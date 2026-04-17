"""
OTS Groups API endpoints
CRUD operations for OTS group management, syncing, and member management
"""

from flask import request, jsonify, current_app
from flask_jwt_extended import jwt_required
from app.api_v1 import api_v1
from app.models import OTSGroupModel, UserModel, db
import datetime


def require_admin_role():
    """Check for group_admin or administrator role (write access)"""
    from app.rbac import has_any_role
    if not has_any_role(['administrator', 'group_admin']):
        return jsonify({'error': 'Group admin access required'}), 403
    return None


def require_view_role():
    """Check for group_admin, group_readonly, or administrator role (read access)"""
    from app.rbac import has_any_role
    if not has_any_role(['administrator', 'group_admin', 'group_readonly']):
        return jsonify({'error': 'Group admin or readonly access required'}), 403
    return None


@api_v1.route('/groups', methods=['GET'])
@jwt_required()
def get_groups():
    """Get all OTS groups"""
    error = require_view_role()
    if error:
        return error

    groups = OTSGroupModel.get_all()

    return jsonify({
        'groups': [{
            'id': g.id,
            'name': g.name,
            'displayName': g.display_name,
            'description': g.description,
            'active': g.active,
            'syncedAt': g.synced_at.isoformat() if g.synced_at else None,
            'userCount': len(g.users),
            'onboardingCodeCount': len(g.onboarding_codes)
        } for g in groups]
    }), 200


