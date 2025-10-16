"""
Packages API endpoints
CRUD operations for ATAK app and plugin package management
"""

from flask import request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt
from app.api_v1 import api_v1
from app.models import PackageModel
from werkzeug.utils import secure_filename
import os
from app.settings import UPDATES_UPLOAD_FOLDER


def require_admin_role():
    """Check for administrator role"""
    claims = get_jwt()
    roles = claims.get('roles', [])
    if 'administrator' not in roles:
        return jsonify({'error': 'Administrator role required'}), 403
    return None


@api_v1.route('/packages', methods=['GET'])
@jwt_required()
def get_packages():
    """Get all packages"""
    packages = PackageModel.get_all()

    return jsonify({
        'packages': [{
            'id': p.id,
            'name': p.name,
            'platform': p.platform,
            'typePackage': p.typePackage,
            'description': p.description,
            'version': p.version,
            'revisionCode': p.revisionCode,
            'apkHash': p.apkHash,
            'apkSize': p.apkSize,
            'fullPackageName': p.fullPackageName,
            'osRequirement': p.osRequirement,
            'takPreReq': p.takPreReq,
            'hasFile': p.fileLocation and os.path.exists(os.path.join(UPDATES_UPLOAD_FOLDER, p.fileLocation)),
            'hasImage': p.imageLocation and os.path.exists(os.path.join(UPDATES_UPLOAD_FOLDER, p.imageLocation))
        } for p in packages]
    }), 200


@api_v1.route('/packages/<int:package_id>', methods=['GET'])
@jwt_required()
def get_package(package_id):
    """Get package by ID"""
    package = PackageModel.get_by_id(package_id)
    if not package:
        return jsonify({'error': 'Package not found'}), 404

    return jsonify({
        'id': package.id,
        'name': package.name,
        'platform': package.platform,
        'typePackage': package.typePackage,
        'description': package.description,
        'fileLocation': package.fileLocation,
        'imageLocation': package.imageLocation,
        'version': package.version,
        'revisionCode': package.revisionCode,
        'apkHash': package.apkHash,
        'apkSize': package.apkSize,
        'fullPackageName': package.fullPackageName,
        'osRequirement': package.osRequirement,
        'takPreReq': package.takPreReq
    }), 200


@api_v1.route('/packages/<int:package_id>/download', methods=['GET'])
@jwt_required()
def download_package(package_id):
    """Download package APK file"""
    package = PackageModel.get_by_id(package_id)
    if not package:
        return jsonify({'error': 'Package not found'}), 404

    if not package.fileLocation:
        return jsonify({'error': 'Package file not found'}), 404

    file_path = os.path.join(UPDATES_UPLOAD_FOLDER, package.fileLocation)
    if not os.path.exists(file_path):
        return jsonify({'error': 'Package file does not exist'}), 404

    return send_file(
        file_path,
        as_attachment=True,
        download_name=package.fileLocation,
        mimetype='application/vnd.android.package-archive'
    )


@api_v1.route('/packages', methods=['POST'])
@jwt_required()
def create_package():
    """Create a new package (admin only)"""
    error = require_admin_role()
    if error:
        return error

    # Handle multipart/form-data for file uploads
    if 'package' not in request.files:
        return jsonify({'error': 'Package file is required'}), 400

    package_file = request.files['package']
    if package_file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not package_file.filename.endswith('.apk'):
        return jsonify({'error': 'File must be an APK'}), 400

    try:
        # Save package file
        package_filename = secure_filename(package_file.filename)
        package_path = os.path.join(UPDATES_UPLOAD_FOLDER, package_filename)
        package_file.save(package_path)

        # Handle optional image
        image_filename = None
        if 'image' in request.files:
            image_file = request.files['image']
            if image_file.filename:
                image_filename = secure_filename(image_file.filename)
                image_path = os.path.join(UPDATES_UPLOAD_FOLDER, image_filename)
                image_file.save(image_path)

        # Get form data
        name = request.form.get('name', package_filename.replace('.apk', ''))
        description = request.form.get('description', '')
        platform = request.form.get('platform', 'Android')
        type_package = request.form.get('typePackage', 'app')
        version = request.form.get('version', '')
        revision_code = request.form.get('revisionCode', '')
        apk_hash = request.form.get('apkHash', '')
        apk_size = os.path.getsize(package_path)
        full_package_name = request.form.get('fullPackageName', '')
        os_requirement = request.form.get('osRequirement', '')
        tak_pre_req = request.form.get('takPreReq', '')

        package = PackageModel.create(
            name=name,
            platform=platform,
            typePackage=type_package,
            description=description,
            fileLocation=package_filename,
            imageLocation=image_filename,
            version=version,
            revisionCode=revision_code,
            apkHash=apk_hash,
            apkSize=apk_size,
            fullPackageName=full_package_name,
            osRequirement=os_requirement,
            takPreReq=tak_pre_req
        )

        return jsonify({
            'message': 'Package created successfully',
            'package': {
                'id': package.id,
                'name': package.name
            }
        }), 201

    except Exception as e:
        # Clean up uploaded files on error
        if os.path.exists(package_path):
            os.remove(package_path)
        if image_filename:
            image_path = os.path.join(UPDATES_UPLOAD_FOLDER, image_filename)
            if os.path.exists(image_path):
                os.remove(image_path)

        return jsonify({'error': f'Failed to create package: {str(e)}'}), 400


