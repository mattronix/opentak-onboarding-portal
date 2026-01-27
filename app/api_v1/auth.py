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
from app.models import UserModel, UserRoleModel, PendingRegistrationModel, OnboardingCodeModel, OneTimeTokenModel
from app.ots import OTSClient
from app.email import send_html_email
import secrets


def get_frontend_url():
    """
    Get the frontend URL, auto-detecting from request if not explicitly configured.
    Handles reverse proxy headers (X-Forwarded-Proto, X-Forwarded-Host).
    """
    frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5000')

    # If explicitly set to a non-localhost value, use it
    if not (frontend_url.startswith('http://localhost') or frontend_url.startswith('http://127.0.0.1')):
        return frontend_url.rstrip('/')

    # Auto-detect from request
    # Check for reverse proxy headers first
    proto = request.headers.get('X-Forwarded-Proto', request.scheme)
    host = request.headers.get('X-Forwarded-Host', request.host)

    # Only use localhost if actually accessing from localhost
    if host.startswith('localhost') or host.startswith('127.0.0.1'):
        return frontend_url.rstrip('/')

    return f"{proto}://{host}"


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
                # Generate display name by capitalizing (e.g., "user" -> "User")
                display_name = role_name.replace('_', ' ').title()
                role = UserRoleModel.create_role(name=role_name, description=f"Auto-created from OTS", display_name=display_name)

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
                'roles': [{'name': role.name, 'displayName': role.display_name} for role in user.roles],
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
        'roles': [{'name': role.name, 'displayName': role.display_name} for role in user.roles],
        'expiryDate': user.expiryDate.isoformat() if user.expiryDate else None,
        'onboardedBy': user.onboardedBy
    }), 200


@api_v1.route('/auth/register', methods=['POST'])
def register():
    """
    Register a new user with onboarding code (creates pending registration and sends verification email)

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
    from app.models import OnboardingCodeModel, PendingRegistrationModel
    from datetime import datetime

    data = request.get_json()

    # Validate required fields
    required_fields = ['username', 'password', 'email', 'firstName', 'lastName', 'callsign', 'onboardingCode']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    # Convert username to lowercase and remove spaces
    username = data['username'].lower().strip()

    # Validate username format (only letters and numbers - no spaces, underscores, periods, or hyphens)
    import re
    username_pattern = r'^[a-z0-9]+$'
    if not re.match(username_pattern, username):
        return jsonify({'error': 'Username can only contain letters and numbers (no spaces, underscores, or periods)'}), 400

    # Validate username length
    if len(username) < 3 or len(username) > 32:
        return jsonify({'error': 'Username must be between 3 and 32 characters'}), 400

    # Validate email format (basic check)
    if '@' not in data['email'] or '.' not in data['email']:
        return jsonify({'error': 'Invalid email format'}), 400

    # Check for duplicate username in existing users
    existing_user = UserModel.get_user_by_username(username)
    if existing_user:
        return jsonify({'error': 'Username already exists'}), 409

    # Check for duplicate email in existing users
    existing_email = UserModel.query.filter_by(email=data['email']).first()
    if existing_email:
        return jsonify({'error': 'Email already registered'}), 409

    # Check for duplicate in pending registrations
    pending_username = PendingRegistrationModel.query.filter_by(username=username).first()
    if pending_username:
        return jsonify({'error': 'Username already pending verification'}), 409

    pending_email = PendingRegistrationModel.query.filter_by(email=data['email']).first()
    if pending_email:
        return jsonify({'error': 'Email already pending verification'}), 409

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
        # Check if auto-approve is enabled on the onboarding code
        auto_approve = onboarding_code.autoApprove
        current_app.logger.info(f"Onboarding code '{onboarding_code.name}' auto-approve: {auto_approve}")

        if auto_approve:
            current_app.logger.info("Auto-approve is ENABLED on onboarding code - will create user directly")
            # Auto-approve: Create user directly without email verification
            from app.ots import OTSClient
            from app.models import UserRoleModel

            # Create user in OTS
            current_app.logger.info(f"Connecting to OTS at {current_app.config['OTS_URL']}")
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
                current_app.logger.info(f"Creating user {username} in OTS with roles {ots_roles}")
                ots_response = ots.create_user(
                    username=username,
                    password=data['password'],
                    roles=ots_roles
                )
                current_app.logger.info(f"OTS user creation successful")
            except Exception as e:
                error_msg = str(e)
                current_app.logger.error(f"OTS user creation failed: {error_msg}")
                if 'can contain only' in error_msg.lower() or 'username' in error_msg.lower():
                    return jsonify({
                        'error': 'Username contains invalid characters. Username can only contain letters and numbers.'
                    }), 400
                # Return error instead of raising to avoid 500
                return jsonify({
                    'error': f'Failed to create user in TAK server. Please try again or contact administrator.'
                }), 500

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

            # Mark email as verified (auto-approved)
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
            from app.models import db
            db.session.commit()

            # Send welcome email (not verification email)
            try:
                frontend_url = get_frontend_url()

                welcome_message = f"""Welcome to OpenTAK, {user.firstName}!

