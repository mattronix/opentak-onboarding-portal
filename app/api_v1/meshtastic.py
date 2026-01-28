"""
Meshtastic API endpoints
CRUD operations for Meshtastic radio configuration management

Syncs with OTS for: name, description, url (channel_url)
Local-only fields: yamlConfig, isPublic, defaultRadioConfig, showOnHomepage, roles, users
"""

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from app.api_v1 import api_v1
from app.models import MeshtasticModel, UserRoleModel, UserModel, db
from app.services.meshtastic_sync import MeshtasticSyncService
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
    """Get all Meshtastic configs (filter by user access via roles only)"""
    current_user_id = int(get_jwt_identity())
    user = UserModel.get_user_by_id(current_user_id)
    user_role_ids = [r.id for r in user.roles] if user else []

    # Get configs based on access (admin status does NOT grant automatic access):
    # 1. Directly assigned to user
    # 2. Assigned to one of user's roles
    # 3. Public configs
    user_configs = user.meshtastic if user else []
    public_configs = MeshtasticModel.query.filter_by(isPublic=True).all()

    # Get configs assigned to user's roles
    role_configs = []
    if user_role_ids:
        all_configs = MeshtasticModel.query.all()
        for config in all_configs:
            config_role_ids = [r.id for r in config.roles]
            if any(rid in user_role_ids for rid in config_role_ids):
                role_configs.append(config)

    # Combine and deduplicate
    configs_dict = {c.id: c for c in user_configs}
    for c in role_configs:
        if c.id not in configs_dict:
            configs_dict[c.id] = c
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
            'showOnHomepage': m.showOnHomepage,
            'ots_id': m.ots_id,
            'synced_at': m.synced_at.isoformat() if m.synced_at else None,
            'group_id': m.group_id,
            'slot_number': m.slot_number
        } for m in configs]
    }), 200


@api_v1.route('/meshtastic/admin', methods=['GET'])
@jwt_required()
def get_all_meshtastic_configs_admin():
    """Get ALL Meshtastic configs (admin only, no filtering)"""
    error = require_admin_role()
    if error:
        return error

    configs = MeshtasticModel.query.all()

    return jsonify({
        'configs': [{
            'id': m.id,
            'name': m.name,
            'description': m.description,
            'url': m.url,
            'isPublic': m.isPublic,
            'defaultRadioConfig': m.defaultRadioConfig,
            'showOnHomepage': m.showOnHomepage,
            'ots_id': m.ots_id,
            'synced_at': m.synced_at.isoformat() if m.synced_at else None,
            'group_id': m.group_id,
            'slot_number': m.slot_number,
            'roles': [{'id': r.id, 'name': r.name} for r in m.roles]
        } for m in configs]
    }), 200


@api_v1.route('/meshtastic/<int:config_id>', methods=['GET'])
@jwt_required()
def get_meshtastic_config(config_id):
    """Get Meshtastic config by ID"""
    config = MeshtasticModel.get_by_id(config_id)
    if not config:
        return jsonify({'error': 'Meshtastic config not found'}), 404

    # Check access (admin status does NOT grant automatic access)
    current_user_id = int(get_jwt_identity())
    user = UserModel.get_user_by_id(current_user_id)

    if not config.isPublic:
        user_role_ids = [r.id for r in user.roles] if user else []
        config_role_ids = [r.id for r in config.roles]

        # Check direct assignment or role-based access
        has_direct_access = config in user.meshtastic if user else False
        has_role_access = any(rid in user_role_ids for rid in config_role_ids)

        if not has_direct_access and not has_role_access:
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
        'ots_id': config.ots_id,
        'synced_at': config.synced_at.isoformat() if config.synced_at else None,
        'roles': [{'id': r.id, 'name': r.name, 'displayName': r.display_name} for r in config.roles]
    }), 200


