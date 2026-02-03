"""
OIDC (OpenID Connect) authentication endpoints.
Supports multiple OIDC providers with per-provider branding and role mapping.
"""

import json
import os
import uuid
import secrets
import requests as http_requests
from flask import request, jsonify, current_app, redirect, session, url_for
from werkzeug.utils import secure_filename
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
)
from datetime import timedelta
from authlib.integrations.requests_client import OAuth2Session
from authlib.jose import jwt as jose_jwt, JsonWebKey

from app.api_v1 import api_v1
from app.models import db, UserModel, UserRoleModel, OIDCProviderModel, SystemSettingsModel
from app.rbac import require_role


def _get_frontend_url():
    """Get the frontend URL (same logic as auth.py)"""
    frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5000')
    if not (frontend_url.startswith('http://localhost') or frontend_url.startswith('http://127.0.0.1')):
        return frontend_url.rstrip('/')
    proto = request.headers.get('X-Forwarded-Proto', request.scheme)
    host = request.headers.get('X-Forwarded-Host', request.host)
    if host.startswith('localhost') or host.startswith('127.0.0.1'):
        return frontend_url.rstrip('/')
    return f"{proto}://{host}"


def _fetch_discovery(discovery_url):
    """Fetch and cache OIDC discovery document"""
    try:
        resp = http_requests.get(discovery_url, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        current_app.logger.error(f"OIDC discovery fetch failed for {discovery_url}: {e}")
        return None


def _extract_claim(token_data, claim_path):
    """
    Extract a value from token data using a dot-separated claim path.
    E.g., "realm_access.roles" → token_data['realm_access']['roles']
    """
    parts = claim_path.split('.')
    value = token_data
    for part in parts:
        if isinstance(value, dict):
            value = value.get(part)
        else:
            return None
    return value


def _build_callback_url(provider_id):
    """Build the OIDC callback URL"""
    frontend_url = _get_frontend_url()
    # The callback must go to the backend API endpoint
    return f"{frontend_url}/api/v1/auth/oidc/{provider_id}/callback"


# =============================================================================
# Public endpoints
# =============================================================================

@api_v1.route('/auth/oidc/providers', methods=['GET'])
def get_oidc_providers():
    """
    Get list of enabled OIDC providers for the login page.
    Returns only public info (id, display_name, button_color). No secrets.
    Returns empty list if OIDC is globally disabled.
    """
    oidc_enabled = SystemSettingsModel.get_setting('oidc_enabled', False)
    if not oidc_enabled:
        return jsonify({'providers': []}), 200

    providers = OIDCProviderModel.query.filter_by(enabled=True).all()
    return jsonify({
        'providers': [p.to_public_dict() for p in providers]
    }), 200


# =============================================================================
# OIDC Auth flow
# =============================================================================

@api_v1.route('/auth/oidc/<int:provider_id>/authorize', methods=['GET'])
def oidc_authorize(provider_id):
    """
    Initiate OIDC authorization flow.
    Redirects the user to the OIDC provider's login page.
    """
    oidc_enabled = SystemSettingsModel.get_setting('oidc_enabled', False)
    if not oidc_enabled:
        return jsonify({'error': 'OIDC login is disabled'}), 403

    provider = OIDCProviderModel.query.get(provider_id)
    if not provider or not provider.enabled:
        return jsonify({'error': 'OIDC provider not found or disabled'}), 404

    discovery = _fetch_discovery(provider.discovery_url)
    if not discovery:
        return jsonify({'error': 'Failed to fetch OIDC provider configuration'}), 502

    callback_url = _build_callback_url(provider_id)

    # Generate state and nonce for security
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)

    # Store in session for validation in callback
    session['oidc_state'] = state
    session['oidc_nonce'] = nonce
    session['oidc_provider_id'] = provider_id

    client = OAuth2Session(
        client_id=provider.client_id,
        client_secret=provider.client_secret,
        scope='openid email profile',
        redirect_uri=callback_url,
    )

    auth_url, _ = client.create_authorization_url(
        discovery['authorization_endpoint'],
        state=state,
        nonce=nonce,
    )

    return redirect(auth_url)


