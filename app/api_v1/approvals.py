"""
Approvals API endpoints
Endpoints for users to view and manage registrations pending their approval
"""

from flask import request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.api_v1 import api_v1
from app.api_v1.auth import get_frontend_url
from app.models import PendingRegistrationModel, OnboardingCodeModel, UserModel, UserRoleModel, db
from datetime import datetime


def get_user_approver_roles(user):
    """Get list of onboarding codes where user's roles are set as approver roles"""
    approver_codes = []
    for role in user.roles:
        # Find onboarding codes where this role is the approver role
        codes = OnboardingCodeModel.query.filter_by(
            approverRoleId=role.id,
            requireApproval=True
        ).all()
        for code in codes:
            if code not in approver_codes:
                approver_codes.append(code)
    return approver_codes


@api_v1.route('/approvals', methods=['GET'])
@jwt_required()
def get_my_approvals():
    """Get pending registrations that the current user can approve"""
    try:
        current_user_id = get_jwt_identity()
        user = UserModel.get_user_by_id(int(current_user_id))

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get onboarding codes where user is an approver
        approver_codes = get_user_approver_roles(user)

        if not approver_codes:
            return jsonify({
                'pending_approvals': [],
                'is_approver': False,
                'message': 'You are not configured as an approver for any onboarding codes'
            }), 200

        # Get pending registrations for these codes that are pending_approval
        code_ids = [code.id for code in approver_codes]
        pending = PendingRegistrationModel.query.filter(
            PendingRegistrationModel.onboarding_code_id.in_(code_ids),
            PendingRegistrationModel.approval_status == 'pending_approval'
        ).all()

        return jsonify({
            'pending_approvals': [{
                'id': p.id,
                'username': p.username,
                'email': p.email,
                'firstName': p.firstName,
                'lastName': p.lastName,
                'callsign': p.callsign,
                'onboarding_code': {
                    'id': p.onboarding_code.id,
                    'name': p.onboarding_code.name,
                    'code': p.onboarding_code.onboardingCode
                } if p.onboarding_code else None,
                'approver_role': {
                    'id': p.onboarding_code.approverRole.id,
                    'name': p.onboarding_code.approverRole.name,
                    'displayName': p.onboarding_code.approverRole.display_name
                } if p.onboarding_code and p.onboarding_code.approverRole else None,
                'created_at': p.created_at.isoformat() if p.created_at else None,
                'expires_at': p.expires_at.isoformat() if p.expires_at else None,
                'is_expired': p.expires_at < datetime.now() if p.expires_at else False
            } for p in pending],
            'is_approver': True,
            'approver_for_codes': [{
                'id': code.id,
                'name': code.name,
                'approver_role': {
                    'id': code.approverRole.id,
                    'name': code.approverRole.name,
                    'displayName': code.approverRole.display_name
                } if code.approverRole else None
            } for code in approver_codes]
        }), 200

    except Exception as e:
        current_app.logger.error(f"Failed to get approvals: {str(e)}")
        return jsonify({'error': f'Failed to get approvals: {str(e)}'}), 400


