from app.extensions import mail
from flask_mail import Message
from flask import render_template

from app.settings import MAIL_DEFAULT_SENDER, BRAND_NAME as DEFAULT_BRAND_NAME, HELP_EMAIL as DEFAULT_HELP_EMAIL
from app.models import SystemSettingsModel
import logging


def get_brand_name():
    """Get brand name from database settings, fallback to env default"""
    try:
        enabled = SystemSettingsModel.get_setting('brand_name_enabled')
        if enabled and str(enabled).lower() == 'true':
            value = SystemSettingsModel.get_setting('brand_name_value')
            if value:
                return value
    except Exception:
        pass
    return DEFAULT_BRAND_NAME


def get_help_email():
    """Get help email from database settings, fallback to env default"""
    try:
        enabled = SystemSettingsModel.get_setting('help_email_enabled')
        if enabled and str(enabled).lower() == 'true':
            value = SystemSettingsModel.get_setting('help_email_value')
            if value:
                return value
    except Exception:
        pass
    return DEFAULT_HELP_EMAIL


def send_html_email(subject, recipients, message, title=None, template="email_default_template.html", sender=MAIL_DEFAULT_SENDER, link_url="https://portal.example.nl", link_title="LOGIN to TAK Portal"):
    if not title:
        title = subject

    # Get settings from database
    brand_name = get_brand_name()
    help_email = get_help_email()

    msg = Message(subject, sender=sender, recipients=recipients)
    msg.html = render_template(template, title=title, message=message, link_title=link_title, link_url=link_url, brand_name=brand_name, HELP_EMAIL=help_email)

    try:
        mail.send(msg)
        logging.info(f"Email sent to {recipients} with subject '{subject}'")
    except Exception as e:
        logging.error(f"Failed to send email to {recipients} with subject '{subject}': {e}")