@api_v1.route('/auth/oidc/<int:provider_id>/callback', methods=['GET'])
def oidc_callback(provider_id):
    """
    Handle OIDC callback after user authenticates with the provider.
    Validates tokens, creates/links local user, generates JWT, redirects to frontend.
    """
    frontend_url = _get_frontend_url()

    # Check for errors from the OIDC provider
    error = request.args.get('error')
    if error:
        error_desc = request.args.get('error_description', error)
        current_app.logger.error(f"OIDC callback error: {error} - {error_desc}")
        return redirect(f"{frontend_url}/login?oidc_error={error_desc}")

    # Validate state
    stored_state = session.pop('oidc_state', None)
    stored_nonce = session.pop('oidc_nonce', None)
    stored_provider_id = session.pop('oidc_provider_id', None)

    callback_state = request.args.get('state')
    if not stored_state or stored_state != callback_state or stored_provider_id != provider_id:
        current_app.logger.error("OIDC callback: state mismatch")
        return redirect(f"{frontend_url}/login?oidc_error=Invalid+authentication+state.+Please+try+again.")

    provider = OIDCProviderModel.query.get(provider_id)
    if not provider or not provider.enabled:
        return redirect(f"{frontend_url}/login?oidc_error=OIDC+provider+not+found+or+disabled")

    discovery = _fetch_discovery(provider.discovery_url)
    if not discovery:
        return redirect(f"{frontend_url}/login?oidc_error=Failed+to+contact+OIDC+provider")

    callback_url = _build_callback_url(provider_id)

    try:
        # Extract authorization code from callback
        code = request.args.get('code')
        if not code:
            current_app.logger.error("OIDC callback: no authorization code in callback URL")
            return redirect(f"{frontend_url}/login?oidc_error=No+authorization+code+received")

        # Exchange authorization code for tokens using direct HTTP POST
        # (more compatible than authlib's fetch_token with different provider auth methods)
        token_data = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': callback_url,
            'client_id': provider.client_id,
            'client_secret': provider.client_secret,
        }

        current_app.logger.debug(f"OIDC token exchange: endpoint={discovery['token_endpoint']}, redirect_uri={callback_url}")
        token_resp = http_requests.post(
            discovery['token_endpoint'],
            data=token_data,
            timeout=15,
        )

        current_app.logger.debug(f"OIDC token response: status={token_resp.status_code}, content-type={token_resp.headers.get('Content-Type', 'unknown')}")

        if token_resp.status_code != 200:
            current_app.logger.error(f"OIDC token exchange failed: status={token_resp.status_code}, body={token_resp.text[:500]}")
            return redirect(f"{frontend_url}/login?oidc_error=Token+exchange+failed.+Please+try+again.")

        try:
            token = token_resp.json()
        except ValueError:
            current_app.logger.error(f"OIDC token response not JSON: {token_resp.text[:500]}")
            return redirect(f"{frontend_url}/login?oidc_error=Invalid+response+from+identity+provider")

        # Get user info from the userinfo endpoint
        userinfo = {}
        if 'userinfo_endpoint' in discovery:
            userinfo_resp = http_requests.get(
                discovery['userinfo_endpoint'],
                headers={'Authorization': f'Bearer {token["access_token"]}'},
                timeout=10,
            )
            if userinfo_resp.status_code == 200:
                userinfo = userinfo_resp.json()

        # Also decode the id_token for claims
        id_token_claims = {}
        if 'id_token' in token:
            # Fetch JWKS for token verification
            jwks_resp = http_requests.get(discovery['jwks_uri'], timeout=10)
            jwks = jwks_resp.json()
            key_set = JsonWebKey.import_key_set(jwks)

            claims = jose_jwt.decode(
                token['id_token'],
                key_set,
            )
            # Validate nonce
            if claims.get('nonce') != stored_nonce:
                current_app.logger.error("OIDC callback: nonce mismatch")
                return redirect(f"{frontend_url}/login?oidc_error=Authentication+verification+failed.+Please+try+again.")
            id_token_claims = dict(claims)

        # Merge userinfo and id_token claims (userinfo takes precedence)
        all_claims = {**id_token_claims, **userinfo}

        email = all_claims.get('email', '').lower().strip()
        sub = all_claims.get('sub', '')
        preferred_username = all_claims.get('preferred_username', '')
        given_name = all_claims.get('given_name', '')
        family_name = all_claims.get('family_name', '')
        name = all_claims.get('name', '')

        current_app.logger.info(f"OIDC claims: email={email}, sub={sub}, username={preferred_username}")

        # Validate required fields
        if not sub:
            current_app.logger.error("OIDC callback: no 'sub' claim in token")
            return redirect(f"{frontend_url}/login?oidc_error=OIDC+provider+did+not+return+a+subject+identifier")

        if not email:
            current_app.logger.error(f"OIDC callback: no email for sub={sub}")
            return redirect(f"{frontend_url}/login?oidc_error=OIDC+provider+did+not+return+an+email+address.+Please+ensure+email+is+included+in+the+OIDC+scope.")

        # Find or create user
        user = UserModel.query.filter_by(email=email).first()

        if not user:
            # Also try matching by oidc_sub + provider
            user = UserModel.query.filter_by(oidc_sub=sub, oidc_provider_id=provider.id).first()

        if not user:
            # Check if auto-create is enabled
            auto_create = SystemSettingsModel.get_setting('oidc_auto_create_user', False)
            if not auto_create:
                return redirect(f"{frontend_url}/login?oidc_error=No+account+found+for+this+email.+Contact+your+administrator.")

            # Create new user
            username = preferred_username.lower().strip() if preferred_username else email.split('@')[0].lower()
            # Ensure username is unique
            base_username = username
            counter = 1
            while UserModel.get_user_by_username(username):
                username = f"{base_username}{counter}"
                counter += 1

            # Parse first/last name
            first_name = given_name or (name.split(' ')[0] if name else '')
            last_name = family_name or (' '.join(name.split(' ')[1:]) if name and ' ' in name else '')

            user = UserModel.create_user(
                username=username,
                email=email,
                firstname=first_name,
                lastname=last_name,
                callsign='',
            )
            if isinstance(user, dict) and 'error' in user:
                current_app.logger.error(f"OIDC: Failed to create user: {user}")
                return redirect(f"{frontend_url}/login?oidc_error=Failed+to+create+user+account")

            user.has_password = False
            user.emailVerified = True  # Email verified by OIDC provider
            current_app.logger.info(f"OIDC: Created new user {username} from OIDC provider {provider.name}")

        # Update OIDC link
        user.oidc_sub = sub
        user.oidc_provider_id = provider.id

        # Sync roles from OIDC claims using configurable role mapping
        sync_roles = provider.sync_roles if provider.sync_roles is not None else True
        oidc_roles = _extract_claim(all_claims, provider.role_claim) or [] if sync_roles else []
        if isinstance(oidc_roles, str):
            oidc_roles = [oidc_roles]

        role_mappings = provider.get_role_mappings()
        if sync_roles and role_mappings and oidc_roles:
            for oidc_role in oidc_roles:
                local_role_name = role_mappings.get(oidc_role)
                if not local_role_name:
                    continue  # Unmapped role — skip

                # Find or create the local role
                local_role = UserRoleModel.query.filter_by(name=local_role_name).first()
                if not local_role:
                    # Auto-create the local role
                    display = local_role_name.replace('_', ' ').title()
                    local_role = UserRoleModel(name=local_role_name, display_name=display, description=f'Auto-created from OIDC mapping')
                    db.session.add(local_role)
                    db.session.flush()
                    current_app.logger.info(f"OIDC: Auto-created role '{local_role_name}' from mapping")

                if local_role not in user.roles:
                    user.roles.append(local_role)
                    current_app.logger.info(f"OIDC: Added role '{local_role_name}' to user {user.username}")

        db.session.commit()

        # Generate JWT tokens
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims={
                'username': user.username,
                'roles': [role.name for role in user.roles]
            },
            expires_delta=timedelta(hours=12)
        )
        refresh_token = create_refresh_token(
            identity=str(user.id),
            expires_delta=timedelta(days=30)
        )

        # Build redirect URL with tokens
        needs_password = 'true' if not user.has_password else 'false'
        needs_profile = 'true' if (not user.email or not user.callsign) else 'false'

        redirect_url = (
            f"{frontend_url}/login"
            f"?oidc_token={access_token}"
            f"&oidc_refresh={refresh_token}"
            f"&needs_password={needs_password}"
            f"&needs_profile={needs_profile}"
        )

        return redirect(redirect_url)

    except Exception as e:
        current_app.logger.error(f"OIDC callback error: {str(e)}", exc_info=True)
        return redirect(f"{frontend_url}/login?oidc_error=Authentication+failed.+Please+try+again.")


