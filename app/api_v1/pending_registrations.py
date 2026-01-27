"""
Pending Registrations API endpoints
View and manage pending user registrations
"""

from flask import request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt
from app.api_v1 import api_v1
from app.api_v1.auth import get_frontend_url
from app.models import PendingRegistrationModel, OnboardingCodeModel, UserModel
from datetime import datetime, timedelta
import secrets
import re


def require_admin_role():
    """Check for registration_admin or administrator role"""
    from app.rbac import has_any_role
    if not has_any_role(['administrator', 'registration_admin']):
        return jsonify({'error': 'Registration admin access required'}), 403
    return None


@api_v1.route('/pending-registrations', methods=['GET'])
@jwt_required()
def get_pending_registrations():
    """Get all pending registrations (admin only)"""
    error = require_admin_role()
    if error:
        return error

    try:
        # Get all pending registrations
        pending = PendingRegistrationModel.query.all()

        return jsonify({
            'pending_registrations': [{
                'id': p.id,
                'username': p.username,
                'email': p.email,
                'firstName': p.firstName,
                'lastName': p.lastName,
                'callsign': p.callsign,
                'onboarding_code_id': p.onboarding_code_id,
                'onboarding_code': {
                    'id': p.onboarding_code.id,
                    'name': p.onboarding_code.name,
                    'code': p.onboarding_code.onboardingCode,
                    'requireApproval': p.onboarding_code.requireApproval,
                    'approverRole': {
                        'id': p.onboarding_code.approverRole.id,
                        'name': p.onboarding_code.approverRole.name,
                        'displayName': p.onboarding_code.approverRole.display_name
                    } if p.onboarding_code.approverRole else None
                } if p.onboarding_code else None,
                'created_at': p.created_at.isoformat() if p.created_at else None,
                'expires_at': p.expires_at.isoformat() if p.expires_at else None,
                'is_expired': p.expires_at < datetime.now() if p.expires_at else False,
                'approval_status': p.approval_status,
                'approved_at': p.approved_at.isoformat() if p.approved_at else None,
                'approved_by': {
                    'id': p.approver.id,
                    'username': p.approver.username,
                    'firstName': p.approver.firstName,
                    'lastName': p.approver.lastName
                } if p.approver else None
            } for p in pending]
        }), 200

    except Exception as e:
        current_app.logger.error(f"Failed to get pending registrations: {str(e)}")
        return jsonify({'error': f'Failed to get pending registrations: {str(e)}'}), 400


@api_v1.route('/pending-registrations/<int:pending_id>', methods=['GET'])
@jwt_required()
def get_pending_registration(pending_id):
    """Get specific pending registration (admin only)"""
    error = require_admin_role()
    if error:
        return error

    try:
        pending = PendingRegistrationModel.query.get(pending_id)

        if not pending:
            return jsonify({'error': 'Pending registration not found'}), 404

        return jsonify({
            'id': pending.id,
            'username': pending.username,
            'email': pending.email,
            'firstName': pending.firstName,
            'lastName': pending.lastName,
            'callsign': pending.callsign,
            'onboarding_code_id': pending.onboarding_code_id,
            'onboarding_code': {
                'id': pending.onboarding_code.id,
                'name': pending.onboarding_code.name,
                'code': pending.onboarding_code.onboardingCode,
                'requireApproval': pending.onboarding_code.requireApproval,
                'approverRole': {
                    'id': pending.onboarding_code.approverRole.id,
                    'name': pending.onboarding_code.approverRole.name,
                    'displayName': pending.onboarding_code.approverRole.display_name
                } if pending.onboarding_code.approverRole else None
            } if pending.onboarding_code else None,
            'created_at': pending.created_at.isoformat() if pending.created_at else None,
            'expires_at': pending.expires_at.isoformat() if pending.expires_at else None,
            'is_expired': pending.expires_at < datetime.now() if pending.expires_at else False,
            'verification_token': pending.verification_token,  # Admin can see token
            'approval_status': pending.approval_status,
            'approved_at': pending.approved_at.isoformat() if pending.approved_at else None,
            'approved_by': {
                'id': pending.approver.id,
                'username': pending.approver.username,
                'firstName': pending.approver.firstName,
                'lastName': pending.approver.lastName
            } if pending.approver else None
        }), 200

    except Exception as e:
        current_app.logger.error(f"Failed to get pending registration: {str(e)}")
        return jsonify({'error': f'Failed to get pending registration: {str(e)}'}), 400


