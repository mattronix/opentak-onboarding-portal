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
        "generate_atak_qr_code": boolean,
        "ots_hostname": "string",
        "meshtastic_homepage_icon_enabled": boolean
    }
    """
    # Helper function to get boolean setting from DB
    def get_bool_setting(key, default=False):
        db_value = SystemSettingsModel.get_setting(key)
        if db_value is not None and db_value != '':
            if isinstance(db_value, bool):
                return db_value
            return str(db_value).lower() == 'true'
        return default

    # Helper function to get string setting from DB
    def get_str_setting(key, default=''):
        db_value = SystemSettingsModel.get_setting(key)
        if db_value is not None:
            return db_value
        return default

    # Get enabled/value pairs for configurable settings
    brand_name_enabled = get_bool_setting('brand_name_enabled', True)
    brand_name_value = get_str_setting('brand_name_value', 'My OTS Portal')

    settings = {
        # Brand name - only show if enabled
        'brand_name': brand_name_value if brand_name_enabled else 'My OTS Portal',
        'primary_color': current_app.config.get('PRIMARY_COLOR', '#000000'),
        'secondary_color': current_app.config.get('SECONDARY_COLOR', 'orange'),
        'accent_color': current_app.config.get('ACCENT_COLOR', 'orange'),
        'logo_path': current_app.config.get('LOGO_PATH', '/static/img/logo.png'),
        'generate_atak_qr_code': get_bool_setting('generate_atak_qr_code', True),
        'generate_itak_qr_code': get_bool_setting('generate_itak_qr_code', True),
        'ots_hostname': current_app.config.get('OTS_HOSTNAME', ''),
        'ots_url': current_app.config.get('OTS_URL', ''),
        'meshtastic_homepage_icon_enabled': get_bool_setting('meshtastic_homepage_icon_enabled', True),
        'atak_homepage_icon_enabled': get_bool_setting('atak_homepage_icon_enabled', True),
        'itak_homepage_icon_enabled': get_bool_setting('itak_homepage_icon_enabled', True),
        'truststore_homepage_icon_enabled': get_bool_setting('truststore_homepage_icon_enabled', False),
        # Installer QR codes
        'atak_installer_qr_enabled': get_bool_setting('atak_installer_qr_enabled', True),
        'atak_installer_qr_url': get_str_setting('atak_installer_qr_url', 'https://play.google.com/store/apps/details?id=com.atakmap.app.civ&hl=en'),
        'itak_installer_qr_enabled': get_bool_setting('itak_installer_qr_enabled', True),
        'itak_installer_qr_url': get_str_setting('itak_installer_qr_url', 'https://apps.apple.com/app/itak/id1561656396'),
        'meshtastic_installer_qr_android_enabled': get_bool_setting('meshtastic_installer_qr_android_enabled', True),
        'meshtastic_installer_qr_android_url': get_str_setting('meshtastic_installer_qr_android_url', 'https://play.google.com/store/apps/details?id=com.geeksville.mesh'),
        'meshtastic_installer_qr_iphone_enabled': get_bool_setting('meshtastic_installer_qr_iphone_enabled', True),
        'meshtastic_installer_qr_iphone_url': get_str_setting('meshtastic_installer_qr_iphone_url', 'https://apps.apple.com/app/meshtastic/id1586432531'),
        # Logo settings
        'custom_logo_enabled': get_bool_setting('custom_logo_enabled', False),
        'custom_logo_path': get_str_setting('custom_logo_path', ''),
        'logo_display_mode': get_str_setting('logo_display_mode', 'logo_and_text'),
        'default_logo_path': current_app.config.get('LOGO_PATH', '/static/img/logo.png'),
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
        # Check if user has settings_admin or administrator role
        from app.rbac import has_any_role
        if not has_any_role(['administrator', 'settings_admin']):
            return jsonify({'error': 'Settings admin access required'}), 403

        # Initialize defaults if needed
        SystemSettingsModel.initialize_defaults()

        # Get settings by category
        settings_by_category = {}
        categories = ['notifications', 'registration', 'email', 'security', 'qr_enrollment', 'branding', 'general']

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
        # Check if user has settings_admin or administrator role
        from app.rbac import has_any_role
        if not has_any_role(['administrator', 'settings_admin']):
            return jsonify({'error': 'Settings admin access required'}), 403

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
        # Check if user has settings_admin or administrator role
        from app.rbac import has_any_role
        if not has_any_role(['administrator', 'settings_admin']):
            return jsonify({'error': 'Settings admin access required'}), 403

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
