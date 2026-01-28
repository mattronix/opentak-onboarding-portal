"""
Meshtastic Channel Groups API endpoints
CRUD operations for managing groups of Meshtastic channels (up to 8 per group)
"""

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from app.api_v1 import api_v1
from app.models import MeshtasticChannelGroup, MeshtasticModel, UserRoleModel, UserModel, ChannelGroupMembership, db
from app.utils.meshtastic_url import update_group_combined_url


def require_admin_role():
    """Check for meshtastic_admin or administrator role"""
    from app.rbac import has_any_role
    if not has_any_role(['administrator', 'meshtastic_admin']):
        return jsonify({'error': 'Meshtastic admin access required'}), 403
    return None


@api_v1.route('/meshtastic/groups', methods=['GET'])
@jwt_required()
def get_meshtastic_groups():
    """Get all Meshtastic channel groups (filter by user access via roles only)"""
    current_user_id = int(get_jwt_identity())
    user = UserModel.get_user_by_id(current_user_id)
    user_role_ids = [r.id for r in user.roles] if user else []

    # Get groups based on access (admin status does NOT grant automatic access):
    # 1. Directly assigned to user
    # 2. Assigned to one of user's roles
    # 3. Public groups
    user_groups = user.meshtastic_groups if user else []
    public_groups = MeshtasticChannelGroup.query.filter_by(isPublic=True).all()

    # Get groups assigned to user's roles
    role_groups = []
    if user_role_ids:
        all_groups = MeshtasticChannelGroup.query.all()
        for group in all_groups:
            group_role_ids = [r.id for r in group.roles]
            if any(rid in user_role_ids for rid in group_role_ids):
                role_groups.append(group)

    # Combine and deduplicate
    groups_dict = {g.id: g for g in user_groups}
    for g in role_groups:
        if g.id not in groups_dict:
            groups_dict[g.id] = g
    for g in public_groups:
        if g.id not in groups_dict:
            groups_dict[g.id] = g

    groups = list(groups_dict.values())

    return jsonify({
        'groups': [{
            'id': g.id,
            'name': g.name,
            'description': g.description,
            'combined_url': g.combined_url,
            'isPublic': g.isPublic,
            'showOnHomepage': g.showOnHomepage,
            'channel_count': len(g.channel_memberships),
            'channels': [{
                'id': m.channel.id,
                'name': m.channel.name,
                'slot_number': m.slot_number,
                'url': m.channel.url
            } for m in sorted(g.channel_memberships, key=lambda x: x.slot_number or 0)]
        } for g in groups]
    }), 200


@api_v1.route('/meshtastic/groups/admin', methods=['GET'])
@jwt_required()
def get_all_meshtastic_groups_admin():
    """Get ALL Meshtastic channel groups (admin only, no filtering)"""
    error = require_admin_role()
    if error:
        return error

    groups = MeshtasticChannelGroup.get_all()

    return jsonify({
        'groups': [{
            'id': g.id,
            'name': g.name,
            'description': g.description,
            'combined_url': g.combined_url,
            'isPublic': g.isPublic,
            'showOnHomepage': g.showOnHomepage,
            'channel_count': len(g.channel_memberships),
            'channels': [{
                'id': m.channel.id,
                'name': m.channel.name,
                'slot_number': m.slot_number,
                'url': m.channel.url
            } for m in sorted(g.channel_memberships, key=lambda x: x.slot_number or 0)],
            'roles': [{'id': r.id, 'name': r.name} for r in g.roles]
        } for g in groups]
    }), 200


@api_v1.route('/meshtastic/groups/<int:group_id>', methods=['GET'])
@jwt_required()
def get_meshtastic_group(group_id):
    """Get Meshtastic channel group by ID"""
    from app.rbac import has_any_role

    group = MeshtasticChannelGroup.get_by_id(group_id)
    if not group:
        return jsonify({'error': 'Channel group not found'}), 404

    # Admins can access any group
    is_admin = has_any_role(['administrator', 'meshtastic_admin'])

    if not is_admin and not group.isPublic:
        current_user_id = int(get_jwt_identity())
        user = UserModel.get_user_by_id(current_user_id)

        # Check direct assignment
        has_direct_access = group in user.meshtastic_groups if user else False

        # Check role-based access
        user_role_ids = [r.id for r in user.roles] if user else []
        group_role_ids = [r.id for r in group.roles]
        has_role_access = any(rid in user_role_ids for rid in group_role_ids)

        if not has_direct_access and not has_role_access:
            return jsonify({'error': 'Access denied'}), 403

    return jsonify({
        'id': group.id,
        'name': group.name,
        'description': group.description,
        'combined_url': group.combined_url,
        'isPublic': group.isPublic,
        'showOnHomepage': group.showOnHomepage,
        'roles': [{'id': r.id, 'name': r.name, 'displayName': r.display_name} for r in group.roles],
        'channels': [{
            'id': m.channel.id,
            'name': m.channel.name,
            'description': m.channel.description,
            'slot_number': m.slot_number,
            'url': m.channel.url,
            'synced_at': m.channel.synced_at.isoformat() if m.channel.synced_at else None
        } for m in sorted(group.channel_memberships, key=lambda x: x.slot_number or 0)]
    }), 200