# =============================================================================
# Admin CRUD endpoints
# =============================================================================

@api_v1.route('/admin/oidc/providers', methods=['GET'])
@jwt_required()
@require_role('administrator', 'settings_admin')
def get_admin_oidc_providers():
    """List all OIDC providers (admin view, secrets masked)"""
    providers = OIDCProviderModel.query.order_by(OIDCProviderModel.id).all()
    return jsonify({
        'providers': [p.to_dict(include_secrets=False) for p in providers]
    }), 200


@api_v1.route('/admin/oidc/providers', methods=['POST'])
@jwt_required()
@require_role('administrator', 'settings_admin')
def create_oidc_provider():
    """Create a new OIDC provider"""
    data = request.get_json()

    required = ['name', 'display_name', 'discovery_url', 'client_id', 'client_secret']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    # Check for duplicate name
    existing = OIDCProviderModel.query.filter_by(name=data['name']).first()
    if existing:
        return jsonify({'error': f'Provider with name "{data["name"]}" already exists'}), 400

    # Validate discovery URL is reachable
    discovery = _fetch_discovery(data['discovery_url'])
    if not discovery:
        return jsonify({'error': 'Could not fetch OIDC discovery document from the provided URL'}), 400

    provider = OIDCProviderModel(
        name=data['name'],
        display_name=data['display_name'],
        button_color=data.get('button_color', '#4285F4'),
        icon_url=data.get('icon_url', ''),
        discovery_url=data['discovery_url'],
        client_id=data['client_id'],
        client_secret=data['client_secret'],
        enabled=data.get('enabled', True),
        role_claim=data.get('role_claim', 'roles'),
        sync_roles=data.get('sync_roles', True),
    )

    if 'role_mappings' in data:
        provider.set_role_mappings(data['role_mappings'])

    db.session.add(provider)
    db.session.commit()

    current_app.logger.info(f"OIDC provider created: {provider.name}")
    return jsonify(provider.to_dict(include_secrets=False)), 201


