# TAK Profile Download Fixes - Complete Summary

## Overview

Fixed multiple issues with the TAK profile download endpoint to enable proper file downloads with JWT query parameter authentication and correct filename generation.

**Endpoint:** `GET /api/v1/tak-profiles/<id>/download`

## Issues Fixed

### ✅ Issue 1: JWT Query Parameter Authentication (401 Error)

**Problem:**
```
GET /api/v1/tak-profiles/1/download?token=eyJ...
Response: 401 Unauthorized
```

**Root Cause:** Flask-JWT-Extended's `@jwt_required()` only accepts tokens in `Authorization` header, not query parameters.

**Solution:** Created custom `@jwt_required_with_query()` decorator supporting both:
- Query parameter: `?token=eyJ...`
- Header: `Authorization: Bearer eyJ...`

**Files Modified:** [app/api_v1/tak_profiles.py](../app/api_v1/tak_profiles.py)

**Documentation:** [JWT_QUERY_PARAMETER_FIX.md](./JWT_QUERY_PARAMETER_FIX.md)

---

### ✅ Issue 2: Duplicate Path in File Location (500 Error)

**Problem:**
```json
{
  "error": "Failed to download profile: [Errno 2] No such file or directory: 'datapackages/datapackages/1'"
}
```

**Root Cause:** Database stored full path `datapackages/1` but code was prepending the base folder again, creating `datapackages/datapackages/1`.

**Solution:** Added logic to check if path already includes base folder:

```python
# Check if takTemplateFolderLocation already includes the base folder
if profile.takTemplateFolderLocation.startswith(DATAPACKAGE_UPLOAD_FOLDER):
    # Path already includes the folder, use as-is
    source_path = profile.takTemplateFolderLocation
else:
    # Path is relative, prepend the base folder
    source_path = os.path.join(DATAPACKAGE_UPLOAD_FOLDER, profile.takTemplateFolderLocation)
```

