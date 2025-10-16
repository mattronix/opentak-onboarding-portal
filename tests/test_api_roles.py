"""
Tests for roles API endpoints
"""
import pytest


class TestRolesEndpoints:
    """Test /roles endpoints"""

    def test_get_roles(self, client, auth_headers):
        """Test getting roles list"""
        response = client.get('/api/v1/roles', headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert 'roles' in data
        assert isinstance(data['roles'], list)

    def test_get_roles_no_auth(self, client):
        """Test getting roles without authentication"""
        response = client.get('/api/v1/roles')

        assert response.status_code == 401

    def test_create_role_as_admin(self, client, auth_headers):
        """Test creating a new role as admin"""
        response = client.post('/api/v1/roles',
            headers=auth_headers,
            json={
                'name': 'new_role',
                'description': 'A new test role'
            }
        )

        assert response.status_code == 201
        data = response.get_json()
        assert 'role' in data
        assert data['role']['name'] == 'new_role'

    def test_create_duplicate_role(self, client, auth_headers, sample_role):
        """Test creating role with duplicate name"""
        response = client.post('/api/v1/roles',
            headers=auth_headers,
            json={
                'name': sample_role.name,
                'description': 'Duplicate'
            }
        )

        assert response.status_code == 409

    def test_get_role_by_id(self, client, auth_headers, sample_role):
        """Test getting specific role by ID"""
        response = client.get(f'/api/v1/roles/{sample_role.id}', headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data['name'] == sample_role.name

    def test_update_role(self, client, auth_headers, sample_role):
        """Test updating role"""
        response = client.put(f'/api/v1/roles/{sample_role.id}',
            headers=auth_headers,
            json={
                'description': 'Updated description'
            }
        )

        assert response.status_code == 200

    def test_delete_role(self, client, auth_headers, sample_role):
        """Test deleting role"""
        response = client.delete(f'/api/v1/roles/{sample_role.id}', headers=auth_headers)

        assert response.status_code == 200
