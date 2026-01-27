"""
TAK Profiles API endpoints
CRUD operations and download for TAK profile management
"""

from flask import request, jsonify, send_file, g
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity, verify_jwt_in_request, decode_token
from app.api_v1 import api_v1
from app.models import TakProfileModel, UserRoleModel, UserModel, db
from werkzeug.utils import secure_filename
import os
import zipfile
import shutil
from app.settings import DATAPACKAGE_UPLOAD_FOLDER
from functools import wraps


def get_jwt_identity_custom():
    """Get JWT identity from either query parameter or standard header"""
    if hasattr(g, 'jwt_identity'):
        return g.jwt_identity
    return get_jwt_identity()


def get_jwt_custom():
    """Get JWT claims from either query parameter or standard header"""
    if hasattr(g, 'jwt_claims'):
        return g.jwt_claims
    return get_jwt()


def jwt_required_with_query():
    """
    Custom JWT decorator that accepts token from query parameter or header.
    Useful for download endpoints that are accessed via browser/direct links.
    """
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            # First try to get token from query parameter
            token = request.args.get('token')
            if token:
                try:
                    # Manually verify and decode the token
                    from flask import current_app
                    import jwt as pyjwt

                    # Decode and verify the token
                    decoded = pyjwt.decode(
                        token,
                        current_app.config['JWT_SECRET_KEY'],
                        algorithms=['HS256']
                    )

                    # Store the decoded token in g for get_jwt_identity() to use
                    g.jwt_identity = decoded['sub']
                    g.jwt_claims = decoded

                except Exception as e:
                    return jsonify({'error': f'Invalid token: {str(e)}'}), 401
            else:
                # Fall back to standard header authentication
                try:
                    verify_jwt_in_request()
                except Exception as e:
                    return jsonify({'error': 'Missing or invalid token'}), 401

            return fn(*args, **kwargs)
        return decorator
    return wrapper


def require_admin_role():
    """Check for tak_profile_admin or administrator role"""
    from app.rbac import has_any_role
    if not has_any_role(['administrator', 'tak_profile_admin']):
        return jsonify({'error': 'TAK profile admin access required'}), 403
    return None


@api_v1.route('/tak-profiles', methods=['GET'])
@jwt_required()
def get_tak_profiles():
    """Get all TAK profiles (filter by user access)"""
    current_user_id = int(get_jwt_identity())  # Convert string to int
    claims = get_jwt()
    is_admin = 'administrator' in claims.get('roles', [])

    if is_admin:
        profiles = TakProfileModel.get_all_tak_profiles()
    else:
        user = UserModel.get_user_by_id(current_user_id)
        profiles_dict = {}

        # Get profiles directly assigned to user
        if user and user.takprofiles:
            for p in user.takprofiles:
                profiles_dict[p.id] = p

        # Get profiles assigned to user's roles
        if user and user.roles:
            for role in user.roles:
                if role.takprofiles:
                    for p in role.takprofiles:
                        if p.id not in profiles_dict:
                            profiles_dict[p.id] = p

        # Get all public profiles
        public_profiles = TakProfileModel.query.filter_by(isPublic=True).all()
        for p in public_profiles:
            if p.id not in profiles_dict:
                profiles_dict[p.id] = p

        profiles = list(profiles_dict.values())

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
    current_user_id = int(get_jwt_identity())  # Convert string to int
    claims = get_jwt()
    is_admin = 'administrator' in claims.get('roles', [])

    if not is_admin and not profile.isPublic:
        user = UserModel.get_user_by_id(current_user_id)
        has_access = profile in user.takprofiles
        if not has_access and user.roles:
            # Check if profile is assigned to any of user's roles
            for role in user.roles:
                if profile in role.takprofiles:
                    has_access = True
                    break
        if not has_access:
            return jsonify({'error': 'Access denied'}), 403

    return jsonify({
        'id': profile.id,
        'name': profile.name,
        'description': profile.description,
        'isPublic': profile.isPublic,
        'takTemplateFolderLocation': profile.takTemplateFolderLocation,
        'takPrefFileLocation': profile.takPrefFileLocation,
        'roles': [{'id': r.id, 'name': r.name, 'displayName': r.display_name} for r in profile.roles]
    }), 200