@api_v1.route('/meshtastic', methods=['POST'])
@jwt_required()
def create_meshtastic_config():
    """Create a new Meshtastic config (admin only) and sync to OTS"""
    error = require_admin_role()
    if error:
        return error

    data = request.get_json()

    # URL is required for new configs (name will be derived from channel)
    url = data.get('url', '').strip()
    if not url:
        return jsonify({'error': 'Channel URL is required'}), 400

    # Name is optional - will be derived from OTS if not provided
    name = data.get('name', '').strip() or f"Channel {url[:20]}..."

    # Validate URL format
    url_lower = url.lower()
    if not (url_lower.startswith('meshtastic://') or url_lower.startswith('https://meshtastic.org/e/#')):
        return jsonify({'error': 'Invalid URL format. Must be a meshtastic:// or https://meshtastic.org/e/# URL from the Meshtastic app'}), 400

    # Check if URL already exists
    existing_url = MeshtasticModel.query.filter_by(url=url).first()
    if existing_url:
        return jsonify({'error': f'A config with this channel URL already exists: "{existing_url.name}"'}), 409

    # Validate YAML if provided
    if data.get('yamlConfig'):
        try:
            yaml.safe_load(data['yamlConfig'])
        except yaml.YAMLError as e:
            return jsonify({'error': f'Invalid YAML: {str(e)}'}), 400

    try:
        # Get roles
        roles = []
        if data.get('roleIds'):
            for role_id in data['roleIds']:
                role = UserRoleModel.get_by_id(role_id)
                if role:
                    roles.append(role)

        # Always sync to OTS (URL is required)
        sync_to_ots = data.get('syncToOts', True)

        config, error_msg = MeshtasticSyncService.create_config(
            name=name,
            description=data.get('description', ''),
            url=url,
            yaml_config=data.get('yamlConfig'),
            is_public=data.get('isPublic', False),
            default_radio_config=data.get('defaultRadioConfig', False),
            show_on_homepage=data.get('showOnHomepage', False),
            roles=roles,
            sync_to_ots=sync_to_ots
        )

        if not config:
            return jsonify({'error': f'Failed to create config: {error_msg}'}), 400

        response = {
            'message': 'Meshtastic config created successfully',
            'config': {
                'id': config.id,
                'name': config.name,
                'ots_id': config.ots_id,
                'synced_at': config.synced_at.isoformat() if config.synced_at else None
            }
        }

        # Include warning if OTS sync failed
        if error_msg:
            response['warning'] = error_msg

        return jsonify(response), 201

    except Exception as e:
        return jsonify({'error': f'Failed to create config: {str(e)}'}), 400


@api_v1.route('/meshtastic/<int:config_id>', methods=['PUT'])
@jwt_required()
def update_meshtastic_config(config_id):
    """Update Meshtastic config (admin only) and sync to OTS"""
    error = require_admin_role()
    if error:
        return error

    config = MeshtasticModel.get_by_id(config_id)
    if not config:
        return jsonify({'error': 'Meshtastic config not found'}), 404

    data = request.get_json()

    try:
        # Check for name conflict
        if data.get('name'):
            existing = MeshtasticModel.query.filter_by(name=data['name']).first()
            if existing and existing.id != config_id:
                return jsonify({'error': 'Config with this name already exists'}), 409

        # Validate YAML if provided
        if data.get('yamlConfig'):
            try:
                yaml.safe_load(data['yamlConfig'])
            except yaml.YAMLError as e:
                return jsonify({'error': f'Invalid YAML: {str(e)}'}), 400

        # Validate URL format if provided
        url = data.get('url', '').strip() if data.get('url') else None
        if url:
            url_lower = url.lower()
            if not (url_lower.startswith('meshtastic://') or url_lower.startswith('https://meshtastic.org/e/#')):
                return jsonify({'error': 'Invalid URL format. Must be a meshtastic:// or https://meshtastic.org/e/# URL from the Meshtastic app'}), 400
            # Check if URL already exists on a different config
            existing_url = MeshtasticModel.query.filter_by(url=url).first()
            if existing_url and existing_url.id != config_id:
                return jsonify({'error': f'A config with this channel URL already exists: "{existing_url.name}"'}), 409

        # Get roles if provided
        roles = None
        if 'roleIds' in data:
            roles = []
            for role_id in data['roleIds']:
                role = UserRoleModel.get_by_id(role_id)
                if role:
                    roles.append(role)

        # Determine if we should sync to OTS
        sync_to_ots = data.get('syncToOts', True)

        updated_config, error_msg = MeshtasticSyncService.update_config(
            config_id=config_id,
            name=data.get('name'),
            description=data.get('description'),
            url=data.get('url'),
            yaml_config=data.get('yamlConfig'),
            is_public=data.get('isPublic'),
            default_radio_config=data.get('defaultRadioConfig'),
            show_on_homepage=data.get('showOnHomepage'),
            roles=roles,
            sync_to_ots=sync_to_ots
        )

        if not updated_config:
            return jsonify({'error': f'Failed to update config: {error_msg}'}), 400

        response = {
            'message': 'Meshtastic config updated successfully',
            'synced_at': updated_config.synced_at.isoformat() if updated_config.synced_at else None
        }

        # Include warning if OTS sync failed
        if error_msg:
            response['warning'] = error_msg

        return jsonify(response), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update config: {str(e)}'}), 400


