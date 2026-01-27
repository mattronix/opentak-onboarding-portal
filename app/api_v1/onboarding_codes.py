"""
Onboarding Codes API endpoints
CRUD operations for onboarding code management
"""

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app.api_v1 import api_v1
from app.models import OnboardingCodeModel, UserModel, UserRoleModel, db
from datetime import datetime


def require_admin_role():
    """Check for onboarding_admin or administrator role"""
    from app.rbac import has_any_role
    if not has_any_role(['administrator', 'onboarding_admin']):
        return jsonify({'error': 'Onboarding admin access required'}), 403
    return None


@api_v1.route('/onboarding-codes', methods=['GET'])
@jwt_required()
def get_onboarding_codes():
    """Get all onboarding codes (admin only)"""
    error = require_admin_role()
    if error:
        return error

    codes = OnboardingCodeModel.get_all_onboarding_codes()

    return jsonify({
        'codes': [{
            'id': code.id,
            'name': code.name,
            'description': code.description,
            'onboardingCode': code.onboardingCode,
            'uses': code.uses,
            'maxUses': code.maxUses,
            'autoApprove': code.autoApprove,
            'requireApproval': code.requireApproval,
            'approverRole': {
                'id': code.approverRole.id,
                'name': code.approverRole.name,
                'displayName': code.approverRole.display_name
            } if code.approverRole else None,
            'onboardContact': {
                'id': code.onboardContact.id,
                'username': code.onboardContact.username
            } if code.onboardContact else None,
            'expiryDate': code.expiryDate.isoformat() if code.expiryDate else None,
            'userExpiryDate': code.userExpiryDate.isoformat() if code.userExpiryDate else None,
            'roles': [{'id': r.id, 'name': r.name, 'displayName': r.display_name} for r in code.roles]
        } for code in codes]
    }), 200


@api_v1.route('/onboarding-codes/<int:code_id>', methods=['GET'])
@jwt_required()
def get_onboarding_code(code_id):
    """Get onboarding code by ID"""
    error = require_admin_role()
    if error:
        return error

    code = OnboardingCodeModel.get_onboarding_code_by_id(code_id)
    if not code:
        return jsonify({'error': 'Onboarding code not found'}), 404

    return jsonify({
        'id': code.id,
        'name': code.name,
        'description': code.description,
        'onboardingCode': code.onboardingCode,
        'uses': code.uses,
        'maxUses': code.maxUses,
        'autoApprove': code.autoApprove,
        'requireApproval': code.requireApproval,
        'approverRole': {
            'id': code.approverRole.id,
            'name': code.approverRole.name,
            'displayName': code.approverRole.display_name
        } if code.approverRole else None,
        'onboardContact': {
            'id': code.onboardContact.id,
            'username': code.onboardContact.username
        } if code.onboardContact else None,
        'expiryDate': code.expiryDate.isoformat() if code.expiryDate else None,
        'userExpiryDate': code.userExpiryDate.isoformat() if code.userExpiryDate else None,
        'roles': [{'id': r.id, 'name': r.name, 'displayName': r.display_name} for r in code.roles],
        'users': [{'id': u.id, 'username': u.username} for u in code.users]
    }), 200


@api_v1.route('/onboarding-codes/validate/<code>', methods=['GET'])
def validate_onboarding_code(code):
    """Validate onboarding code (public endpoint for registration)"""
    onboarding_code = OnboardingCodeModel.get_onboarding_code_by_code(code)

    if not onboarding_code:
        return jsonify({'valid': False, 'error': 'Invalid code'}), 404

    # Check expiry
    if onboarding_code.expiryDate and onboarding_code.expiryDate < datetime.now():
        return jsonify({'valid': False, 'error': 'Code has expired'}), 400

    # Check max uses
    if onboarding_code.maxUses and onboarding_code.uses >= onboarding_code.maxUses:
        return jsonify({'valid': False, 'error': 'Code has reached maximum uses'}), 400

    return jsonify({
        'valid': True,
        'name': onboarding_code.name,
        'description': onboarding_code.description
    }), 200


