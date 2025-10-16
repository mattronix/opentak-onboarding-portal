# Email Testing Guide

## Overview
This guide will help you test the email functionality in the OpenTAK Portal, specifically the registration notification emails.

## Prerequisites

### 1. Email Configuration
Make sure your `.env` file has the email settings configured:

```env
# Enable email functionality
MAIL_ENABLED=True

# SMTP Server settings
MAIL_SERVER=smtp.gmail.com          # Or your SMTP server
MAIL_PORT=587                        # 587 for TLS, 465 for SSL
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
MAIL_USE_TLS=True
MAIL_USE_SSL=False
MAIL_DEFAULT_SENDER=noreply@example.com
```

### 2. Gmail Setup (if using Gmail)
If you're using Gmail, you'll need to:
1. Enable 2-factor authentication on your Google account
2. Generate an "App Password" at https://myaccount.google.com/apppasswords
3. Use the app password in `MAIL_PASSWORD` (not your regular password)

### 3. Other SMTP Providers
- **Office 365**: `smtp.office365.com:587`
- **Outlook**: `smtp-mail.outlook.com:587`
- **Yahoo**: `smtp.mail.yahoo.com:587`
- **SendGrid**: `smtp.sendgrid.net:587`
- **Mailgun**: `smtp.mailgun.org:587`

## Testing Methods

### Method 1: Run the Test Script (Recommended)

```bash
# Make sure you're in the project directory
cd /Users/matthew/projects/A-STSC/opentak-onboarding-portal

# Run the test script
python test_email.py
```

This script will:
- ✅ Check your email configuration
- ✅ List all users and their email addresses
- ✅ Show which onboarding codes have contacts
- ✅ Optionally send a test email

### Method 2: Test via Docker

If you're running the app in Docker:

```bash
# Enter the web container
docker compose exec web bash

# Run the test script
python test_email.py
```

### Method 3: Test Registration Flow (End-to-End)

This tests the actual user registration with email notification:

#### Step 1: Set up an Onboarding Code with Contact
1. Log in to the portal as an admin
2. Go to Admin → Onboarding Codes
3. Create or edit an onboarding code
4. Set the "Onboard Contact" field to a user who has an email address
5. Save the code

#### Step 2: Verify Contact User Has Email
1. Go to Admin → Users
2. Find the contact user
3. Make sure they have an email address set
4. If not, edit the user and add an email address

#### Step 3: Test Registration
1. Log out (or use incognito mode)
2. Go to the registration page
3. Fill in the registration form with the onboarding code
4. Submit the registration
5. Check the contact user's email inbox

**Expected Result**: The contact user should receive an email with:
- Subject: "New User Registration"
- Body containing: username, callsign, email of the new user

## Troubleshooting

### Email Not Sending

**Check 1: Is MAIL_ENABLED=True?**
```bash
# Run the test script to verify
python test_email.py
```

**Check 2: SMTP Connection**
```bash
# Test SMTP connection manually
python3 << EOF
import smtplib
server = smtplib.SMTP('smtp.gmail.com', 587)
server.starttls()
server.login('your_email@gmail.com', 'your_app_password')
print("✅ SMTP connection successful!")
server.quit()
EOF
```

**Check 3: Check Docker Logs**
```bash
docker compose logs web | grep -i "email\|mail"
```

### No Email Address for Contact

**Problem**: Onboarding code has a contact, but the contact user has no email.

**Solution**:
1. Log in as admin
2. Go to Users → Edit the contact user
3. Add an email address
4. Save

### Onboarding Code Has No Contact

**Problem**: The onboarding code doesn't have an onboard contact assigned.

**Solution**:
1. Log in as admin
2. Go to Onboarding Codes → Edit the code
3. Select a user in the "Onboard Contact" field
4. Save

### Gmail "Less Secure Apps" Error

**Problem**: Gmail blocks the login attempt.

**Solution**:
1. Don't use "Less secure app access" (deprecated by Google)
2. Instead, use an App Password:
   - Enable 2FA on your Google account
   - Go to https://myaccount.google.com/apppasswords
   - Generate an app password
   - Use that password in `MAIL_PASSWORD`

## Checking Email Logs

### Application Logs
```bash
# If running in Docker
docker compose logs web -f | grep -i email

# If running locally
tail -f logs/app.log | grep -i email
```

### Python Logging
The app logs email activities at these levels:
- `INFO`: Successful email sends
- `ERROR`: Failed email sends with error details

Look for messages like:
- `Email sent to [email] with subject 'New User Registration'`
- `Failed to send email to [email] with subject '...': [error]`

## Manual Database Check

To verify the database structure is correct:

```bash
# Enter the web container
docker compose exec web bash

# Open Python shell
python3

# Run this code
from app import create_app
from app.models import OnboardingCodeModel

app = create_app()
with app.app_context():
    codes = OnboardingCodeModel.get_all_onboarding_codes()
    for code in codes:
        print(f"Code: {code.name}")
        print(f"  onboardContactId: {code.onboardContactId}")
        print(f"  onboardContact: {code.onboardContact}")
        if code.onboardContact:
            print(f"  Contact username: {code.onboardContact.username}")
            print(f"  Contact email: {code.onboardContact.email}")
        print()
```

## Testing Checklist

Before declaring email working, verify:

- [ ] `MAIL_ENABLED=True` in `.env`
- [ ] SMTP credentials are correct
- [ ] Can send test email via `test_email.py`
- [ ] At least one user has an email address
- [ ] At least one onboarding code has a contact user assigned
- [ ] Contact user has an email address
- [ ] Registration successfully sends email to contact
- [ ] Email appears in inbox (check spam folder too!)

## Common Email Content

### Registration Notification Email

**To**: Onboard Contact's email
**Subject**: New User Registration
**Content**:
```
Using your Onboarding Code 'Code Name' (CODE123),
a new registration has been made:

Username: newuser123
Callsign: NEWUSER
Email: newuser@example.com

If this is not who you expect, please contact your administrator.
```

## Need Help?

If emails still aren't working after following this guide:

1. Run `python test_email.py` and share the output
2. Check `docker compose logs web` for error messages
3. Verify your SMTP provider's documentation
4. Try a different SMTP provider (e.g., Gmail, SendGrid)
5. Check if your network/firewall blocks SMTP ports (587, 465)
