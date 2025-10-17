"""
Settings API endpoint
Returns application configuration settings for the frontend
"""

from flask import jsonify, current_app, request
from flask_jwt_extended import jwt_required, get_jwt
from app.api_v1 import api_v1
from app.models import SystemSettingsModel
from app import db


@api_v1.route('/settings', methods=['GET'])
def get_settings():
    """
    Get public application settings

    Returns configuration that the frontend needs to know about,
    such as feature flags and display settings.

    Response:
    {
        "brand_name": "string",
        "primary_color": "string",
        "secondary_color": "string",
        "accent_color": "string",
        "logo_path": "string",
        "help_link": "string",
        "help_email": "string",
        "generate_itak_qr_code": boolean,
        "itak_hostname": "string",
        "ots_hostname": "string",
        "itak_homepage_icon_enabled": boolean,
        "truststore_homepage_icon_enabled": boolean,
        "zerotier_icon": boolean,
        "enable_repo": boolean,
        "enable_claim_radio": boolean,
        "forgot_password_enabled": boolean
    }
    """
    settings = {
        'brand_name': current_app.config.get('BRAND_NAME', 'My OTS Portal'),
        'primary_color': current_app.config.get('PRIMARY_COLOR', '#000000'),
        'secondary_color': current_app.config.get('SECONDARY_COLOR', 'orange'),
        'accent_color': current_app.config.get('ACCENT_COLOR', 'orange'),
        'logo_path': current_app.config.get('LOGO_PATH', '/static/img/logo.png'),
        'help_link': current_app.config.get('HELP_LINK', 'https://www.google.com'),
        'help_email': current_app.config.get('HELP_EMAIL', 'help@example.nl'),
        'generate_itak_qr_code': bool(current_app.config.get('GENERATE_ITAK_QR_CODE', True)),
        'itak_hostname': current_app.config.get('ITAK_HOSTNAME', ''),
        'ots_hostname': current_app.config.get('OTS_HOSTNAME', ''),
        'ots_url': current_app.config.get('OTS_URL', ''),
        'itak_homepage_icon_enabled': bool(current_app.config.get('ITAK_HOMEPAGE_ICON_ENABLED', True)),
        'truststore_homepage_icon_enabled': bool(current_app.config.get('TRUSTSTORE_HOMEPAGE_ICON_ENABLED', True)),
        'zerotier_icon': bool(current_app.config.get('ZEROTIER_ICON', False)),
        'enable_repo': bool(current_app.config.get('ENABLE_REPO', False)),
        'enable_claim_radio': bool(current_app.config.get('ENABLE_CLAIM_RADIO', False)),
        'forgot_password_enabled': bool(current_app.config.get('FORGOT_PASSWORD_ENABLED', True)),
    }

    return jsonify(settings), 200


@api_v1.route('/admin/settings', methods=['GET'])
@jwt_required()
def get_admin_settings():
    """
    Get all system settings grouped by category
    ---
    tags:
      - Settings
    security:
      - Bearer: []
    responses:
      200:
        description: System settings grouped by category
        schema:
          type: object
          properties:
            notifications:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                  key:
                    type: string
                  value:
                    type: string
                  description:
                    type: string
            email:
              type: array
              items:
                type: object
            security:
              type: array
              items:
                type: object
            general:
              type: array
              items:
                type: object
      403:
        description: Admin access required
      500:
        description: Failed to retrieve settings
    """
    try:
        # Check if user is admin
        claims = get_jwt()
        if 'administrator' not in claims.get('roles', []) and 'admin' not in claims.get('roles', []):
            return jsonify({'error': 'Admin access required'}), 403

        # Initialize defaults if needed
        SystemSettingsModel.initialize_defaults()

        # Get settings by category
        settings_by_category = {}
        categories = ['notifications', 'email', 'security', 'general']

        for category in categories:
            settings = SystemSettingsModel.get_category_settings(category)
            settings_by_category[category] = [
                {
                    'id': s.id,
                    'key': s.key,
                    'value': s.value,
                    'description': s.description
                }
                for s in settings
            ]

        return jsonify(settings_by_category), 200

    except Exception as e:
        current_app.logger.error(f"Error getting admin settings: {str(e)}")
        return jsonify({'error': 'Failed to retrieve settings'}), 500


