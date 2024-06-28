from app.extensions import mail
from flask_mail import Message
from app.extensions import mail
from flask_mail import Message
from flask import render_template

from app.settings import MAIL_DEFAULT_SENDER

def send_html_email(subject, recipients, template="email_default_template.html", sender=MAIL_DEFAULT_SENDER):
    msg = Message(subject, sender=sender, recipients=recipients)
    msg.html = render_template(template)
    mail.send(msg)