@api_v1.route('/pending-registrations', methods=['POST'])
@jwt_required()
def create_pending_registration():
    """Create a new pending registration manually (admin only)"""
    error = require_admin_role()
    if error:
        return error

    try:
        from app.email import send_html_email

        data = request.get_json()

        # Validate required fields
        required_fields = ['username', 'password', 'email', 'firstName', 'lastName', 'callsign', 'onboarding_code_id']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400

        # Convert username to lowercase and remove spaces
        username = data['username'].lower().strip()

        # Validate username format (only letters and numbers)
        username_pattern = r'^[a-z0-9]+$'
        if not re.match(username_pattern, username):
            return jsonify({'error': 'Username can only contain letters and numbers (no spaces, underscores, or periods)'}), 400

        # Validate username length
        if len(username) < 3 or len(username) > 32:
            return jsonify({'error': 'Username must be between 3 and 32 characters'}), 400

        # Validate email format
        if '@' not in data['email'] or '.' not in data['email']:
            return jsonify({'error': 'Invalid email format'}), 400

        # Check for duplicate username
        if UserModel.get_user_by_username(username):
            return jsonify({'error': 'Username already exists'}), 409

        if PendingRegistrationModel.query.filter_by(username=username).first():
            return jsonify({'error': 'Username already pending verification'}), 409

        # Check for duplicate email
        if UserModel.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already registered'}), 409

        if PendingRegistrationModel.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already pending verification'}), 409

        # Validate onboarding code
        onboarding_code = OnboardingCodeModel.get_onboarding_code_by_id(data['onboarding_code_id'])
        if not onboarding_code:
            return jsonify({'error': 'Invalid onboarding code'}), 400

        # Check if auto-approve is enabled on the onboarding code
        if onboarding_code.autoApprove:
            # Auto-approve: Create user directly without email verification
            from app.ots import OTSClient
            from app import db

            current_app.logger.info(f"Auto-approve enabled - creating user {username} directly")

            # Create user in OTS
            ots = OTSClient(current_app.config['OTS_URL'], current_app.config['OTS_USERNAME'], current_app.config['OTS_PASSWORD'])

            # Prepare roles from onboarding code
            ots_roles = ['user']
            if onboarding_code.roles:
                role_names = [role.name.lower() for role in onboarding_code.roles]
                if any(r in ['administrator', 'admin'] for r in role_names):
                    ots_roles = ['administrator']

            try:
                ots.create_user(username=username, password=data['password'], roles=ots_roles)
            except Exception as e:
                error_msg = str(e)
                current_app.logger.error(f"OTS user creation failed: {error_msg}")
                if 'can contain only' in error_msg.lower() or 'username' in error_msg.lower():
                    return jsonify({'error': 'Username contains invalid characters'}), 400
                return jsonify({'error': f'Failed to create user in TAK server: {error_msg}'}), 500

            # Create user in local database
            expiry_date = onboarding_code.userExpiryDate if onboarding_code.userExpiryDate else None
            user = UserModel.create_user(
                username=username,
                email=data['email'],
                firstname=data['firstName'],
                lastname=data['lastName'],
                callsign=data['callsign'],
                expirydate=expiry_date,
                onboardedby=onboarding_code.onboardContact.username if onboarding_code.onboardContact else None
            )

            if isinstance(user, dict) and 'error' in user:
                return jsonify({'error': 'User already exists'}), 409

            user.emailVerified = True

            # Add roles and profiles from onboarding code
            for role in onboarding_code.roles:
                user.roles.append(role)
            for role in onboarding_code.roles:
                for tak_profile in role.takprofiles:
                    if tak_profile not in user.takprofiles:
                        user.takprofiles.append(tak_profile)
            for role in onboarding_code.roles:
                for meshtastic in role.meshtastic:
                    if meshtastic not in user.meshtastic:
                        user.meshtastic.append(meshtastic)

            onboarding_code.uses += 1
            db.session.commit()

            # Send welcome email
            frontend_url = get_frontend_url()

            try:
                welcome_message = f"""Welcome to OpenTAK, {user.firstName}!

Your account has been created by an administrator and is now active.

Your Account Details:
- Username: {user.username}
- Email: {user.email}
- Callsign: {user.callsign}

Getting Started:
1. Login to the portal at {frontend_url}/login
2. Download your TAK certificates from your dashboard
3. Configure your TAK devices with your certificates

Welcome aboard!
The OpenTAK Team"""

                send_html_email(
                    subject='Welcome to OpenTAK Portal!',
                    recipients=[user.email],
                    message=welcome_message,
                    title='Welcome to OpenTAK!',
                    link_url=f"{frontend_url}/login",
                    link_title='Login to Portal'
                )
            except Exception as e:
                current_app.logger.error(f"Failed to send welcome email: {str(e)}")

            current_app.logger.info(f"Admin auto-approved user {username} ({data['email']})")

            return jsonify({
                'message': f'User {username} created successfully (auto-approved)',
                'auto_approved': True,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email
                }
            }), 201

        # Standard flow: Create pending registration and send verification email
        verification_token = secrets.token_urlsafe(48)
        expires_at = datetime.now() + timedelta(hours=24)

        pending = PendingRegistrationModel.create_pending_registration(
            username=username,
            email=data['email'],
            password=data['password'],
            first_name=data['firstName'],
            last_name=data['lastName'],
            callsign=data['callsign'],
            onboarding_code_id=data['onboarding_code_id'],
            verification_token=verification_token,
            expires_at=expires_at
        )

        if not pending:
            return jsonify({'error': 'Failed to create pending registration'}), 500

        # Send verification email
        frontend_url = get_frontend_url()

        verification_link = f"{frontend_url}/verify-email?token={verification_token}"

        welcome_message = f"""Hello {data['firstName']} {data['lastName']},

Thank you for registering with OpenTAK Onboarding Portal!

Please click the link below to verify your email address and complete your registration:

{verification_link}

This link will expire on {expires_at.strftime('%Y-%m-%d at %H:%M')}.

Your registration details:
- Username: {username}
- Callsign: {data['callsign']}
- Email: {data['email']}

If you did not request this registration, please ignore this email.

Welcome to the team!"""

        send_html_email(
            subject='Verify Your Email - OpenTAK Portal',
            recipients=[data['email']],
            message=welcome_message,
            title='Please Verify Your Email',
            link_url=verification_link,
            link_title='Verify Email Address'
        )

        current_app.logger.info(f"Admin created pending registration for {username} ({data['email']})")

        # Send notification to admins about pending registration
        try:
            from app.notifications import notify_admin_pending_registration
            notify_admin_pending_registration(
                username=username,
                email=data['email'],
                first_name=data['firstName'],
                last_name=data['lastName'],
                callsign=data['callsign']
            )
        except Exception as e:
            current_app.logger.error(f"Failed to send admin notification: {str(e)}")

        return jsonify({
            'message': 'Pending registration created successfully',
            'id': pending.id,
            'username': pending.username,
            'email': pending.email,
            'expires_at': pending.expires_at.isoformat()
        }), 201

    except Exception as e:
        current_app.logger.error(f"Failed to create pending registration: {str(e)}")
        return jsonify({'error': f'Failed to create pending registration: {str(e)}'}), 400


