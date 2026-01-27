"""
API v1 Blueprint
RESTful API endpoints for the OpenTAK Onboarding Portal
"""

from flask import Blueprint

# Create the API v1 blueprint
api_v1 = Blueprint('api_v1', __name__, url_prefix='/api/v1')

# Import all route modules to register them
from app.api_v1 import auth, users, roles, onboarding_codes, tak_profiles, meshtastic, radios, settings, qr, pending_registrations, version, announcements, api_keys, approvals
