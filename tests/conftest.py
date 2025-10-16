"""
Pytest configuration and fixtures
"""
import pytest
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from app.models import db as _db


@pytest.fixture(scope='session')
def app():
    """Create application for testing"""
    # Set testing config BEFORE importing
    # Don't load .env file in tests
    os.environ['DOTENV_PATH'] = '/dev/null'
    os.environ['TESTING'] = 'True'
    os.environ['ENABLE_API'] = 'True'
    os.environ['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    os.environ['SECRET_KEY'] = 'test-secret-key'
    os.environ['JWT_SECRET_KEY'] = 'test-jwt-secret'
    os.environ['OTS_URL'] = 'http://localhost:8080'
    os.environ['OTS_USERNAME'] = 'test'
    os.environ['OTS_PASSWORD'] = 'test'
    os.environ['DEBUG'] = 'False'
    os.environ['MAIL_ENABLED'] = 'False'

    # Need to create app manually to avoid the global app instance
    from flask import Flask
    app = Flask(__name__)

    # Use absolute path to settings.py in app directory
    settings_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'app', 'settings.py'))
    app.config.from_pyfile(settings_path)

    # Override config after loading settings.py to ensure test values are used
    app.config['TESTING'] = True
    app.config['OTS_URL'] = 'http://localhost:8080'
    app.config['TESTING'] = True
    app.config['WTF_CSRF_ENABLED'] = False

    # Import and register everything except scheduler
    from app.models import db as _db, migrate
    from app.jina_filters import jina2_filters_blueprint
    from flask_breadcrumbs import Breadcrumbs
    from flask_menu import Menu
    from app.extensions import mail, jwt_manager, qrcode
    from flask_cors import CORS
    import logging

    # Enable CORS
    CORS(app, resources={
        r"/api/*": {
            "origins": app.config.get('CORS_ORIGINS', '*'),
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        }
    })

    _db.init_app(app)
    migrate.init_app(app, _db, render_as_batch=False)
    menu = Menu()
    breadcrumbs = Breadcrumbs(init_menu=False)
    menu.init_app(app)
    breadcrumbs.init_app(app)
    qrcode.init_app(app)
    jwt_manager.init_app(app)

    # Register API blueprint
    if app.config['ENABLE_API']:
        from app.api_v1 import api_v1
        app.register_blueprint(api_v1)

    mail.init_app(app)

    with app.app_context():
        _db.create_all()
        yield app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope='function')
def client(app):
    """Test client for making requests"""
    return app.test_client()


@pytest.fixture(scope='function')
def db(app):
    """Database fixture that provides a clean slate for each test"""
    with app.app_context():
        _db.session.begin_nested()
        yield _db
        _db.session.rollback()
        _db.session.remove()


@pytest.fixture(scope='function')
def auth_headers(client, db):
    """Create a test user and return auth headers"""
    from app.models import UserModel, UserRoleModel

    # Get or create admin role
    admin_role = UserRoleModel.query.filter_by(name='administrator').first()
    if not admin_role:
        admin_role = UserRoleModel.create_role(
            name='administrator',
            description='Admin role'
        )

    # Get or create test user
    user = UserModel.query.filter_by(username='testuser').first()
    if not user:
        user = UserModel.create_user(
            username='testuser',
            email='test@example.com',
            firstname='Test',
            lastname='User',
            callsign='TEST'
        )

    # Ensure user has admin role
    if admin_role not in user.roles:
        user.roles.append(admin_role)
        _db.session.commit()

    # Mock OTS authentication
    import requests_mock
    with requests_mock.Mocker() as m:
        # Mock OTS login
        m.post(
            'http://localhost:8080/api/login',
            json={
                'token': 'mock-ots-token',
                'user': {
                    'username': 'testuser',
                    'email': 'test@example.com',
                    'roles': ['administrator']
                }
            }
        )

        # Mock OTS get_me
        m.get(
            'http://localhost:8080/api/me',
            json={
                'username': 'testuser',
                'email': 'test@example.com',
                'callsign': 'TEST',
                'firstName': 'Test',
                'lastName': 'User',
                'roles': ['administrator']
            }
        )

        # Login to get JWT token
        response = client.post('/api/v1/auth/login', json={
            'username': 'testuser',
            'password': 'password'
        })

        if response.status_code == 200:
            data = response.get_json()
            access_token = data.get('access_token')
            return {'Authorization': f'Bearer {access_token}'}

    return {}


@pytest.fixture
def sample_user(db):
    """Create a sample user for testing"""
    from app.models import UserModel

    # Get or create user
    user = UserModel.query.filter_by(username='sampleuser').first()
    if not user:
        user = UserModel.create_user(
            username='sampleuser',
            email='sample@example.com',
            firstname='Sample',
            lastname='User',
            callsign='SAMPLE'
        )
        # Check if create returned an error dict
        if isinstance(user, dict):
            user = UserModel.query.filter_by(username='sampleuser').first()
        else:
            db.session.commit()
    return user


@pytest.fixture
def sample_role(db):
    """Create a sample role for testing"""
    from app.models import UserRoleModel

    # Get or create role
    role = UserRoleModel.query.filter_by(name='test_role').first()
    if not role:
        role = UserRoleModel.create_role(
            name='test_role',
            description='Test role for testing'
        )
        # Check if create returned an error dict
        if isinstance(role, dict):
            role = UserRoleModel.query.filter_by(name='test_role').first()
        else:
            db.session.commit()
    return role