@api_v1.route('/pending-registrations/<int:pending_id>', methods=['PUT'])
@jwt_required()
def update_pending_registration(pending_id):
    """Update a pending registration and resend verification email (admin only)"""
    error = require_admin_role()
    if error:
        return error

    try:
        from app.email import send_html_email

        pending = PendingRegistrationModel.query.get(pending_id)
        if not pending:
            return jsonify({'error': 'Pending registration not found'}), 404

        data = request.get_json()

        # Update fields if provided
        if 'username' in data:
            username = data['username'].lower().strip()
            username_pattern = r'^[a-z0-9]+$'
            if not re.match(username_pattern, username):
                return jsonify({'error': 'Username can only contain letters and numbers'}), 400
            if len(username) < 3 or len(username) > 32:
                return jsonify({'error': 'Username must be between 3 and 32 characters'}), 400
            # Check for duplicates (excluding current pending)
            if UserModel.get_user_by_username(username):
                return jsonify({'error': 'Username already exists'}), 409
            existing_pending = PendingRegistrationModel.query.filter_by(username=username).first()
            if existing_pending and existing_pending.id != pending_id:
                return jsonify({'error': 'Username already pending verification'}), 409
            pending.username = username

        if 'email' in data:
            if '@' not in data['email'] or '.' not in data['email']:
                return jsonify({'error': 'Invalid email format'}), 400
            # Check for duplicates (excluding current pending)
            if UserModel.query.filter_by(email=data['email']).first():
                return jsonify({'error': 'Email already registered'}), 409
            existing_pending = PendingRegistrationModel.query.filter_by(email=data['email']).first()
            if existing_pending and existing_pending.id != pending_id:
                return jsonify({'error': 'Email already pending verification'}), 409
            pending.email = data['email']

        if 'password' in data:
            pending.password = data['password']

        if 'firstName' in data:
            pending.firstName = data['firstName']

        if 'lastName' in data:
            pending.lastName = data['lastName']

        if 'callsign' in data:
            pending.callsign = data['callsign']

        if 'onboarding_code_id' in data:
            onboarding_code = OnboardingCodeModel.get_onboarding_code_by_id(data['onboarding_code_id'])
            if not onboarding_code:
                return jsonify({'error': 'Invalid onboarding code'}), 400
            pending.onboarding_code_id = data['onboarding_code_id']

        # Generate new verification token and extend expiry
        pending.verification_token = secrets.token_urlsafe(48)
        pending.expires_at = datetime.now() + timedelta(hours=24)

        from app import db
        db.session.commit()

        # Send new verification email
        frontend_url = get_frontend_url()

        verification_link = f"{frontend_url}/verify-email?token={pending.verification_token}"

        welcome_message = f"""Hello {pending.firstName} {pending.lastName},

Your registration details have been updated. Please verify your email address to complete your registration:

{verification_link}

This link will expire on {pending.expires_at.strftime('%Y-%m-%d at %H:%M')}.

Your updated registration details:
- Username: {pending.username}
- Callsign: {pending.callsign}
- Email: {pending.email}

If you did not request this update, please contact an administrator.

Welcome to the team!"""

        send_html_email(
            subject='Verify Your Updated Email - OpenTAK Portal',
            recipients=[pending.email],
            message=welcome_message,
            title='Please Verify Your Email',
            link_url=verification_link,
            link_title='Verify Email Address'
        )

        current_app.logger.info(f"Admin updated pending registration for {pending.username} ({pending.email})")

        return jsonify({
            'message': 'Pending registration updated and verification email sent',
            'id': pending.id,
            'username': pending.username,
            'email': pending.email,
            'expires_at': pending.expires_at.isoformat()
        }), 200

    except Exception as e:
        current_app.logger.error(f"Failed to update pending registration: {str(e)}")
        return jsonify({'error': f'Failed to update pending registration: {str(e)}'}), 400


