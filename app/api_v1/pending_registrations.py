"""
Pending Registrations API endpoints
View and manage pending user registrations
"""

from flask import request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt
from app.api_v1 import api_v1
from app.models import PendingRegistrationModel, OnboardingCodeModel, UserModel
from datetime import datetime, timedelta
import secrets
import re


def require_admin_role():
    """Check for administrator role"""
    claims = get_jwt()
    roles = claims.get('roles', [])
    if 'administrator' not in roles:
        return jsonify({'error': 'Administrator role required'}), 403
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
                    'code': p.onboarding_code.onboardingCode
                } if p.onboarding_code else None,
                'created_at': p.created_at.isoformat() if p.created_at else None,
                'expires_at': p.expires_at.isoformat() if p.expires_at else None,
                'is_expired': p.expires_at < datetime.now() if p.expires_at else False
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
                'code': pending.onboarding_code.onboardingCode
            } if pending.onboarding_code else None,
            'created_at': pending.created_at.isoformat() if pending.created_at else None,
            'expires_at': pending.expires_at.isoformat() if pending.expires_at else None,
            'is_expired': pending.expires_at < datetime.now() if pending.expires_at else False,
            'verification_token': pending.verification_token  # Admin can see token
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

        # Generate verification token
        verification_token = secrets.token_urlsafe(48)
        expires_at = datetime.now() + timedelta(hours=24)

        # Create pending registration
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
        frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5000')
        if frontend_url.startswith('http://localhost') or frontend_url.startswith('http://127.0.0.1'):
            if not (request.host.startswith('localhost') or request.host.startswith('127.0.0.1')):
                frontend_url = f"{request.scheme}://{request.host}"

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
        frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5000')
        if frontend_url.startswith('http://localhost') or frontend_url.startswith('http://127.0.0.1'):
            if not (request.host.startswith('localhost') or request.host.startswith('127.0.0.1')):
                frontend_url = f"{request.scheme}://{request.host}"

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
    """Resend verification email and extend expiry by 24 hours (admin only)"""
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

        # Generate new verification token and extend expiry by 24 hours
        pending.verification_token = secrets.token_urlsafe(48)
        pending.expires_at = datetime.now() + timedelta(hours=24)

        from app import db
        db.session.commit()

        # Get frontend URL from config
        frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5000')

        # Auto-detect production URL if FRONTEND_URL is not set or is a localhost value
        if frontend_url.startswith('http://localhost') or frontend_url.startswith('http://127.0.0.1'):
            # Only use localhost if the request is actually from localhost
            if not (request.host.startswith('localhost') or request.host.startswith('127.0.0.1')):
                # For production, use the same host as the API
                frontend_url = f"{request.scheme}://{request.host}"

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
