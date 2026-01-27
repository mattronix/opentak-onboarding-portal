"""
QR Code API endpoints
Generates QR code connection strings for ATAK/iTAK
Mimics the OTS server /Marti/api/tls/config/qr endpoint
"""

from flask import request, Response, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.api_v1 import api_v1
from app.ots import otsClient
import qrcode
import io
import time

# Default token configuration (can be overridden by settings)
DEFAULT_TOKEN_EXPIRY_MINUTES = 60
DEFAULT_TOKEN_MAX_USES = 1

# Simple in-memory cache for QR strings
# Key: "username:token_type", Value: {"qr_string": str, "exp": int}
_qr_cache = {}


def get_cached_qr_string(username, token_type):
    """Get cached QR string for a user if not expired"""
    key = f"{username}:{token_type}"
    cached = _qr_cache.get(key)
    if cached:
        # Check if cached entry is expired
        if cached.get('exp') and cached['exp'] < time.time():
            del _qr_cache[key]
            return None
        return cached.get('qr_string')
    return None


def set_cached_qr_string(username, token_type, qr_string, exp=None):
    """Cache QR string for a user"""
    key = f"{username}:{token_type}"
    _qr_cache[key] = {'qr_string': qr_string, 'exp': exp}


def clear_cached_qr_string(username, token_type):
    """Clear cached QR string for a user"""
    key = f"{username}:{token_type}"
    _qr_cache.pop(key, None)


def get_token_settings():
    """Get token expiry and max uses from system settings"""
    from app.models import SystemSettingsModel

    expiry_minutes = DEFAULT_TOKEN_EXPIRY_MINUTES
    max_uses = DEFAULT_TOKEN_MAX_USES

    try:
        expiry_setting = SystemSettingsModel.get_setting('qr_token_expiry_minutes')
        if expiry_setting:
            expiry_minutes = int(expiry_setting)
    except (ValueError, TypeError):
        pass

    try:
        max_setting = SystemSettingsModel.get_setting('qr_token_max_uses')
        if max_setting:
            max_uses = int(max_setting)
    except (ValueError, TypeError):
        pass

    return expiry_minutes * 60, max_uses  # Return seconds and max uses


def extract_qr_data(response_data):
    """
    Extract QR data from OTS response.

    OTS client wraps responses in: {"response": {...}, "status_code": 200}
    The actual OTS API returns: {"qr_string": "tak://...", "exp": ..., "max": ..., "total_uses": ...}

    Returns dict with qr_string, exp, max, total_uses or None if parsing fails.
    """
    if not response_data:
        return None

    # Handle case where response_data is a string (tak:// URL or iTAK format)
    if isinstance(response_data, str):
        if response_data.startswith('tak://') or response_data.startswith('OpenTAKServer_'):
            return {'qr_string': response_data}
        return None

    # Must be a dict at this point
    if not isinstance(response_data, dict):
        return None

    # OTS client wraps in {"response": {...}, "status_code": ...}
    data = response_data.get('response', response_data)

    if not data:
        return None

    # Handle string response (older OTS versions or iTAK format)
    if isinstance(data, str) and (data.startswith('tak://') or data.startswith('OpenTAKServer_')):
        return {'qr_string': data}

    # Handle dict response
    if isinstance(data, dict):
        # Check for double nesting (some OTS versions)
        if 'response' in data and isinstance(data['response'], dict):
            data = data['response']

        qr_string = data.get('qr_string')
        exp = data.get('exp')
        max_uses = data.get('max')
        total_uses = data.get('total_uses', 0)

        if qr_string or exp is not None or max_uses is not None:
            return {
                'qr_string': qr_string,
                'exp': exp,
                'max': max_uses,
                'total_uses': total_uses,
                'success': data.get('success', True)
            }

    return None


def is_token_exhausted(qr_data):
    """Check if token has been used up (total_uses >= max)"""
    if not qr_data:
        return True
    if not isinstance(qr_data, dict):
        return True
    max_uses = qr_data.get('max')
    total_uses = qr_data.get('total_uses', 0)
    if max_uses is not None and total_uses >= max_uses:
        return True
    return False


