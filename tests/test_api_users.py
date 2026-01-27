"""
Tests for users API endpoints
"""
import pytest


class TestUsersEndpoints:
    """Test /users endpoints"""

    def test_get_users_as_admin(self, client, auth_headers):
        """Test getting users list as admin"""
        response = client.get('/api/v1/users', headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert 'users' in data
        assert 'total' in data
        assert isinstance(data['users'], list)

    def test_get_users_no_auth(self, client):
        """Test getting users without authentication"""
        response = client.get('/api/v1/users')

        assert response.status_code == 401

    def test_get_user_by_id(self, client, auth_headers, sample_user):
        """Test getting specific user by ID"""
        response = client.get(f'/api/v1/users/{sample_user.id}', headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['username'] == sample_user.username
        assert data['email'] == sample_user.email

    def test_get_nonexistent_user(self, client, auth_headers):
        """Test getting user that doesn't exist"""
        response = client.get('/api/v1/users/99999', headers=auth_headers)

        assert response.status_code == 404

    def test_update_user(self, client, auth_headers, sample_user):
        """Test updating user information"""
        response = client.put(f'/api/v1/users/{sample_user.id}',
            headers=auth_headers,
            json={
                'email': 'updated@example.com',
                'firstName': 'Updated'
            }
        )

        assert response.status_code == 200
        data = response.get_json()
        assert 'message' in data
