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


# Meshtastic hardware model mapping (from HardwareModel protobuf enum)
HARDWARE_MODELS = {
    0: 'UNSET', 1: 'TLORA_V2', 2: 'TLORA_V1', 3: 'TLORA_V2_1_1P6', 4: 'TBEAM',
    5: 'HELTEC_V2_0', 6: 'TBEAM_V0P7', 7: 'T_ECHO', 8: 'TLORA_V1_1P3', 9: 'RAK4631',
    10: 'HELTEC_V2_1', 11: 'HELTEC_V1', 12: 'LILYGO_TBEAM_S3_CORE', 13: 'RAK11200',
    14: 'NANO_G1', 15: 'TLORA_V2_1_1P8', 16: 'TLORA_T3_S3', 17: 'NANO_G1_EXPLORER',
    18: 'NANO_G2_ULTRA', 19: 'LORA_TYPE', 20: 'WIPHONE', 21: 'WIO_WM1110',
    22: 'RAK2560', 23: 'HELTEC_HRU_3601', 25: 'STATION_G1', 26: 'RAK11310',
    27: 'SENSELORA_RP2040', 28: 'SENSELORA_S3', 29: 'CANARYONE', 30: 'RP2040_LORA',
    31: 'STATION_G2', 32: 'LORA_RELAY_V1', 33: 'NRF52840DK', 34: 'PPR',
    35: 'GENIEBLOCKS', 36: 'NRF52_UNKNOWN', 37: 'PORTDUINO', 38: 'ANDROID_SIM',
    39: 'DIY_V1', 40: 'NRF52840_PCA10059', 41: 'DR_DEV', 42: 'M5STACK',
    43: 'HELTEC_V3', 44: 'HELTEC_WSL_V3', 45: 'BETAFPV_2400_TX', 46: 'BETAFPV_900_NANO_TX',
    47: 'RPI_PICO', 48: 'HELTEC_WIRELESS_TRACKER', 49: 'HELTEC_WIRELESS_PAPER',
    50: 'T_DECK', 51: 'T_WATCH_S3', 52: 'PICOMPUTER_S3', 53: 'HELTEC_HT62',
    54: 'EBYTE_ESP32_S3', 55: 'ESP32_S3_PICO', 56: 'CHATTER_2',
    57: 'HELTEC_WIRELESS_PAPER_V1_0', 58: 'HELTEC_WIRELESS_TRACKER_V1_0', 59: 'UNPHONE',
    60: 'TD_LORAC', 61: 'CDEBYTE_EORA_S3', 62: 'TWC_MESH_V4', 63: 'NRF52_PROMICRO_DIY',
    64: 'RADIOMASTER_900_BANDIT_NANO', 65: 'HELTEC_CAPSULE_SENSOR_V3',
    66: 'HELTEC_VISION_MASTER_T190', 67: 'HELTEC_VISION_MASTER_E213',
    68: 'HELTEC_VISION_MASTER_E290', 69: 'HELTEC_MESH_NODE_T114', 70: 'SENSECAP_INDICATOR',
    71: 'TRACKER_T1000_E', 72: 'RAK3172', 73: 'WIO_E5', 74: 'RADIOMASTER_900_BANDIT',
    75: 'ME25LS01_4Y10TD', 76: 'RP2040_FEATHER_RFM95', 77: 'M5STACK_COREBASIC',
    78: 'M5STACK_CORE2', 79: 'RPI_PICO2', 80: 'M5STACK_CORES3', 81: 'SEEED_XIAO_S3',
    82: 'MS24SF1', 83: 'TLORA_C6', 84: 'WISMESH_TAP', 85: 'ROUTASTIC',
    86: 'MESHLINK', 87: 'MESHLINK_GSM', 88: 'RAK_WISMESHTAP', 89: 'HELTEC_ESP32C3',
    90: 'MESH_T_PHONE', 91: 'HELTEC_HT62_V2', 92: 'CROWPANEL_ESP32S3_LORA',
    93: 'ROUTASTIC_ROUTERV2', 94: 'ROUTASTIC_ROUTERV3', 95: 'HELTEC_MESH_NODE_T114_V2',
    96: 'HELTEC_CAPSULE_SENSOR_V3_2', 97: 'WISMESH_POCKET', 98: 'WISMESH_HUB',
    99: 'TRACKER_T1000_C', 253: 'PRIVATE_HW',
}


