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
    """Approve a pending registration (must be in approver role)"""
    try:
        from app.email import send_html_email
        import secrets
        from datetime import timedelta

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

        # Check if user is allowed to approve this registration
        onboarding_code = pending.onboarding_code
        if not onboarding_code:
            return jsonify({'error': 'Onboarding code not found'}), 404

        if not onboarding_code.requireApproval or not onboarding_code.approverRole:
            return jsonify({'error': 'This registration does not require approval'}), 400

        # Check if user has the approver role
        user_role_ids = [role.id for role in user.roles]
        if onboarding_code.approverRoleId not in user_role_ids:
            return jsonify({'error': 'You do not have permission to approve this registration'}), 403

        # Check if expired
        if pending.expires_at < datetime.now():
            return jsonify({'error': 'This registration has expired'}), 400

        # Double-check for duplicates
        if UserModel.get_user_by_username(pending.username):
            PendingRegistrationModel.delete_by_id(pending.id)
            return jsonify({'error': 'Username already exists'}), 409

        # Update status to pending_verification and generate new verification token
        pending.approval_status = 'pending_verification'
        pending.approved_by = user.id
        pending.approved_at = datetime.now()
        pending.verification_token = secrets.token_urlsafe(48)
        pending.expires_at = datetime.now() + timedelta(hours=24)  # Reset expiry for verification

        db.session.commit()

        # Get frontend URL
        frontend_url = get_frontend_url()

        verification_link = f"{frontend_url}/verify-email?token={pending.verification_token}"

        # Send verification email to user
        try:
            verification_message = f"""Hello {pending.firstName},

Great news! Your registration request for OpenTAK Portal has been approved by {user.firstName or user.username}!

To complete your registration, please verify your email address by clicking the link below:

{verification_link}

This link will expire in 24 hours.

Your registration details:
- Username: {pending.username}
- Callsign: {pending.callsign}
- Email: {pending.email}

Once you verify your email, your account will be created and you can log in.

Welcome to the team!
The OpenTAK Team"""

            send_html_email(
                subject='Registration Approved - Verify Your Email',
                recipients=[pending.email],
                message=verification_message,
                title='Registration Approved!',
                link_url=verification_link,
                link_title='Verify Email Address'
            )
        except Exception as e:
            current_app.logger.error(f"Failed to send verification email: {str(e)}")
            return jsonify({'error': f'Approved but failed to send verification email: {str(e)}'}), 500

        current_app.logger.info(f"Registration approved by {user.username} for {pending.username} - verification email sent")

        return jsonify({
            'message': f'Registration approved for {pending.username}. Verification email sent.',
            'pending': {
                'id': pending.id,
                'username': pending.username,
                'email': pending.email,
                'approval_status': pending.approval_status,
                'approved_by': user.username
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