@api_v1.route('/tak-profiles/<int:profile_id>/download', methods=['GET'])
@jwt_required_with_query()
def download_tak_profile(profile_id):
    """Download TAK profile as ZIP with callsign injection

    Supports JWT token from:
    - Authorization header: Authorization: Bearer <token>
    - Query parameter: ?token=<token> (for browser/direct link downloads)
    """
    current_user_id = int(get_jwt_identity_custom())  # Convert string to int
    user = UserModel.get_user_by_id(current_user_id)

    profile = TakProfileModel.get_tak_profile_by_id(profile_id)
    if not profile:
        return jsonify({'error': 'TAK profile not found'}), 404

    # Check access
    claims = get_jwt_custom()
    is_admin = 'administrator' in claims.get('roles', [])

    # Check if user has access via direct assignment, role assignment, or public
    has_access = is_admin or profile.isPublic or profile in user.takprofiles
    if not has_access and user.roles:
        # Check if profile is assigned to any of user's roles
        for role in user.roles:
            if profile in role.takprofiles:
                has_access = True
                break

    if not has_access:
        return jsonify({'error': 'Access denied'}), 403

    try:
        # Create temporary directory for customized package
        import tempfile
        temp_dir = tempfile.mkdtemp()

        # Get user callsign or use username as fallback
        callsign = user.callsign if user.callsign else user.username

        # Copy and customize the datapackage
        # Check if takTemplateFolderLocation already includes the base folder
        if profile.takTemplateFolderLocation.startswith(DATAPACKAGE_UPLOAD_FOLDER):
            # Path already includes the folder, use as-is
            source_path = profile.takTemplateFolderLocation
        else:
            # Path is relative, prepend the base folder
            source_path = os.path.join(DATAPACKAGE_UPLOAD_FOLDER, profile.takTemplateFolderLocation)

        dest_path = os.path.join(temp_dir, 'package')

        if not os.path.exists(source_path):
            return jsonify({'error': f'TAK profile files not found at: {source_path}'}), 404

        shutil.copytree(source_path, dest_path)

        # Inject user callsign into preferences file if exists
        if profile.takPrefFileLocation:
            pref_file = os.path.join(dest_path, profile.takPrefFileLocation)
            if os.path.exists(pref_file):
                with open(pref_file, 'r') as f:
                    content = f.read()
                # Replace ${callsign} placeholder with actual callsign
                content = content.replace('${callsign}', callsign)
                with open(pref_file, 'w') as f:
                    f.write(content)

        # Create ZIP file with sanitized filename
        safe_profile_name = "".join(c for c in profile.name if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_callsign = "".join(c for c in callsign if c.isalnum() or c in ('-', '_')).strip()
        zip_filename = f'{safe_profile_name}_{safe_callsign}.zip'
        zip_path = os.path.join(temp_dir, zip_filename)
        shutil.make_archive(zip_path.replace('.zip', ''), 'zip', dest_path)

        # Send file and cleanup temp directory after sending
        response = send_file(
            zip_path,
            as_attachment=True,
            download_name=zip_filename,
            mimetype='application/zip'
        )

        # Register cleanup function to run after response is sent
        @response.call_on_close
        def cleanup():
            try:
                shutil.rmtree(temp_dir)
            except:
                pass

        return response

    except Exception as e:
        # Clean up temp directory on error
        try:
            if 'temp_dir' in locals():
                shutil.rmtree(temp_dir)
        except:
            pass
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
            is_public=is_public,
            template_folder_location=folder_name,
            pref_file_location=tak_pref_file
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

        # Update roles if roleIds[] is present in the request
        if 'roleIds[]' in request.form or request.form:
            profile.roles.clear()
            role_ids = request.form.getlist('roleIds[]')
            for role_id in role_ids:
                role = UserRoleModel.get_by_id(int(role_id))
                if role:
                    profile.roles.append(role)

        # Commit directly to ensure relationship changes are saved
        db.session.commit()

        return jsonify({'message': 'TAK profile updated successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update TAK profile: {str(e)}'}), 400


@api_v1.route('/tak-profiles/<int:profile_id>/files', methods=['GET'])
@jwt_required()
def get_tak_profile_files(profile_id):
    """Get file tree structure for TAK profile (admin only)"""
    error = require_admin_role()
    if error:
        return error

    profile = TakProfileModel.get_tak_profile_by_id(profile_id)
    if not profile:
        return jsonify({'error': 'TAK profile not found'}), 404

    def make_tree(path, base_path=''):
        """Recursively build file tree structure"""
        tree = {'name': os.path.basename(path), 'path': base_path, 'children': [], 'isDir': True}
        try:
            items = os.listdir(path)
            for name in sorted(items):
                full_path = os.path.join(path, name)
                relative_path = os.path.join(base_path, name) if base_path else name

                if os.path.isdir(full_path):
                    tree['children'].append(make_tree(full_path, relative_path))
                else:
                    tree['children'].append({
                        'name': name,
                        'path': relative_path,
                        'isDir': False
                    })
        except OSError:
            pass
        return tree

    try:
        if profile.takTemplateFolderLocation:
            folder_path = os.path.join(DATAPACKAGE_UPLOAD_FOLDER, profile.takTemplateFolderLocation)
            if os.path.exists(folder_path):
                file_tree = make_tree(folder_path)
                return jsonify({'fileTree': file_tree}), 200
            else:
                return jsonify({'error': 'Profile folder not found'}), 404
        else:
            return jsonify({'error': 'No folder location specified'}), 404

    except Exception as e:
        return jsonify({'error': f'Failed to get file tree: {str(e)}'}), 400


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