@api_v1.route('/onboarding-codes', methods=['POST'])
@jwt_required()
def create_onboarding_code():
    """Create a new onboarding code (admin only)"""
    error = require_admin_role()
    if error:
        return error

    data = request.get_json()

    required_fields = ['name', 'onboardingCode']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    # Check if code already exists
    existing = OnboardingCodeModel.get_onboarding_code_by_code(data['onboardingCode'])
    if existing:
        return jsonify({'error': 'Onboarding code already exists'}), 409

    try:
        # Parse dates
        expiry_date = None
        if data.get('expiryDate'):
            expiry_date = datetime.fromisoformat(data['expiryDate'].replace('Z', '+00:00'))

        user_expiry_date = None
        if data.get('userExpiryDate'):
            user_expiry_date = datetime.fromisoformat(data['userExpiryDate'].replace('Z', '+00:00'))

        # Get onboard contact
        onboard_contact_id = data.get('onboardContactId')

        code = OnboardingCodeModel.create_onboarding_code(
            onboardingcode=data['onboardingCode'],
            name=data['name'],
            description=data.get('description', ''),
            maxuses=data.get('maxUses'),
            onboardcontact=onboard_contact_id,
            expirydate=expiry_date,
            userexpirydate=user_expiry_date,
            autoapprove=data.get('autoApprove', False),
            requireapproval=data.get('requireApproval', False),
            approverroleid=data.get('approverRoleId')
        )

        # Add roles
        if data.get('roleIds'):
            for role_id in data['roleIds']:
                role = UserRoleModel.get_by_id(role_id)
                if role:
                    code.roles.append(role)
            db.session.commit()

        return jsonify({
            'message': 'Onboarding code created successfully',
            'code': {
                'id': code.id,
                'name': code.name,
                'onboardingCode': code.onboardingCode
            }
        }), 201

    except Exception as e:
        return jsonify({'error': f'Failed to create onboarding code: {str(e)}'}), 400


@api_v1.route('/onboarding-codes/<int:code_id>', methods=['PUT'])
@jwt_required()
def update_onboarding_code(code_id):
    """Update onboarding code (admin only)"""
    error = require_admin_role()
    if error:
        return error

    code = OnboardingCodeModel.get_onboarding_code_by_id(code_id)
    if not code:
        return jsonify({'error': 'Onboarding code not found'}), 404

    data = request.get_json()

    try:
        if data.get('name'):
            code.name = data['name']
        if 'description' in data:
            code.description = data['description']
        if 'maxUses' in data:
            code.maxUses = data['maxUses']
        if 'onboardContactId' in data:
            code.onboardContactId = data['onboardContactId']

        if 'expiryDate' in data:
            if data['expiryDate']:
                code.expiryDate = datetime.fromisoformat(data['expiryDate'].replace('Z', '+00:00'))
            else:
                code.expiryDate = None

        if 'userExpiryDate' in data:
            if data['userExpiryDate']:
                code.userExpiryDate = datetime.fromisoformat(data['userExpiryDate'].replace('Z', '+00:00'))
            else:
                code.userExpiryDate = None

        if 'autoApprove' in data:
            code.autoApprove = data['autoApprove']

        if 'requireApproval' in data:
            code.requireApproval = data['requireApproval']

        if 'approverRoleId' in data:
            code.approverRoleId = data['approverRoleId']

        # Update roles if roleIds is provided in the request
        if 'roleIds' in data:
            code.roles.clear()
            for role_id in data['roleIds']:
                role = UserRoleModel.get_by_id(role_id)
                if role:
                    code.roles.append(role)

        # Commit directly to ensure relationship changes are saved
        db.session.commit()

        return jsonify({
            'message': 'Onboarding code updated successfully'
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update onboarding code: {str(e)}'}), 400


@api_v1.route('/onboarding-codes/<int:code_id>', methods=['DELETE'])
@jwt_required()
def delete_onboarding_code(code_id):
    """Delete onboarding code (admin only)"""
    error = require_admin_role()
    if error:
        return error

    code = OnboardingCodeModel.get_onboarding_code_by_id(code_id)
    if not code:
        return jsonify({'error': 'Onboarding code not found'}), 404

    try:
        OnboardingCodeModel.delete_onboarding_code_by_id(code_id)
        return jsonify({'message': 'Onboarding code deleted successfully'}), 200

    except Exception as e:
        return jsonify({'error': f'Failed to delete onboarding code: {str(e)}'}), 400
