"""
Roles API endpoints
CRUD operations for role management
"""

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app.api_v1 import api_v1
from app.models import UserRoleModel


def require_admin_role():
    """Check for administrator role"""
    claims = get_jwt()
    roles = claims.get('roles', [])
    if 'administrator' not in roles:
        return jsonify({'error': 'Administrator role required'}), 403
    return None


@api_v1.route('/roles', methods=['GET'])
@jwt_required()
def get_roles():
    """Get all roles"""
    roles = UserRoleModel.get_all_roles()

    return jsonify({
        'roles': [{
            'id': role.id,
            'name': role.name,
            'description': role.description,
            'userCount': len(role.users)
        } for role in roles]
    }), 200


@api_v1.route('/roles/<int:role_id>', methods=['GET'])
@jwt_required()
def get_role(role_id):
    """Get role by ID with details"""
    role = UserRoleModel.get_by_id(role_id)
    if not role:
        return jsonify({'error': 'Role not found'}), 404

    return jsonify({
        'id': role.id,
        'name': role.name,
        'description': role.description,
        'users': [{'id': u.id, 'username': u.username} for u in role.users],
        'takProfiles': [{'id': tp.id, 'name': tp.name} for tp in role.takprofiles],
        'meshtastic': [{'id': m.id, 'name': m.name} for m in role.meshtastic]
    }), 200


@api_v1.route('/roles', methods=['POST'])
@jwt_required()
def create_role():
    """Create a new role (admin only)"""
    error = require_admin_role()
    if error:
        return error

    data = request.get_json()

    if not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400

    # Check if role already exists
    existing = UserRoleModel.get_role_by_name(data['name'])
    if existing:
        return jsonify({'error': 'Role already exists'}), 409

    try:
        role = UserRoleModel.create_role(
            name=data['name'],
            description=data.get('description', '')
        )

        return jsonify({
            'message': 'Role created successfully',
            'role': {
                'id': role.id,
                'name': role.name,
                'description': role.description
            }
        }), 201

    except Exception as e:
        return jsonify({'error': f'Failed to create role: {str(e)}'}), 400


@api_v1.route('/roles/<int:role_id>', methods=['PUT'])
@jwt_required()
def update_role(role_id):
    """Update role (admin only)"""
    error = require_admin_role()
    if error:
        return error

    role = UserRoleModel.get_by_id(role_id)
    if not role:
        return jsonify({'error': 'Role not found'}), 404

    data = request.get_json()

    if data.get('name'):
        # Check if new name conflicts with existing role
        existing = UserRoleModel.get_role_by_name(data['name'])
        if existing and existing.id != role_id:
            return jsonify({'error': 'Role name already exists'}), 409
        role.name = data['name']

    if 'description' in data:
        role.description = data['description']

    try:
        UserRoleModel.update(role)

        return jsonify({
            'message': 'Role updated successfully',
            'role': {
                'id': role.id,
                'name': role.name,
                'description': role.description
            }
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to update role: {str(e)}'}), 400


@api_v1.route('/roles/<int:role_id>', methods=['DELETE'])
@jwt_required()
def delete_role(role_id):
    """Delete role (admin only)"""
    error = require_admin_role()
    if error:
        return error

    role = UserRoleModel.get_by_id(role_id)
    if not role:
        return jsonify({'error': 'Role not found'}), 404

    try:
        UserRoleModel.delete_by_id(role_id)
        return jsonify({'message': 'Role deleted successfully'}), 200

    except Exception as e:
        return jsonify({'error': f'Failed to delete role: {str(e)}'}), 400
