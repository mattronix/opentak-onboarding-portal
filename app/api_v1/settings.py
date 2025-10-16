"""
Settings API endpoint
Returns application configuration settings for the frontend
"""

from flask import jsonify, current_app
from app.api_v1 import api_v1


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
