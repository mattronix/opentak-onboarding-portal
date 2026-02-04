"""
Magic Link authentication endpoints.
Allows passwordless login via email link.
"""

from flask import request, jsonify, current_app
from flask_jwt_extended import create_access_token, create_refresh_token
from datetime import timedelta, datetime
from app.api_v1 import api_v1
from app.models import db, UserModel, OneTimeTokenModel, SystemSettingsModel
from app.email import send_html_email
from app.api_v1.auth import get_frontend_url
import secrets
import threading


@api_v1.route('/auth/magic-link', methods=['POST'])
def request_magic_link():
    """
    Request a magic login link (public, no auth required).
    Sends an email with a one-time login link.
    Always returns success to prevent user enumeration.
    """
    enabled = SystemSettingsModel.get_setting('magic_link_login_enabled', False)
    if enabled not in [True, 'true', 'True']:
        return jsonify({'error': 'Magic link login is disabled'}), 403

    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    email = data.get('email', '').strip().lower()
    if not email:
        return jsonify({'error': 'Email is required'}), 400

    # Always return success regardless of whether user exists (security)
    success_message = 'If an account exists with that email, you will receive a login link'

    try:
        user = UserModel.query.filter_by(email=email).first()
        if not user:
            return jsonify({'message': success_message}), 200

        # Delete any existing magic_login tokens for this user
        OneTimeTokenModel.query.filter_by(
            user_id=user.id,
            token_type='magic_login'
        ).delete()
        db.session.commit()

        # Generate token
        token = secrets.token_urlsafe(48)

        # Get expiry from settings
        expiry_str = SystemSettingsModel.get_setting('magic_link_expiry_minutes', '15')
        try:
            expiry_minutes = int(expiry_str)
        except (ValueError, TypeError):
            expiry_minutes = 15

        expires_at = datetime.utcnow() + timedelta(minutes=expiry_minutes)

        # Create token record
        OneTimeTokenModel.create_token(
            user_id=user.id,
            token=token,
            token_type='magic_login',
            expires_at=expires_at
        )

        # Build login URL
        frontend_url = get_frontend_url()
        login_url = f"{frontend_url}/login?magic_token={token}"

        # Get brand name for email
        brand_name = SystemSettingsModel.get_setting('brand_name_value', 'OpenTAK Portal')

        # Send email in background thread to avoid blocking the response
        message = f"""Hello {user.username},

You requested a login link for {brand_name}. Click the button below to log in:

This link will expire in {expiry_minutes} minutes and can only be used once.

If you didn't request this login link, you can safely ignore this email."""

        app = current_app._get_current_object()
        email_args = dict(
            subject=f'Login Link - {brand_name}',
            recipients=[user.email],
            message=message,
            title=f'Login to {brand_name}',
            link_url=login_url,
            link_title='Login Now'
        )

        def send_in_background(app, email_args, user_email):
            with app.app_context():
                try:
                    send_html_email(**email_args)
                    app.logger.info(f"Magic link sent to {user_email}")
                except Exception as e:
                    app.logger.error(f"Error sending magic link email: {str(e)}")

        thread = threading.Thread(
            target=send_in_background,
            args=(app, email_args, user.email)
        )
        thread.daemon = True
        thread.start()

    except Exception as e:
        current_app.logger.error(f"Error preparing magic link: {str(e)}")
        # Still return success to prevent user enumeration

    return jsonify({'message': success_message}), 200


@api_v1.route('/auth/magic-link/verify', methods=['POST'])
def verify_magic_link():
    """
    Verify a magic link token and return JWT tokens (public, no auth required).
    Returns tokens and user state flags (needs_password, needs_profile).
    """
    enabled = SystemSettingsModel.get_setting('magic_link_login_enabled', False)
    if enabled not in [True, 'true', 'True']:
        return jsonify({'error': 'Magic link login is disabled'}), 403

    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    token = data.get('token')
    if not token:
        return jsonify({'error': 'Token is required'}), 400

    # Validate and consume the token
    result = OneTimeTokenModel.validate_and_use_token(token, 'magic_login')
    if not result:
        return jsonify({'error': 'Invalid or expired magic link'}), 400

    user_id = result
    user = UserModel.get_user_by_id(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Create JWT tokens (same pattern as OIDC callback)
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={
            'username': user.username,
            'roles': [role.name for role in user.roles]
        },
        expires_delta=timedelta(hours=12)
    )
    refresh_token = create_refresh_token(
        identity=str(user.id),
        expires_delta=timedelta(days=30)
    )

    # Determine user state
    needs_password = not getattr(user, 'has_password', True)
    needs_profile = not user.email or not user.callsign

    current_app.logger.info(f"Magic link login for user '{user.username}'")

    return jsonify({
        'access_token': access_token,
        'refresh_token': refresh_token,
        'needs_password': needs_password,
        'needs_profile': needs_profile,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'callsign': user.callsign
        }
    }), 200
