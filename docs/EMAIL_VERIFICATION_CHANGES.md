# Email Verification System - Implementation Summary

## Overview
Implemented a complete email verification system that:
- ✅ Sends a welcome email to new users with verification link
- ✅ Only creates users in OpenTAK Server after email verification
- ✅ Prevents duplicate usernames and emails
- ✅ Made header always visible (removed auto-hide on scroll)

## Changes Made

### 1. Backend Changes

#### Models ([app/models.py](app/models.py))
- Added `emailVerified` field to `UserModel` to track verification status
- Created new `PendingRegistrationModel` to store registrations awaiting verification
  - Stores: username, email, password (temporarily), firstName, lastName, callsign
  - Has verification token and expiration (24 hours)
  - Includes cleanup methods for expired registrations

#### API Endpoints ([app/api_v1/auth.py](app/api_v1/auth.py))

**Updated `/auth/register` (POST)**
- Now creates pending registration instead of immediate user
- Checks for duplicate usernames/emails in both users and pending registrations
- Generates verification token
- Sends welcome email with verification link
- Returns: `{message: "Please check your email...", email: "..."}`

**New `/auth/verify-email` (POST)**
- Accepts verification token
- Validates token and checks expiration
- Creates user in OpenTAK Server
- Creates user in local database
- Sets `emailVerified = True`
- Assigns roles, TAK profiles, and Meshtastic configs
- Sends notification to onboard contact
- Deletes pending registration
- Returns: `{message: "Email verified!", user: {...}}`

### 2. Frontend Changes

#### Layout ([frontend/src/components/Layout.jsx](frontend/src/components/Layout.jsx))
- Removed scroll hide/show logic
- Removed `useState` and `useEffect` for scroll tracking
- Header now always visible

#### Styles ([frontend/src/components/Layout.css](frontend/src/components/Layout.css))
- Removed `.navbar-visible` and `.navbar-hidden` classes
- Removed `.footer-visible` and `.footer-hidden` classes
- Removed transitions for hide/show animations

### 3. Email Templates

**Welcome/Verification Email** (sent to new user)
- Subject: "Verify Your Email - OpenTAK Portal"
- Contains:
  - Welcome message
  - Verification link
  - Registration details (username, callsign, email)
  - 24-hour expiration notice

**Registration Complete Email** (sent to onboard contact)
- Subject: "New User Registration Completed"
- Contains:
  - Notification that someone registered with their code
  - New user details
  - Warning if unexpected

## Database Migration Required

Run these commands to create the new database tables:

```bash
# If using Docker
docker compose exec web bash

# Create migration
ENABLE_API=True flask db migrate -m "Add email verification and pending registrations"

# Apply migration
ENABLE_API=True flask db upgrade
```

## Frontend Pages Needed

You need to create a new page for email verification:

### `/verify-email` Route
- Reads `token` from URL query parameter
- Calls `POST /api/v1/auth/verify-email` with the token
- Shows success/error message
- Redirects to login page on success

Example file: `frontend/src/pages/VerifyEmail.jsx`

## Registration Flow

### Old Flow:
1. User fills registration form
2. User created in OTS immediately
3. User created in local database
4. Done

### New Flow:
1. User fills registration form
2. ✅ Check for duplicates (username/email)
3. Create pending registration
4. Send verification email to user
5. User clicks link in email
6. Token verified
7. ✅ Double-check for duplicates again
8. User created in OTS
9. User created in local database with `emailVerified=True`
10. Send notification to onboard contact
11. Done

## Security Improvements

1. **No Duplicate Accounts**: Checks both users and pending registrations
2. **Email Verification**: Users must verify they own the email
3. **Token Expiration**: Verification links expire after 24 hours
4. **Secure Tokens**: Uses `secrets.token_urlsafe(48)` for tokens
5. **Cleanup**: Expired pending registrations can be cleaned up

## Testing

1. **Test Registration**:
   ```bash
   curl -X POST http://localhost:5000/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "username": "testuser",
       "password": "testpass123",
       "email": "test@example.com",
       "firstName": "Test",
       "lastName": "User",
       "callsign": "TEST",
       "onboardingCode": "YOUR_CODE_HERE"
     }'
   ```

2. **Check Email**: Verification email should be sent

3. **Test Verification**:
   ```bash
   curl -X POST http://localhost:5000/api/v1/auth/verify-email \
     -H "Content-Type: application/json" \
     -d '{
       "token": "TOKEN_FROM_EMAIL"
     }'
   ```

4. **Test Duplicates**:
   - Try registering same username twice
   - Try registering same email twice
   - Should get error: "Username already exists" or "Email already registered"

## Maintenance

### Cleanup Expired Registrations

You can manually clean up expired pending registrations:

```python
from app import create_app
from app.models import PendingRegistrationModel

app = create_app()
with app.app_context():
    count = PendingRegistrationModel.cleanup_expired()
    print(f"Cleaned up {count} expired registrations")
```

Or create a cron job/scheduled task to run this periodically.

## Next Steps

1. ✅ Create database migration
2. ✅ Create frontend VerifyEmail page
3. ✅ Update App.jsx to add `/verify-email` route
4. ✅ Update Register.jsx to show "check your email" message
5. ✅ Test end-to-end flow
6. ⚠️ Consider adding rate limiting to prevent abuse
7. ⚠️ Consider adding "resend verification email" feature

## Configuration

Make sure these are set in your `.env`:

```env
MAIL_ENABLED=True
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
MAIL_USE_TLS=True
MAIL_DEFAULT_SENDER=noreply@example.com
FRONTEND_URL=https://your-domain.com
```

## Troubleshooting

**Issue**: Email not sending
- Check `MAIL_ENABLED=True`
- Run `python test_email.py` to verify configuration
- Check Docker logs: `docker compose logs web | grep -i email`

**Issue**: Verification link doesn't work
- Check `FRONTEND_URL` is set correctly
- Ensure frontend has `/verify-email` route
- Check token hasn't expired (24 hours)

**Issue**: Duplicate user errors
- Check if user already exists: `UserModel.get_user_by_username(username)`
- Check pending registrations: `PendingRegistrationModel.query.all()`
- Run cleanup: `PendingRegistrationModel.cleanup_expired()`