@api_v1.route('/pending-registrations/<int:pending_id>', methods=['DELETE'])
@jwt_required()
def delete_pending_registration(pending_id):
    """Delete pending registration (admin only)"""
    error = require_admin_role()
    if error:
        return error

    try:
        pending = PendingRegistrationModel.query.get(pending_id)

        if not pending:
            return jsonify({'error': 'Pending registration not found'}), 404

        username = pending.username
        email = pending.email

        # Delete the pending registration
        success = PendingRegistrationModel.delete_by_id(pending_id)

        if not success:
            return jsonify({'error': 'Failed to delete pending registration'}), 400

        current_app.logger.info(f"Admin deleted pending registration for {username} ({email})")

        return jsonify({
            'message': f'Pending registration for {username} deleted successfully'
        }), 200

    except Exception as e:
        current_app.logger.error(f"Failed to delete pending registration: {str(e)}")
        return jsonify({'error': f'Failed to delete pending registration: {str(e)}'}), 400


@api_v1.route('/pending-registrations/cleanup-expired', methods=['POST'])
@jwt_required()
def cleanup_expired_registrations():
    """Clean up all expired pending registrations (admin only)"""
    error = require_admin_role()
    if error:
        return error

    try:
        count = PendingRegistrationModel.cleanup_expired()

        current_app.logger.info(f"Admin cleaned up {count} expired pending registrations")

        return jsonify({
            'message': f'Cleaned up {count} expired pending registrations'
        }), 200

    except Exception as e:
        current_app.logger.error(f"Failed to cleanup expired registrations: {str(e)}")
        return jsonify({'error': f'Failed to cleanup expired registrations: {str(e)}'}), 400


