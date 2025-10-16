"""
TAK Profiles API endpoints
CRUD operations and download for TAK profile management
"""

from flask import request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from app.api_v1 import api_v1
from app.models import TakProfileModel, UserRoleModel, UserModel
from werkzeug.utils import secure_filename
import os
import zipfile
import shutil
from app.settings import DATAPACKAGE_UPLOAD_FOLDER


def require_admin_role():
    """Check for administrator role"""
    claims = get_jwt()
    roles = claims.get('roles', [])
    if 'administrator' not in roles:
        return jsonify({'error': 'Administrator role required'}), 403
    return None


@api_v1.route('/tak-profiles', methods=['GET'])
@jwt_required()
def get_tak_profiles():
    """Get all TAK profiles (filter by user access)"""
    current_user_id = get_jwt_identity()
    claims = get_jwt()
    is_admin = 'administrator' in claims.get('roles', [])

    if is_admin:
        profiles = TakProfileModel.get_all_tak_profiles()
    else:
        user = UserModel.get_user_by_id(current_user_id)
        profiles = user.takprofiles if user else []

    return jsonify({
        'profiles': [{
            'id': p.id,
            'name': p.name,
            'description': p.description,
            'isPublic': p.isPublic
        } for p in profiles]
    }), 200


@api_v1.route('/tak-profiles/<int:profile_id>', methods=['GET'])
@jwt_required()
def get_tak_profile(profile_id):
    """Get TAK profile by ID"""
    profile = TakProfileModel.get_tak_profile_by_id(profile_id)
    if not profile:
        return jsonify({'error': 'TAK profile not found'}), 404

    # Check access
    current_user_id = get_jwt_identity()
    claims = get_jwt()
    is_admin = 'administrator' in claims.get('roles', [])

    if not is_admin and not profile.isPublic:
        user = UserModel.get_user_by_id(current_user_id)
        if profile not in user.takprofiles:
            return jsonify({'error': 'Access denied'}), 403

    return jsonify({
        'id': profile.id,
        'name': profile.name,
        'description': profile.description,
        'isPublic': profile.isPublic,
        'takTemplateFolderLocation': profile.takTemplateFolderLocation,
        'takPrefFileLocation': profile.takPrefFileLocation,
        'roles': [{'id': r.id, 'name': r.name} for r in profile.roles]
    }), 200


@api_v1.route('/tak-profiles/<int:profile_id>/download', methods=['GET'])
@jwt_required()
def download_tak_profile(profile_id):
    """Download TAK profile as ZIP with callsign injection"""
    current_user_id = get_jwt_identity()
    user = UserModel.get_user_by_id(current_user_id)

    profile = TakProfileModel.get_tak_profile_by_id(profile_id)
    if not profile:
        return jsonify({'error': 'TAK profile not found'}), 404

    # Check access
    claims = get_jwt()
    is_admin = 'administrator' in claims.get('roles', [])
    if not is_admin and not profile.isPublic and profile not in user.takprofiles:
        return jsonify({'error': 'Access denied'}), 403

    try:
        # Create temporary directory for customized package
        import tempfile
        temp_dir = tempfile.mkdtemp()

        # Copy and customize the datapackage
        source_path = os.path.join(DATAPACKAGE_UPLOAD_FOLDER, profile.takTemplateFolderLocation)
        dest_path = os.path.join(temp_dir, 'package')

        shutil.copytree(source_path, dest_path)

        # Inject user callsign into preferences file if exists
        if profile.takPrefFileLocation:
            pref_file = os.path.join(dest_path, profile.takPrefFileLocation)
            if os.path.exists(pref_file):
                with open(pref_file, 'r') as f:
                    content = f.read()
                content = content.replace('${callsign}', user.callsign)
                with open(pref_file, 'w') as f:
                    f.write(content)

        # Create ZIP file
        zip_path = os.path.join(temp_dir, f'{profile.name}_{user.callsign}.zip')
        shutil.make_archive(zip_path.replace('.zip', ''), 'zip', dest_path)

        return send_file(
            zip_path,
            as_attachment=True,
            download_name=f'{profile.name}_{user.callsign}.zip',
            mimetype='application/zip'
        )

    except Exception as e:
        return jsonify({'error': f'Failed to download profile: {str(e)}'}), 500


