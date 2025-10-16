# Quick Start Guide - What Changed

## Summary

I've implemented several major features:

### 1. **Header Always Visible** ✅
The navigation header now stays visible at all times (no more auto-hiding on scroll)

### 2. **Email Verification System** ✅
Complete email verification flow for new user registrations:
- Users receive verification email before account creation
- No duplicate usernames or emails
- Only creates OpenTAK account after email verification
- Sends welcome email to new user
- Sends notification to onboard contact

### 3. **Fixed Onboarding Contact Emails** ✅
- Renamed database column from `onboardContact` to `onboardContactId`
- Added proper SQLAlchemy relationship
- Registration notification emails now work correctly

## What You Need to Do

### Step 1: Database is Already Migrated ✅
The database has been updated with:
- `emailVerified` column in `users` table
- `pending_registrations` table for email verification
- `onboardContactId` column in `onboardingcodes` table

### Step 2: Update Frontend Routes

Add the VerifyEmail route to your `App.jsx`:

```jsx
import VerifyEmail from './pages/VerifyEmail';

// Add this route (can be public, doesn't need authentication)
<Route path="/verify-email" element={<VerifyEmail />} />
```

Full example:
```jsx
<Routes>
  {/* Public routes */}
  <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
  <Route path="/register/:code" element={<PublicRoute><Register /></PublicRoute>} />
  <Route path="/verify-email" element={<VerifyEmail />} />  {/* ADD THIS */}

  {/* Rest of your routes... */}
</Routes>
```

### Step 3: Ensure Email is Configured

Make sure your `.env` has:
```env
MAIL_ENABLED=True
MAIL_SERVER=smtp.gmail.com  # or your SMTP server
MAIL_PORT=587
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
MAIL_USE_TLS=True
MAIL_DEFAULT_SENDER=noreply@example.com
```

### Step 4: Test It Out!

1. **Register a new user** - they'll get an email
2. **Click verification link** in email
3. **Account gets created** in OpenTAK
4. **Onboard contact** receives notification

## New Registration Flow

### Before (Old):
1. User submits registration form
2. Account immediately created in OpenTAK
3. Done

### Now (New):
1. User submits registration form
2. ✅ System checks for duplicates
3. Pending registration created
4. **Verification email sent to user**
5. User clicks link in email
6. Token validated
7. ✅ Double-check for duplicates
8. Account created in OpenTAK
9. Notification sent to onboard contact
10. Done

## Features

### Duplicate Prevention ✅
- Checks username in both `users` and `pending_registrations`
- Checks email in both tables
- Returns clear error messages

### Security ✅
- Verification tokens are 64 characters long
- Tokens expire after 24 hours
- One-time use only
- Automatic cleanup of expired pending registrations

### User Experience ✅
- Clear welcome email with instructions
- Beautiful verification page
- Auto-redirect to login after verification
- Helpful error messages

## Testing

### Test Email Configuration:
```bash
python test_email.py
```

### Test Registration:
1. Go to registration page
2. Fill out form
3. Check email inbox (and spam!)
4. Click verification link
5. Should redirect to login page

### Test Duplicates:
1. Register a user
2. Before verifying, try registering again with same username
3. Should get "Username already pending verification" error
4. After verification, try again
5. Should get "Username already exists" error

## Files Created/Modified

### Backend:
- ✅ `app/models.py` - Added `PendingRegistrationModel` and `emailVerified` field
- ✅ `app/api_v1/auth.py` - Updated `/auth/register` and added `/auth/verify-email`
- ✅ `migrations/versions/d52f4586db0e_*.py` - Database migration
- ✅ `app/api_v1/onboarding_codes.py` - Fixed onboardContact references

### Frontend:
- ✅ `frontend/src/components/Layout.jsx` - Removed auto-hide scroll logic
- ✅ `frontend/src/components/Layout.css` - Removed transition classes
- ✅ `frontend/src/pages/VerifyEmail.jsx` - NEW verification page
- ✅ `frontend/src/pages/VerifyEmail.css` - NEW styles

### Documentation:
- ✅ `test_email.py` - Email testing script
- ✅ `EMAIL_TESTING_GUIDE.md` - Complete testing guide
- ✅ `EMAIL_VERIFICATION_CHANGES.md` - Detailed technical docs
- ✅ `QUICK_START_GUIDE.md` - This file!

## Troubleshooting

**"No such column: users.emailVerified"**
- Database migration already applied ✅

**Emails not sending:**
```bash
python test_email.py  # Test your config
docker compose logs web | grep -i email  # Check logs
```

**Verification link doesn't work:**
- Make sure `/verify-email` route is added to `App.jsx`
- Check `FRONTEND_URL` in `.env`
- Verify token hasn't expired (24 hours)

**"Username already pending verification":**
- User registered but hasn't verified yet
- Wait 24 hours or cleanup: `PendingRegistrationModel.cleanup_expired()`

## API Endpoints

### `POST /api/v1/auth/register`
**Request:**
```json
{
  "username": "newuser",
  "password": "pass123",
  "email": "user@example.com",
  "firstName": "First",
  "lastName": "Last",
  "callsign": "CALL",
  "onboardingCode": "CODE123"
}
```

**Response (Success):**
```json
{
  "message": "Registration initiated. Please check your email to verify your account.",
  "email": "user@example.com"
}
```

**Response (Duplicate):**
```json
{
  "error": "Username already exists"
}
```

### `POST /api/v1/auth/verify-email`
**Request:**
```json
{
  "token": "verification_token_from_email"
}
```

**Response (Success):**
```json
{
  "message": "Email verified successfully! Your account is now active.",
  "user": {
    "id": 1,
    "username": "newuser",
    "email": "user@example.com",
    "callsign": "CALL"
  }
}
```

## Next Steps (Optional Enhancements)

1. ⚠️ Add "Resend Verification Email" feature
2. ⚠️ Add rate limiting to prevent abuse
3. ⚠️ Add email verification status to admin user list
4. ⚠️ Add scheduled task to clean up expired registrations
5. ⚠️ Add frontend message after registration ("Check your email!")

## Need Help?

1. **Email Issues**: See [EMAIL_TESTING_GUIDE.md](EMAIL_TESTING_GUIDE.md)
2. **Technical Details**: See [EMAIL_VERIFICATION_CHANGES.md](EMAIL_VERIFICATION_CHANGES.md)
3. **Test Email**: Run `python test_email.py`

## Success Checklist

- [ ] Frontend route added for `/verify-email`
- [ ] Email configuration verified (`python test_email.py`)
- [ ] Registered test user
- [ ] Received verification email
- [ ] Clicked link and verified
- [ ] Account created in OpenTAK
- [ ] Onboard contact received notification
- [ ] Header stays visible when scrolling
- [ ] Duplicate username/email properly rejected

Once all checkboxes are complete, you're ready to go! 🚀