@api_v1.route('/meshtastic/groups', methods=['POST'])
@jwt_required()
def create_meshtastic_group():
    """Create a new Meshtastic channel group (admin only)"""
    error = require_admin_role()
    if error:
        return error

    data = request.get_json()

    if not data.get('name'):
        return jsonify({'error': 'name is required'}), 400

    # Check if name already exists
    existing = MeshtasticChannelGroup.query.filter_by(name=data['name']).first()
    if existing:
        return jsonify({'error': 'A group with this name already exists'}), 409

    try:
        # Get roles
        roles = []
        if data.get('roleIds'):
            for role_id in data['roleIds']:
                role = UserRoleModel.get_by_id(role_id)
                if role:
                    roles.append(role)

        group = MeshtasticChannelGroup(
            name=data['name'],
            description=data.get('description', ''),
            combined_url=data.get('combined_url'),
            isPublic=data.get('isPublic', False),
            showOnHomepage=data.get('showOnHomepage', True),
            roles=roles
        )
        db.session.add(group)
        db.session.commit()

        return jsonify({
            'message': 'Channel group created successfully',
            'group': {
                'id': group.id,
                'name': group.name
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create group: {str(e)}'}), 400


@api_v1.route('/meshtastic/groups/<int:group_id>', methods=['PUT'])
@jwt_required()
def update_meshtastic_group(group_id):
    """Update Meshtastic channel group (admin only)"""
    error = require_admin_role()
    if error:
        return error

    group = MeshtasticChannelGroup.get_by_id(group_id)
    if not group:
        return jsonify({'error': 'Channel group not found'}), 404

    data = request.get_json()

    try:
        # Check for name conflict
        if data.get('name') and data['name'] != group.name:
            existing = MeshtasticChannelGroup.query.filter_by(name=data['name']).first()
            if existing:
                return jsonify({'error': 'A group with this name already exists'}), 409
            group.name = data['name']

        if 'description' in data:
            group.description = data['description']
        if 'combined_url' in data:
            group.combined_url = data['combined_url']
        if 'isPublic' in data:
            group.isPublic = data['isPublic']
        if 'showOnHomepage' in data:
            group.showOnHomepage = data['showOnHomepage']

        # Update roles if provided
        if 'roleIds' in data:
            roles = []
            for role_id in data['roleIds']:
                role = UserRoleModel.get_by_id(role_id)
                if role:
                    roles.append(role)
            group.roles = roles

        db.session.commit()

        return jsonify({
            'message': 'Channel group updated successfully'
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update group: {str(e)}'}), 400


@api_v1.route('/meshtastic/groups/<int:group_id>', methods=['DELETE'])
@jwt_required()
def delete_meshtastic_group(group_id):
    """Delete Meshtastic channel group (admin only)"""
    error = require_admin_role()
    if error:
        return error

    group = MeshtasticChannelGroup.get_by_id(group_id)
    if not group:
        return jsonify({'error': 'Channel group not found'}), 404

    try:
        # Remove channels from group (don't delete them)
        for channel in group.channels:
            channel.group_id = None
            channel.slot_number = None

        db.session.delete(group)
        db.session.commit()

        return jsonify({'message': 'Channel group deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete group: {str(e)}'}), 400


@api_v1.route('/meshtastic/groups/<int:group_id>/channels', methods=['POST'])
@jwt_required()
def add_channel_to_group(group_id):
    """Add a channel to a group at a specific slot (admin only). Channels can be in multiple groups."""
    error = require_admin_role()
    if error:
        return error

    group = MeshtasticChannelGroup.get_by_id(group_id)
    if not group:
        return jsonify({'error': 'Channel group not found'}), 404

    data = request.get_json()

    channel_id = data.get('channel_id')
    slot_number = data.get('slot_number')

    if channel_id is None:
        return jsonify({'error': 'channel_id is required'}), 400
    if slot_number is None:
        return jsonify({'error': 'slot_number is required'}), 400

    # Validate slot number
    if slot_number < 0 or slot_number > 7:
        return jsonify({'error': 'slot_number must be between 0 and 7'}), 400

    channel = MeshtasticModel.get_by_id(channel_id)
    if not channel:
        return jsonify({'error': 'Channel not found'}), 404

    # Check if channel is already in this specific group
    existing_membership = ChannelGroupMembership.get_by_channel_and_group(channel_id, group_id)
    if existing_membership:
        return jsonify({'error': f'Channel is already in this group at slot {existing_membership.slot_number}'}), 409

    # Check if slot is already occupied in this group
    valid, error_msg = group.validate_slot(slot_number)
    if not valid:
        return jsonify({'error': error_msg}), 409

    try:
        # Create new membership
        membership = ChannelGroupMembership(
            channel_id=channel_id,
            group_id=group_id,
            slot_number=slot_number
        )
        db.session.add(membership)

        # Regenerate combined URL with the new channel
        update_group_combined_url(group)

        db.session.commit()

        return jsonify({
            'message': f'Channel added to slot {slot_number}',
            'channel': {
                'id': channel.id,
                'name': channel.name,
                'slot_number': slot_number
            },
            'combined_url': group.combined_url
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to add channel: {str(e)}'}), 400


@api_v1.route('/meshtastic/groups/<int:group_id>/channels/<int:channel_id>', methods=['DELETE'])
@jwt_required()
def remove_channel_from_group(group_id, channel_id):
    """Remove a channel from a group (admin only)"""
    error = require_admin_role()
    if error:
        return error

    group = MeshtasticChannelGroup.get_by_id(group_id)
    if not group:
        return jsonify({'error': 'Channel group not found'}), 404

    # Find the membership
    membership = ChannelGroupMembership.get_by_channel_and_group(channel_id, group_id)
    if not membership:
        return jsonify({'error': 'Channel is not in this group'}), 400

    try:
        db.session.delete(membership)

        # Regenerate combined URL without this channel
        update_group_combined_url(group)

        db.session.commit()

        return jsonify({
            'message': 'Channel removed from group',
            'combined_url': group.combined_url
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to remove channel: {str(e)}'}), 400


@api_v1.route('/meshtastic/groups/<int:group_id>/channels/<int:channel_id>/slot', methods=['PUT'])
@jwt_required()
def update_channel_slot(group_id, channel_id):
    """Update a channel's slot number within a group (admin only)"""
    error = require_admin_role()
    if error:
        return error

    group = MeshtasticChannelGroup.get_by_id(group_id)
    if not group:
        return jsonify({'error': 'Channel group not found'}), 404

    # Find the membership
    membership = ChannelGroupMembership.get_by_channel_and_group(channel_id, group_id)
    if not membership:
        return jsonify({'error': 'Channel is not in this group'}), 400

    data = request.get_json()
    new_slot = data.get('slot_number')

    if new_slot is None:
        return jsonify({'error': 'slot_number is required'}), 400

    if new_slot < 0 or new_slot > 7:
        return jsonify({'error': 'slot_number must be between 0 and 7'}), 400

    # Check if new slot is occupied by another channel
    valid, error_msg = group.validate_slot(new_slot, exclude_channel_id=channel_id)
    if not valid:
        return jsonify({'error': error_msg}), 409

    try:
        membership.slot_number = new_slot

        # Regenerate combined URL with updated slot
        update_group_combined_url(group)

        db.session.commit()

        return jsonify({
            'message': f'Channel moved to slot {new_slot}',
            'combined_url': group.combined_url
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update slot: {str(e)}'}), 400


@api_v1.route('/meshtastic/groups/<int:group_id>/regenerate-url', methods=['POST'])
@jwt_required()
def regenerate_group_url(group_id):
    """Regenerate the combined URL for a group (admin only)"""
    error = require_admin_role()
    if error:
        return error

    group = MeshtasticChannelGroup.get_by_id(group_id)
    if not group:
        return jsonify({'error': 'Channel group not found'}), 404

    try:
        update_group_combined_url(group)
        db.session.commit()

        return jsonify({
            'message': 'Combined URL regenerated',
            'combined_url': group.combined_url
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to regenerate URL: {str(e)}'}), 400


@api_v1.route('/meshtastic/groups/regenerate-all-urls', methods=['POST'])
@jwt_required()
def regenerate_all_group_urls():
    """Regenerate combined URLs for all groups (admin only)"""
    error = require_admin_role()
    if error:
        return error

    try:
        groups = MeshtasticChannelGroup.get_all()
        updated = 0
        for group in groups:
            if group.channels:
                update_group_combined_url(group)
                updated += 1

        db.session.commit()

        return jsonify({
            'message': f'Regenerated URLs for {updated} groups'
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to regenerate URLs: {str(e)}'}), 400


@api_v1.route('/meshtastic/ungrouped', methods=['GET'])
@jwt_required()
def get_ungrouped_channels():
    """Get all channels not assigned to any group (admin only)"""
    error = require_admin_role()
    if error:
        return error

    # Find channels with no group memberships
    all_channels = MeshtasticModel.query.all()
    ungrouped = [c for c in all_channels if len(c.group_memberships) == 0]

    return jsonify({
        'channels': [{
            'id': c.id,
            'name': c.name,
            'description': c.description,
            'url': c.url,
            'synced_at': c.synced_at.isoformat() if c.synced_at else None,
            'group_count': len(c.group_memberships)
        } for c in ungrouped]
    }), 200


@api_v1.route('/meshtastic/channels/<int:channel_id>/groups', methods=['GET'])
@jwt_required()
def get_channel_groups(channel_id):
    """Get all groups that a channel belongs to (admin only)"""
    error = require_admin_role()
    if error:
        return error

    channel = MeshtasticModel.get_by_id(channel_id)
    if not channel:
        return jsonify({'error': 'Channel not found'}), 404

    return jsonify({
        'channel_id': channel_id,
        'channel_name': channel.name,
        'groups': [{
            'id': m.group.id,
            'name': m.group.name,
            'slot_number': m.slot_number
        } for m in channel.group_memberships]
    }), 200
