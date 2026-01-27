"""
Role-Based Access Control (RBAC) helpers for the OpenTAK Onboarding Portal.

Admin roles (stored in local database, not OTS):
- administrator: Full access to everything
- user_admin: Manage users
- role_admin: Manage roles
- onboarding_admin: Manage onboarding codes
- registration_admin: Manage pending registrations
- tak_profile_admin: Manage TAK profiles
- meshtastic_admin: Manage Meshtastic configurations
- radio_admin: Manage radios
- announcement_admin: Manage announcements
- settings_admin: Manage system settings
"""

from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity

# Define admin roles with description and display name
# Format: role_name: (description, display_name)
ADMIN_ROLES = {
    'administrator': ('Full administrator access', 'Administrator'),
    'user_admin': ('Manage user accounts', 'User Admin'),
    'role_admin': ('Manage user roles', 'Role Admin'),
    'onboarding_admin': ('Manage onboarding codes', 'Onboarding Admin'),
    'registration_admin': ('Manage pending registrations', 'Registration Admin'),
    'tak_profile_admin': ('Manage TAK profiles', 'TAK Profile Admin'),
    'meshtastic_admin': ('Manage Meshtastic configurations', 'Meshtastic Admin'),
    'radio_admin': ('Manage radio equipment', 'Radio Admin'),
    'announcement_admin': ('Manage announcements', 'Announcement Admin'),
    'settings_admin': ('Manage system settings', 'Settings Admin'),
    'api_key_admin': ('Manage API keys', 'API Key Admin'),
}

# Map modules to required roles (administrator always has access)
MODULE_ROLES = {
    'users': ['administrator', 'user_admin'],
    'roles': ['administrator', 'role_admin'],
    'onboarding_codes': ['administrator', 'onboarding_admin'],
    'pending_registrations': ['administrator', 'registration_admin'],
    'tak_profiles': ['administrator', 'tak_profile_admin'],
    'meshtastic': ['administrator', 'meshtastic_admin'],
    'radios': ['administrator', 'radio_admin'],
    'announcements': ['administrator', 'announcement_admin'],
    'settings': ['administrator', 'settings_admin'],
    'api_keys': ['administrator', 'api_key_admin'],
    'api_docs': ['administrator', 'api_key_admin'],
}


def get_user_roles():
    """Get the roles from the database for the current user (not from JWT)"""
    from app.models import UserModel

    try:
        current_user_id = get_jwt_identity()
        if not current_user_id:
            return []

        user = UserModel.get_user_by_id(int(current_user_id))
        if not user:
            return []

        return [role.name for role in user.roles]
    except Exception:
        return []


def has_role(role_name):
    """Check if user has a specific role (from database)"""
    return role_name in get_user_roles()


def has_any_role(role_names):
    """Check if user has any of the specified roles (from database)"""
    user_roles = get_user_roles()
    return any(role in user_roles for role in role_names)


def has_module_access(module_name):
    """Check if user has access to a specific module"""
    required_roles = MODULE_ROLES.get(module_name, ['administrator'])
    return has_any_role(required_roles)


def require_role(*allowed_roles):
    """
    Decorator to require specific role(s) for an endpoint.
    Checks roles from database, not JWT.
    Administrator role always has access.

    Usage:
        @require_role('user_admin')
        def get_users():
            ...

        @require_role('role_admin', 'user_admin')
        def some_endpoint():
            ...
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user_roles = get_user_roles()

            # Administrator always has access
            if 'administrator' in user_roles:
                return fn(*args, **kwargs)

            # Check if user has any of the allowed roles
            if any(role in user_roles for role in allowed_roles):
                return fn(*args, **kwargs)

            return jsonify({
                'error': 'Access denied. Required role: ' + ' or '.join(allowed_roles)
            }), 403

        return wrapper
    return decorator


def require_any_admin_role():
    """Check if user has any admin-level role (from database)"""
    user_roles = get_user_roles()
    admin_role_names = list(ADMIN_ROLES.keys())
    if any(role in user_roles for role in admin_role_names):
        return None
    return jsonify({'error': 'Administrator role required'}), 403


def require_admin():
    """Check for full administrator role (from database)"""
    if 'administrator' not in get_user_roles():
        return jsonify({'error': 'Administrator role required'}), 403
    return None


def get_user_admin_modules():
    """Get list of modules the current user has access to (from database)"""
    user_roles = get_user_roles()
    accessible_modules = []

    for module, required_roles in MODULE_ROLES.items():
        if any(role in user_roles for role in required_roles):
            accessible_modules.append(module)

    return accessible_modules


def seed_admin_roles(db, UserRoleModel):
    """
    Seed the database with admin roles if they don't exist.
    Also updates display names for any roles missing them.
    Call this during app initialization.
    """
    try:
        # Seed admin roles
        for role_name, (description, display_name) in ADMIN_ROLES.items():
            existing = UserRoleModel.get_role_by_name(role_name)
            if not existing:
                UserRoleModel.create_role(role_name, description, display_name)
                print(f"Created admin role: {role_name}")
            elif existing and not getattr(existing, 'display_name', None):
                # Update existing roles with display_name if missing
                existing.display_name = display_name
                db.session.commit()
                print(f"Updated admin role display_name: {role_name}")

        # Update any other roles (e.g., OTS-created) that don't have display names
        all_roles = UserRoleModel.get_all_roles()
        for role in all_roles:
            if not getattr(role, 'display_name', None):
                # Generate display name by capitalizing (e.g., "user" -> "User")
                role.display_name = role.name.replace('_', ' ').title()
                db.session.commit()
                print(f"Updated role display_name: {role.name} -> {role.display_name}")
    except Exception as e:
        # Handle case where migration hasn't run yet (missing columns)
        print(f"Warning: Could not seed admin roles (likely pending migration): {e}")
        db.session.rollback()
