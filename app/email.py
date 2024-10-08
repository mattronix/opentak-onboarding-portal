from app.extensions import mail
from flask_mail import Message
from flask import render_template

from app.settings import MAIL_DEFAULT_SENDER, BRAND_NAME, HELP_EMAIL
import logging

def send_html_email(subject, recipients, message, title=None, template="email_default_template.html", sender=MAIL_DEFAULT_SENDER, link_url="https://portal.example.nl", link_title="LOGIN to TAK Portal"):
    if not title:
        title = subject

    msg = Message(subject, sender=sender, recipients=recipients)
    msg.html = render_template(template, title=title, message=message, link_title=link_title, link_url=link_url, brand_name=BRAND_NAME, HELP_EMAIL=HELP_EMAIL)
    
    try:
        mail.send(msg)
        logging.info(f"Email sent to {recipients} with subject '{subject}'")
    except Exception as e:
        logging.error(f"Failed to send email to {recipients} with subject '{subject}': {e}")