"""
API Keys management endpoints
"""

from flask import jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.api_v1 import api_v1
from app.models import ApiKeyModel, db
from app.rbac import has_any_role
import json
from datetime import datetime


def require_api_key_admin():
    """Check if user has api_key_admin or administrator role"""
    if not has_any_role(['administrator', 'api_key_admin']):
        return jsonify({'error': 'API Key admin access required'}), 403
    return None


# Available permissions that can be assigned to API keys
API_PERMISSIONS = [
    {'key': 'users:read', 'label': 'Read Users', 'description': 'View user list and details'},
    {'key': 'users:write', 'label': 'Write Users', 'description': 'Create and update users'},
    {'key': 'roles:read', 'label': 'Read Roles', 'description': 'View roles list'},
    {'key': 'roles:write', 'label': 'Write Roles', 'description': 'Create and update roles'},
    {'key': 'tak_profiles:read', 'label': 'Read TAK Profiles', 'description': 'View TAK profiles'},
    {'key': 'tak_profiles:write', 'label': 'Write TAK Profiles', 'description': 'Create and update TAK profiles'},
    {'key': 'tak_profiles:download', 'label': 'Download TAK Profiles', 'description': 'Download TAK profile files'},
    {'key': 'onboarding_codes:read', 'label': 'Read Onboarding Codes', 'description': 'View onboarding codes'},
    {'key': 'onboarding_codes:write', 'label': 'Write Onboarding Codes', 'description': 'Create and update onboarding codes'},
    {'key': 'meshtastic:read', 'label': 'Read Meshtastic', 'description': 'View Meshtastic configurations'},
    {'key': 'meshtastic:write', 'label': 'Write Meshtastic', 'description': 'Create and update Meshtastic configurations'},
    {'key': 'radios:read', 'label': 'Read Radios', 'description': 'View radio inventory'},
    {'key': 'radios:write', 'label': 'Write Radios', 'description': 'Create and update radios'},
    {'key': 'announcements:read', 'label': 'Read Announcements', 'description': 'View announcements'},
    {'key': 'announcements:write', 'label': 'Write Announcements', 'description': 'Create and send announcements'},
    {'key': 'settings:read', 'label': 'Read Settings', 'description': 'View system settings'},
    {'key': 'settings:write', 'label': 'Write Settings', 'description': 'Update system settings'},
]


@api_v1.route('/admin/api-keys', methods=['GET'])
@jwt_required()
def get_api_keys():
    """
    Get all API keys
    """
    auth_error = require_api_key_admin()
    if auth_error:
        return auth_error

    try:
        api_keys = ApiKeyModel.get_all()
        return jsonify({
            'api_keys': [
                {
                    'id': key.id,
                    'name': key.name,
                    'description': key.description,
                    'key_prefix': key.key_prefix,
                    'permissions': key.get_permissions_list(),
                    'rate_limit': key.rate_limit,
                    'is_active': key.is_active,
                    'expires_at': key.expires_at.isoformat() if key.expires_at else None,
                    'created_at': key.created_at.isoformat() if key.created_at else None,
                    'created_by': {
                        'id': key.creator.id,
                        'username': key.creator.username
                    } if key.creator else None,
                    'last_used_at': key.last_used_at.isoformat() if key.last_used_at else None,
                    'last_used_ip': key.last_used_ip,
                    'usage_count': key.usage_count
                }
                for key in api_keys
            ]
        }), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching API keys: {str(e)}")
        return jsonify({'error': 'Failed to fetch API keys'}), 500


@api_v1.route('/admin/api-keys/<int:key_id>', methods=['GET'])
@jwt_required()
def get_api_key(key_id):
    """
    Get a single API key by ID
    """
    auth_error = require_api_key_admin()
    if auth_error:
        return auth_error

    try:
        api_key = ApiKeyModel.get_by_id(key_id)
        if not api_key:
            return jsonify({'error': 'API key not found'}), 404

        return jsonify({
            'id': api_key.id,
            'name': api_key.name,
            'description': api_key.description,
            'key_prefix': api_key.key_prefix,
            'permissions': api_key.get_permissions_list(),
            'rate_limit': api_key.rate_limit,
            'is_active': api_key.is_active,
            'expires_at': api_key.expires_at.isoformat() if api_key.expires_at else None,
            'created_at': api_key.created_at.isoformat() if api_key.created_at else None,
            'created_by': {
                'id': api_key.creator.id,
                'username': api_key.creator.username
            } if api_key.creator else None,
            'last_used_at': api_key.last_used_at.isoformat() if api_key.last_used_at else None,
            'last_used_ip': api_key.last_used_ip,
            'usage_count': api_key.usage_count
        }), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching API key: {str(e)}")
        return jsonify({'error': 'Failed to fetch API key'}), 500