@api_v1.route('/groups/<int:group_id>', methods=['GET'])
@jwt_required()
def get_group(group_id):
    """Get group by ID with details including members"""
    error = require_view_role()
    if error:
        return error

    group = OTSGroupModel.get_by_id(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    return jsonify({
        'id': group.id,
        'name': group.name,
        'displayName': group.display_name,
        'description': group.description,
        'active': group.active,
        'syncedAt': group.synced_at.isoformat() if group.synced_at else None,
        'users': [{'id': u.id, 'username': u.username, 'callsign': u.callsign, 'email': u.email} for u in group.users],
        'onboardingCodes': [{'id': c.id, 'name': c.name} for c in group.onboarding_codes]
    }), 200


@api_v1.route('/groups', methods=['POST'])
@jwt_required()
def create_group():
    """Create a new OTS group (locally and in OTS)"""
    error = require_admin_role()
    if error:
        return error

    data = request.get_json()

    if not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400

    existing = OTSGroupModel.get_by_name(data['name'])
    if existing:
        return jsonify({'error': 'Group already exists'}), 409

    try:
        # Create in OTS first
        from app.ots import otsClient
        try:
            otsClient.create_group(
                name=data['name'],
                description=data.get('description', '')
            )
            current_app.logger.info(f"Created group '{data['name']}' in OTS")
        except Exception as e:
            current_app.logger.error(f"Failed to create group '{data['name']}' in OTS: {str(e)}")
            return jsonify({'error': f'Failed to create group in OTS: {str(e)}'}), 400

        # Create locally
        group = OTSGroupModel.create_group(
            name=data['name'],
            display_name=data.get('displayName'),
            description=data.get('description', ''),
            active=data.get('active', True)
        )

        if isinstance(group, dict) and 'error' in group:
            return jsonify(group), 400

        group.synced_at = datetime.datetime.utcnow()
        db.session.commit()

        return jsonify({
            'message': 'Group created successfully',
            'group': {
                'id': group.id,
                'name': group.name,
                'displayName': group.display_name
            }
        }), 201

    except Exception as e:
        return jsonify({'error': f'Failed to create group: {str(e)}'}), 400


@api_v1.route('/groups/<int:group_id>', methods=['PUT'])
@jwt_required()
def update_group(group_id):
    """Update group local metadata"""
    error = require_admin_role()
    if error:
        return error

    group = OTSGroupModel.get_by_id(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    data = request.get_json()

    try:
        if 'displayName' in data:
            group.display_name = data['displayName']
        if 'description' in data:
            group.description = data['description']
        if 'active' in data:
            group.active = data['active']

        db.session.commit()

        return jsonify({
            'message': 'Group updated successfully',
            'group': {
                'id': group.id,
                'name': group.name,
                'displayName': group.display_name,
                'description': group.description,
                'active': group.active
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update group: {str(e)}'}), 400


@api_v1.route('/groups/<int:group_id>', methods=['DELETE'])
@jwt_required()
def delete_group(group_id):
    """Delete a group (locally and from OTS)"""
    error = require_admin_role()
    if error:
        return error

    group = OTSGroupModel.get_by_id(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    try:
        # Delete from OTS
        from app.ots import otsClient
        try:
            otsClient.delete_group(group.name)
            current_app.logger.info(f"Deleted group '{group.name}' from OTS")
        except Exception as e:
            current_app.logger.warning(f"Failed to delete group '{group.name}' from OTS (may not exist): {str(e)}")

        OTSGroupModel.delete_by_id(group_id)
        return jsonify({'message': 'Group deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to delete group: {str(e)}'}), 400


@api_v1.route('/groups/<int:group_id>/members', methods=['GET'])
@jwt_required()
def get_group_members(group_id):
    """Get members of a group from OTS with direction info"""
    error = require_view_role()
    if error:
        return error

    group = OTSGroupModel.get_by_id(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    # Fetch members from OTS (includes direction and active status)
    ots_members = []
    try:
        from app.ots import otsClient
        ots_response = otsClient.get_group_members(group.name)
        ots_data = ots_response.get('response', {})
        if isinstance(ots_data, dict):
            ots_members = ots_data.get('results', ots_data.get('members', []))
        elif isinstance(ots_data, list):
            ots_members = ots_data
    except Exception as e:
        current_app.logger.warning(f"Failed to fetch OTS members for group '{group.name}': {str(e)}")

    # Enrich OTS members with local user info where possible
    members = []
    for m in ots_members:
        username = m.get('username', '') if isinstance(m, dict) else str(m)
        direction = m.get('direction', '') if isinstance(m, dict) else ''
        active = m.get('active', True) if isinstance(m, dict) else True

        local_user = UserModel.get_user_by_username(username) if username else None
        members.append({
            'username': username,
            'direction': direction,
            'active': active,
            'localUserId': local_user.id if local_user else None,
            'callsign': local_user.callsign if local_user else None,
        })

    return jsonify({
        'members': members,
    }), 200


@api_v1.route('/groups/<int:group_id>/members', methods=['POST'])
@jwt_required()
def add_group_member(group_id):
    """Add a user to a group in OTS with a specific direction"""
    error = require_admin_role()
    if error:
        return error

    group = OTSGroupModel.get_by_id(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    data = request.get_json()
    username = data.get('username')
    user_id = data.get('userId')
    direction = data.get('direction', 'BOTH')

    if direction not in ('IN', 'OUT', 'BOTH'):
        return jsonify({'error': 'Direction must be IN, OUT, or BOTH'}), 400

    # Resolve user
    user = None
    if user_id:
        user = UserModel.get_user_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        username = user.username
    elif username:
        user = UserModel.get_user_by_username(username)
    else:
        return jsonify({'error': 'username or userId is required'}), 400

    try:
        from app.ots import otsClient
        from app.models import GroupUserAssociation

        new_dirs = set(['IN', 'OUT'] if direction == 'BOTH' else [direction])

        # Determine old directions to find what to remove
        old_dir = None
        if user:
            existing = GroupUserAssociation.query.filter_by(group_id=group.id, user_id=user.id).first()
            if existing:
                old_dir = existing.direction
        old_dirs = set(['IN', 'OUT'] if old_dir == 'BOTH' else [old_dir]) if old_dir else set()

        # Add new directions
        for d in new_dirs - old_dirs:
            otsClient.add_user_to_group(username, group.name, direction=d)

        # Remove directions no longer wanted
        for d in old_dirs - new_dirs:
            try:
                otsClient.remove_user_from_group(username, group.name, direction=d)
            except Exception as e:
                current_app.logger.warning(f"Failed to remove {username} from OTS group {group.name} {d}: {e}")

        # Track locally
        if user:
            if existing:
                existing.direction = direction
            else:
                assoc = GroupUserAssociation(group_id=group.id, user_id=user.id, direction=direction)
                db.session.add(assoc)
            db.session.commit()

        current_app.logger.info(f"Set user {username} in group '{group.name}' direction={direction}")

        return jsonify({
            'message': f'Added {username} to group {group.name} ({direction})'
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to add member: {str(e)}'}), 400


@api_v1.route('/groups/<int:group_id>/members/<path:username>', methods=['DELETE'])
@jwt_required()
def remove_group_member(group_id, username):
    """Remove a user from a group in OTS for a specific direction"""
    error = require_admin_role()
    if error:
        return error

    group = OTSGroupModel.get_by_id(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    direction = request.args.get('direction', 'BOTH')
    if direction not in ('IN', 'OUT', 'BOTH'):
        return jsonify({'error': 'Direction must be IN, OUT, or BOTH'}), 400

    try:
        from app.ots import otsClient
        ots_directions = ['IN', 'OUT'] if direction == 'BOTH' else [direction]
        for d in ots_directions:
            try:
                otsClient.remove_user_from_group(username, group.name, direction=d)
            except Exception as e:
                current_app.logger.warning(f"Failed to remove {username} from OTS group {group.name} {d}: {e}")

        # Update local tracking
        user = UserModel.get_user_by_username(username)
        if user:
            from app.models import GroupUserAssociation
            existing = GroupUserAssociation.query.filter_by(group_id=group.id, user_id=user.id).first()
            if existing:
                if direction == 'BOTH':
                    db.session.delete(existing)
                elif existing.direction == 'BOTH':
                    other_dir = 'OUT' if direction == 'IN' else 'IN'
                    existing.direction = other_dir
                elif existing.direction == direction:
                    db.session.delete(existing)
                db.session.commit()

        current_app.logger.info(f"Removed user {username} from group '{group.name}' direction={direction}")

        return jsonify({
            'message': f'Removed {username} from group {group.name} ({direction})'
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to remove member: {str(e)}'}), 400


@api_v1.route('/groups/sync', methods=['POST'])
@jwt_required()
def sync_groups_from_ots():
    """Sync groups from OTS server to local database"""
    error = require_admin_role()
    if error:
        return error

    try:
        from app.ots import otsClient

        current_app.logger.info("Starting OTS group sync")
        ots_response = otsClient.get_groups()

        ots_groups = ots_response.get('response', {})
        if isinstance(ots_groups, dict):
            ots_groups = ots_groups.get('results', ots_groups.get('groups', ots_groups.get('response', [])))
        if not isinstance(ots_groups, list):
            ots_groups = []

        synced = 0
        created = 0
        updated = 0

        for ots_group in ots_groups:
            group_name = ots_group.get('name') if isinstance(ots_group, dict) else str(ots_group)
            if not group_name:
                continue

            description = ots_group.get('description', '') if isinstance(ots_group, dict) else ''
            active = ots_group.get('active', True) if isinstance(ots_group, dict) else True

            existing = OTSGroupModel.get_by_name(group_name)
            if existing:
                if description:
                    existing.description = description
                existing.active = active
                existing.synced_at = datetime.datetime.utcnow()
                updated += 1
            else:
                group = OTSGroupModel(
                    name=group_name,
                    display_name=group_name.replace('_', ' ').title(),
                    description=description,
                    active=active,
                    synced_at=datetime.datetime.utcnow()
                )
                db.session.add(group)
                created += 1

            synced += 1

        db.session.commit()

        current_app.logger.info(f"OTS group sync complete: {synced} synced, {created} created, {updated} updated")

        return jsonify({
            'message': f'Synced {synced} groups from OTS ({created} new, {updated} updated)',
            'synced': synced,
            'created': created,
            'updated': updated
        }), 200

    except ConnectionError as e:
        current_app.logger.error(f"OTS group sync failed - connection error: {str(e)}")
        return jsonify({'error': 'Cannot connect to OTS server'}), 503
    except Exception as e:
        current_app.logger.error(f"OTS group sync failed: {str(e)}")
        db.session.rollback()
        return jsonify({'error': f'Failed to sync groups: {str(e)}'}), 400
