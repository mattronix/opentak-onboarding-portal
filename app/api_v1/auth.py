"""
Authentication API endpoints
Handles login, logout, token refresh, and password management
"""

from flask import request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt
)
from datetime import timedelta, datetime
from app.api_v1 import api_v1
from app.models import UserModel, UserRoleModel, OneTimeTokenModel
from app.ots import OTSClient
from app.email import send_html_email
import secrets


@api_v1.route('/auth/login', methods=['POST'])
def login():
    """
    Authenticate user with OTS and return JWT tokens

    Request body:
    {
        "username": "string",
        "password": "string"
    }

    Response:
    {
        "access_token": "string",
        "refresh_token": "string",
        "user": {
            "id": "int",
            "username": "string",
            "email": "string",
            "callsign": "string",
            "roles": ["string"]
        }
    }
    """
    data = request.get_json()

    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400

    username = data['username']
    password = data['password']

    try:
        # Authenticate with OTS
        ots = OTSClient(current_app.config['OTS_URL'], username, password)
        ots_profile = ots.get_me()

        # DEBUG: Dump the entire OTS profile
        current_app.logger.info(f"Login: OTS profile for {username}: {ots_profile}")

        # Also write to a temp file for debugging
        import json
        import tempfile
        try:
            with open('/tmp/ots_profile_debug.json', 'w') as f:
                json.dump({'username': username, 'profile': ots_profile}, f, indent=2, default=str)
        except:
            pass

        if not ots_profile:
            return jsonify({'error': 'Invalid username or password'}), 401

        # Extract response data from OTS profile
        ots_data = ots_profile.get('response', {})

        # Get or create local user
        from app.models import db
        user = UserModel.get_user_by_username(username)
        if not user:
            # Create user if doesn't exist locally
            user = UserModel.create_user(
                username=username,
                email=ots_data.get('email', ''),
                firstname=ots_data.get('firstName', ''),
                lastname=ots_data.get('lastName', ''),
                callsign=ots_data.get('callsign', username)
            )

        # Sync roles from OTS - ADD roles from OTS but keep existing local roles
        # This allows portal-managed roles to persist while still syncing OTS roles
        # IMPORTANT: We only ADD roles from OTS, never remove existing local roles
        # OTS returns roles as array of objects with 'name' property
        ots_roles_data = ots_data.get('roles', [])
        ots_roles = [role['name'] for role in ots_roles_data if isinstance(role, dict) and 'name' in role]
        current_app.logger.info(f"Login: User {username} - OTS roles: {ots_roles}")
        current_app.logger.info(f"Login: User {username} - Current local roles: {[r.name for r in user.roles]}")

        # Add OTS roles if they don't already exist
        for role_name in ots_roles:
            role = UserRoleModel.get_role_by_name(role_name)

            # Create role if it doesn't exist in local database
            if not role:
                current_app.logger.info(f"Login: Creating role {role_name} from OTS")
                role = UserRoleModel.create_role(name=role_name, description=f"Auto-created from OTS")

                # Check if role creation failed
                if isinstance(role, dict) and 'error' in role:
                    current_app.logger.error(f"Login: Failed to create role {role_name}: {role['error']}")
                    continue

                current_app.logger.info(f"Login: Created role {role_name}")

            # Add role to user if not already assigned
            if role and role not in user.roles:
                user.roles.append(role)
                db.session.add(user)
                db.session.commit()
                current_app.logger.info(f"Login: Added role {role_name} to user {username}")

        # Sync TAK profiles and Meshtastic configs from roles
        current_app.logger.info(f"Login: Syncing TAK profiles and Meshtastic configs for user {username}")

        # Add TAK profiles from all roles
        for role in user.roles:
            for tak_profile in role.takprofiles:
                if tak_profile not in user.takprofiles:
                    user.takprofiles.append(tak_profile)
                    current_app.logger.info(f"Login: Added TAK profile {tak_profile.name} to user {username} from role {role.name}")

        # Add Meshtastic configs from all roles
        for role in user.roles:
            for meshtastic in role.meshtastic:
                if meshtastic not in user.meshtastic:
                    user.meshtastic.append(meshtastic)
                    current_app.logger.info(f"Login: Added Meshtastic config {meshtastic.name} to user {username} from role {role.name}")

        # Commit the changes
        db.session.commit()

        # Refresh user to get latest state
        db.session.refresh(user)
        current_app.logger.info(f"Login: User {username} final roles after sync: {[r.name for r in user.roles]}")
        current_app.logger.info(f"Login: User {username} TAK profiles: {[p.name for p in user.takprofiles]}")
        current_app.logger.info(f"Login: User {username} Meshtastic configs: {[m.name for m in user.meshtastic]}")

        # Create JWT tokens (identity must be string for Flask-JWT-Extended)
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

        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'firstName': user.firstName,
                'lastName': user.lastName,
                'callsign': user.callsign,
                'roles': [role.name for role in user.roles],
                'expiryDate': user.expiryDate.isoformat() if user.expiryDate else None
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Login error: {str(e)}")
        # Return user-friendly error message
        return jsonify({'error': 'Invalid username or password'}), 401


