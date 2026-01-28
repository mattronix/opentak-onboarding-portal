"""
Radios API endpoints
CRUD operations for radio device management
"""

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from app.api_v1 import api_v1
from app.models import RadioModel, UserModel, MeshtasticChannelGroup, MeshtasticModel, SystemSettingsModel
from datetime import datetime
import re


def require_admin_role():
    """Check for radio_admin or administrator role"""
    from app.rbac import has_any_role
    if not has_any_role(['administrator', 'radio_admin']):
        return jsonify({'error': 'Radio admin access required'}), 403
    return None


def check_radio_duplicates(data, exclude_id=None):
    """
    Check for duplicate radio fields (name, shortName, longName, mac).
    Returns error response tuple if duplicate found, None otherwise.
    exclude_id: ID of radio to exclude from checks (for updates)
    """
    # Check name
    if data.get('name'):
        existing = RadioModel.query.filter_by(name=data['name']).first()
        if existing and (exclude_id is None or existing.id != exclude_id):
            return jsonify({'error': 'Radio with this name already exists'}), 409

    # Check shortName (only if provided and non-empty)
    if data.get('shortName'):
        existing = RadioModel.query.filter_by(shortName=data['shortName']).first()
        if existing and (exclude_id is None or existing.id != exclude_id):
            return jsonify({'error': f'Radio with short name "{data["shortName"]}" already exists'}), 409

    # Check longName (only if provided and non-empty)
    if data.get('longName'):
        existing = RadioModel.query.filter_by(longName=data['longName']).first()
        if existing and (exclude_id is None or existing.id != exclude_id):
            return jsonify({'error': f'Radio with long name "{data["longName"]}" already exists'}), 409

    # Check MAC (only if provided and non-empty)
    if data.get('mac'):
        existing = RadioModel.query.filter_by(mac=data['mac']).first()
        if existing and (exclude_id is None or existing.id != exclude_id):
            return jsonify({'error': 'Radio with this MAC address already exists'}), 409

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

    # Check for duplicates (name, shortName, longName, mac)
    duplicate_error = check_radio_duplicates(data)
    if duplicate_error:
        return duplicate_error

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

    # Check for duplicates (excluding this radio)
    duplicate_error = check_radio_duplicates(data, exclude_id=radio_id)
    if duplicate_error:
        return duplicate_error

    try:
        if data.get('name'):
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
            radio.mac = data['mac']
        if 'role' in data:
            radio.role = data['role']
        if 'publicKey' in data:
            radio.publicKey = data['publicKey']
        if 'privateKey' in data:
            radio.privateKey = data['privateKey']
        if 'assignedToId' in data:
            radio.assignedTo = data['assignedToId']
        elif 'assignedTo' in data:
            radio.assignedTo = data['assignedTo']
        if 'ownerId' in data:
            radio.owner = data['ownerId']
        elif 'owner' in data:
            radio.owner = data['owner']

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
    """Claim a radio (assigns it to the current user)"""
    current_user_id = int(get_jwt_identity())  # Convert string to int

    radio = RadioModel.get_by_id(radio_id)
    if not radio:
        return jsonify({'error': 'Radio not found'}), 404

    if radio.assignedTo:
        return jsonify({'error': 'Radio is already assigned to someone'}), 409

    try:
        radio.assignedTo = current_user_id
        radio.updatedAt = datetime.utcnow()
        RadioModel.update(radio)

        return jsonify({'message': 'Radio claimed successfully'}), 200

    except Exception as e:
        return jsonify({'error': f'Failed to claim radio: {str(e)}'}), 400


@api_v1.route('/radios/enroll', methods=['POST'])
@jwt_required()
def enroll_radio():
    """
    User self-enrollment of a radio.
    Requires user_radio_enrollment_enabled setting to be true.
    The current user becomes both owner and assignedTo.
    """
    # Check if user enrollment is enabled
    user_enrollment_enabled = SystemSettingsModel.get_setting('user_radio_enrollment_enabled', False)
    if user_enrollment_enabled not in [True, 'true', 'True']:
        return jsonify({'error': 'User radio enrollment is not enabled'}), 403

    current_user_id = int(get_jwt_identity())
    data = request.get_json()

    if not data.get('name'):
        return jsonify({'error': 'Radio name is required'}), 400

    # Check for duplicates (name, shortName, longName, mac)
    duplicate_error = check_radio_duplicates(data)
    if duplicate_error:
        return duplicate_error

    try:
        radio = RadioModel.create(
            name=data['name'],
            platform=data.get('platform', ''),
            radioType=data.get('radioType', 'meshtastic'),
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
            assignedTo=current_user_id,
            owner=current_user_id
        )

        return jsonify({
            'message': 'Radio enrolled successfully',
            'radio': {
                'id': radio.id,
                'name': radio.name,
                'mac': radio.mac
            }
        }), 201

    except Exception as e:
        return jsonify({'error': f'Failed to enroll radio: {str(e)}'}), 400


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


