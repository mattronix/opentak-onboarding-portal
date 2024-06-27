from os import environ
from dotenv import load_dotenv
from distutils.util import strtobool

load_dotenv()

SECRET_KEY=str(environ.get('SECRET_KEY'))

OTS_USERNAME=str(environ.get('OTS_USERNAME'))
OTS_PASSWORD=str(environ.get('OTS_PASSWORD'))
OTS_URL=str(environ.get('OTS_URL'))
DEBUG=strtobool(environ.get('DEBUG'))
SQLALCHEMY_DATABASE_URI=str(environ.get('SQLALCHEMY_DATABASE_URI', 'sqlite:///db.sqlite'))