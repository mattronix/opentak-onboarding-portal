from os import environ
from dotenv import load_dotenv
from distutils.util import strtobool
from urllib.parse import urlparse
import secrets

load_dotenv()

SECRET_KEY=str(environ.get('SECRET_KEY'))
OTS_USERNAME=str(environ.get('OTS_USERNAME'))
OTS_PASSWORD=str(environ.get('OTS_PASSWORD'))
OTS_URL=str(environ.get('OTS_URL'))
OTS_HOSTNAME=urlparse(OTS_URL).hostname
DEBUG=strtobool(environ.get('DEBUG'))
SQLALCHEMY_DATABASE_URI=str(environ.get('SQLALCHEMY_DATABASE_URI', 'sqlite:///db.sqlite'))
GENERATE_ITAK_QR_CODE=strtobool(environ.get('GENERATE_ITAK_QR_CODE', 'True'))
ITAK_HOSTNAME=str(environ.get('ITAK_HOSTNAME', urlparse(OTS_URL).hostname))
MAIL_SERVER=str(environ.get('MAIL_SERVER'))
MAIL_PORT=int(environ.get('MAIL_PORT'))
MAIL_USE_TLS=strtobool(environ.get('MAIL_USE_TLS'))
MAIL_USE_SSL=strtobool(environ.get('MAIL_USE_SSL'))
MAIL_USERNAME=str(environ.get('MAIL_USERNAME'))
MAIL_PASSWORD=str(environ.get('MAIL_PASSWORD'))
MAIL_DEFAULT_SENDER=str(environ.get('MAIL_DEFAULT_SENDER'))
MAIL_ENABLED=strtobool(environ.get('MAIL_ENABLED', 'False'))
HELP_LINK=str(environ.get('HELP_LINK', 'https://www.google.com'))
HELP_EMAIL=str(environ.get('HELP_EMAIL', 'help@example.nl'))
DATAPACKAGE_UPLOAD_FOLDER = (environ.get('DATAPACKAGE_UPLOAD_FOLDER','datapackages'))
UPDATES_UPLOAD_FOLDER = str(environ.get('UPDATES_UPLOAD_FOLDER', 'updates'))

PRIMARY_COLOR = str(environ.get('PRIMARY_COLOR', '#000000'))
SECONDARY_COLOR = str(environ.get('SECONDARY_COLOR', 'orange'))

ACCENT_COLOR = str(environ.get('ACCENT_COLOR', 'orange'))

LOGO_PATH = str(environ.get('LOGO_PATH', '/static/img/logo.png'))
BRAND_NAME = str(environ.get('BRAND_NAME', 'My OTS Portal'))

FORGOT_PASSWORD_ENABLED = strtobool(environ.get('FORGOT_PASSWORD_ENABLED', 'True'))

JWT_SECRET_KEY = str(environ.get('JWT_SECRET_KEY', secrets.token_hex(32)))

ZEROTIER_ICON = strtobool(environ.get('ZEROTIER_ICON', 'False'))