@api_v1.route('/auth/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Refresh access token using refresh token

    Response:
    {
        "access_token": "string"
    }
    """
    current_user_id = get_jwt_identity()
    # Convert to int since JWT identity is stored as string
    user = UserModel.get_user_by_id(int(current_user_id))

    if not user:
        return jsonify({'error': 'User not found'}), 404

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={
            'username': user.username,
            'roles': [role.name for role in user.roles]
        },
        expires_delta=timedelta(hours=12)
    )

    return jsonify({'access_token': access_token}), 200


@api_v1.route('/auth/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """
    Get current authenticated user profile

    Response:
    {
        "id": "int",
        "username": "string",
        "email": "string",
        "callsign": "string",
        "roles": ["string"],
        ...
    }
    """
    current_user_id = get_jwt_identity()
    # Convert to int since JWT identity is stored as string
    user = UserModel.get_user_by_id(int(current_user_id))

    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'firstName': user.firstName,
        'lastName': user.lastName,
        'callsign': user.callsign,
        'roles': [role.name for role in user.roles],
        'expiryDate': user.expiryDate.isoformat() if user.expiryDate else None,
        'onboardedBy': user.onboardedBy
    }), 200


@api_v1.route('/auth/register', methods=['POST'])
def register():
    """
    Register a new user with onboarding code

    Request body:
    {
        "username": "string",
        "password": "string",
        "email": "string",
        "firstName": "string",
        "lastName": "string",
        "callsign": "string",
        "onboardingCode": "string"
    }
    """
    from app.models import OnboardingCodeModel
    from datetime import datetime

    data = request.get_json()

    # Validate required fields
    required_fields = ['username', 'password', 'email', 'firstName', 'lastName', 'callsign', 'onboardingCode']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    # Validate onboarding code
    onboarding_code = OnboardingCodeModel.get_onboarding_code_by_code(data['onboardingCode'])
    if not onboarding_code:
        return jsonify({'error': 'Invalid onboarding code'}), 400

    # Check if code is expired
    if onboarding_code.expiryDate and onboarding_code.expiryDate < datetime.now():
        return jsonify({'error': 'Onboarding code has expired'}), 400

    # Check if code has reached max uses
    if onboarding_code.maxUses and onboarding_code.uses >= onboarding_code.maxUses:
        return jsonify({'error': 'Onboarding code has reached maximum uses'}), 400

    try:
        # Create user in OTS
        ots = OTSClient(current_app.config['OTS_URL'], current_app.config['OTS_USERNAME'], current_app.config['OTS_PASSWORD'])

        # Prepare roles from onboarding code
        ots_roles = ['user']  # Default role
        if onboarding_code.roles:
            ots_roles = [role.name for role in onboarding_code.roles]

        # Create user in OTS with username, password, and roles
        ots_response = ots.create_user(
            username=data['username'],
            password=data['password'],
            roles=ots_roles
        )

        # Create user in local database
        expiry_date = onboarding_code.userExpiryDate if onboarding_code.userExpiryDate else None

        user = UserModel.create_user(
            username=data['username'],
            email=data['email'],
            firstname=data['firstName'],
            lastname=data['lastName'],
            callsign=data['callsign'],
            expirydate=expiry_date,
            onboardedby=onboarding_code.onboardContact.username if onboarding_code.onboardContact else None
        )

        # Check if user creation failed
        if isinstance(user, dict) and 'error' in user:
            return jsonify({'error': f'User already exists in local database'}), 409

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

        # Commit all changes (roles, TAK profiles, Meshtastic, code usage)
        from app.models import db
        db.session.commit()

        # Send email notification to onboard contact
        if onboarding_code.onboardContact:
            try:
                onboard_contact = UserModel.get_user_by_id(onboarding_code.onboardContact)
                if onboard_contact and onboard_contact.email:
                    notification_message = (
                        f"Using your Onboarding Code '{onboarding_code.name}' ({onboarding_code.onboardingCode}), "
                        f"a new registration has been made:\n\n"
                        f"Username: {user.username}\n"
                        f"Callsign: {user.callsign}\n"
                        f"Email: {user.email}\n\n"
                        f"If this is not who you expect, please contact your administrator."
                    )
                    send_html_email(
                        subject='New User Registration',
                        recipients=[onboard_contact.email],
                        message=notification_message,
                        title='New Registration Using Your Link'
                    )
            except Exception as e:
                current_app.logger.error(f"Failed to send onboard contact notification: {str(e)}")
                # Don't fail registration if email fails

        return jsonify({
            'message': 'User registered successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'callsign': user.callsign
            }
        }), 201

    except Exception as e:
        current_app.logger.error(f"Registration failed: {str(e)}")
        return jsonify({'error': f'Registration failed: {str(e)}'}), 400


@api_v1.route('/auth/forgot-password', methods=['POST'])
def forgot_password():
    """
    Request password reset email with one-time use token

    Request body:
    {
        "email": "string"
    }
    """
    if not current_app.config.get('FORGOT_PASSWORD_ENABLED', True):
        return jsonify({'error': 'Password reset is disabled'}), 403

    data = request.get_json()
    email = data.get('email')

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    user = UserModel.query.filter_by(email=email).first()

    if user:
        # Generate unique one-time use token (32 bytes = 64 hex characters)
        token_value = secrets.token_urlsafe(32)

        # Create token expiry (15 minutes from now)
        expires_at = datetime.now() + timedelta(minutes=15)

        # Store token in database
        token_obj = OneTimeTokenModel.create_token(
            user_id=user.id,
            token=token_value,
            token_type='password_reset',
            expires_at=expires_at
        )

        if not token_obj:
            return jsonify({'error': 'Failed to generate reset token'}), 500

        # Send email
        try:
            # Get frontend URL from config, or derive from request
            frontend_url = current_app.config.get('FRONTEND_URL')
            if not frontend_url or frontend_url == 'http://localhost:5173':
                # Derive from request URL (scheme + host)
                frontend_url = f"{request.scheme}://{request.host}"

            reset_link = f"{frontend_url}/reset-password?token={token_value}"
            message = f"Hello {user.username},\n\nYou have requested to reset your password. Please click the link below to reset your password:\n\n{reset_link}\n\nThis link will expire in 15 minutes and can only be used once.\n\nIf you did not request this, please ignore this email."

            send_html_email(
                subject='Password Reset Request',
                recipients=[user.email],
                message=message,
                title='Password Reset Request'
            )
        except Exception as e:
            current_app.logger.error(f"Failed to send password reset email: {str(e)}")
            return jsonify({'error': f'Failed to send email: {str(e)}'}), 500

    # Always return success to prevent email enumeration
    return jsonify({'message': 'If the email exists, a password reset link has been sent'}), 200


@api_v1.route('/auth/reset-password', methods=['POST'])
def reset_password():
    """
    Reset password with one-time use token

    Request body:
    {
        "token": "string",
        "newPassword": "string"
    }
    """
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('newPassword')

    if not token or not new_password:
        return jsonify({'error': 'Token and new password are required'}), 400

    try:
        # Validate and consume one-time token
        user_id = OneTimeTokenModel.validate_and_use_token(token, 'password_reset')

        if not user_id:
            return jsonify({'error': 'Invalid, expired, or already used token'}), 400

        user = UserModel.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Reset password in OTS
        ots = OTSClient(current_app.config['OTS_URL'], current_app.config['OTS_USERNAME'], current_app.config['OTS_PASSWORD'])
        ots.reset_user_password(user.username, new_password)

        return jsonify({'message': 'Password reset successfully'}), 200

    except Exception as e:
        current_app.logger.error(f"Password reset failed: {str(e)}")
        return jsonify({'error': f'Password reset failed: {str(e)}'}), 400


@api_v1.route('/auth/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """
    Change password for authenticated user

    Request body:
    {
        "currentPassword": "string",
        "newPassword": "string"
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        current_password = data.get('currentPassword')
        new_password = data.get('newPassword')

        if not current_password or not new_password:
            return jsonify({'error': 'Current and new password are required'}), 400

        current_user_id = get_jwt_identity()
        # Convert to int since JWT identity is stored as string
        user = UserModel.get_user_by_id(int(current_user_id))

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Verify current password with OTS
        try:
            ots_test = OTSClient(current_app.config['OTS_URL'], user.username, current_password)
            test_result = ots_test.get_me()
            if not test_result:
                return jsonify({'error': 'Current password is incorrect'}), 401
        except Exception as e:
            current_app.logger.error(f"Password verification failed: {str(e)}")
            return jsonify({'error': 'Current password is incorrect'}), 401

        # Change password in OTS
        try:
            ots = OTSClient(current_app.config['OTS_URL'], current_app.config['OTS_USERNAME'], current_app.config['OTS_PASSWORD'])
            result = ots.reset_user_password(user.username, new_password)
            current_app.logger.info(f"Password reset result: {result}")
        except Exception as e:
            current_app.logger.error(f"Password reset failed: {str(e)}")
            return jsonify({'error': f'Failed to reset password: {str(e)}'}), 400

        return jsonify({'message': 'Password changed successfully'}), 200

    except Exception as e:
        current_app.logger.error(f"Change password error: {str(e)}")
        return jsonify({'error': f'Password change failed: {str(e)}'}), 400