@api_v1.route('/pending-registrations/<int:pending_id>/resend', methods=['POST'])
@jwt_required()
def resend_verification_email(pending_id):
    """Resend verification email and extend expiry by 24 hours (admin only)

    Only works for registrations in 'pending_verification' status.
    For registrations pending approval, the approval workflow must be used.
    """
    error = require_admin_role()
    if error:
        return error

    try:
        from app.email import send_html_email
        from datetime import timedelta
        import secrets

        pending = PendingRegistrationModel.query.get(pending_id)

        if not pending:
            return jsonify({'error': 'Pending registration not found'}), 404

        # Only allow resending for pending_verification status
        if pending.approval_status == 'pending_approval':
            return jsonify({'error': 'This registration is pending approval. Resend is only available for email verification.'}), 400

        # Generate new verification token and extend expiry by 24 hours
        pending.verification_token = secrets.token_urlsafe(48)
        pending.expires_at = datetime.now() + timedelta(hours=24)

        from app import db
        db.session.commit()

        # Get frontend URL
        frontend_url = get_frontend_url()

        verification_link = f"{frontend_url}/verify-email?token={pending.verification_token}"

        welcome_message = f"""Hello {pending.firstName} {pending.lastName},

This is a reminder to verify your email address for your OpenTAK Portal registration.

Please click the link below to complete your registration:

{verification_link}

This link will expire on {pending.expires_at.strftime('%Y-%m-%d at %H:%M')}.

Your registration details:
- Username: {pending.username}
- Callsign: {pending.callsign}
- Email: {pending.email}

If you did not request this registration, please ignore this email.

Welcome to the team!"""

        send_html_email(
            subject='Verify Your Email - OpenTAK Portal (Reminder)',
            recipients=[pending.email],
            message=welcome_message,
            title='Please Verify Your Email',
            link_url=verification_link,
            link_title='Verify Email Address'
        )

        current_app.logger.info(f"Admin resent verification email to {pending.email} for user {pending.username}")

        return jsonify({
            'message': f'Verification email resent to {pending.email}'
        }), 200

    except Exception as e:
        current_app.logger.error(f"Failed to resend verification email: {str(e)}")
        return jsonify({'error': f'Failed to resend verification email: {str(e)}'}), 400