@api_v1.route('/admin/oidc/providers/<int:provider_id>', methods=['PUT'])
@jwt_required()
@require_role('administrator', 'settings_admin')
def update_oidc_provider(provider_id):
    """Update an existing OIDC provider"""
    provider = OIDCProviderModel.query.get(provider_id)
    if not provider:
        return jsonify({'error': 'Provider not found'}), 404

    data = request.get_json()

    if 'name' in data and data['name'] != provider.name:
        existing = OIDCProviderModel.query.filter_by(name=data['name']).first()
        if existing:
            return jsonify({'error': f'Provider with name "{data["name"]}" already exists'}), 400
        provider.name = data['name']

    if 'display_name' in data:
        provider.display_name = data['display_name']
    if 'button_color' in data:
        provider.button_color = data['button_color']
    if 'discovery_url' in data:
        provider.discovery_url = data['discovery_url']
    if 'icon_url' in data:
        provider.icon_url = data['icon_url']
    if 'client_id' in data:
        provider.client_id = data['client_id']
    if 'client_secret' in data and data['client_secret'] and not data['client_secret'].startswith('••'):
        # Only update secret if it's not the masked value
        provider.client_secret = data['client_secret']
    if 'enabled' in data:
        provider.enabled = data['enabled']
    if 'role_claim' in data:
        provider.role_claim = data['role_claim']
    if 'sync_roles' in data:
        provider.sync_roles = data['sync_roles']
    if 'role_mappings' in data:
        provider.set_role_mappings(data['role_mappings'])

    db.session.commit()
    current_app.logger.info(f"OIDC provider updated: {provider.name}")
    return jsonify(provider.to_dict(include_secrets=False)), 200


