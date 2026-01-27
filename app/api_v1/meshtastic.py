"""
Meshtastic API endpoints
CRUD operations for Meshtastic radio configuration management
"""

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from app.api_v1 import api_v1
from app.models import MeshtasticModel, UserRoleModel, UserModel, db
import yaml


def require_admin_role():
    """Check for meshtastic_admin or administrator role"""
    from app.rbac import has_any_role
    if not has_any_role(['administrator', 'meshtastic_admin']):
        return jsonify({'error': 'Meshtastic admin access required'}), 403
    return None


@api_v1.route('/meshtastic', methods=['GET'])
@jwt_required()
def get_meshtastic_configs():
    """Get all Meshtastic configs (filter by user access)"""
    current_user_id = int(get_jwt_identity())  # Convert string to int
    claims = get_jwt()
    is_admin = 'administrator' in claims.get('roles', [])

    if is_admin:
        configs = MeshtasticModel.get_all_meshtastic()
    else:
        user = UserModel.get_user_by_id(current_user_id)
        # Get user's assigned configs plus all public configs
        user_configs = user.meshtastic if user else []
        public_configs = MeshtasticModel.query.filter_by(isPublic=True).all()

        # Combine and deduplicate
        configs_dict = {c.id: c for c in user_configs}
        for c in public_configs:
            if c.id not in configs_dict:
                configs_dict[c.id] = c

        configs = list(configs_dict.values())

    return jsonify({
        'configs': [{
            'id': m.id,
            'name': m.name,
            'description': m.description,
            'url': m.url,
            'isPublic': m.isPublic,
            'defaultRadioConfig': m.defaultRadioConfig,
            'showOnHomepage': m.showOnHomepage
        } for m in configs]
    }), 200


@api_v1.route('/meshtastic/<int:config_id>', methods=['GET'])
@jwt_required()
def get_meshtastic_config(config_id):
    """Get Meshtastic config by ID"""
    config = MeshtasticModel.get_by_id(config_id)
    if not config:
        return jsonify({'error': 'Meshtastic config not found'}), 404

    # Check access
    current_user_id = int(get_jwt_identity())  # Convert string to int
    claims = get_jwt()
    is_admin = 'administrator' in claims.get('roles', [])

    if not is_admin and not config.isPublic:
        user = UserModel.get_user_by_id(current_user_id)
        if config not in user.meshtastic:
            return jsonify({'error': 'Access denied'}), 403

    return jsonify({
        'id': config.id,
        'name': config.name,
        'description': config.description,
        'url': config.url,
        'isPublic': config.isPublic,
        'yamlConfig': config.yamlConfig,
        'defaultRadioConfig': config.defaultRadioConfig,
        'showOnHomepage': config.showOnHomepage,
        'roles': [{'id': r.id, 'name': r.name, 'displayName': r.display_name} for r in config.roles]
    }), 200


@api_v1.route('/meshtastic', methods=['POST'])
@jwt_required()
def create_meshtastic_config():
    """Create a new Meshtastic config (admin only)"""
    error = require_admin_role()
    if error:
        return error

    data = request.get_json()

    required_fields = ['name', 'yamlConfig']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    # Validate YAML
    try:
        yaml.safe_load(data['yamlConfig'])
    except yaml.YAMLError as e:
        return jsonify({'error': f'Invalid YAML: {str(e)}'}), 400

    # Check if name already exists
    existing = MeshtasticModel.query.filter_by(name=data['name']).first()
    if existing:
        return jsonify({'error': 'Config with this name already exists'}), 409

    try:
        config = MeshtasticModel.create_meshtastic(
            name=data['name'],
            description=data.get('description', ''),
            url=data.get('url', ''),
            isPublic=data.get('isPublic', False),
            yamlConfig=data['yamlConfig'],
            defaultRadioConfig=data.get('defaultRadioConfig', False),
            showOnHomepage=data.get('showOnHomepage', False)
        )

        # Add roles
        if data.get('roleIds'):
            for role_id in data['roleIds']:
                role = UserRoleModel.get_by_id(role_id)
                if role:
                    config.roles.append(role)

        return jsonify({
            'message': 'Meshtastic config created successfully',
            'config': {
                'id': config.id,
                'name': config.name
            }
        }), 201

    except Exception as e:
        return jsonify({'error': f'Failed to create config: {str(e)}'}), 400


@api_v1.route('/meshtastic/<int:config_id>', methods=['PUT'])
@jwt_required()
def update_meshtastic_config(config_id):
    """Update Meshtastic config (admin only)"""
    error = require_admin_role()
    if error:
        return error

    config = MeshtasticModel.get_by_id(config_id)
    if not config:
        return jsonify({'error': 'Meshtastic config not found'}), 404

    data = request.get_json()

    try:
        if data.get('name'):
            # Check for name conflict
            existing = MeshtasticModel.query.filter_by(name=data['name']).first()
            if existing and existing.id != config_id:
                return jsonify({'error': 'Config with this name already exists'}), 409
            config.name = data['name']

        if 'description' in data:
            config.description = data['description']
        if 'url' in data:
            config.url = data['url']
        if 'isPublic' in data:
            config.isPublic = data['isPublic']
        if 'defaultRadioConfig' in data:
            config.defaultRadioConfig = data['defaultRadioConfig']
        if 'showOnHomepage' in data:
            config.showOnHomepage = data['showOnHomepage']

        if data.get('yamlConfig'):
            # Validate YAML
            yaml.safe_load(data['yamlConfig'])
            config.yamlConfig = data['yamlConfig']

        # Update roles if roleIds is provided in the request
        if 'roleIds' in data:
            config.roles.clear()
            for role_id in data['roleIds']:
                role = UserRoleModel.get_by_id(role_id)
                if role:
                    config.roles.append(role)

        # Commit directly to ensure relationship changes are saved
        db.session.commit()

        return jsonify({'message': 'Meshtastic config updated successfully'}), 200

    except yaml.YAMLError as e:
        return jsonify({'error': f'Invalid YAML: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update config: {str(e)}'}), 400


@api_v1.route('/meshtastic/<int:config_id>', methods=['DELETE'])
@jwt_required()
def delete_meshtastic_config(config_id):
    """Delete Meshtastic config (admin only)"""
    error = require_admin_role()
    if error:
        return error

    config = MeshtasticModel.get_by_id(config_id)
    if not config:
        return jsonify({'error': 'Meshtastic config not found'}), 404

    try:
        MeshtasticModel.delete_meshtastic_by_id(config_id)
        return jsonify({'message': 'Meshtastic config deleted successfully'}), 200

    except Exception as e:
        return jsonify({'error': f'Failed to delete config: {str(e)}'}), 400
