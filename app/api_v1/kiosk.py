"""
Kiosk enrollment API endpoints.
Handles kiosk session creation, polling, and mobile authentication.
"""

from flask import request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
)
from datetime import timedelta, datetime
from app.api_v1 import api_v1
from app.models import db, UserModel, KioskSessionModel, SystemSettingsModel
from app.api_v1.auth import get_frontend_url
import secrets


@api_v1.route('/kiosk/session', methods=['POST'])
def create_kiosk_session():
    """
    Create a new kiosk session (public, no auth required).
    Returns a session_id and QR URL for display on the kiosk screen.
    """
    enabled = SystemSettingsModel.get_setting('kiosk_enrollment_enabled', False)
    if enabled not in [True, 'true', 'True']:
        return jsonify({'error': 'Kiosk enrollment is disabled'}), 403

    try:
        # Clean up old expired sessions
        KioskSessionModel.cleanup_expired()

        session_id = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(minutes=10)

        session = KioskSessionModel.create_session(
            session_id=session_id,
            expires_at=expires_at
        )

        if not session:
            return jsonify({'error': 'Failed to create kiosk session'}), 500

        frontend_url = get_frontend_url()
        qr_url = f"{frontend_url}/kiosk-login/{session_id}"

        return jsonify({
            'session_id': session_id,
            'qr_url': qr_url,
            'expires_at': expires_at.isoformat()
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error creating kiosk session: {str(e)}")
        return jsonify({'error': 'Failed to create kiosk session'}), 500


@api_v1.route('/kiosk/session/<session_id>/status', methods=['GET'])
def get_kiosk_session_status(session_id):
    """
    Poll kiosk session status (public, no auth required).
    Returns current status and tokens when authenticated (one-time read).
    """
    enabled = SystemSettingsModel.get_setting('kiosk_enrollment_enabled', False)
    if enabled not in [True, 'true', 'True']:
        return jsonify({'error': 'Kiosk enrollment is disabled'}), 403

    session = KioskSessionModel.get_by_session_id(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    # Check if pending session has expired
    if session.status == 'pending' and session.expires_at < datetime.utcnow():
        session.status = 'expired'
        db.session.commit()
        return jsonify({'status': 'expired'}), 200

    if session.status == 'authenticated':
        # Build response with tokens (one-time read)
        response = {
            'status': 'authenticated',
            'access_token': session.access_token,
            'refresh_token': session.refresh_token,
            'user': {
                'id': session.user.id,
                'username': session.user.username,
                'callsign': session.user.callsign,
                'firstName': session.user.firstName,
                'lastName': session.user.lastName
            } if session.user else None
        }

        # Clear tokens from database after first read (security)
        session.access_token = None
        session.refresh_token = None
        db.session.commit()

        return jsonify(response), 200

    if session.status == 'expired':
        return jsonify({'status': 'expired'}), 200

    return jsonify({'status': 'pending'}), 200


@api_v1.route('/kiosk/session/<session_id>/authenticate', methods=['POST'])
@jwt_required()
def authenticate_kiosk_session(session_id):
    """
    Authenticate a kiosk session from a mobile device (requires JWT).
    The mobile user's identity is used to create kiosk-specific tokens.
    """
    enabled = SystemSettingsModel.get_setting('kiosk_enrollment_enabled', False)
    if enabled not in [True, 'true', 'True']:
        return jsonify({'error': 'Kiosk enrollment is disabled'}), 403

    session = KioskSessionModel.get_by_session_id(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    if session.status != 'pending':
        return jsonify({'error': 'Session is not pending'}), 400

    if session.expires_at < datetime.utcnow():
        session.status = 'expired'
        db.session.commit()
        return jsonify({'error': 'Session has expired'}), 400

    user_id = get_jwt_identity()
    user = UserModel.get_user_by_id(int(user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Get timeout from settings
    timeout_str = SystemSettingsModel.get_setting('kiosk_session_timeout_minutes', '10')
    try:
        timeout_minutes = int(timeout_str)
    except (ValueError, TypeError):
        timeout_minutes = 10

    # Create kiosk-specific JWT tokens with shorter expiry
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={
            'username': user.username,
            'roles': [role.name for role in user.roles],
            'kiosk_session': True
        },
        expires_delta=timedelta(minutes=timeout_minutes)
    )
    refresh_token = create_refresh_token(
        identity=str(user.id),
        expires_delta=timedelta(minutes=timeout_minutes)
    )

    # Update session
    session.user_id = user.id
    session.status = 'authenticated'
    session.authenticated_at = datetime.utcnow()
    session.access_token = access_token
    session.refresh_token = refresh_token
    db.session.commit()

    return jsonify({'message': 'Session authenticated successfully'}), 200
