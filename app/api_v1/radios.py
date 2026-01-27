"""
Radios API endpoints
CRUD operations for radio device management
"""

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from app.api_v1 import api_v1
from app.models import RadioModel, UserModel
from datetime import datetime


def require_admin_role():
    """Check for radio_admin or administrator role"""
    from app.rbac import has_any_role
    if not has_any_role(['administrator', 'radio_admin']):
        return jsonify({'error': 'Radio admin access required'}), 403
    return None


@api_v1.route('/radios', methods=['GET'])
@jwt_required()
def get_radios():
    """Get all radios (admin) or user's radios"""
    from app.rbac import has_any_role
    current_user_id = int(get_jwt_identity())  # Convert string to int
    is_admin = has_any_role(['administrator', 'radio_admin'])

    if is_admin:
        radios = RadioModel.get_all()
    else:
        user = UserModel.get_user_by_id(current_user_id)
        radios = RadioModel.query.filter(
            (RadioModel.assignedTo == user.id) | (RadioModel.owner == user.id)
        ).all()

    return jsonify({
        'radios': [{
            'id': r.id,
            'name': r.name,
            'platform': r.platform,
            'radioType': r.radioType,
            'description': r.description,
            'softwareVersion': r.softwareVersion,
            'model': r.model,
            'vendor': r.vendor,
            'shortName': r.shortName,
            'longName': r.longName,
            'mac': r.mac,
            'assignedTo': r.assignedTo,
            'owner': r.owner,
            'createdAt': r.createdAt.isoformat() if r.createdAt else None,
            'updatedAt': r.updatedAt.isoformat() if r.updatedAt else None
        } for r in radios]
    }), 200


@api_v1.route('/radios/<int:radio_id>', methods=['GET'])
@jwt_required()
def get_radio(radio_id):
    """Get radio by ID"""
    radio = RadioModel.get_by_id(radio_id)
    if not radio:
        return jsonify({'error': 'Radio not found'}), 404

    # Check access
    from app.rbac import has_any_role
    current_user_id = int(get_jwt_identity())  # Convert string to int
    is_admin = has_any_role(['administrator', 'radio_admin'])

    if not is_admin and radio.assignedTo != current_user_id and radio.owner != current_user_id:
        return jsonify({'error': 'Access denied'}), 403

    return jsonify({
        'id': radio.id,
        'name': radio.name,
        'platform': radio.platform,
        'radioType': radio.radioType,
        'description': radio.description,
        'softwareVersion': radio.softwareVersion,
        'model': radio.model,
        'vendor': radio.vendor,
        'shortName': radio.shortName,
        'longName': radio.longName,
        'mac': radio.mac,
        'role': radio.role,
        'publicKey': radio.publicKey,
        'assignedTo': radio.assignedTo,
        'owner': radio.owner,
        'createdAt': radio.createdAt.isoformat() if radio.createdAt else None,
        'updatedAt': radio.updatedAt.isoformat() if radio.updatedAt else None
    }), 200


@api_v1.route('/radios', methods=['POST'])
@jwt_required()
def create_radio():
    """Create a new radio (admin only)"""
    error = require_admin_role()
    if error:
        return error

    data = request.get_json()

    required_fields = ['name']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    # Check if name already exists
    existing = RadioModel.get_by_name(data['name'])
    if existing:
        return jsonify({'error': 'Radio with this name already exists'}), 409

    # Check if MAC already exists
    if data.get('mac'):
        existing_mac = RadioModel.query.filter_by(mac=data['mac']).first()
        if existing_mac:
            return jsonify({'error': 'Radio with this MAC address already exists'}), 409

    try:
        radio = RadioModel.create(
            name=data['name'],
            platform=data.get('platform', ''),
            radioType=data.get('radioType', 'other'),
            description=data.get('description', ''),
            software_version=data.get('softwareVersion', ''),
            model=data.get('model', ''),
            vendor=data.get('vendor', ''),
            shortName=data.get('shortName', ''),
            longName=data.get('longName', ''),
            mac=data.get('mac', ''),
            role=data.get('role', ''),
            publicKey=data.get('publicKey', ''),
            privateKey=data.get('privateKey', ''),
            assignedTo=data.get('assignedTo'),
            owner=data.get('owner')
        )

        return jsonify({
            'message': 'Radio created successfully',
            'radio': {
                'id': radio.id,
                'name': radio.name,
                'mac': radio.mac
            }
        }), 201

    except Exception as e:
        return jsonify({'error': f'Failed to create radio: {str(e)}'}), 400


