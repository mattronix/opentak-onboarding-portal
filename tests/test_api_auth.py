"""
Tests for authentication API endpoints
"""
import pytest
import requests_mock


class TestAuthLogin:
    """Test /auth/login endpoint"""

    def test_login_success(self, client, db):
        """Test successful login"""
        # Create test user in database
        from app.models import UserModel, UserRoleModel

        # Create user role
        role = UserRoleModel.query.filter_by(name='user').first()
        if not role:
            role = UserRoleModel.create_role(name='user', description='User role')

        # Create user
        user = UserModel.query.filter_by(username='testuser').first()
        if not user:
            user = UserModel.create_user(
                username='testuser',
                email='test@example.com',
                firstname='Test',
                lastname='User',
                callsign='TEST'
            )
            user.roles.append(role)
            db.session.commit()

        with requests_mock.Mocker() as m:
            # Mock OTS login response
            m.post('http://localhost:8080/api/login', json={
                'token': 'mock-token',
                'user': {
                    'username': 'testuser',
                    'email': 'test@example.com',
                    'roles': ['user']
                }
            })

            # Mock OTS get_me response
            m.get('http://localhost:8080/api/me', json={
                'username': 'testuser',
                'email': 'test@example.com',
                'callsign': 'TEST',
                'firstName': 'Test',
                'lastName': 'User',
                'roles': ['user']
            })

            response = client.post('/api/v1/auth/login', json={
                'username': 'testuser',
                'password': 'password'
            })

            # Debug output
            if response.status_code != 200:
                print(f"Login failed with status {response.status_code}")
                print(f"Response: {response.get_json()}")

            assert response.status_code == 200
            data = response.get_json()
            assert 'access_token' in data
            assert 'refresh_token' in data
            assert 'user' in data

    def test_login_missing_credentials(self, client):
        """Test login with missing credentials"""
        response = client.post('/api/v1/auth/login', json={
            'username': 'testuser'
        })

        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data

    def test_login_invalid_credentials(self, client):
        """Test login with invalid credentials"""
        with requests_mock.Mocker() as m:
            # Mock OTS 401 response
            m.post('http://localhost:8080/api/login', status_code=401)

            response = client.post('/api/v1/auth/login', json={
                'username': 'baduser',
                'password': 'badpass'
            })

            assert response.status_code == 401
            data = response.get_json()
            assert 'error' in data


class TestAuthMe:
    """Test /auth/me endpoint"""

    def test_get_current_user_success(self, client, auth_headers):
        """Test getting current user with valid token"""
        print(f"Auth headers: {auth_headers}")
        response = client.get('/api/v1/auth/me', headers=auth_headers)

        if response.status_code != 200:
            print(f"Failed with status {response.status_code}")
            print(f"Response: {response.get_json()}")

        assert response.status_code == 200
        data = response.get_json()
        assert 'username' in data
        assert 'email' in data

    def test_get_current_user_no_auth(self, client):
        """Test getting current user without authentication"""
        response = client.get('/api/v1/auth/me')

        assert response.status_code == 401


class TestAuthRegister:
    """Test /auth/register endpoint"""

    def test_register_with_invalid_code(self, client):
        """Test registration with invalid onboarding code"""
        response = client.post('/api/v1/auth/register', json={
            'username': 'newuser',
            'password': 'password',
            'email': 'new@example.com',
            'firstName': 'New',
            'lastName': 'User',
            'callsign': 'NEW',
            'onboardingCode': 'INVALID'
        })

        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data

    def test_register_missing_fields(self, client):
        """Test registration with missing required fields"""
        response = client.post('/api/v1/auth/register', json={
            'username': 'newuser',
            'password': 'password'
        })

        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data