def get_or_create_atak_token(username, force_refresh=False):
    """
    Get existing ATAK token or create a fresh one if needed.

    Returns:
        dict: {qr_string, expires_at, max_uses, total_uses} or None
    """
    expiry_seconds, max_uses = get_token_settings()

    # If force refresh, delete existing token first and create new one
    if force_refresh:
        clear_cached_qr_string(username, 'atak')
        try:
            otsClient.delete_atak_qr_string(username)
        except Exception:
            pass  # Ignore delete errors
    else:
        # Try to get existing token from OTS
        try:
            existing = otsClient.get_atak_qr_string(username)
            qr_data = extract_qr_data(existing)

            if qr_data:
                qr_string = qr_data.get('qr_string')
                exp = qr_data.get('exp')
                token_max = qr_data.get('max')
                total_uses = qr_data.get('total_uses', 0)

                # Check if token is expired
                if exp and exp < time.time():
                    clear_cached_qr_string(username, 'atak')
                else:
                    # Token is valid - return it
                    if qr_string:
                        set_cached_qr_string(username, 'atak', qr_string, exp)
                        return {
                            'qr_string': qr_string,
                            'expires_at': exp,
                            'max_uses': token_max if token_max is not None else max_uses,
                            'total_uses': total_uses
                        }
                    # Try cached value
                    cached_qr = get_cached_qr_string(username, 'atak')
                    if cached_qr:
                        return {
                            'qr_string': cached_qr,
                            'expires_at': exp,
                            'max_uses': token_max if token_max is not None else max_uses,
                            'total_uses': total_uses
                        }
        except Exception:
            # Try cached value on error
            cached_qr = get_cached_qr_string(username, 'atak')
            if cached_qr:
                return {
                    'qr_string': cached_qr,
                    'expires_at': None,
                    'max_uses': max_uses,
                    'total_uses': 0
                }

    # Delete existing token before creating new one
    try:
        otsClient.delete_atak_qr_string(username)
    except Exception:
        pass

    # Create new token
    try:
        exp_time = int(time.time()) + expiry_seconds
        qr_response = otsClient.create_atak_qr_string(
            username=username,
            exp=exp_time,
            max_uses=max_uses
        )
        qr_data = extract_qr_data(qr_response)

        if qr_data and qr_data.get('qr_string'):
            set_cached_qr_string(username, 'atak', qr_data['qr_string'], qr_data.get('exp', exp_time))
            return {
                'qr_string': qr_data['qr_string'],
                'expires_at': qr_data.get('exp', exp_time),
                'max_uses': qr_data.get('max', max_uses),
                'total_uses': qr_data.get('total_uses', 0)
            }
    except Exception as e:
        current_app.logger.error(f"Failed to create ATAK token: {e}")

    return None


def get_or_create_itak_token(username, force_refresh=False):
    """
    Generate iTAK connection string locally.

    iTAK connection strings don't have expiry or usage tracking,
    so we just generate the format: OpenTAKServer_HOST,HOST,PORT,SSL

    Returns:
        dict: {qr_string, expires_at: None, max_uses: None, total_uses: None}
    """
    from app.settings import OTS_HOSTNAME

    host = OTS_HOSTNAME or 'localhost'
    port = '8089'

    itak_qr_string = f"OpenTAKServer_{host},{host},{port},SSL"

    return {
        'qr_string': itak_qr_string,
        'expires_at': None,  # iTAK connection strings don't expire
        'max_uses': None,    # No usage tracking for iTAK
        'total_uses': None
    }


