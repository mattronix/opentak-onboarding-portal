# User Deletion Guide

## Overview

When you delete a user from the OpenTAK Onboarding Portal, the system now:
1. ✅ Deletes the user from OpenTAK Server (OTS)
2. ✅ Deletes the user from the local database
3. ✅ Logs all actions for audit purposes
4. ✅ Handles errors gracefully

## How It Works

### Deletion Flow

```
1. Admin clicks "Delete" on a user
2. API receives DELETE /api/v1/users/{user_id}
3. Verify admin permissions
4. Find user in local database
5. Attempt to delete from OTS
   ├─ Success: Log and continue
   └─ Failure: Log warning and continue anyway*
6. Delete from local database
7. Return success message
```

\* **Important**: If OTS deletion fails (e.g., user doesn't exist in OTS), the system continues with local deletion to prevent orphaned records.

### Error Handling

The improved deletion logic handles several scenarios:

**Scenario 1: Normal Deletion**
- User exists in both OTS and local database
- Both deletions succeed
- Result: ✅ User completely removed

**Scenario 2: User Only in Local Database**
- User doesn't exist in OTS (maybe manually deleted)
- OTS deletion fails
- Local deletion still proceeds
- Result: ✅ User removed from local database, warning logged

**Scenario 3: User Not Found**
- User doesn't exist in local database
- Returns 404 error
- No deletion attempts
- Result: ❌ Error returned to admin

**Scenario 4: Database Error**
- OTS deletion succeeds
- Local database deletion fails
- Error returned
- Result: ⚠️ User removed from OTS but still in local DB

## API Endpoint

### `DELETE /api/v1/users/{user_id}`

**Authorization**: Requires admin role

**Request:**
```http
DELETE /api/v1/users/123
Authorization: Bearer {jwt_token}
```

**Response (Success):**
```json
{
  "message": "User testuser deleted successfully from both OTS and local database"
}
```

**Response (Not Found):**
```json
{
  "error": "User not found"
}
```

**Response (No Permission):**
```json
{
  "error": "Administrator role required"
}
```

**Response (Deletion Failed):**
```json
{
  "error": "Failed to delete user: {error_details}"
}
```

## Logging

All deletion attempts are logged with details:

```
INFO: Attempting to delete user 'testuser' from OTS
INFO: Successfully deleted user 'testuser' from OTS: {response}
INFO: Deleting user 'testuser' from local database
INFO: Successfully deleted user 'testuser' from local database
```

Or in case of OTS failure:

```
INFO: Attempting to delete user 'testuser' from OTS
ERROR: Failed to delete user 'testuser' from OTS: {error}
WARNING: Continuing with local deletion for user 'testuser'
INFO: Deleting user 'testuser' from local database
INFO: Successfully deleted user 'testuser' from local database
```

## Testing

### Manual Test via Frontend

1. Log in as administrator
2. Go to Admin → Users
3. Find a test user
4. Click "Delete" button
5. Confirm deletion
6. Verify user is removed from list
7. Try logging in as deleted user (should fail)

### Manual Test via API

```bash
# Get your JWT token first by logging in
TOKEN="your_jwt_token_here"

# Delete a user
curl -X DELETE http://localhost:5000/api/v1/users/123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### Check Logs

```bash
# If running in Docker
docker compose logs web | grep -i "delete user"

# If running locally
tail -f logs/app.log | grep -i "delete user"
```

## What Gets Deleted

### From OpenTAK Server (OTS):
- User account
- Authentication credentials
- User roles in OTS
- User certificates
- Any OTS-specific data

### From Local Database:
- User record from `users` table
- All relationships:
  - Role associations (`user_role_association`)
  - TAK profile associations (`user_takprofile_association`)
  - Meshtastic config associations (`user_meshtastic_association`)
  - Onboarding code associations (`user_onboardingcode_association`)
- One-time tokens (password reset, etc.)

### What Is NOT Deleted:
- Audit logs (if implemented)
- Onboarding codes the user may have created
- Users the person onboarded (their `onboardedBy` field)
- Historical data in other systems

## Security Considerations

1. **Admin Only**: Only users with administrator role can delete users
2. **JWT Required**: Must have valid JWT token
3. **Audit Trail**: All deletions are logged with timestamps and usernames
4. **Irreversible**: Deletion cannot be undone (no soft delete)
5. **OTS Sync**: Ensures user is removed from authentication server

## Best Practices

### Before Deleting a User:

1. **Verify Identity**: Make sure you're deleting the correct user
2. **Check Dependencies**: See if user has created onboarding codes or other resources
3. **Notify User**: Consider notifying the user before deletion (if applicable)
4. **Export Data**: Export user data if needed for records
5. **Check OTS**: Verify user exists in OTS (optional)

### After Deleting a User:

1. **Verify Deletion**: Check that user is gone from both systems
2. **Test Login**: Confirm user can no longer log in
3. **Check Logs**: Review deletion logs for any errors
4. **Update Documentation**: Update any user lists or docs

## Troubleshooting

### Problem: "User not found" but user is visible in list

**Solution:**
- Refresh the page
- Check if you're looking at the correct user ID
- Verify database connection

### Problem: OTS deletion fails

**Common Causes:**
- OTS server is down
- User doesn't exist in OTS
- Invalid OTS credentials
- Network connectivity issues

**Solution:**
- Check OTS server status
- Verify OTS_URL, OTS_USERNAME, OTS_PASSWORD in `.env`
- Check Docker logs: `docker compose logs web`
- User will still be deleted from local DB (by design)

### Problem: Local database deletion fails

**Common Causes:**
- Database connection lost
- Foreign key constraints
- User doesn't exist

**Solution:**
- Check database connection
- Look for related records that might block deletion
- Check logs for specific error message

### Problem: User deleted from OTS but still in local database

**This is a serious issue!** It means:
- OTS deletion succeeded
- Local deletion failed
- User can't log in (no OTS account) but appears in admin panel

**Solution:**
1. Check logs to identify the error
2. Manually delete from database:
   ```sql
   DELETE FROM users WHERE id = {user_id};
   ```
3. Or try the deletion API again (OTS deletion will fail harmlessly)

## Developer Notes

### Code Location

- **API Endpoint**: [app/api_v1/users.py:314-360](app/api_v1/users.py#L314-L360)
- **OTS Client**: [app/ots.py:224-226](app/ots.py#L224-L226)
- **User Model**: [app/models.py:228-235](app/models.py#L228-L235)

### OTS API Call

The system uses the OTS API endpoint:
```
POST /api/user/delete
Body: {"username": "testuser"}
```

### Error Handling Strategy

The code uses a try-catch within a try-catch:
1. Outer try-catch: Handles overall deletion process
2. Inner try-catch: Handles OTS deletion specifically
3. If OTS fails: Log warning and continue
4. If local fails: Return error to user

This ensures we don't leave orphaned users in the local database.

## Related Documentation

- [OTS API Documentation](app/ots.py)
- [User Model](app/models.py)
- [Users API](app/api_v1/users.py)

## Changelog

### 2025-10-16
- ✅ Improved error handling for OTS deletion failures
- ✅ Added detailed logging for audit trail
- ✅ Added current_app.logger import
- ✅ Continue with local deletion even if OTS fails
- ✅ Better success/error messages

### Previous
- Basic deletion from both OTS and local database
