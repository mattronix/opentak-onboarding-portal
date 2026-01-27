#!/usr/bin/env python3
"""
Test script for email functionality
Tests both the email configuration and the registration email flow
"""

import os
import sys
from flask import Flask
from app.extensions import mail
from app.email import send_html_email
from app.models import db, UserModel, OnboardingCodeModel


def test_email_config():
    """Test basic email configuration"""
    print("\n=== Testing Email Configuration ===")

    from app.settings import (
        MAIL_ENABLED, MAIL_SERVER, MAIL_PORT,
        MAIL_USERNAME, MAIL_USE_TLS, MAIL_DEFAULT_SENDER
    )

    print(f"MAIL_ENABLED: {MAIL_ENABLED}")
    print(f"MAIL_SERVER: {MAIL_SERVER}")
    print(f"MAIL_PORT: {MAIL_PORT}")
    print(f"MAIL_USERNAME: {MAIL_USERNAME}")
    print(f"MAIL_USE_TLS: {MAIL_USE_TLS}")
    print(f"MAIL_DEFAULT_SENDER: {MAIL_DEFAULT_SENDER}")

    if not MAIL_ENABLED:
        print("\n⚠️  WARNING: MAIL_ENABLED is False - emails will not be sent!")
        print("Set MAIL_ENABLED=True in your .env file")
        return False

    return True


def test_send_email(app, recipient_email):
    """Test sending a simple email"""
    print("\n=== Testing Email Sending ===")

    with app.app_context():
        try:
            send_html_email(
                subject='Test Email from OpenTAK Portal',
                recipients=[recipient_email],
                message='This is a test email. If you receive this, email is working!',
                title='Email Test'
            )
            print(f"✅ Test email sent successfully to {recipient_email}")
            return True
        except Exception as e:
            print(f"❌ Failed to send test email: {e}")
            return False


def test_onboarding_code_email(app):
    """Test the onboarding code email flow"""
    print("\n=== Testing Onboarding Code Email Flow ===")

    with app.app_context():
        # Find an onboarding code with a contact
        codes = OnboardingCodeModel.get_all_onboarding_codes()

        if not codes:
            print("❌ No onboarding codes found in database")
            return False

        print(f"Found {len(codes)} onboarding code(s)")

        for code in codes:
            print(f"\n📋 Onboarding Code: {code.name} ({code.onboardingCode})")
            print(f"   Has onboardContactId: {code.onboardContactId}")

            if code.onboardContact:
                contact = code.onboardContact
                print(f"   Contact User: {contact.username}")
                print(f"   Contact Email: {contact.email}")

                if contact.email:
                    print(f"   ✅ This code will send emails to: {contact.email}")
                else:
                    print(f"   ⚠️  Contact has no email address set!")
            else:
                print(f"   ⚠️  No onboard contact assigned")

        return True


def test_user_emails(app):
    """Check which users have email addresses"""
    print("\n=== Checking User Email Addresses ===")

    with app.app_context():
        users = UserModel.get_all_users()

        if not users:
            print("❌ No users found in database")
            return False

        print(f"Found {len(users)} user(s)")

        users_with_email = 0
        for user in users:
            if user.email:
                print(f"✅ {user.username}: {user.email}")
                users_with_email += 1
            else:
                print(f"⚠️  {user.username}: No email address")

        print(f"\n{users_with_email}/{len(users)} users have email addresses")
        return users_with_email > 0


def main():
    """Main test function"""
    print("=" * 60)
    print("OpenTAK Portal - Email Testing Script")
    print("=" * 60)

    # Create Flask app
    from app import create_app
    app = create_app()

    # Test 1: Check email configuration
    if not test_email_config():
        print("\n❌ Email is not configured. Update your .env file first.")
        sys.exit(1)

    # Test 2: Check users and their emails
    test_user_emails(app)

    # Test 3: Check onboarding codes
    test_onboarding_code_email(app)

    # Test 4: Optionally send a test email
    print("\n" + "=" * 60)
    send_test = input("Do you want to send a test email? (y/n): ").lower().strip()

    if send_test == 'y':
        recipient = input("Enter recipient email address: ").strip()
        if recipient:
            test_send_email(app, recipient)
        else:
            print("❌ No email address provided")

    print("\n" + "=" * 60)
    print("Testing Complete!")
    print("=" * 60)

    print("\n📝 Next Steps:")
    print("1. Make sure MAIL_ENABLED=True in your .env file")
    print("2. Verify SMTP settings (MAIL_SERVER, MAIL_PORT, MAIL_USERNAME, etc.)")
    print("3. Ensure onboarding codes have a contact user assigned")
    print("4. Ensure contact users have email addresses")
    print("5. Test registration via the web interface")


if __name__ == '__main__':
    main()
