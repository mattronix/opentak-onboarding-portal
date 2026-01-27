"""
Users API endpoints
CRUD operations for user management
"""

from flask import request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt
from app.api_v1 import api_v1
from app.models import UserModel, UserRoleModel, db
from app.ots import OTSClient
from app.settings import OTS_URL, OTS_USERNAME, OTS_PASSWORD, OTS_VERIFY_SSL
from datetime import datetime
def require_admin_role():
    """Check for user_admin or administrator role"""
    from app.rbac import has_any_role
    if not has_any_role(['administrator', 'user_admin']):
        return jsonify({'error': 'User admin role required'}), 403
    return None


@api_v1.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    """
    Get all users (admin only)

    Query parameters:
    - page: int (default: 1)
    - per_page: int (default: 50)
    - search: string (search username, email, callsign)

    Response:
    {
        "users": [
            {
                "id": "int",
                "username": "string",
                "email": "string",
                "callsign": "string",
                ...
            }
        ],
        "total": "int",
        "page": "int",
        "per_page": "int"
    }
    """
    error = require_admin_role()
    if error:
        return error

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    search = request.args.get('search', '')

    query = UserModel.query

    if search:
        search_filter = f'%{search}%'
        query = query.filter(
            (UserModel.username.ilike(search_filter)) |
            (UserModel.email.ilike(search_filter)) |
            (UserModel.callsign.ilike(search_filter))
        )

    total = query.count()
    users = query.offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        'users': [{
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'firstName': user.firstName,
            'lastName': user.lastName,
            'callsign': user.callsign,
            'roles': [{'name': role.name, 'displayName': role.display_name} for role in user.roles],
            'expiryDate': user.expiryDate.isoformat() if user.expiryDate else None,
            'onboardedBy': user.onboardedBy
        } for user in users],
        'total': total,
        'page': page,
        'per_page': per_page
    }), 200


