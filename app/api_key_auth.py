"""
API Key Authentication middleware for the OpenTAK Onboarding Portal.

Allows endpoints to accept either JWT token or API key authentication.
API keys are passed via the X-API-Key header.
"""

from functools import wraps
from flask import request, jsonify, g
from app.models import ApiKeyModel


def get_api_key_from_request():
    """Extract API key from request headers"""
    return request.headers.get('X-API-Key')


def validate_api_key_auth():
    """
    Validate API key from request and set up request context.
    Returns (api_key, error_response) tuple.
    """
    raw_key = get_api_key_from_request()

    if not raw_key:
        return None, None  # No API key provided, not an error

    api_key = ApiKeyModel.validate_key(raw_key)

    if not api_key:
        return None, (jsonify({
            'error': 'Invalid or expired API key',
            'code': 'INVALID_API_KEY'
        }), 401)

    # Record usage
    ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
    if ip_address and ',' in ip_address:
        ip_address = ip_address.split(',')[0].strip()
    api_key.record_usage(ip_address)

    return api_key, None


def api_key_or_jwt_required(permission=None):
    """
    Decorator that allows either API key or JWT authentication.

    If an API key is provided, it validates the key and optionally checks permission.
    If no API key is provided, it falls back to JWT authentication.

    Usage:
        @api_key_or_jwt_required()
        def my_endpoint():
            ...

        @api_key_or_jwt_required('users:read')
        def get_users():
            ...
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

            # Check for API key first
            raw_key = get_api_key_from_request()

            if raw_key:
                # API key authentication
                api_key, error = validate_api_key_auth()

                if error:
                    return error

                if not api_key:
                    return jsonify({
                        'error': 'Invalid API key',
                        'code': 'INVALID_API_KEY'
                    }), 401

                # Check permission if required
                if permission and not api_key.has_permission(permission):
                    return jsonify({
                        'error': f'API key does not have permission: {permission}',
                        'code': 'PERMISSION_DENIED'
                    }), 403

                # Set request context for API key auth
                g.auth_type = 'api_key'
                g.api_key = api_key
                g.api_key_id = api_key.id

                return fn(*args, **kwargs)
            else:
                # Fall back to JWT authentication
                try:
                    verify_jwt_in_request()
                    g.auth_type = 'jwt'
                    g.user_id = get_jwt_identity()
                    return fn(*args, **kwargs)
                except Exception as e:
                    return jsonify({
                        'error': 'Authentication required. Provide JWT token or API key.',
                        'code': 'AUTH_REQUIRED'
                    }), 401

        return wrapper
    return decorator


def api_key_required(permission=None):
    """
    Decorator that requires API key authentication only (no JWT fallback).

    Usage:
        @api_key_required()
        def my_endpoint():
            ...

        @api_key_required('users:read')
        def get_users():
            ...
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            api_key, error = validate_api_key_auth()

            if error:
                return error

            if not api_key:
                return jsonify({
                    'error': 'API key required. Provide X-API-Key header.',
                    'code': 'API_KEY_REQUIRED'
                }), 401

            # Check permission if required
            if permission and not api_key.has_permission(permission):
                return jsonify({
                    'error': f'API key does not have permission: {permission}',
                    'code': 'PERMISSION_DENIED'
                }), 403

            # Set request context
            g.auth_type = 'api_key'
            g.api_key = api_key
            g.api_key_id = api_key.id

            return fn(*args, **kwargs)

        return wrapper
    return decorator


def get_current_auth_type():
    """Get the current authentication type ('jwt' or 'api_key')"""
    return getattr(g, 'auth_type', None)


def get_current_api_key():
    """Get the current API key if authenticated via API key"""
    return getattr(g, 'api_key', None)


def is_api_key_auth():
    """Check if the current request is authenticated via API key"""
    return get_current_auth_type() == 'api_key'