@api_v1.route('/meshtastic/<int:config_id>', methods=['DELETE'])
@jwt_required()
def delete_meshtastic_config(config_id):
    """Delete Meshtastic config (admin only) and remove from OTS"""
    error = require_admin_role()
    if error:
        return error

    config = MeshtasticModel.get_by_id(config_id)
    if not config:
        return jsonify({'error': 'Meshtastic config not found'}), 404

    # Check if we should also delete from OTS
    delete_from_ots = request.args.get('deleteFromOts', 'true').lower() == 'true'

    try:
        success, error_msg = MeshtasticSyncService.delete_config(
            config_id=config_id,
            delete_from_ots=delete_from_ots
        )

        if not success:
            return jsonify({'error': f'Failed to delete config: {error_msg}'}), 400

        response = {'message': 'Meshtastic config deleted successfully'}

        # Include warning if OTS deletion failed
        if error_msg:
            response['warning'] = error_msg

        return jsonify(response), 200

    except Exception as e:
        return jsonify({'error': f'Failed to delete config: {str(e)}'}), 400


@api_v1.route('/meshtastic/sync', methods=['POST'])
@jwt_required()
def sync_meshtastic_from_ots():
    """Sync Meshtastic configs from OTS (admin only)"""
    error = require_admin_role()
    if error:
        return error

    try:
        created, updated, errors = MeshtasticSyncService.sync_from_ots()

        response = {
            'message': 'Sync completed',
            'created': created,
            'updated': updated
        }

        if errors:
            response['errors'] = errors

        return jsonify(response), 200

    except Exception as e:
        return jsonify({'error': f'Sync failed: {str(e)}'}), 500


@api_v1.route('/meshtastic/<int:config_id>/sync', methods=['POST'])
@jwt_required()
def sync_single_meshtastic_to_ots(config_id):
    """Push a single Meshtastic config to OTS (admin only)"""
    error = require_admin_role()
    if error:
        return error

    config = MeshtasticModel.get_by_id(config_id)
    if not config:
        return jsonify({'error': 'Meshtastic config not found'}), 404

    if not config.url:
        return jsonify({'error': 'Config must have a URL to sync to OTS'}), 400

    # Validate URL format
    url_lower = config.url.lower()
    if not (url_lower.startswith('meshtastic://') or url_lower.startswith('https://meshtastic.org/e/#')):
        return jsonify({'error': 'Invalid URL format. Must be a meshtastic:// or https://meshtastic.org/e/# URL from the Meshtastic app'}), 400

    try:
        success, error_msg = MeshtasticSyncService.push_to_ots(config)

        if not success:
            return jsonify({'error': f'Sync failed: {error_msg}'}), 500

        return jsonify({
            'message': 'Config synced to OTS successfully',
            'ots_id': config.ots_id,
            'synced_at': config.synced_at.isoformat() if config.synced_at else None
        }), 200

    except Exception as e:
        return jsonify({'error': f'Sync failed: {str(e)}'}), 500