@api_v1.route('/pending-registrations/<int:pending_id>/approve', methods=['POST'])
@jwt_required()
def approve_pending_registration(pending_id):
    """Manually approve a pending registration without email verification (admin only)"""
    error = require_admin_role()
    if error:
        return error

    try:
        from app.models import SystemSettingsModel, UserRoleModel
        from app.ots import OTSClient
        from app.email import send_html_email

        # Check if manual approval is enabled
        allow_manual_approval = SystemSettingsModel.get_setting('allow_manual_approval', True)
        if allow_manual_approval is not True and allow_manual_approval != 'true':
            return jsonify({'error': 'Manual approval is disabled in settings'}), 403

        pending = PendingRegistrationModel.query.get(pending_id)
        if not pending:
            return jsonify({'error': 'Pending registration not found'}), 404

        # Get onboarding code
        onboarding_code = OnboardingCodeModel.get_onboarding_code_by_id(pending.onboarding_code_id)
        if not onboarding_code:
            return jsonify({'error': 'Onboarding code no longer valid'}), 400

        # Check for duplicates before creating
        if UserModel.get_user_by_username(pending.username):
            PendingRegistrationModel.delete_by_id(pending.id)
            return jsonify({'error': 'Username already exists'}), 409

        if UserModel.query.filter_by(email=pending.email).first():
            PendingRegistrationModel.delete_by_id(pending.id)
            return jsonify({'error': 'Email already registered'}), 409

        # Create user in OTS
        ots = OTSClient(current_app.config['OTS_URL'], current_app.config['OTS_USERNAME'], current_app.config['OTS_PASSWORD'])

        # Prepare roles from onboarding code - OTS only supports 'user' and 'administrator'
        ots_roles = ['user']  # Default role
        if onboarding_code.roles:
            role_names = [role.name.lower() for role in onboarding_code.roles]
            if any(r in ['administrator', 'admin'] for r in role_names):
                ots_roles = ['administrator']
            else:
                ots_roles = ['user']

        # Create user in OTS
        try:
            ots_response = ots.create_user(
                username=pending.username,
                password=pending.password,
                roles=ots_roles
            )
        except Exception as e:
            error_msg = str(e)
            if 'can contain only' in error_msg.lower() or 'username' in error_msg.lower():
                PendingRegistrationModel.delete_by_id(pending.id)
                return jsonify({
                    'error': 'Username contains invalid characters. Username can only contain letters and numbers.'
                }), 400
            raise

        # Create user in local database
        expiry_date = onboarding_code.userExpiryDate if onboarding_code.userExpiryDate else None

        user = UserModel.create_user(
            username=pending.username,
            email=pending.email,
            firstname=pending.firstName,
            lastname=pending.lastName,
            callsign=pending.callsign,
            expirydate=expiry_date,
            onboardedby=onboarding_code.onboardContact.username if onboarding_code.onboardContact else None
        )

        if isinstance(user, dict) and 'error' in user:
            return jsonify({'error': 'User already exists'}), 409

        # Mark email as verified (admin approved)
        user.emailVerified = True

        # Add roles from onboarding code
        for role in onboarding_code.roles:
            user.roles.append(role)

        # Add TAK profiles from onboarding code roles
        for role in onboarding_code.roles:
            for tak_profile in role.takprofiles:
                if tak_profile not in user.takprofiles:
                    user.takprofiles.append(tak_profile)

        # Add Meshtastic configs from onboarding code roles
        for role in onboarding_code.roles:
            for meshtastic in role.meshtastic:
                if meshtastic not in user.meshtastic:
                    user.meshtastic.append(meshtastic)

        # Increment onboarding code uses
        onboarding_code.uses += 1

        # Commit all changes
        from app import db
        db.session.commit()

        # Delete pending registration
        PendingRegistrationModel.delete_by_id(pending.id)

        # Send welcome email to new user
        try:
            frontend_url = get_frontend_url()

            welcome_message = f"""Welcome to OpenTAK, {user.firstName}!

Your account has been approved by an administrator and is now active. You can now start using the OpenTAK Portal.

Your Account Details:
- Username: {user.username}
- Email: {user.email}
- Callsign: {user.callsign}

Getting Started:
1. Login to the portal at {frontend_url}/login
2. Download your TAK certificates from your dashboard
3. Configure your TAK devices with your certificates
4. Join the network and start collaborating!

Need Help?
If you have any questions or need assistance, please contact your onboard coordinator or visit our help center.

Welcome aboard!
The OpenTAK Team"""

            send_html_email(
                subject='Welcome to OpenTAK Portal - Account Approved!',
                recipients=[user.email],
                message=welcome_message,
                title='Welcome to OpenTAK!',
                link_url=f"{frontend_url}/login",
                link_title='Login to Portal'
            )
        except Exception as e:
            current_app.logger.error(f"Failed to send welcome email: {str(e)}")

        # Send notification to admins
        try:
            from app.notifications import notify_admin_new_registration
            notify_admin_new_registration(
                username=user.username,
                email=user.email,
                first_name=user.firstName,
                last_name=user.lastName,
                callsign=user.callsign
            )
        except Exception as e:
            current_app.logger.error(f"Failed to send admin notification: {str(e)}")

        current_app.logger.info(f"Admin manually approved registration for {user.username} ({user.email})")

        return jsonify({
            'message': f'Registration approved for {user.username}',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'callsign': user.callsign
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Failed to approve pending registration: {str(e)}")
        return jsonify({'error': f'Failed to approve registration: {str(e)}'}), 400
