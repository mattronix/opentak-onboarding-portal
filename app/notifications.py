"""
Notification helpers for sending admin notifications
Checks system settings to honor user preferences
"""

from app.models import SystemSettingsModel, UserModel, UserRoleModel
from app.email import send_html_email
from flask import current_app, request, has_request_context
import logging


def get_frontend_url_safe():
    """
    Get frontend URL, auto-detecting from request if available.
    Safe to call outside of request context.
    """
    frontend_url = get_frontend_url_safe()

    # If explicitly set to a non-localhost value, use it
    if not (frontend_url.startswith('http://localhost') or frontend_url.startswith('http://127.0.0.1')):
        return frontend_url.rstrip('/')

    # Try to auto-detect from request if available
    if has_request_context():
        proto = request.headers.get('X-Forwarded-Proto', request.scheme)
        host = request.headers.get('X-Forwarded-Host', request.host)

        if not (host.startswith('localhost') or host.startswith('127.0.0.1')):
            return f"{proto}://{host}"

    return frontend_url.rstrip('/')


def get_admin_emails():
    """
    Get all admin user email addresses
    Returns a list of email addresses for users with 'administrator' or 'admin' role
    """
    try:
        # Get admin roles
        admin_role = UserRoleModel.get_role_by_name('administrator')
        admin_role_alt = UserRoleModel.get_role_by_name('admin')

        admin_emails = set()

        # Get users with administrator role
        if admin_role:
            for user in admin_role.users:
                if user.email:
                    admin_emails.add(user.email)

        # Get users with admin role
        if admin_role_alt:
            for user in admin_role_alt.users:
                if user.email:
                    admin_emails.add(user.email)

        return list(admin_emails)
    except Exception as e:
        current_app.logger.error(f"Error getting admin emails: {str(e)}")
        return []


def notify_admin_pending_registration(username, email, first_name, last_name, callsign):
    """
    Send notification to admins when a new pending registration is created
    Only sends if 'notify_admin_pending_registration' setting is enabled

    Args:
        username: The username of the pending registration
        email: The email of the pending registration
        first_name: First name of the user
        last_name: Last name of the user
        callsign: Callsign of the user
    """
    try:
        # Check if notification is enabled
        notify_enabled = SystemSettingsModel.get_setting('notify_admin_pending_registration', default=False)

        if not notify_enabled:
            current_app.logger.debug("Admin notification for pending registration is disabled")
            return

        # Get admin emails
        admin_emails = get_admin_emails()

        if not admin_emails:
            current_app.logger.warning("No admin emails found to notify for pending registration")
            return

        # Get frontend URL for admin link
        frontend_url = get_frontend_url_safe()
        admin_link = f"{frontend_url}/admin/pending-registrations"

        # Construct email message
        message = f"""A new user has registered and is awaiting email verification.

User Details:
- Username: {username}
- Name: {first_name} {last_name}
- Callsign: {callsign}
- Email: {email}

The user must verify their email address before their account is created. Once verified, you will receive another notification.

You can view all pending registrations in the admin panel."""

        # Send email to all admins
        send_html_email(
            subject=f'New Pending Registration - {username}',
            recipients=admin_emails,
            message=message,
            title='New Pending Registration',
            link_url=admin_link,
            link_title='View Pending Registrations'
        )

        current_app.logger.info(f"Sent pending registration notification to {len(admin_emails)} admin(s) for user {username}")

    except Exception as e:
        current_app.logger.error(f"Failed to send pending registration notification: {str(e)}")


def notify_admin_new_registration(username, email, first_name, last_name, callsign):
    """
    Send notification to admins when a new user completes registration (email verified)
    Only sends if 'notify_admin_new_registration' setting is enabled

    Args:
        username: The username of the new user
        email: The email of the new user
        first_name: First name of the user
        last_name: Last name of the user
        callsign: Callsign of the user
    """
    try:
        # Check if notification is enabled
        notify_enabled = SystemSettingsModel.get_setting('notify_admin_new_registration', default=False)

        if not notify_enabled:
            current_app.logger.debug("Admin notification for new registration is disabled")
            return

        # Get admin emails
        admin_emails = get_admin_emails()

        if not admin_emails:
            current_app.logger.warning("No admin emails found to notify for new registration")
            return

        # Get frontend URL for admin link
        frontend_url = get_frontend_url_safe()
        admin_link = f"{frontend_url}/admin/users"

        # Construct email message
        message = f"""A new user has completed registration and their account has been created.

User Details:
- Username: {username}
- Name: {first_name} {last_name}
- Callsign: {callsign}
- Email: {email}

The user has verified their email address and their account is now active.

You can view and manage users in the admin panel."""

        # Send email to all admins
        send_html_email(
            subject=f'New User Registration Complete - {username}',
            recipients=admin_emails,
            message=message,
            title='New User Registration Complete',
            link_url=admin_link,
            link_title='View Users'
        )

        current_app.logger.info(f"Sent new registration notification to {len(admin_emails)} admin(s) for user {username}")

    except Exception as e:
        current_app.logger.error(f"Failed to send new registration notification: {str(e)}")
