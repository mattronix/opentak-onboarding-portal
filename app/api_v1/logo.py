"""
Logo API endpoints
Upload and manage custom logo for the portal
"""

from flask import request, jsonify, current_app
from flask_jwt_extended import jwt_required
from app.api_v1 import api_v1
from app.models import SystemSettingsModel
from app import db
from werkzeug.utils import secure_filename
import os
import uuid

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_logo_upload_folder():
    """Get the path to the logo upload folder"""
    return os.path.join(current_app.root_path, 'static', 'img', 'custom')


@api_v1.route('/admin/logo', methods=['POST'])
@jwt_required()
def upload_logo():
    """
    Upload a custom logo (admin only)
    ---
    tags:
      - Logo
    security:
      - Bearer: []
    consumes:
      - multipart/form-data
    parameters:
      - name: logo
        in: formData
        type: file
        required: true
        description: Logo image file (PNG, JPG, JPEG, GIF, max 2MB)
    responses:
      200:
        description: Logo uploaded successfully
      400:
        description: Invalid file or no file provided
      403:
        description: Admin access required
      500:
        description: Failed to upload logo
    """
    from app.rbac import has_any_role
    if not has_any_role(['administrator', 'settings_admin']):
        return jsonify({'error': 'Settings admin access required'}), 403

    if 'logo' not in request.files:
        return jsonify({'error': 'No logo file provided'}), 400

    file = request.files['logo']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': f'Invalid file type. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'}), 400

    # Check file size
    file.seek(0, 2)  # Seek to end
    size = file.tell()
    file.seek(0)  # Reset to beginning
    if size > MAX_FILE_SIZE:
        return jsonify({'error': f'File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB'}), 400

    try:
        # Generate unique filename to avoid caching issues
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"logo_{uuid.uuid4().hex[:8]}.{ext}"
        filename = secure_filename(filename)

        upload_folder = get_logo_upload_folder()
        os.makedirs(upload_folder, exist_ok=True)

        # Delete old custom logo if exists
        old_logo_path = SystemSettingsModel.get_setting('custom_logo_path')
        if old_logo_path:
            old_file = os.path.join(upload_folder, os.path.basename(old_logo_path))
            if os.path.exists(old_file):
                os.remove(old_file)

        # Save new file
        filepath = os.path.join(upload_folder, filename)
        file.save(filepath)

        # Update settings
        logo_url = f'/static/img/custom/{filename}'

        # Update or create settings
        logo_enabled_setting = SystemSettingsModel.query.filter_by(key='custom_logo_enabled').first()
        if logo_enabled_setting:
            logo_enabled_setting.value = 'true'
        else:
            logo_enabled_setting = SystemSettingsModel(
                key='custom_logo_enabled',
                value='true',
                category='branding',
                description='Enable custom logo display'
            )
            db.session.add(logo_enabled_setting)

        logo_path_setting = SystemSettingsModel.query.filter_by(key='custom_logo_path').first()
        if logo_path_setting:
            logo_path_setting.value = logo_url
        else:
            logo_path_setting = SystemSettingsModel(
                key='custom_logo_path',
                value=logo_url,
                category='branding',
                description='Path to uploaded custom logo file'
            )
            db.session.add(logo_path_setting)

        db.session.commit()

        current_app.logger.info(f"Logo uploaded successfully: {logo_url}")

        return jsonify({
            'message': 'Logo uploaded successfully',
            'logo_path': logo_url
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error uploading logo: {str(e)}")
        return jsonify({'error': 'Failed to upload logo'}), 500


@api_v1.route('/admin/logo', methods=['DELETE'])
@jwt_required()
def delete_logo():
    """
    Delete custom logo and reset to default
    ---
    tags:
      - Logo
    security:
      - Bearer: []
    responses:
      200:
        description: Logo reset to default
      403:
        description: Admin access required
      500:
        description: Failed to delete logo
    """
    from app.rbac import has_any_role
    if not has_any_role(['administrator', 'settings_admin']):
        return jsonify({'error': 'Settings admin access required'}), 403

    try:
        logo_path = SystemSettingsModel.get_setting('custom_logo_path')
        if logo_path:
            upload_folder = get_logo_upload_folder()
            old_file = os.path.join(upload_folder, os.path.basename(logo_path))
            if os.path.exists(old_file):
                os.remove(old_file)

        # Update settings
        logo_enabled_setting = SystemSettingsModel.query.filter_by(key='custom_logo_enabled').first()
        if logo_enabled_setting:
            logo_enabled_setting.value = 'false'

        logo_path_setting = SystemSettingsModel.query.filter_by(key='custom_logo_path').first()
        if logo_path_setting:
            logo_path_setting.value = ''

        db.session.commit()

        current_app.logger.info("Logo reset to default")

        return jsonify({'message': 'Logo reset to default'}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting logo: {str(e)}")
        return jsonify({'error': 'Failed to delete logo'}), 500


@api_v1.route('/admin/logo', methods=['GET'])
@jwt_required()
def get_logo_settings():
    """
    Get current logo settings
    ---
    tags:
      - Logo
    security:
      - Bearer: []
    responses:
      200:
        description: Current logo settings
        schema:
          type: object
          properties:
            custom_logo_enabled:
              type: boolean
            custom_logo_path:
              type: string
            logo_display_mode:
              type: string
            default_logo_path:
              type: string
      403:
        description: Admin access required
    """
    from app.rbac import has_any_role
    if not has_any_role(['administrator', 'settings_admin']):
        return jsonify({'error': 'Settings admin access required'}), 403

    enabled = SystemSettingsModel.get_setting('custom_logo_enabled')
    custom_logo_enabled = enabled and str(enabled).lower() == 'true'

    return jsonify({
        'custom_logo_enabled': custom_logo_enabled,
        'custom_logo_path': SystemSettingsModel.get_setting('custom_logo_path') or '',
        'logo_display_mode': SystemSettingsModel.get_setting('logo_display_mode') or 'logo_and_text',
        'default_logo_path': current_app.config.get('LOGO_PATH', '/static/img/logo.png')
    }), 200