@api_v1.route('/admin/api-keys', methods=['POST'])
@jwt_required()
def create_api_key():
    """
    Create a new API key
    Returns the raw key only once - it cannot be retrieved later
    """
    auth_error = require_api_key_admin()
    if auth_error:
        return auth_error

    try:
        data = request.get_json()

        if not data or not data.get('name'):
            return jsonify({'error': 'Name is required'}), 400

        # Parse expires_at if provided
        expires_at = None
        if data.get('expires_at'):
            try:
                expires_at = datetime.fromisoformat(data['expires_at'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid expires_at format'}), 400

        current_user_id = get_jwt_identity()

        api_key, raw_key = ApiKeyModel.create_api_key(
            name=data['name'],
            created_by=int(current_user_id),
            description=data.get('description'),
            permissions=data.get('permissions', []),
            rate_limit=data.get('rate_limit', 1000),
            expires_at=expires_at
        )

        if not api_key:
            return jsonify({'error': 'Failed to create API key'}), 500

        current_app.logger.info(f"API key '{api_key.name}' created by user {current_user_id}")

        return jsonify({
            'message': 'API key created successfully',
            'api_key': {
                'id': api_key.id,
                'name': api_key.name,
                'description': api_key.description,
                'key_prefix': api_key.key_prefix,
                'permissions': api_key.get_permissions_list(),
                'rate_limit': api_key.rate_limit,
                'is_active': api_key.is_active,
                'expires_at': api_key.expires_at.isoformat() if api_key.expires_at else None,
                'created_at': api_key.created_at.isoformat() if api_key.created_at else None,
            },
            'raw_key': raw_key  # Only returned on creation
        }), 201
    except Exception as e:
        current_app.logger.error(f"Error creating API key: {str(e)}")
        return jsonify({'error': 'Failed to create API key'}), 500


@api_v1.route('/admin/api-keys/<int:key_id>', methods=['PUT'])
@jwt_required()
def update_api_key(key_id):
    """
    Update an API key (name, description, permissions, rate_limit, is_active, expires_at)
    """
    auth_error = require_api_key_admin()
    if auth_error:
        return auth_error

    try:
        api_key = ApiKeyModel.get_by_id(key_id)
        if not api_key:
            return jsonify({'error': 'API key not found'}), 404

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        if 'name' in data:
            api_key.name = data['name']
        if 'description' in data:
            api_key.description = data['description']
        if 'permissions' in data:
            api_key.permissions = json.dumps(data['permissions'])
        if 'rate_limit' in data:
            api_key.rate_limit = data['rate_limit']
        if 'is_active' in data:
            api_key.is_active = data['is_active']
        if 'expires_at' in data:
            if data['expires_at']:
                try:
                    api_key.expires_at = datetime.fromisoformat(data['expires_at'].replace('Z', '+00:00'))
                except ValueError:
                    return jsonify({'error': 'Invalid expires_at format'}), 400
            else:
                api_key.expires_at = None

        db.session.commit()

        current_app.logger.info(f"API key '{api_key.name}' updated")

        return jsonify({
            'message': 'API key updated successfully',
            'api_key': {
                'id': api_key.id,
                'name': api_key.name,
                'description': api_key.description,
                'key_prefix': api_key.key_prefix,
                'permissions': api_key.get_permissions_list(),
                'rate_limit': api_key.rate_limit,
                'is_active': api_key.is_active,
                'expires_at': api_key.expires_at.isoformat() if api_key.expires_at else None,
            }
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating API key: {str(e)}")
        return jsonify({'error': 'Failed to update API key'}), 500


@api_v1.route('/admin/api-keys/<int:key_id>/regenerate', methods=['POST'])
@jwt_required()
def regenerate_api_key(key_id):
    """
    Regenerate an API key - creates a new key value
    Returns the new raw key only once
    """
    auth_error = require_api_key_admin()
    if auth_error:
        return auth_error

    try:
        api_key = ApiKeyModel.get_by_id(key_id)
        if not api_key:
            return jsonify({'error': 'API key not found'}), 404

        raw_key = api_key.regenerate()
        if not raw_key:
            return jsonify({'error': 'Failed to regenerate API key'}), 500

        current_app.logger.info(f"API key '{api_key.name}' regenerated")

        return jsonify({
            'message': 'API key regenerated successfully',
            'api_key': {
                'id': api_key.id,
                'name': api_key.name,
                'key_prefix': api_key.key_prefix,
            },
            'raw_key': raw_key
        }), 200
    except Exception as e:
        current_app.logger.error(f"Error regenerating API key: {str(e)}")
        return jsonify({'error': 'Failed to regenerate API key'}), 500


@api_v1.route('/admin/api-keys/<int:key_id>', methods=['DELETE'])
@jwt_required()
def delete_api_key(key_id):
    """
    Delete an API key
    """
    auth_error = require_api_key_admin()
    if auth_error:
        return auth_error

    try:
        api_key = ApiKeyModel.get_by_id(key_id)
        if not api_key:
            return jsonify({'error': 'API key not found'}), 404

        key_name = api_key.name
        result = ApiKeyModel.delete_by_id(key_id)

        if 'error' in result:
            return jsonify(result), 404

        current_app.logger.info(f"API key '{key_name}' deleted")

        return jsonify({'message': 'API key deleted successfully'}), 200
    except Exception as e:
        current_app.logger.error(f"Error deleting API key: {str(e)}")
        return jsonify({'error': 'Failed to delete API key'}), 500


@api_v1.route('/admin/api-keys/permissions', methods=['GET'])
@jwt_required()
def get_available_permissions():
    """
    Get list of available permissions for API keys
    """
    auth_error = require_api_key_admin()
    if auth_error:
        return auth_error

    return jsonify({'permissions': API_PERMISSIONS}), 200