def resolve_placeholders(text, radio, user=None):
    """
    Resolve placeholders in text with radio/user values.
    Supported: ${shortName}, ${longName}, ${mac}, ${callsign}

    Returns tuple of (resolved_text, list_of_unresolved_placeholders)
    """
    if not text:
        return text, []

    replacements = {
        '${shortName}': radio.shortName or '',
        '${longName}': radio.longName or '',
        '${mac}': radio.mac or '',
        '${callsign}': user.callsign if user and hasattr(user, 'callsign') and user.callsign else '',
    }

    unresolved = []
    result = text
    for placeholder, value in replacements.items():
        if placeholder in result:
            if value:
                result = result.replace(placeholder, value)
            else:
                # Keep placeholder visible and track it as unresolved
                unresolved.append(placeholder)

    return result, unresolved


@api_v1.route('/radios/<int:radio_id>/program-config', methods=['POST'])
@jwt_required()
def get_program_config(radio_id):
    """
    Get programming configuration for a Meshtastic radio.
    Input: { channel_group_id: int?, channel_id: int? }
    Output: { radio: {}, channels: [], yaml_config: string, combined_url: string }
    Resolves placeholders: ${shortName}, ${longName}, ${mac}, ${callsign}
    """
    from app.rbac import has_any_role
    current_user_id = int(get_jwt_identity())
    is_admin = has_any_role(['administrator', 'radio_admin'])

    radio = RadioModel.get_by_id(radio_id)
    if not radio:
        return jsonify({'error': 'Radio not found'}), 404

    # Check access: admin OR (user_program_radio_enabled AND user is assigned)
    if not is_admin:
        user_program_enabled = SystemSettingsModel.get_setting('user_program_radio_enabled', False)
        if user_program_enabled in [True, 'true', 'True']:
            # Allow if user is assigned to this radio
            if radio.assignedTo != current_user_id and radio.owner != current_user_id:
                return jsonify({'error': 'You are not assigned to this radio'}), 403
        else:
            return jsonify({'error': 'Radio programming is not enabled for users'}), 403

    if radio.radioType != 'meshtastic':
        return jsonify({'error': 'Radio is not a Meshtastic device'}), 400

    data = request.get_json() or {}
    channel_group_id = data.get('channel_group_id')
    channel_id = data.get('channel_id')

    if not channel_group_id and not channel_id:
        return jsonify({'error': 'Either channel_group_id or channel_id is required'}), 400

    # Get the assigned user for callsign placeholder
    user = None
    if radio.assignedTo:
        user = UserModel.get_user_by_id(radio.assignedTo)
    elif radio.owner:
        user = UserModel.get_user_by_id(radio.owner)

    channels = []
    yaml_config = None
    combined_url = None
    unresolved = []

    if channel_group_id:
        # Get channel group with all its channels
        group = MeshtasticChannelGroup.get_by_id(channel_group_id)
        if not group:
            return jsonify({'error': 'Channel group not found'}), 404

        # Get channels sorted by slot
        for membership in sorted(group.channel_memberships, key=lambda m: m.slot_number or 0):
            channel = membership.channel
            channels.append({
                'id': channel.id,
                'name': channel.name,
                'slot_number': membership.slot_number,
                'url': channel.url
            })

        # Group-level YAML config (with placeholders resolved)
        yaml_config, unresolved = resolve_placeholders(group.yamlConfig, radio, user)
        combined_url = group.combined_url

    elif channel_id:
        # Single channel mode (no YAML config for individual channels)
        channel = MeshtasticModel.get_by_id(channel_id)
        if not channel:
            return jsonify({'error': 'Channel not found'}), 404

        channels.append({
            'id': channel.id,
            'name': channel.name,
            'slot_number': 0,  # Default to primary slot for single channel
            'url': channel.url
        })

    return jsonify({
        'radio': {
            'id': radio.id,
            'name': radio.name,
            'shortName': radio.shortName,
            'longName': radio.longName,
            'mac': radio.mac,
            'model': radio.model,
            'vendor': radio.vendor,
            'softwareVersion': radio.softwareVersion
        },
        'channels': channels,
        'yaml_config': yaml_config,
        'combined_url': combined_url,
        'user': {
            'id': user.id,
            'callsign': user.callsign if hasattr(user, 'callsign') else None
        } if user else None,
        'unresolved_placeholders': unresolved
    }), 200