def get_model_name(model_value):
    """Convert model number to friendly name if it's a number"""
    if model_value is None:
        return None
    # If it's already a string name (not a number), return as-is
    if isinstance(model_value, str):
        # Check if it's a numeric string
        if model_value.isdigit():
            num = int(model_value)
            return HARDWARE_MODELS.get(num, f'UNKNOWN({num})')
        return model_value
    # If it's an int
    if isinstance(model_value, int):
        return HARDWARE_MODELS.get(model_value, f'UNKNOWN({model_value})')
    return model_value


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
    """Get all radios (admin/readonly) or user's radios"""
    from app.rbac import has_any_role
    current_user_id = int(get_jwt_identity())  # Convert string to int
    claims = get_jwt()
    is_kiosk = claims.get('kiosk_session', False)
    is_admin = has_any_role(['administrator', 'radio_admin', 'radio_readonly'])

    if is_admin and not is_kiosk:
        radios = RadioModel.get_all()
    else:
        radios = RadioModel.query.filter(
            RadioModel.assignedTo == current_user_id
        ).all()

    return jsonify({
        'radios': [{
            'id': r.id,
            'name': r.name,
            'platform': r.platform,
            'radioType': r.radioType,
            'description': r.description,
            'softwareVersion': r.softwareVersion,
            'model': get_model_name(r.model),
            'vendor': r.vendor,
            'shortName': r.shortName,
            'longName': r.longName,
            'mac': r.mac,
            'meshtasticId': r.meshtastic_id,
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
    is_admin = has_any_role(['administrator', 'radio_admin', 'radio_readonly'])

    if not is_admin and radio.assignedTo != current_user_id and radio.owner != current_user_id:
        return jsonify({'error': 'Access denied'}), 403

    return jsonify({
        'id': radio.id,
        'name': radio.name,
        'platform': radio.platform,
        'radioType': radio.radioType,
        'description': radio.description,
        'softwareVersion': radio.softwareVersion,
        'model': get_model_name(radio.model),
        'vendor': radio.vendor,
        'shortName': radio.shortName,
        'longName': radio.longName,
        'mac': radio.mac,
        'meshtasticId': radio.meshtastic_id,
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


@api_v1.route('/radios/<int:radio_id>/claim-code', methods=['GET'])
@jwt_required()
def get_claim_code(radio_id):
    """
    Get the claim code for a radio (admin only).
    The claim code is the radio's MAC address.
    """
    from app.rbac import has_any_role
    if not has_any_role(['administrator', 'radio_admin', 'radio_readonly']):
        return jsonify({'error': 'Admin access required'}), 403

    radio = RadioModel.get_by_id(radio_id)
    if not radio:
        return jsonify({'error': 'Radio not found'}), 404

    claim_code = radio.get_claim_code()
    if not claim_code:
        return jsonify({'error': 'Radio has no MAC address set'}), 400

    return jsonify({'claim_code': claim_code}), 200


@api_v1.route('/radios/claim-by-node/<path:node_id>', methods=['GET'])
@jwt_required()
def get_radio_by_node_id(node_id):
    """
    Get radio info by Meshtastic node ID (for claim page).
    Node ID format: !ef123456 (last 4 bytes of MAC as hex)
    Returns basic radio info if node ID is valid.
    """
    radio = RadioModel.get_by_node_id(node_id)
    if not radio:
        return jsonify({'error': 'Radio not found'}), 404

    return jsonify({
        'id': radio.id,
        'name': radio.name,
        'platform': radio.platform,
        'model': get_model_name(radio.model),
        'shortName': radio.shortName,
        'longName': radio.longName,
        'mac': radio.mac,
        'meshtasticId': radio.meshtastic_id,
        'assignedTo': radio.assignedTo
    }), 200


@api_v1.route('/radios/claim-by-node/<path:node_id>', methods=['POST'])
@jwt_required()
def claim_radio_by_node_id(node_id):
    """
    Claim a radio using its Meshtastic node ID (assigns it to the current user).
    Node ID format: !ef123456
    """
    current_user_id = int(get_jwt_identity())

    radio = RadioModel.get_by_node_id(node_id)
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
    is_admin = has_any_role(['administrator', 'radio_admin', 'radio_readonly'])

    radio = RadioModel.get_by_id(radio_id)
    if not radio:
        return jsonify({'error': 'Radio not found'}), 404

    # Check access: admin/readonly OR (user_program_radio_enabled AND user is assigned)
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
            'meshtasticId': radio.meshtastic_id,
            'model': get_model_name(radio.model),
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


@api_v1.route('/radios/<int:radio_id>/compare-config', methods=['POST'])
@jwt_required()
def compare_config(radio_id):
    """
    Compare current radio config with target config.
    Input: {
        channel_group_id: int,
        current_config: {
            owner: { shortName, longName },
            channels: [{ slot_number, name, psk }]
        }
    }
    Output: {
        has_changes: bool,
        diff: {
            owner: [{ field, current, target, changed }],
            channels: [{ slot, currentName, targetName, changed, hasUrl }]
        },
        target_config: { ... }
    }
    """
    from app.rbac import has_any_role
    current_user_id = int(get_jwt_identity())
    is_admin = has_any_role(['administrator', 'radio_admin', 'radio_readonly'])

    radio = RadioModel.get_by_id(radio_id)
    if not radio:
        return jsonify({'error': 'Radio not found'}), 404

    # Check access
    if not is_admin:
        user_program_enabled = SystemSettingsModel.get_setting('user_program_radio_enabled', False)
        if user_program_enabled in [True, 'true', 'True']:
            if radio.assignedTo != current_user_id and radio.owner != current_user_id:
                return jsonify({'error': 'You are not assigned to this radio'}), 403
        else:
            return jsonify({'error': 'Radio config comparison is not enabled for users'}), 403

    if radio.radioType != 'meshtastic':
        return jsonify({'error': 'Radio is not a Meshtastic device'}), 400

    data = request.get_json() or {}
    channel_group_id = data.get('channel_group_id')
    current_config = data.get('current_config', {})

    if not channel_group_id:
        return jsonify({'error': 'channel_group_id is required'}), 400

    # Get target config
    group = MeshtasticChannelGroup.get_by_id(channel_group_id)
    if not group:
        return jsonify({'error': 'Channel group not found'}), 404

    # Get assigned user for callsign placeholder
    user = None
    if radio.assignedTo:
        user = UserModel.get_user_by_id(radio.assignedTo)
    elif radio.owner:
        user = UserModel.get_user_by_id(radio.owner)

    # Build target channels
    target_channels = []
    for membership in sorted(group.channel_memberships, key=lambda m: m.slot_number or 0):
        channel = membership.channel
        target_channels.append({
            'slot_number': membership.slot_number,
            'name': channel.name,
            'url': channel.url
        })

    # Resolve YAML config placeholders
    yaml_config, _ = resolve_placeholders(group.yamlConfig, radio, user)

    # Build diff
    diff = {
        'owner': [],
        'channels': [],
        'has_yaml_config': bool(yaml_config)
    }

    # Owner diff
    current_owner = current_config.get('owner', {})
    current_short = current_owner.get('shortName', '')
    current_long = current_owner.get('longName', '')
    target_short = radio.shortName or ''
    target_long = radio.longName or ''

    diff['owner'].append({
        'field': 'Short Name',
        'current': current_short or '(empty)',
        'target': target_short or '(empty)',
        'changed': current_short != target_short
    })
    diff['owner'].append({
        'field': 'Long Name',
        'current': current_long or '(empty)',
        'target': target_long or '(empty)',
        'changed': current_long != target_long
    })

    # Channels diff
    current_channels = current_config.get('channels', [])
    current_by_slot = {ch.get('slot_number'): ch for ch in current_channels}

    for target_ch in target_channels:
        slot = target_ch['slot_number']
        current_ch = current_by_slot.get(slot, {})
        current_name = current_ch.get('name', '')
        target_name = target_ch['name'] or ''

        diff['channels'].append({
            'slot': slot,
            'currentName': current_name or '(empty)',
            'targetName': target_name or '(empty)',
            'changed': current_name != target_name,
            'hasUrl': bool(target_ch.get('url'))
        })

    # Check for extra current channels not in target
    target_slots = {ch['slot_number'] for ch in target_channels}
    for current_ch in current_channels:
        slot = current_ch.get('slot_number')
        if slot not in target_slots and current_ch.get('name'):
            diff['channels'].append({
                'slot': slot,
                'currentName': current_ch['name'],
                'targetName': '(will be removed)',
                'changed': True,
                'removing': True
            })

    # Sort channels by slot
    diff['channels'].sort(key=lambda x: x['slot'])

    # Determine if there are any changes
    has_changes = (
        any(o['changed'] for o in diff['owner']) or
        any(c['changed'] for c in diff['channels']) or
        diff['has_yaml_config']
    )

    return jsonify({
        'has_changes': has_changes,
        'diff': diff,
        'target_config': {
            'radio': {
                'id': radio.id,
                'name': radio.name,
                'shortName': radio.shortName,
                'longName': radio.longName,
                'meshtasticId': radio.meshtastic_id,
            },
            'channels': target_channels,
            'yaml_config': yaml_config
        }
    }), 200