@api_v1.route('/admin/oidc/providers/<int:provider_id>', methods=['DELETE'])
@jwt_required()
@require_role('administrator', 'settings_admin')
def delete_oidc_provider(provider_id):
    """Delete an OIDC provider"""
    provider = OIDCProviderModel.query.get(provider_id)
    if not provider:
        return jsonify({'error': 'Provider not found'}), 404

    # Delete icon file if exists
    if provider.icon_url:
        upload_folder = os.path.join(current_app.instance_path, 'uploads')
        old_filename = os.path.basename(provider.icon_url)
        old_file = os.path.join(upload_folder, secure_filename(old_filename))
        if os.path.exists(old_file):
            os.remove(old_file)

    name = provider.name
    db.session.delete(provider)
    db.session.commit()

    current_app.logger.info(f"OIDC provider deleted: {name}")
    return jsonify({'message': f'Provider "{name}" deleted'}), 200


ICON_ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'svg'}
ICON_MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB


@api_v1.route('/admin/oidc/providers/<int:provider_id>/icon', methods=['POST'])
@jwt_required()
@require_role('administrator', 'settings_admin')
def upload_oidc_icon(provider_id):
    """Upload an icon for an OIDC provider"""
    provider = OIDCProviderModel.query.get(provider_id)
    if not provider:
        return jsonify({'error': 'Provider not found'}), 404

    if 'icon' not in request.files:
        return jsonify({'error': 'No icon file provided'}), 400

    file = request.files['icon']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
    if ext not in ICON_ALLOWED_EXTENSIONS:
        return jsonify({'error': f'Invalid file type. Allowed: {", ".join(ICON_ALLOWED_EXTENSIONS)}'}), 400

    # Check file size
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > ICON_MAX_FILE_SIZE:
        return jsonify({'error': 'File too large. Maximum size: 2MB'}), 400

    try:
        filename = f"oidc_icon_{provider_id}_{uuid.uuid4().hex[:8]}.{ext}"
        filename = secure_filename(filename)

        upload_folder = os.path.join(current_app.instance_path, 'uploads')
        os.makedirs(upload_folder, exist_ok=True)

        # Delete old icon if exists
        if provider.icon_url:
            old_filename = os.path.basename(provider.icon_url)
            old_file = os.path.join(upload_folder, secure_filename(old_filename))
            if os.path.exists(old_file):
                os.remove(old_file)

        filepath = os.path.join(upload_folder, filename)
        file.save(filepath)

        icon_url = f'/api/v1/uploads/{filename}'
        provider.icon_url = icon_url
        db.session.commit()

        current_app.logger.info(f"OIDC icon uploaded for provider {provider.name}: {icon_url}")
        return jsonify({'message': 'Icon uploaded', 'icon_url': icon_url}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error uploading OIDC icon: {str(e)}")
        return jsonify({'error': 'Failed to upload icon'}), 500


@api_v1.route('/admin/oidc/providers/<int:provider_id>/icon', methods=['DELETE'])
@jwt_required()
@require_role('administrator', 'settings_admin')
def delete_oidc_icon(provider_id):
    """Delete the icon for an OIDC provider"""
    provider = OIDCProviderModel.query.get(provider_id)
    if not provider:
        return jsonify({'error': 'Provider not found'}), 404

    try:
        if provider.icon_url:
            upload_folder = os.path.join(current_app.instance_path, 'uploads')
            old_filename = os.path.basename(provider.icon_url)
            old_file = os.path.join(upload_folder, secure_filename(old_filename))
            if os.path.exists(old_file):
                os.remove(old_file)

        provider.icon_url = ''
        db.session.commit()

        current_app.logger.info(f"OIDC icon deleted for provider {provider.name}")
        return jsonify({'message': 'Icon deleted'}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting OIDC icon: {str(e)}")
        return jsonify({'error': 'Failed to delete icon'}), 500