Your account has been created and is now active. You can now start using the OpenTAK Portal.

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
                    subject='Welcome to OpenTAK Portal!',
                    recipients=[user.email],
                    message=welcome_message,
                    title='Welcome to OpenTAK!',
                    link_url=f"{frontend_url}/login",
                    link_title='Login to Portal'
                )
            except Exception as e:
                current_app.logger.error(f"Failed to send welcome email: {str(e)}")

            # Send notification to admins about new completed registration
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

            current_app.logger.info(f"Auto-approved registration for {username} ({data['email']})")

            return jsonify({
                'message': 'Registration successful! Your account is now active. You can log in.',
                'email': data['email'],
                'auto_approved': True
            }), 201

        # Check if approval workflow is required
        require_approval = onboarding_code.requireApproval
        current_app.logger.info(f"Onboarding code '{onboarding_code.name}' require-approval: {require_approval}")

        if require_approval:
            current_app.logger.info("Require-approval is ENABLED on onboarding code - will send approval emails")
            # Approval flow: Create pending registration and send approval emails to approvers

            # Generate verification and approval tokens
            verification_token = secrets.token_urlsafe(48)
            approval_token = secrets.token_urlsafe(48)

            # Set expiration (7 days for approval flow to give approvers time)
            expires_at = datetime.now() + timedelta(days=7)

            # Create pending registration with pending_approval status
            from app.models import db
            pending = PendingRegistrationModel(
                username=username,
                email=data['email'],
                password=data['password'],
                firstName=data['firstName'],
                lastName=data['lastName'],
                callsign=data['callsign'],
                onboarding_code_id=onboarding_code.id,
                verification_token=verification_token,
                approval_token=approval_token,
                approval_status='pending_approval',
                expires_at=expires_at
            )
            db.session.add(pending)
            db.session.commit()

            if not pending:
                return jsonify({'error': 'Failed to create pending registration'}), 500

            # Get frontend URL
            frontend_url = get_frontend_url()

            # Build approval/rejection links
            approve_link = f"{frontend_url}/api/v1/registration/approve/{approval_token}"
            reject_link = f"{frontend_url}/api/v1/registration/reject/{approval_token}"

            # Get approvers from the approver role
            approver_emails = set()

            if onboarding_code.approverRole:
                for user in onboarding_code.approverRole.users:
                    if user.email:
                        approver_emails.add(user.email)
                        current_app.logger.info(f"Adding approver from role '{onboarding_code.approverRole.name}': {user.username} ({user.email})")

            if not approver_emails:
                current_app.logger.error("No approvers configured for onboarding code with requireApproval enabled")
                PendingRegistrationModel.delete_by_id(pending.id)
                return jsonify({'error': 'No approvers configured. Please contact administrator.'}), 500

            # Send approval emails to all approvers
            approval_message = f"""A new user registration requires your approval:

Registration Details:
- Username: {username}
- Name: {data['firstName']} {data['lastName']}
- Email: {data['email']}
- Callsign: {data['callsign']}
- Onboarding Code: {onboarding_code.name}

Please click one of the buttons below to approve or reject this registration:

APPROVE: {approve_link}

REJECT: {reject_link}

This request will expire in 7 days.

Note: Clicking "Approve" will create the user account immediately. Clicking "Reject" will delete the registration request."""

            try:
                for approver_email in approver_emails:
                    send_html_email(
                        subject=f'Approval Required: New Registration for {username}',
                        recipients=[approver_email],
                        message=approval_message,
                        title='Registration Approval Required',
                        link_url=approve_link,
                        link_title='Approve Registration'
                    )
                    current_app.logger.info(f"Approval email sent to {approver_email}")
            except Exception as e:
                current_app.logger.error(f"Failed to send approval email: {str(e)}")
                PendingRegistrationModel.delete_by_id(pending.id)
                return jsonify({'error': f'Failed to send approval emails: {str(e)}'}), 500

            # Send notification to the registrant
            try:
                pending_message = f"""Hello {data['firstName']},

Thank you for registering with OpenTAK Portal!

Your registration is now pending approval. An administrator will review your request and you will receive an email once it has been approved or rejected.

Your registration details:
- Username: {username}
- Callsign: {data['callsign']}
- Email: {data['email']}

If you have any questions, please contact your administrator.

Thank you for your patience!"""

                send_html_email(
                    subject='Registration Pending Approval - OpenTAK Portal',
                    recipients=[data['email']],
                    message=pending_message,
                    title='Registration Pending Approval'
                )
            except Exception as e:
                current_app.logger.error(f"Failed to send pending notification email: {str(e)}")

            current_app.logger.info(f"Registration pending approval for {username} ({data['email']})")

            return jsonify({
                'message': 'Registration submitted! Your request is pending approval. You will receive an email once approved.',
                'email': data['email'],
                'pending_approval': True
            }), 201

        # Standard flow: Create pending registration and send verification email
        current_app.logger.info(f"Using STANDARD flow (auto_approve={auto_approve}, require_approval={require_approval}) - creating pending registration")
        # Generate verification token (64 characters)
        verification_token = secrets.token_urlsafe(48)

        # Set expiration (24 hours from now)
        expires_at = datetime.now() + timedelta(hours=24)

        # Create pending registration
        pending = PendingRegistrationModel.create_pending_registration(
            username=username,
            email=data['email'],
            password=data['password'],  # Store temporarily
            first_name=data['firstName'],
            last_name=data['lastName'],
            callsign=data['callsign'],
            onboarding_code_id=onboarding_code.id,
            verification_token=verification_token,
            expires_at=expires_at
        )

        if not pending:
            return jsonify({'error': 'Failed to create pending registration'}), 500

        # Send verification email to user
        try:
            frontend_url = get_frontend_url()

            verification_link = f"{frontend_url}/verify-email?token={verification_token}"

            welcome_message = f"""Hello {data['firstName']} {data['lastName']},

Thank you for registering with OpenTAK Onboarding Portal!

To complete your registration, please verify your email address by clicking the link below:

{verification_link}

This link will expire in 24 hours.

Your registration details:
- Username: {data['username']}
- Callsign: {data['callsign']}
- Email: {data['email']}

If you did not request this registration, please ignore this email.

Welcome to the team!"""

            send_html_email(
                subject='Verify Your Email - OpenTAK Portal',
                recipients=[data['email']],
                message=welcome_message,
                title='Welcome! Please Verify Your Email',
                link_url=verification_link,
                link_title='Verify Email Address'
            )

            current_app.logger.info(f"Verification email sent to {data['email']} for user {data['username']}")

            # Send notification to admins about pending registration
            from app.notifications import notify_admin_pending_registration
            notify_admin_pending_registration(
                username=username,
                email=data['email'],
                first_name=data['firstName'],
                last_name=data['lastName'],
                callsign=data['callsign']
            )

        except Exception as e:
            current_app.logger.error(f"Failed to send verification email: {str(e)}")
            # Delete pending registration if email fails
            PendingRegistrationModel.delete_by_id(pending.id)
            return jsonify({'error': f'Failed to send verification email: {str(e)}'}), 500

        return jsonify({
            'message': 'Registration initiated. Please check your email to verify your account.',
            'email': data['email']
        }), 201

    except Exception as e:
        current_app.logger.error(f"Registration failed: {str(e)}")
        return jsonify({'error': f'Registration failed: {str(e)}'}), 400


