# JWT Query Parameter Support for Download Endpoints

## Problem

The TAK profile download endpoint was returning `401 Unauthorized` when accessing it with a JWT token in the query parameter:

```
GET /api/v1/tak-profiles/1/download?token=eyJ...
Response: 401 Unauthorized
```

This is a common pattern for download endpoints because:
1. Browser downloads can't easily add custom headers
2. Direct links (from emails, QR codes, etc.) can only include query parameters
3. Users expect to click a link and download files without manual authentication

## Root Cause

Flask-JWT-Extended's `@jwt_required()` decorator only checks for JWT tokens in the `Authorization` header by default:

```
Authorization: Bearer eyJ...
```

It does not support query parameters out of the box.

## Solution

Created custom JWT authentication decorator that supports **both** authentication methods:

### 1. Query Parameter Authentication (NEW)
```
GET /api/v1/tak-profiles/1/download?token=eyJ...
```

### 2. Header Authentication (EXISTING)
```
GET /api/v1/tak-profiles/1/download
Authorization: Bearer eyJ...
```

## Implementation

### Custom Decorator: `jwt_required_with_query()`

**Location:** [app/api_v1/tak_profiles.py](../app/api_v1/tak_profiles.py#L32-L70)

```python
def jwt_required_with_query():
    """
    Custom JWT decorator that accepts token from query parameter or header.
    Useful for download endpoints that are accessed via browser/direct links.
    """
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            # First try to get token from query parameter
            token = request.args.get('token')
            if token:
                try:
                    # Manually verify and decode the token
                    from flask import current_app
                    import jwt as pyjwt

                    # Decode and verify the token
                    decoded = pyjwt.decode(
                        token,
                        current_app.config['JWT_SECRET_KEY'],
                        algorithms=['HS256']
                    )

                    # Store the decoded token in g for access
                    g.jwt_identity = decoded['sub']
                    g.jwt_claims = decoded

                except Exception as e:
                    return jsonify({'error': f'Invalid token: {str(e)}'}), 401
            else:
                # Fall back to standard header authentication
                try:
                    verify_jwt_in_request()
                except Exception as e:
                    return jsonify({'error': 'Missing or invalid token'}), 401

            return fn(*args, **kwargs)
        return decorator
    return wrapper
```

### Helper Functions

**`get_jwt_identity_custom()`** - Gets user ID from either source:
```python
def get_jwt_identity_custom():
    """Get JWT identity from either query parameter or standard header"""
    if hasattr(g, 'jwt_identity'):
        return g.jwt_identity
    return get_jwt_identity()
```

**`get_jwt_custom()`** - Gets JWT claims from either source:
```python
def get_jwt_custom():
    """Get JWT claims from either query parameter or standard header"""
    if hasattr(g, 'jwt_claims'):
        return g.jwt_claims
    return get_jwt()
```

### Updated Download Endpoint

**Before:**
```python
@api_v1.route('/tak-profiles/<int:profile_id>/download', methods=['GET'])
@jwt_required()
def download_tak_profile(profile_id):
    current_user_id = int(get_jwt_identity())
    claims = get_jwt()
    # ...
```

**After:**
```python
@api_v1.route('/tak-profiles/<int:profile_id>/download', methods=['GET'])
@jwt_required_with_query()
def download_tak_profile(profile_id):
    """Download TAK profile as ZIP with callsign injection

    Supports JWT token from:
    - Authorization header: Authorization: Bearer <token>
    - Query parameter: ?token=<token> (for browser/direct link downloads)
    """
    current_user_id = int(get_jwt_identity_custom())
    claims = get_jwt_custom()
    # ...
```

## Usage Examples

### 1. Browser/Direct Link Download (Query Parameter)

User receives email with download link:
```
http://localhost:5000/api/v1/tak-profiles/1/download?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

User clicks link → Browser downloads file ✅

### 2. API Client Download (Header)

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  http://localhost:5000/api/v1/tak-profiles/1/download
```

### 3. React SPA Download (Either Method)

**Using Header:**
```javascript
const response = await fetch(`/api/v1/tak-profiles/${id}/download`, {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

**Using Query Parameter:**
```javascript
const downloadUrl = `/api/v1/tak-profiles/${id}/download?token=${accessToken}`;
window.location.href = downloadUrl; // Triggers browser download
```

## Security Considerations

### ✅ Secure Practices Maintained

1. **Token Verification**: Tokens are cryptographically verified using JWT_SECRET_KEY
2. **Expiration Check**: Token expiration is enforced (12-hour default)
3. **Signature Validation**: HMAC-SHA256 signature is verified
4. **Role-Based Access**: Admin and ownership checks still apply
5. **Same Secret**: Uses same JWT_SECRET_KEY as header authentication

### ⚠️ Security Notes

**Query parameters in URLs are:**
- Visible in browser history
- Logged in server access logs
- Visible in browser developer tools
- Can be shared via copy/paste

**Recommendations:**
1. ✅ Use query parameter authentication **only** for download endpoints
2. ✅ Keep token expiration short (12 hours default)
3. ✅ Use HTTPS in production to encrypt URLs
4. ✅ Don't log full URLs with tokens on server side
5. ✅ Consider generating short-lived download tokens specifically for file access

### Alternative: Download-Specific Tokens

For enhanced security, consider generating short-lived (5-15 minute) tokens specifically for downloads:

```python
# In the TAK profiles list/get endpoint
download_token = create_access_token(
    identity=str(user.id),
    additional_claims={'download_only': True, 'profile_id': profile.id},
    expires_delta=timedelta(minutes=15)
)
```

Then validate the `download_only` claim in the download endpoint.

## Testing

### Manual Test

1. Login to get JWT token:
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"matthew","password":"yourpassword"}'
```

2. Extract access_token from response

3. Test download with query parameter:
```bash
curl "http://localhost:5000/api/v1/tak-profiles/1/download?token=YOUR_TOKEN" \
  --output profile.zip
```

4. Verify file downloaded successfully

### Browser Test

1. Login to web app
2. Get JWT token from localStorage or network tab
3. Open in browser:
```
http://localhost:5000/api/v1/tak-profiles/1/download?token=YOUR_TOKEN
```
4. File should download automatically

## Files Modified

1. **[app/api_v1/tak_profiles.py](../app/api_v1/tak_profiles.py)**
   - Added `jwt_required_with_query()` decorator (lines 32-70)
   - Added `get_jwt_identity_custom()` helper (lines 18-22)
   - Added `get_jwt_custom()` helper (lines 25-29)
   - Updated download endpoint to use new decorator (line 136)
   - Updated endpoint to use custom helpers (lines 144, 152)

## Future Enhancements

### Apply to Other Download Endpoints

This pattern can be applied to other download endpoints:

**Packages Download:**
```python
@api_v1.route('/packages/<int:package_id>/download', methods=['GET'])
@jwt_required_with_query()  # Add this
def download_package(package_id):
    current_user_id = int(get_jwt_identity_custom())  # Use this
    # ...
```

**Meshtastic Config Download:**
```python
@api_v1.route('/meshtastic/<int:config_id>/download', methods=['GET'])
@jwt_required_with_query()  # Add this
def download_meshtastic_config(config_id):
    current_user_id = int(get_jwt_identity_custom())  # Use this
    # ...
```

### Create Reusable Module

Move the custom decorator to a shared module:
```python
# app/decorators.py or app/utils/jwt.py
def jwt_required_flexible(allow_query=False):
    """
    Flexible JWT decorator supporting multiple token locations

    Args:
        allow_query: If True, accept token from query parameter
    """
    # Implementation...
```

Usage:
```python
from app.decorators import jwt_required_flexible

@api_v1.route('/download', methods=['GET'])
@jwt_required_flexible(allow_query=True)
def download_file():
    # ...
```

## Related Documentation

- [API Test Results](./API_TEST_RESULTS_FINAL.md)
- [API Testing Guide](./API_TESTING_GUIDE.md)
- [Conversion Guide](./CONVERSION_GUIDE.md)