@api_v1.route('/admin/settings/<int:setting_id>', methods=['PUT'])
@jwt_required()
def update_admin_setting(setting_id):
    """
    Update a system setting by ID (admin only)
    ---
    tags:
      - Settings
    security:
      - Bearer: []
    parameters:
      - name: setting_id
        in: path
        type: integer
        required: true
        description: The ID of the setting to update
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - value
          properties:
            value:
              type: string
              description: The new value for the setting (can be "true"/"false" for booleans)
    responses:
      200:
        description: Setting updated successfully
        schema:
          type: object
          properties:
            message:
              type: string
            setting:
              type: object
              properties:
                id:
                  type: integer
                key:
                  type: string
                value:
                  type: string
                description:
                  type: string
      400:
        description: Value is required
      403:
        description: Admin access required
      404:
        description: Setting not found
      500:
        description: Failed to update setting
    """
    try:
        # Check if user is admin
        claims = get_jwt()
        if 'administrator' not in claims.get('roles', []) and 'admin' not in claims.get('roles', []):
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data or 'value' not in data:
            return jsonify({'error': 'Value is required'}), 400

        # Get the setting
        setting = SystemSettingsModel.query.get(setting_id)
        if not setting:
            return jsonify({'error': 'Setting not found'}), 404

        # Update the setting
        setting.value = str(data['value']).lower() if isinstance(data['value'], bool) else data['value']
        db.session.commit()

        current_app.logger.info(f"Setting '{setting.key}' updated to '{setting.value}'")

        return jsonify({
            'message': 'Setting updated successfully',
            'setting': {
                'id': setting.id,
                'key': setting.key,
                'value': setting.value,
                'description': setting.description
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating setting: {str(e)}")
        return jsonify({'error': 'Failed to update setting'}), 500


@api_v1.route('/admin/settings/key/<key>', methods=['PUT'])
@jwt_required()
def update_admin_setting_by_key(key):
    """
    Update a system setting by key name (admin only)
    ---
    tags:
      - Settings
    security:
      - Bearer: []
    parameters:
      - name: key
        in: path
        type: string
        required: true
        description: The key name of the setting to update (e.g., "notify_admin_pending_registration")
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - value
          properties:
            value:
              type: string
              description: The new value for the setting (can be "true"/"false" for booleans)
    responses:
      200:
        description: Setting updated successfully
        schema:
          type: object
          properties:
            message:
              type: string
            setting:
              type: object
              properties:
                id:
                  type: integer
                key:
                  type: string
                value:
                  type: string
                description:
                  type: string
      400:
        description: Value is required
      403:
        description: Admin access required
      404:
        description: Setting not found
      500:
        description: Failed to update setting
    """
    try:
        # Check if user is admin
        claims = get_jwt()
        if 'administrator' not in claims.get('roles', []) and 'admin' not in claims.get('roles', []):
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data or 'value' not in data:
            return jsonify({'error': 'Value is required'}), 400

        # Get the setting
        setting = SystemSettingsModel.query.filter_by(key=key).first()
        if not setting:
            return jsonify({'error': 'Setting not found'}), 404

        # Update the setting
        setting.value = str(data['value']).lower() if isinstance(data['value'], bool) else data['value']
        db.session.commit()

        current_app.logger.info(f"Setting '{setting.key}' updated to '{setting.value}'")

        return jsonify({
            'message': 'Setting updated successfully',
            'setting': {
                'id': setting.id,
                'key': setting.key,
                'value': setting.value,
                'description': setting.description
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating setting: {str(e)}")
        return jsonify({'error': 'Failed to update setting'}), 500