@api_v1.route('/auth/verify-email', methods=['POST'])
def verify_email():
    """
    Verify email and complete user registration

    Request body:
    {
        "token": "string"
    }
    """
    from app.models import PendingRegistrationModel, OnboardingCodeModel
    from datetime import datetime

    data = request.get_json()
    token = data.get('token')

    if not token:
        return jsonify({'error': 'Verification token is required'}), 400

    try:
        # Find pending registration
        pending = PendingRegistrationModel.get_by_token(token)

        if not pending:
            return jsonify({'error': 'Invalid verification token'}), 400

        # Check if expired
        if pending.expires_at < datetime.now():
            PendingRegistrationModel.delete_by_id(pending.id)
            return jsonify({'error': 'Verification link has expired. Please register again.'}), 400

        # Get onboarding code
        onboarding_code = OnboardingCodeModel.get_onboarding_code_by_id(pending.onboarding_code_id)
        if not onboarding_code:
            return jsonify({'error': 'Onboarding code no longer valid'}), 400

        # Double-check for duplicates before creating
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
            # Filter roles to only include those that exist in OTS
            allowed_ots_roles = ['user', 'administrator']
            role_names = [role.name.lower() for role in onboarding_code.roles]

            # Check if any role maps to administrator
            if any(r in ['administrator', 'admin'] for r in role_names):
                ots_roles = ['administrator']
            else:
                # Default to user for any other role
                ots_roles = ['user']

            current_app.logger.info(f"Mapped onboarding code roles {[r.name for r in onboarding_code.roles]} to OTS roles {ots_roles}")

        # Create user in OTS with username, password, and roles
        try:
            ots_response = ots.create_user(
                username=pending.username,
                password=pending.password,
                roles=ots_roles
            )
        except Exception as e:
            # Check if it's a username validation error
            error_msg = str(e)
            if 'can contain only' in error_msg.lower() or 'username' in error_msg.lower():
                PendingRegistrationModel.delete_by_id(pending.id)
                return jsonify({
                    'error': 'Username contains invalid characters. Username can only contain letters and numbers (no spaces, underscores, or periods). Please register again with a valid username.'
                }), 400
            # Re-raise other errors
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

        # Check if user creation failed
        if isinstance(user, dict) and 'error' in user:
            return jsonify({'error': f'User already exists'}), 409

        # Mark email as verified
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
        from app.models import db
        db.session.commit()

        # Delete pending registration
        PendingRegistrationModel.delete_by_id(pending.id)

        # Send welcome email to new user
        try:
            frontend_url = get_frontend_url()

            welcome_message = f"""Welcome to OpenTAK, {user.firstName}!

Your account has been successfully created and verified. You can now start using the OpenTAK Portal.

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
                subject='Welcome to OpenTAK Portal!',
                recipients=[user.email],
                message=welcome_message,
                title='Welcome to OpenTAK!',
                link_url=f"{frontend_url}/login",
                link_title='Login to Portal'
            )

            current_app.logger.info(f"Welcome email sent to {user.email}")
        except Exception as e:
            current_app.logger.error(f"Failed to send welcome email: {str(e)}")
            # Don't fail verification if email fails

        # Send notification to admins about new completed registration
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
            # Don't fail verification if notification fails

        # Send email notification to onboard contact
        if onboarding_code.onboardContact:
            try:
                onboard_contact = onboarding_code.onboardContact
                if onboard_contact and onboard_contact.email:
                    notification_message = (
                        f"Using your Onboarding Code '{onboarding_code.name}' ({onboarding_code.onboardingCode}), "
                        f"a new registration has been completed:\n\n"
                        f"Username: {user.username}\n"
                        f"Callsign: {user.callsign}\n"
                        f"Email: {user.email}\n\n"
                        f"If this is not who you expect, please contact your administrator."
                    )
                    send_html_email(
                        subject='New User Registration Completed',
                        recipients=[onboard_contact.email],
                        message=notification_message,
                        title='New Registration Completed'
                    )
            except Exception as e:
                current_app.logger.error(f"Failed to send onboard contact notification: {str(e)}")
                # Don't fail verification if email fails

        return jsonify({
            'message': 'Email verified successfully! Your account is now active.',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'callsign': user.callsign
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Email verification failed: {str(e)}")
        return jsonify({'error': f'Email verification failed: {str(e)}'}), 400


@api_v1.route('/auth/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """
    Change password for authenticated user (does not require current password)

    Request body:
    {
        "newPassword": "string"
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        new_password = data.get('newPassword')

        if not new_password:
            return jsonify({'error': 'New password is required'}), 400

        current_user_id = get_jwt_identity()
        # Convert to int since JWT identity is stored as string
        user = UserModel.get_user_by_id(int(current_user_id))

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Change password in OTS (no current password verification required)
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


@api_v1.route('/auth/forgot-password', methods=['POST'])
def forgot_password():
    """
    Request a password reset token

    Request body:
    {
        "email": "string"
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        email = data.get('email')
        if not email:
            return jsonify({'error': 'Email is required'}), 400

        # Find user by email
        user = UserModel.query.filter_by(email=email).first()

        # Always return success even if user not found (security best practice)
        if not user:
            current_app.logger.info(f"Password reset requested for non-existent email: {email}")
            return jsonify({'message': 'If an account exists with that email, you will receive reset instructions'}), 200

        # Delete any existing tokens for this user
        OneTimeTokenModel.query.filter_by(user_id=user.id).delete()

        # Create new reset token
        token = secrets.token_urlsafe(48)
        reset_token = OneTimeTokenModel(
            user_id=user.id,
            token=token,
            token_type='password_reset',
            expires_at=datetime.utcnow() + timedelta(hours=1)
        )

        from app import db
        db.session.add(reset_token)
        db.session.commit()

        # Send reset email
        frontend_url = get_frontend_url()

        reset_url = f"{frontend_url}/reset-password?token={token}"

        reset_message = f"""Hello {user.username},

We received a request to reset your password. Click the button below to reset it:

{reset_url}

This link will expire in 1 hour.

If you didn't request this password reset, you can safely ignore this email.

Best regards,
OpenTAK Onboarding Portal Team"""

        send_html_email(
            subject='Password Reset Request',
            recipients=[user.email],
            message=reset_message,
            title='Reset Your Password',
            link_url=reset_url,
            link_title='Reset Password'
        )

        current_app.logger.info(f"Password reset email sent to {user.email}")
        return jsonify({'message': 'If an account exists with that email, you will receive reset instructions'}), 200

    except Exception as e:
        current_app.logger.error(f"Forgot password error: {str(e)}")
        return jsonify({'error': 'An error occurred processing your request'}), 500


@api_v1.route('/auth/reset-password', methods=['POST'])
def reset_password():
    """
    Reset password using a token

    Request body:
    {
        "token": "string",
        "new_password": "string"
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        token = data.get('token')
        new_password = data.get('new_password')

        if not token or not new_password:
            return jsonify({'error': 'Token and new password are required'}), 400

        if len(new_password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters long'}), 400

        # Find and validate token
        reset_token = OneTimeTokenModel.query.filter_by(
            token=token,
            token_type='password_reset',
            is_used=False
        ).first()

        if not reset_token:
            return jsonify({'error': 'Invalid or expired reset token'}), 400

        # Check if token is expired
        if reset_token.expires_at < datetime.utcnow():
            return jsonify({'error': 'Reset token has expired'}), 400

        # Get user
        user = UserModel.query.get(reset_token.user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Reset password in OTS
        try:
            ots = OTSClient(
                current_app.config['OTS_URL'],
                current_app.config['OTS_USERNAME'],
                current_app.config['OTS_PASSWORD']
            )
            result = ots.reset_user_password(user.username, new_password)
            current_app.logger.info(f"Password reset in OTS: {result}")
        except Exception as e:
            current_app.logger.error(f"OTS password reset failed: {str(e)}")
            return jsonify({'error': 'Failed to reset password in OTS'}), 500

        # Mark token as used
        reset_token.is_used = True
        reset_token.used_at = datetime.utcnow()
        from app import db
        db.session.commit()

        current_app.logger.info(f"Password successfully reset for user: {user.username}")
        return jsonify({'message': 'Password reset successfully'}), 200

    except Exception as e:
        current_app.logger.error(f"Reset password error: {str(e)}")
        return jsonify({'error': 'An error occurred resetting your password'}), 500


@api_v1.route('/auth/permissions', methods=['GET'])
@jwt_required()
def get_user_permissions():
    """
    Get current user's admin permissions (which modules they can access)

    Response:
    {
        "roles": ["string"],
        "modules": ["string"],
        "isAdmin": boolean
    }
    """
    from app.rbac import get_user_roles, get_user_admin_modules, ADMIN_ROLES

    user_roles = get_user_roles()
    accessible_modules = get_user_admin_modules()

    # Check if user has any admin role
    is_admin = any(role in ADMIN_ROLES for role in user_roles)

    return jsonify({
        'roles': user_roles,
        'modules': accessible_modules,
        'isAdmin': is_admin
    }), 200


@api_v1.route('/registration/approve/<token>', methods=['GET'])
def approve_registration(token):
    """
    Approve a pending registration via email link
    Changes status to pending_verification and sends email verification link to user
    """
    from app.models import db

    # Find pending registration by approval token
    pending = PendingRegistrationModel.query.filter_by(approval_token=token).first()

    if not pending:
        return f"""
        <html>
        <head><title>Registration Approval</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
            <h1 style="color: #dc3545;">Invalid or Expired Link</h1>
            <p>This approval link is invalid or has already been used.</p>
        </body>
        </html>
        """, 400

    # Check if expired
    if pending.expires_at < datetime.now():
        PendingRegistrationModel.delete_by_id(pending.id)
        return f"""
        <html>
        <head><title>Registration Approval</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
            <h1 style="color: #dc3545;">Link Expired</h1>
            <p>This approval link has expired. The registration request has been deleted.</p>
        </body>
        </html>
        """, 400

    # Check if already processed
    if pending.approval_status not in ['pending_approval']:
        return f"""
        <html>
        <head><title>Registration Approval</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
            <h1 style="color: #ffc107;">Already Processed</h1>
            <p>This registration has already been {pending.approval_status}.</p>
        </body>
        </html>
        """, 400

    try:
        # Double-check for duplicates
        if UserModel.get_user_by_username(pending.username):
            PendingRegistrationModel.delete_by_id(pending.id)
            return f"""
            <html>
            <head><title>Registration Approval</title></head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
                <h1 style="color: #dc3545;">Username Already Exists</h1>
                <p>A user with this username already exists.</p>
            </body>
            </html>
            """, 409

        # Update status to pending_verification and generate new verification token
        pending.approval_status = 'pending_verification'
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

Great news! Your registration request for OpenTAK Portal has been approved!

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
            return f"""
            <html>
            <head><title>Registration Approval</title></head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
                <h1 style="color: #dc3545;">Error Sending Email</h1>
                <p>The registration was approved but we couldn't send the verification email: {str(e)}</p>
            </body>
            </html>
            """, 500

        current_app.logger.info(f"Registration approved for {pending.username} - verification email sent")

        return f"""
        <html>
        <head><title>Registration Approved</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
            <h1 style="color: #28a745;">Registration Approved!</h1>
            <p>The registration for <strong>{pending.username}</strong> has been approved.</p>
            <p>A verification email has been sent to <strong>{pending.email}</strong>.</p>
            <p style="color: #666; margin-top: 20px;">The user must click the verification link in the email to complete their registration.</p>
            <div style="margin-top: 30px;">
                <p style="color: #666;">Registration Details:</p>
                <ul style="list-style: none; padding: 0;">
                    <li>Username: {pending.username}</li>
                    <li>Email: {pending.email}</li>
                    <li>Callsign: {pending.callsign}</li>
                </ul>
            </div>
        </body>
        </html>
        """, 200

    except Exception as e:
        current_app.logger.error(f"Registration approval failed: {str(e)}")
        return f"""
        <html>
        <head><title>Registration Approval</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
            <h1 style="color: #dc3545;">Error</h1>
            <p>An error occurred while approving the registration: {str(e)}</p>
        </body>
        </html>
        """, 500


@api_v1.route('/registration/reject/<token>', methods=['GET'])
def reject_registration(token):
    """
    Reject a pending registration via email link
    Deletes the pending registration and notifies the user
    """
    from app.models import db

    # Find pending registration by approval token
    pending = PendingRegistrationModel.query.filter_by(approval_token=token).first()

    if not pending:
        return f"""
        <html>
        <head><title>Registration Rejection</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
            <h1 style="color: #dc3545;">Invalid or Expired Link</h1>
            <p>This rejection link is invalid or has already been used.</p>
        </body>
        </html>
        """, 400

    # Check if already processed
    if pending.approval_status not in ['pending_approval']:
        return f"""
        <html>
        <head><title>Registration Rejection</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
            <h1 style="color: #ffc107;">Already Processed</h1>
            <p>This registration has already been {pending.approval_status}.</p>
        </body>
        </html>
        """, 400

    username = pending.username
    email = pending.email
    first_name = pending.firstName

    try:
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

        current_app.logger.info(f"Registration rejected for {username}")

        return f"""
        <html>
        <head><title>Registration Rejected</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
            <h1 style="color: #dc3545;">Registration Rejected</h1>
            <p>The registration for <strong>{username}</strong> has been rejected.</p>
            <p>The user has been notified by email.</p>
        </body>
        </html>
        """, 200

    except Exception as e:
        current_app.logger.error(f"Registration rejection failed: {str(e)}")
        return f"""
        <html>
        <head><title>Registration Rejection</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
            <h1 style="color: #dc3545;">Error</h1>
            <p>An error occurred while rejecting the registration: {str(e)}</p>
        </body>
        </html>
        """, 500