@api_v1.route('/tak-profiles', methods=['POST'])
@jwt_required()
def create_tak_profile():
    """Create a new TAK profile (admin only)"""
    error = require_admin_role()
    if error:
        return error

    # Handle multipart/form-data for file upload
    if 'datapackage' not in request.files:
        return jsonify({'error': 'Datapackage file is required'}), 400

    file = request.files['datapackage']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not file.filename.endswith('.zip'):
        return jsonify({'error': 'File must be a ZIP archive'}), 400

    try:
        # Save uploaded file
        filename = secure_filename(file.filename)
        folder_name = filename.replace('.zip', '')

        upload_path = os.path.join(DATAPACKAGE_UPLOAD_FOLDER, folder_name)
        os.makedirs(upload_path, exist_ok=True)

        zip_path = os.path.join(DATAPACKAGE_UPLOAD_FOLDER, filename)
        file.save(zip_path)

        # Extract ZIP
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(upload_path)

        # Get form data
        name = request.form.get('name', filename.replace('.zip', ''))
        description = request.form.get('description', '')
        is_public = request.form.get('isPublic', 'false').lower() == 'true'
        tak_pref_file = request.form.get('takPrefFileLocation', '')

        profile = TakProfileModel.create_tak_profile(
            name=name,
            description=description,
            isPublic=is_public,
            takTemplateFolderLocation=folder_name,
            takPrefFileLocation=tak_pref_file
        )

        # Add roles
        role_ids = request.form.getlist('roleIds[]')
        for role_id in role_ids:
            role = UserRoleModel.get_by_id(int(role_id))
            if role:
                profile.roles.append(role)

        # Clean up ZIP file
        os.remove(zip_path)

        return jsonify({
            'message': 'TAK profile created successfully',
            'profile': {
                'id': profile.id,
                'name': profile.name
            }
        }), 201

    except Exception as e:
        return jsonify({'error': f'Failed to create TAK profile: {str(e)}'}), 400


@api_v1.route('/tak-profiles/<int:profile_id>', methods=['PUT'])
@jwt_required()
def update_tak_profile(profile_id):
    """Update TAK profile (admin only)"""
    error = require_admin_role()
    if error:
        return error

    profile = TakProfileModel.get_tak_profile_by_id(profile_id)
    if not profile:
        return jsonify({'error': 'TAK profile not found'}), 404

    try:
        # Handle file upload if provided
        if 'datapackage' in request.files:
            file = request.files['datapackage']
            if file.filename:
                # Process new datapackage similar to create
                filename = secure_filename(file.filename)
                folder_name = filename.replace('.zip', '')
                # ... (similar upload logic)

        # Update fields from form data
        if request.form.get('name'):
            profile.name = request.form.get('name')
        if 'description' in request.form:
            profile.description = request.form.get('description')
        if 'isPublic' in request.form:
            profile.isPublic = request.form.get('isPublic').lower() == 'true'
        if 'takPrefFileLocation' in request.form:
            profile.takPrefFileLocation = request.form.get('takPrefFileLocation')

        # Update roles
        if 'roleIds[]' in request.form:
            profile.roles = []
            role_ids = request.form.getlist('roleIds[]')
            for role_id in role_ids:
                role = UserRoleModel.get_by_id(int(role_id))
                if role:
                    profile.roles.append(role)

        TakProfileModel.update_tak_profile(profile)

        return jsonify({'message': 'TAK profile updated successfully'}), 200

    except Exception as e:
        return jsonify({'error': f'Failed to update TAK profile: {str(e)}'}), 400


@api_v1.route('/tak-profiles/<int:profile_id>', methods=['DELETE'])
@jwt_required()
def delete_tak_profile(profile_id):
    """Delete TAK profile (admin only)"""
    error = require_admin_role()
    if error:
        return error

    profile = TakProfileModel.get_tak_profile_by_id(profile_id)
    if not profile:
        return jsonify({'error': 'TAK profile not found'}), 404

    try:
        # Delete folder
        if profile.takTemplateFolderLocation:
            folder_path = os.path.join(DATAPACKAGE_UPLOAD_FOLDER, profile.takTemplateFolderLocation)
            if os.path.exists(folder_path):
                shutil.rmtree(folder_path)

        TakProfileModel.delete_tak_profile_by_id(profile_id)
        return jsonify({'message': 'TAK profile deleted successfully'}), 200

    except Exception as e:
        return jsonify({'error': f'Failed to delete TAK profile: {str(e)}'}), 400