@api_v1.route('/users/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """
    Get user by ID

    Response includes full user details with relationships
    """
    claims = get_jwt()
    roles = claims.get('roles', [])
    current_user_id = claims.get('sub')

    # Users can view their own profile, admins can view any
    if 'administrator' not in roles and current_user_id != user_id:
        return jsonify({'error': 'Permission denied'}), 403

    user = UserModel.get_user_by_id(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'firstName': user.firstName,
        'lastName': user.lastName,
        'callsign': user.callsign,
        'roles': [{
            'id': role.id,
            'name': role.name,
            'displayName': role.display_name,
            'description': role.description
        } for role in user.roles],
        'takProfiles': [{
            'id': tp.id,
            'name': tp.name,
            'description': tp.description
        } for tp in user.takprofiles],
        'meshtastic': [{
            'id': m.id,
            'name': m.name,
            'description': m.description
        } for m in user.meshtastic],
        'assignedRadios': [{
            'id': r.id,
            'name': r.name,
            'platform': r.platform,
            'radioType': r.radioType
        } for r in UserModel.query.get(user_id).radios_assigned.all()] if hasattr(UserModel.query.get(user_id), 'radios_assigned') else [],
        'expiryDate': user.expiryDate.isoformat() if user.expiryDate else None,
        'onboardedBy': user.onboardedBy
    }), 200


@api_v1.route('/users', methods=['POST'])
@jwt_required()
def create_user():
    """
    Create a new user (admin only)

    Request body:
    {
        "username": "string",
        "password": "string",
        "email": "string",
        "firstName": "string",
        "lastName": "string",
        "callsign": "string",
        "roleIds": [int],
        "expiryDate": "ISO8601 string" (optional)
    }
    """
    error = require_admin_role()
    if error:
        return error

    data = request.get_json()

    # Validate required fields
    required_fields = ['username', 'password', 'email', 'firstName', 'lastName', 'callsign']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    # Check if user already exists
    existing_user = UserModel.get_user_by_username(data['username'])
    if existing_user:
        return jsonify({'error': 'Username already exists'}), 409

    try:
        # Create user in OTS first
        ots = OTSClient(OTS_URL, OTS_USERNAME, OTS_PASSWORD)

        # Determine OTS roles - OTS only supports 'user' and 'administrator'
        ots_roles = ['user']  # Default role
        if data.get('roleIds'):
            roles = UserRoleModel.query.filter(UserRoleModel.id.in_(data['roleIds'])).all()
            role_names = [role.name.lower() for role in roles]
            if any(r in ['administrator', 'admin'] for r in role_names):
                ots_roles = ['administrator']

        # Create user in OTS with username, password, and roles
        ots.create_user(data['username'], data['password'], ots_roles)

        # Create user in local database
        expiry_date = None
        if data.get('expiryDate'):
            expiry_date = datetime.fromisoformat(data['expiryDate'].replace('Z', '+00:00'))

        user = UserModel.create_user(
            username=data['username'],
            email=data['email'],
            firstName=data['firstName'],
            lastName=data['lastName'],
            callsign=data['callsign'],
            expiryDate=expiry_date
        )

        # Add roles
        if data.get('roleIds'):
            for role_id in data['roleIds']:
                role = UserRoleModel.get_by_id(role_id)
                if role:
                    user.roles.append(role)
            db.session.commit()

        return jsonify({
            'message': 'User created successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'callsign': user.callsign
            }
        }), 201

    except Exception as e:
        return jsonify({'error': f'Failed to create user: {str(e)}'}), 400


@api_v1.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    """
    Update user (admin only, or own profile for basic fields)

    Request body:
    {
        "email": "string",
        "firstName": "string",
        "lastName": "string",
        "callsign": "string",
        "roleIds": [int],  // admin only
        "expiryDate": "ISO8601 string"  // admin only
    }
    """
    claims = get_jwt()
    roles = claims.get('roles', [])
    current_user_id = claims.get('sub')

    is_admin = 'administrator' in roles
    is_own_profile = current_user_id == user_id

    if not is_admin and not is_own_profile:
        return jsonify({'error': 'Permission denied'}), 403

    user = UserModel.get_user_by_id(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()

    # Update basic fields (allowed for own profile)
    if data.get('email'):
        user.email = data['email']
    if data.get('firstName'):
        user.firstName = data['firstName']
    if data.get('lastName'):
        user.lastName = data['lastName']
    if data.get('callsign'):
        user.callsign = data['callsign']

    # Admin-only fields
    if is_admin:
        # Update roles if roleIds is provided in the request
        if 'roleIds' in data:
            user.roles.clear()
            for role_id in data['roleIds']:
                role = UserRoleModel.get_by_id(role_id)
                if role:
                    user.roles.append(role)

        if 'expiryDate' in data:
            if data['expiryDate']:
                user.expiryDate = datetime.fromisoformat(data['expiryDate'].replace('Z', '+00:00'))
            else:
                user.expiryDate = None

    try:
        # Commit directly to ensure relationship changes are saved
        db.session.commit()

        # Sync roles to OTS if admin updated them
        if is_admin and 'roleIds' in data:
            ots = OTSClient(OTS_URL, OTS_USERNAME, OTS_PASSWORD)
            # OTS sync would go here if supported

        return jsonify({
            'message': 'User updated successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'callsign': user.callsign,
                'roles': [role.name for role in user.roles]
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update user: {str(e)}'}), 400


@api_v1.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    """
    Delete user from both OTS and local database (admin only)
    """
    error = require_admin_role()
    if error:
        return error

    user = UserModel.get_user_by_id(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Store username for logging
    username = user.username

    try:
        # Delete from OTS first
        current_app.logger.info(f"Attempting to delete user '{username}' from OTS")
        ots = OTSClient(OTS_URL, OTS_USERNAME, OTS_PASSWORD)

        try:
            ots_response = ots.delete_user(username)
            current_app.logger.info(f"Successfully deleted user '{username}' from OTS: {ots_response}")
        except Exception as ots_error:
            current_app.logger.error(f"Failed to delete user '{username}' from OTS: {str(ots_error)}")
            # Continue with local deletion even if OTS deletion fails
            # This prevents orphaned users in local DB if OTS user doesn't exist
            current_app.logger.warning(f"Continuing with local deletion for user '{username}'")

        # Delete from local database
        current_app.logger.info(f"Deleting user '{username}' from local database")
        result = UserModel.delete_user_by_id(user_id)

        if isinstance(result, dict) and 'error' in result:
            return jsonify({'error': result['error']}), 400

        current_app.logger.info(f"Successfully deleted user '{username}' from local database")
        return jsonify({
            'message': f'User {username} deleted successfully from both OTS and local database'
        }), 200

    except Exception as e:
        current_app.logger.error(f"Failed to delete user '{username}': {str(e)}")
        return jsonify({'error': f'Failed to delete user: {str(e)}'}), 400