**Location:** [app/api_v1/tak_profiles.py](../app/api_v1/tak_profiles.py#L166-L172)

---

### ✅ Issue 3: Incorrect Filename (test_None.zip)

**Problem:** Downloaded file was named `test_None.zip` because user's callsign was `None`.

**Root Cause:** Code directly used `user.callsign` without checking for `None` value.

**Solution:** Added fallback to username and filename sanitization:

```python
# Get user callsign or use username as fallback
callsign = user.callsign if user.callsign else user.username

# Create ZIP file with sanitized filename
safe_profile_name = "".join(c for c in profile.name if c.isalnum() or c in (' ', '-', '_')).strip()
safe_callsign = "".join(c for c in callsign if c.isalnum() or c in ('-', '_')).strip()
zip_filename = f'{safe_profile_name}_{safe_callsign}.zip'
```

**Location:** [app/api_v1/tak_profiles.py](../app/api_v1/tak_profiles.py#L162-L195)

**Result:** File now named `test_matthew.zip` (profile name + username/callsign)

---

## Additional Improvements

### 1. Better Error Messages

Added check for file existence with descriptive error:
```python
if not os.path.exists(source_path):
    return jsonify({'error': f'TAK profile files not found at: {source_path}'}), 404
```

### 2. Temporary File Cleanup

Added automatic cleanup of temporary files after download:
```python
@response.call_on_close
def cleanup():
    try:
        shutil.rmtree(temp_dir)
    except:
        pass
```

### 3. Error Handling Cleanup

Added cleanup on error:
```python
except Exception as e:
    # Clean up temp directory on error
    try:
        if 'temp_dir' in locals():
            shutil.rmtree(temp_dir)
    except:
        pass
    return jsonify({'error': f'Failed to download profile: {str(e)}'}), 500
```

### 4. Filename Sanitization

Sanitizes filenames to prevent security issues:
- Removes special characters
- Allows only alphanumeric, spaces, hyphens, underscores
- Prevents path traversal attacks

## Complete Code Changes

### Updated Download Endpoint

**File:** [app/api_v1/tak_profiles.py](../app/api_v1/tak_profiles.py#L135-L224)

```python
@api_v1.route('/tak-profiles/<int:profile_id>/download', methods=['GET'])
@jwt_required_with_query()
def download_tak_profile(profile_id):
    """Download TAK profile as ZIP with callsign injection

    Supports JWT token from:
    - Authorization header: Authorization: Bearer <token>
    - Query parameter: ?token=<token> (for browser/direct link downloads)
    """
    current_user_id = int(get_jwt_identity_custom())  # Convert string to int
    user = UserModel.get_user_by_id(current_user_id)

    profile = TakProfileModel.get_tak_profile_by_id(profile_id)
    if not profile:
        return jsonify({'error': 'TAK profile not found'}), 404

    # Check access
    claims = get_jwt_custom()
    is_admin = 'administrator' in claims.get('roles', [])
    if not is_admin and not profile.isPublic and profile not in user.takprofiles:
        return jsonify({'error': 'Access denied'}), 403

    try:
        # Create temporary directory for customized package
        import tempfile
        temp_dir = tempfile.mkdtemp()

        # Get user callsign or use username as fallback
        callsign = user.callsign if user.callsign else user.username

        # Copy and customize the datapackage
        # Check if takTemplateFolderLocation already includes the base folder
        if profile.takTemplateFolderLocation.startswith(DATAPACKAGE_UPLOAD_FOLDER):
            # Path already includes the folder, use as-is
            source_path = profile.takTemplateFolderLocation
        else:
            # Path is relative, prepend the base folder
            source_path = os.path.join(DATAPACKAGE_UPLOAD_FOLDER, profile.takTemplateFolderLocation)

        dest_path = os.path.join(temp_dir, 'package')

        if not os.path.exists(source_path):
            return jsonify({'error': f'TAK profile files not found at: {source_path}'}), 404

        shutil.copytree(source_path, dest_path)

        # Inject user callsign into preferences file if exists
        if profile.takPrefFileLocation:
            pref_file = os.path.join(dest_path, profile.takPrefFileLocation)
            if os.path.exists(pref_file):
                with open(pref_file, 'r') as f:
                    content = f.read()
                # Replace ${callsign} placeholder with actual callsign
                content = content.replace('${callsign}', callsign)
                with open(pref_file, 'w') as f:
                    f.write(content)

        # Create ZIP file with sanitized filename
        safe_profile_name = "".join(c for c in profile.name if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_callsign = "".join(c for c in callsign if c.isalnum() or c in ('-', '_')).strip()
        zip_filename = f'{safe_profile_name}_{safe_callsign}.zip'
        zip_path = os.path.join(temp_dir, zip_filename)
        shutil.make_archive(zip_path.replace('.zip', ''), 'zip', dest_path)

        # Send file and cleanup temp directory after sending
        response = send_file(
            zip_path,
            as_attachment=True,
            download_name=zip_filename,
            mimetype='application/zip'
        )

        # Register cleanup function to run after response is sent
        @response.call_on_close
        def cleanup():
            try:
                shutil.rmtree(temp_dir)
            except:
                pass

        return response

    except Exception as e:
        # Clean up temp directory on error
        try:
            if 'temp_dir' in locals():
                shutil.rmtree(temp_dir)
        except:
            pass
        return jsonify({'error': f'Failed to download profile: {str(e)}'}), 500
```

## Testing

### Test with Query Parameter

```bash
# Get JWT token
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"matthew","password":"yourpassword"}'

# Download with token in query parameter
curl "http://localhost:5000/api/v1/tak-profiles/1/download?token=YOUR_TOKEN" \
  --output profile.zip

# Verify filename
ls -lh profile.zip
```

### Test with Authorization Header

```bash
curl http://localhost:5000/api/v1/tak-profiles/1/download \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output profile.zip
```

### Test in Browser

Navigate to:
```
http://localhost:5000/api/v1/tak-profiles/1/download?token=YOUR_TOKEN
```

File should download automatically with correct name.

## Files Modified

1. **[app/api_v1/tak_profiles.py](../app/api_v1/tak_profiles.py)**
   - Added `jwt_required_with_query()` decorator
   - Added `get_jwt_identity_custom()` helper
   - Added `get_jwt_custom()` helper
   - Updated download endpoint with all fixes
   - Added path validation logic
   - Added callsign fallback logic
   - Added filename sanitization
   - Added temporary file cleanup

## Status

✅ **All Issues Resolved**

- ✅ Query parameter authentication works
- ✅ Header authentication still works
- ✅ File path resolution correct
- ✅ Filename properly generated with callsign/username
- ✅ Callsign injection works in preference files
- ✅ Temporary files cleaned up automatically
- ✅ Better error messages
- ✅ Security improvements (filename sanitization)

## Related Documentation

- [JWT Query Parameter Fix](./JWT_QUERY_PARAMETER_FIX.md)
- [API Test Results](./API_TEST_RESULTS_FINAL.md)
- [Conversion Guide](./CONVERSION_GUIDE.md)