@api_v1.route('/Marti/api/tls/config/qr', methods=['GET'])
@jwt_required(optional=True)
def get_marti_qr():
    """
    Get QR code image for ATAK/iTAK configuration

    Mimics the OTS server endpoint: /Marti/api/tls/config/qr?clientUid=username

    Query Parameters:
    - clientUid: Username for the client (optional if using JWT auth)

    Returns:
    - PNG image of QR code
    """
    try:
        # Get username from query param or JWT token
        client_uid = request.args.get('clientUid')

        if not client_uid:
            # Try to get from JWT if authenticated
            try:
                client_uid = get_jwt_identity()
            except:
                pass

        if not client_uid:
            return Response(
                'Missing clientUid parameter',
                status=400,
                mimetype='text/plain'
            )

        # Get or create token (auto-regenerates if exhausted/expired)
        token_data = get_or_create_atak_token(client_uid)

        if not token_data or not token_data.get('qr_string'):
            return Response(
                'Failed to generate QR string',
                status=500,
                mimetype='text/plain'
            )

        # Generate QR code image
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(token_data['qr_string'])
        qr.make(fit=True)

        # Create PNG image
        img = qr.make_image(fill_color="black", back_color="white")

        # Save to bytes buffer
        img_io = io.BytesIO()
        img.save(img_io, 'PNG')
        img_io.seek(0)

        return Response(
            img_io.getvalue(),
            mimetype='image/png',
            headers={
                'Content-Disposition': f'inline; filename=qr_{client_uid}.png',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        )

    except Exception as e:
        current_app.logger.error(f"QR code generation error: {str(e)}")
        return Response(
            f'Failed to generate QR code: {str(e)}',
            status=500,
            mimetype='text/plain'
        )


@api_v1.route('/qr/atak', methods=['GET'])
@jwt_required()
def get_atak_qr_string():
    """
    Get ATAK QR code connection string (JSON format)

    Returns the QR string that can be scanned by ATAK to configure
    connection to the TAK server. Auto-regenerates if token is exhausted or expired.

    Query Parameters:
    - refresh: Set to "true" to force regenerate the token

    Response:
    {
        "qr_string": "string",
        "username": "string",
        "expires_at": integer (Unix timestamp),
        "max_uses": integer,
        "total_uses": integer
    }
    """
    from app.models import UserModel

    try:
        # Get current user's ID and fetch username
        user_id = get_jwt_identity()
        user = UserModel.get_user_by_id(int(user_id))

        if not user:
            return {
                'error': 'User not found',
                'details': 'Could not find user'
            }, 404

        username = user.username

        # Check if force refresh is requested
        force_refresh = request.args.get('refresh', '').lower() == 'true'

        # Get or create token (auto-regenerates if exhausted/expired)
        token_data = get_or_create_atak_token(username, force_refresh=force_refresh)

        if token_data and token_data.get('qr_string'):
            return {
                'qr_string': token_data['qr_string'],
                'username': username,
                'expires_at': token_data.get('expires_at'),
                'max_uses': token_data.get('max_uses'),
                'total_uses': token_data.get('total_uses', 0)
            }, 200
        else:
            return {
                'error': 'Failed to generate QR string',
                'details': 'QR string is empty or OTS returned unexpected format'
            }, 500

    except Exception as e:
        current_app.logger.error(f"QR code generation error: {str(e)}")
        return {
            'error': 'Failed to generate QR code',
            'details': str(e)
        }, 500


@api_v1.route('/qr/itak', methods=['GET'])
@jwt_required()
def get_itak_qr_string():
    """
    Get iTAK QR code connection string (JSON format)

    Returns the QR string that can be scanned by iTAK to configure
    connection to the TAK server. Auto-regenerates if token is exhausted or expired.

    Query Parameters:
    - refresh: Set to "true" to force regenerate the token

    Response:
    {
        "qr_string": "string",
        "username": "string",
        "expires_at": integer (Unix timestamp),
        "max_uses": integer,
        "total_uses": integer
    }
    """
    from app.models import UserModel

    try:
        # Get current user's ID and fetch username
        user_id = get_jwt_identity()
        user = UserModel.get_user_by_id(int(user_id))

        if not user:
            return {
                'error': 'User not found',
                'details': 'Could not find user'
            }, 404

        username = user.username

        # Check if force refresh is requested
        force_refresh = request.args.get('refresh', '').lower() == 'true'

        # Get or create token (auto-regenerates if exhausted/expired)
        token_data = get_or_create_itak_token(username, force_refresh=force_refresh)

        if token_data and token_data.get('qr_string'):
            return {
                'qr_string': token_data['qr_string'],
                'username': username,
                'expires_at': token_data.get('expires_at'),
                'max_uses': token_data.get('max_uses'),
                'total_uses': token_data.get('total_uses', 0)
            }, 200
        else:
            return {
                'error': 'Failed to generate QR string',
                'details': 'QR string is empty or OTS returned unexpected format'
            }, 500

    except Exception as e:
        current_app.logger.error(f"iTAK QR code generation error: {str(e)}")
        return {
            'error': 'Failed to generate QR code',
            'details': str(e)
        }, 500
