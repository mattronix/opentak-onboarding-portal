"""
Pending Registrations API endpoints
View and manage pending user registrations
"""

from flask import request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt
from app.api_v1 import api_v1
from app.models import PendingRegistrationModel
from datetime import datetime


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
    """Resend verification email (admin only)"""
    error = require_admin_role()
    if error:
        return error

    try:
        from app.email import send_html_email

        pending = PendingRegistrationModel.query.get(pending_id)

        if not pending:
            return jsonify({'error': 'Pending registration not found'}), 404

        # Check if expired
        if pending.expires_at < datetime.now():
            return jsonify({'error': 'Verification link has expired. User must register again.'}), 400

        # Get frontend URL - auto-detect from request if not configured
        frontend_url = current_app.config.get('FRONTEND_URL')
        if not frontend_url or frontend_url == 'http://localhost:5173':
            # Auto-detect: use same host as API request
            if request.host.startswith('localhost') or request.host.startswith('127.0.0.1'):
                frontend_url = 'http://localhost:5173'
            else:
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