@api_v1.route('/approvals/<int:pending_id>/approve', methods=['POST'])
@jwt_required()
def approve_pending(pending_id):
    """Approve a pending registration and create user directly (must be in approver role)"""
    try:
        from app.email import send_html_email
        from app.ots import OTSClient

        current_user_id = get_jwt_identity()
        approver = UserModel.get_user_by_id(int(current_user_id))

        if not approver:
            return jsonify({'error': 'User not found'}), 404

        # Get the pending registration
        pending = PendingRegistrationModel.query.get(pending_id)
        if not pending:
            return jsonify({'error': 'Pending registration not found'}), 404

        if pending.approval_status != 'pending_approval':
            return jsonify({'error': f'Registration is not pending approval (status: {pending.approval_status})'}), 400

        # Check if user is allowed to approve this registration
        onboarding_code = pending.onboarding_code
        if not onboarding_code:
            return jsonify({'error': 'Onboarding code not found'}), 404

        if not onboarding_code.requireApproval or not onboarding_code.approverRole:
            return jsonify({'error': 'This registration does not require approval'}), 400

        # Check if approver has the approver role
        approver_role_ids = [role.id for role in approver.roles]
        if onboarding_code.approverRoleId not in approver_role_ids:
            return jsonify({'error': 'You do not have permission to approve this registration'}), 403

        # Check if expired
        if pending.expires_at < datetime.now():
            return jsonify({'error': 'This registration has expired'}), 400

        # Double-check for duplicates
        if UserModel.get_user_by_username(pending.username):
            PendingRegistrationModel.delete_by_id(pending.id)
            return jsonify({'error': 'Username already exists'}), 409

        if UserModel.query.filter_by(email=pending.email).first():
            PendingRegistrationModel.delete_by_id(pending.id)
            return jsonify({'error': 'Email already registered'}), 409

        # Create user in OTS
        current_app.logger.info(f"Creating user {pending.username} in OTS (approved by {approver.username})")
        ots = OTSClient(current_app.config['OTS_URL'], current_app.config['OTS_USERNAME'], current_app.config['OTS_PASSWORD'])

        # Prepare roles from onboarding code - OTS only supports 'user' and 'administrator'
        ots_roles = ['user']  # Default role
        if onboarding_code.roles:
            role_names = [role.name.lower() for role in onboarding_code.roles]
            if any(r in ['administrator', 'admin'] for r in role_names):
                ots_roles = ['administrator']

        try:
            ots_response = ots.create_user(
                username=pending.username,
                password=pending.password,
                roles=ots_roles
            )
            current_app.logger.info(f"OTS user creation successful for {pending.username}")
        except Exception as e:
            error_msg = str(e)
            current_app.logger.error(f"OTS user creation failed: {error_msg}")
            if 'can contain only' in error_msg.lower() or 'username' in error_msg.lower():
                return jsonify({'error': 'Username contains invalid characters'}), 400
            return jsonify({'error': f'Failed to create user in TAK server: {error_msg}'}), 500

        # Create user in local database
        expiry_date = onboarding_code.userExpiryDate if onboarding_code.userExpiryDate else None

        new_user = UserModel.create_user(
            username=pending.username,
            email=pending.email,
            firstname=pending.firstName,
            lastname=pending.lastName,
            callsign=pending.callsign,
            expirydate=expiry_date,
            onboardedby=onboarding_code.onboardContact.username if onboarding_code.onboardContact else None
        )

        if isinstance(new_user, dict) and 'error' in new_user:
            return jsonify({'error': 'Failed to create user in local database'}), 500

        # Mark email as verified (admin approved)
        new_user.emailVerified = True

        # Add roles from onboarding code
        for role in onboarding_code.roles:
            new_user.roles.append(role)

        # Add TAK profiles from onboarding code roles
        for role in onboarding_code.roles:
            for tak_profile in role.takprofiles:
                if tak_profile not in new_user.takprofiles:
                    new_user.takprofiles.append(tak_profile)

        # Add Meshtastic configs from onboarding code roles
        for role in onboarding_code.roles:
            for meshtastic in role.meshtastic:
                if meshtastic not in new_user.meshtastic:
                    new_user.meshtastic.append(meshtastic)

        # Increment onboarding code uses
        onboarding_code.uses += 1

        # Update pending registration status before deleting
        pending.approval_status = 'approved'
        pending.approved_by = approver.id
        pending.approved_at = datetime.now()

        db.session.commit()

        # Delete pending registration
        PendingRegistrationModel.delete_by_id(pending.id)

        # Get frontend URL for welcome email
        frontend_url = get_frontend_url()

        # Send welcome email to new user
        try:
            welcome_message = f"""Hello {new_user.firstName},

Great news! Your registration request for OpenTAK Portal has been approved by {approver.firstName or approver.username}!

Your account is now active and you can log in immediately.

Your Account Details:
- Username: {new_user.username}
- Email: {new_user.email}
- Callsign: {new_user.callsign}

Getting Started:
1. Login to the portal at {frontend_url}/login
2. Download your TAK certificates from your dashboard
3. Configure your TAK devices with your certificates
4. Join the network and start collaborating!

Welcome to the team!
The OpenTAK Team"""

            send_html_email(
                subject='Welcome to OpenTAK Portal - Registration Approved!',
                recipients=[new_user.email],
                message=welcome_message,
                title='Welcome to OpenTAK!',
                link_url=f"{frontend_url}/login",
                link_title='Login to Portal'
            )
        except Exception as e:
            current_app.logger.error(f"Failed to send welcome email: {str(e)}")
            # Don't fail the approval if email fails

        current_app.logger.info(f"Registration approved and user created by {approver.username} for {pending.username}")

        return jsonify({
            'message': f'Registration approved! User {new_user.username} has been created and can now log in.',
            'user': {
                'id': new_user.id,
                'username': new_user.username,
                'email': new_user.email,
                'callsign': new_user.callsign,
                'approved_by': approver.username
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Failed to approve registration: {str(e)}")
        return jsonify({'error': f'Failed to approve registration: {str(e)}'}), 400


@api_v1.route('/approvals/<int:pending_id>/reject', methods=['POST'])
@jwt_required()
def reject_pending(pending_id):
    """Reject a pending registration (must be in approver role)"""
    try:
        from app.email import send_html_email

        current_user_id = get_jwt_identity()
        user = UserModel.get_user_by_id(int(current_user_id))

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get the pending registration
        pending = PendingRegistrationModel.query.get(pending_id)
        if not pending:
            return jsonify({'error': 'Pending registration not found'}), 404

        if pending.approval_status != 'pending_approval':
            return jsonify({'error': f'Registration is not pending approval (status: {pending.approval_status})'}), 400

        # Check if user is allowed to reject this registration
        onboarding_code = pending.onboarding_code
        if not onboarding_code:
            return jsonify({'error': 'Onboarding code not found'}), 404

        if not onboarding_code.requireApproval or not onboarding_code.approverRole:
            return jsonify({'error': 'This registration does not require approval'}), 400

        # Check if user has the approver role
        user_role_ids = [role.id for role in user.roles]
        if onboarding_code.approverRoleId not in user_role_ids:
            return jsonify({'error': 'You do not have permission to reject this registration'}), 403

        username = pending.username
        email = pending.email
        first_name = pending.firstName

        # Send rejection email to user
        try:
            rejection_message = f"""Hello {first_name},

We regret to inform you that your registration request for OpenTAK Portal has been declined.

If you believe this was in error or have any questions, please contact your administrator.

Thank you for your interest in OpenTAK.

Best regards,
The OpenTAK Team"""

            send_html_email(
                subject='Registration Request Declined - OpenTAK Portal',
                recipients=[email],
                message=rejection_message,
                title='Registration Declined'
            )
        except Exception as e:
            current_app.logger.error(f"Failed to send rejection email: {str(e)}")

        # Delete the pending registration
        PendingRegistrationModel.delete_by_id(pending.id)

        current_app.logger.info(f"Registration rejected by {user.username} for {username}")

        return jsonify({
            'message': f'Registration rejected for {username}',
            'rejected_by': user.username
        }), 200

    except Exception as e:
        current_app.logger.error(f"Failed to reject registration: {str(e)}")
        return jsonify({'error': f'Failed to reject registration: {str(e)}'}), 400


@api_v1.route('/approvals/check', methods=['GET'])
@jwt_required()
def check_approver_status():
    """Check if current user is an approver for any onboarding codes"""
    try:
        current_user_id = get_jwt_identity()
        user = UserModel.get_user_by_id(int(current_user_id))

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get onboarding codes where user is an approver
        approver_codes = get_user_approver_roles(user)

        # Count pending approvals
        pending_count = 0
        if approver_codes:
            code_ids = [code.id for code in approver_codes]
            pending_count = PendingRegistrationModel.query.filter(
                PendingRegistrationModel.onboarding_code_id.in_(code_ids),
                PendingRegistrationModel.approval_status == 'pending_approval'
            ).count()

        return jsonify({
            'is_approver': len(approver_codes) > 0,
            'pending_count': pending_count,
            'approver_for_codes': [{
                'id': code.id,
                'name': code.name
            } for code in approver_codes]
        }), 200

    except Exception as e:
        current_app.logger.error(f"Failed to check approver status: {str(e)}")
        return jsonify({'error': f'Failed to check approver status: {str(e)}'}), 400