@api_v1.route('/packages/<int:package_id>', methods=['PUT'])
@jwt_required()
def update_package(package_id):
    """Update package (admin only)"""
    error = require_admin_role()
    if error:
        return error

    package = PackageModel.get_by_id(package_id)
    if not package:
        return jsonify({'error': 'Package not found'}), 404

    try:
        # Handle file upload if provided
        if 'package' in request.files:
            package_file = request.files['package']
            if package_file.filename:
                # Delete old file
                if package.fileLocation:
                    old_path = os.path.join(UPDATES_UPLOAD_FOLDER, package.fileLocation)
                    if os.path.exists(old_path):
                        os.remove(old_path)

                # Save new file
                package_filename = secure_filename(package_file.filename)
                package_path = os.path.join(UPDATES_UPLOAD_FOLDER, package_filename)
                package_file.save(package_path)
                package.fileLocation = package_filename
                package.apkSize = os.path.getsize(package_path)

        # Handle image upload if provided
        if 'image' in request.files:
            image_file = request.files['image']
            if image_file.filename:
                # Delete old image
                if package.imageLocation:
                    old_image_path = os.path.join(UPDATES_UPLOAD_FOLDER, package.imageLocation)
                    if os.path.exists(old_image_path):
                        os.remove(old_image_path)

                # Save new image
                image_filename = secure_filename(image_file.filename)
                image_path = os.path.join(UPDATES_UPLOAD_FOLDER, image_filename)
                image_file.save(image_path)
                package.imageLocation = image_filename

        # Update fields from form data
        if request.form.get('name'):
            package.name = request.form.get('name')
        if 'description' in request.form:
            package.description = request.form.get('description')
        if 'platform' in request.form:
            package.platform = request.form.get('platform')
        if 'typePackage' in request.form:
            package.typePackage = request.form.get('typePackage')
        if 'version' in request.form:
            package.version = request.form.get('version')
        if 'revisionCode' in request.form:
            package.revisionCode = request.form.get('revisionCode')
        if 'apkHash' in request.form:
            package.apkHash = request.form.get('apkHash')
        if 'fullPackageName' in request.form:
            package.fullPackageName = request.form.get('fullPackageName')
        if 'osRequirement' in request.form:
            package.osRequirement = request.form.get('osRequirement')
        if 'takPreReq' in request.form:
            package.takPreReq = request.form.get('takPreReq')

        PackageModel.update(package)

        return jsonify({'message': 'Package updated successfully'}), 200

    except Exception as e:
        return jsonify({'error': f'Failed to update package: {str(e)}'}), 400


@api_v1.route('/packages/<int:package_id>', methods=['DELETE'])
@jwt_required()
def delete_package(package_id):
    """Delete package (admin only)"""
    error = require_admin_role()
    if error:
        return error

    package = PackageModel.get_by_id(package_id)
    if not package:
        return jsonify({'error': 'Package not found'}), 404

    try:
        # Delete files
        if package.fileLocation:
            file_path = os.path.join(UPDATES_UPLOAD_FOLDER, package.fileLocation)
            if os.path.exists(file_path):
                os.remove(file_path)

        if package.imageLocation:
            image_path = os.path.join(UPDATES_UPLOAD_FOLDER, package.imageLocation)
            if os.path.exists(image_path):
                os.remove(image_path)

        PackageModel.delete_by_id(package_id)
        return jsonify({'message': 'Package deleted successfully'}), 200

    except Exception as e:
        return jsonify({'error': f'Failed to delete package: {str(e)}'}), 400