@api_v1.route('/radios/<int:radio_id>', methods=['PUT'])
@jwt_required()
def update_radio(radio_id):
    """Update radio (admin only)"""
    error = require_admin_role()
    if error:
        return error

    radio = RadioModel.get_by_id(radio_id)
    if not radio:
        return jsonify({'error': 'Radio not found'}), 404

    data = request.get_json()

    try:
        if data.get('name'):
            # Check for name conflict
            existing = RadioModel.get_by_name(data['name'])
            if existing and existing.id != radio_id:
                return jsonify({'error': 'Radio with this name already exists'}), 409
            radio.name = data['name']

        if 'description' in data:
            radio.description = data['description']
        if 'platform' in data:
            radio.platform = data['platform']
        if 'radioType' in data:
            radio.radioType = data['radioType']
        if 'softwareVersion' in data:
            radio.softwareVersion = data['softwareVersion']
        if 'model' in data:
            radio.model = data['model']
        if 'vendor' in data:
            radio.vendor = data['vendor']
        if 'shortName' in data:
            radio.shortName = data['shortName']
        if 'longName' in data:
            radio.longName = data['longName']
        if 'mac' in data:
            # Check for MAC conflict
            existing_mac = RadioModel.query.filter_by(mac=data['mac']).first()
            if existing_mac and existing_mac.id != radio_id:
                return jsonify({'error': 'Radio with this MAC already exists'}), 409
            radio.mac = data['mac']
        if 'role' in data:
            radio.role = data['role']
        if 'publicKey' in data:
            radio.publicKey = data['publicKey']
        if 'privateKey' in data:
            radio.privateKey = data['privateKey']
        if 'assignedToId' in data:
            radio.assignedTo = data['assignedToId']
        if 'ownerId' in data:
            radio.owner = data['ownerId']

        radio.updatedAt = datetime.utcnow()
        RadioModel.update(radio)

        return jsonify({'message': 'Radio updated successfully'}), 200

    except Exception as e:
        return jsonify({'error': f'Failed to update radio: {str(e)}'}), 400


@api_v1.route('/radios/<int:radio_id>/assign', methods=['PUT'])
@jwt_required()
def assign_radio(radio_id):
    """Assign radio to user (admin only)"""
    error = require_admin_role()
    if error:
        return error

    radio = RadioModel.get_by_id(radio_id)
    if not radio:
        return jsonify({'error': 'Radio not found'}), 404

    data = request.get_json()
    user_id = data.get('userId')

    if user_id:
        user = UserModel.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

    try:
        radio.assignedTo = user_id
        radio.updatedAt = datetime.utcnow()
        RadioModel.update(radio)

        return jsonify({'message': 'Radio assigned successfully'}), 200

    except Exception as e:
        return jsonify({'error': f'Failed to assign radio: {str(e)}'}), 400


@api_v1.route('/radios/<int:radio_id>/claim', methods=['POST'])
@jwt_required()
def claim_radio(radio_id):
    """Claim ownership of a radio (user can claim unowned radio)"""
    current_user_id = int(get_jwt_identity())  # Convert string to int

    radio = RadioModel.get_by_id(radio_id)
    if not radio:
        return jsonify({'error': 'Radio not found'}), 404

    if radio.owner:
        return jsonify({'error': 'Radio already has an owner'}), 409

    try:
        radio.owner = current_user_id
        radio.updatedAt = datetime.utcnow()
        RadioModel.update(radio)

        return jsonify({'message': 'Radio claimed successfully'}), 200

    except Exception as e:
        return jsonify({'error': f'Failed to claim radio: {str(e)}'}), 400


@api_v1.route('/radios/<int:radio_id>', methods=['DELETE'])
@jwt_required()
def delete_radio(radio_id):
    """Delete radio (admin only)"""
    error = require_admin_role()
    if error:
        return error

    radio = RadioModel.get_by_id(radio_id)
    if not radio:
        return jsonify({'error': 'Radio not found'}), 404

    try:
        RadioModel.delete_by_id(radio_id)
        return jsonify({'message': 'Radio deleted successfully'}), 200

    except Exception as e:
        return jsonify({'error': f'Failed to delete radio: {str(e)}'}), 400
