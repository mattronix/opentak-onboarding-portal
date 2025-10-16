# API Testing & Documentation Guide

## 🎯 Quick Access

- **Swagger UI (Interactive Docs)**: http://localhost:5000/api/docs
- **OpenAPI Spec**: http://localhost:5000/api/v1/apispec.json
- **API Base URL**: http://localhost:5000/api/v1

## 📚 API Documentation (Swagger UI)

### Accessing the Docs

1. Start the Flask server:
   ```bash
   flask run
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:5000/api/docs
   ```

3. You'll see interactive API documentation with:
   - All available endpoints
   - Request/response schemas
   - Try-it-out functionality
   - Authentication support

### Using Swagger UI

1. **Authenticate**:
   - Click "Authorize" button at the top
   - Enter `Bearer <your_access_token>`
   - Click "Authorize" again

2. **Try Endpoints**:
   - Expand any endpoint
   - Click "Try it out"
   - Fill in parameters
   - Click "Execute"
   - View response

## 🧪 Automated Testing with Pytest

### Running All Tests

```bash
# Run all tests
pytest

# Run with coverage report
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_api_auth.py

# Run specific test class
pytest tests/test_api_auth.py::TestAuthLogin

# Run specific test
pytest tests/test_api_auth.py::TestAuthLogin::test_login_success

# Run with verbose output
pytest -v

# Run with print statements visible
pytest -s
```

### Test Structure

```
tests/
├── __init__.py
├── conftest.py              # Fixtures and configuration
├── test_api_auth.py         # Authentication endpoint tests
├── test_api_users.py        # User management tests
└── test_api_roles.py        # Role management tests
```

### Available Fixtures

**conftest.py provides these fixtures:**

- `app` - Flask application instance
- `client` - Test client for making requests
- `db` - Database with transaction rollback
- `auth_headers` - Pre-authenticated admin headers
- `sample_user` - Sample user for testing
- `sample_role` - Sample role for testing

### Example Test

```python
def test_get_users(client, auth_headers):
    """Test getting users list"""
    response = client.get('/api/v1/users', headers=auth_headers)

    assert response.status_code == 200
    data = response.get_json()
    assert 'users' in data
```

### Test Coverage

After running tests with coverage, open the HTML report:
```bash
open htmlcov/index.html
```

## 🔧 Manual API Testing

### Using curl

#### 1. Login and Get Token

```bash
# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password"
  }'

# Response includes access_token
# Save it to a variable
export TOKEN="eyJ0eXAiOiJKV1QiLCJhbGc..."
```

#### 2. Make Authenticated Requests

```bash
# Get current user
curl http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"

# List users (admin)
curl http://localhost:5000/api/v1/users \
  -H "Authorization: Bearer $TOKEN"

# Get specific user
curl http://localhost:5000/api/v1/users/1 \
  -H "Authorization: Bearer $TOKEN"

# Create role
curl -X POST http://localhost:5000/api/v1/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "operator",
    "description": "System operator"
  }'

# Update user
curl -X PUT http://localhost:5000/api/v1/users/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newemail@example.com"
  }'
```

### Using Postman

1. **Import Collection**:
   - Create a new collection
   - Add requests for each endpoint
   - Use variables for `{{baseUrl}}` and `{{token}}`

2. **Setup Environment**:
   ```json
   {
     "baseUrl": "http://localhost:5000/api/v1",
     "token": ""
   }
   ```

3. **Authorization**:
   - Type: Bearer Token
   - Token: `{{token}}`

4. **Pre-request Script** (to auto-login):
   ```javascript
   if (!pm.environment.get("token")) {
       pm.sendRequest({
           url: pm.environment.get("baseUrl") + "/auth/login",
           method: "POST",
           header: "Content-Type: application/json",
           body: {
               mode: 'raw',
               raw: JSON.stringify({
                   username: "admin",
                   password: "password"
               })
           }
       }, function (err, res) {
           pm.environment.set("token", res.json().access_token);
       });
   }
   ```

### Using Python requests

```python
import requests

# Base URL
BASE_URL = "http://localhost:5000/api/v1"

# Login
response = requests.post(f"{BASE_URL}/auth/login", json={
    "username": "admin",
    "password": "password"
})

token = response.json()["access_token"]

# Make authenticated request
headers = {"Authorization": f"Bearer {token}"}
response = requests.get(f"{BASE_URL}/users", headers=headers)
users = response.json()

print(users)
```

## 📊 Test Results & Reporting

### Continuous Integration

Add to your CI/CD pipeline:

```yaml
# .github/workflows/test.yml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: 3.11
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
      - name: Run tests
        run: |
          pytest --cov=app --cov-report=xml
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

### Test Report Example

```
============================= test session starts ==============================
platform darwin -- Python 3.11.6, pytest-8.4.2, pluggy-1.6.0
rootdir: /Users/matthew/projects/A-STSC/opentak-onboarding-portal
plugins: flask-1.3.0, cov-7.0.0
collected 15 items

tests/test_api_auth.py ........                                          [ 53%]
tests/test_api_users.py .....                                            [ 86%]
tests/test_api_roles.py ..                                               [100%]

---------- coverage: platform darwin, python 3.11.6-final-0 ----------
Name                          Stmts   Miss  Cover   Missing
-----------------------------------------------------------
app/__init__.py                  45      2    96%   79-80
app/api_v1/__init__.py           12      0   100%
app/api_v1/auth.py              156     35    78%   45-52, 89-95
app/api_v1/users.py             123     28    77%   67-75, 112-118
app/api_v1/roles.py              67     12    82%   89-95
-----------------------------------------------------------
TOTAL                           403     77    81%

============================== 15 passed in 2.43s ===============================
```

## 🐛 Debugging Tips

### Enable Debug Mode

```python
# In test
import pytest

@pytest.mark.debug
def test_something(client):
    # Set breakpoint
    import pdb; pdb.set_trace()
    response = client.get('/api/v1/users')
```

### View Request/Response

```python
def test_debug_request(client):
    response = client.get('/api/v1/users')
    print(f"Status: {response.status_code}")
    print(f"Headers: {response.headers}")
    print(f"Body: {response.get_data(as_text=True)}")
```

### Mock External Services

```python
import requests_mock

def test_with_mock(client):
    with requests_mock.Mocker() as m:
        m.post('http://ots-server/api/login', json={'token': 'mock'})
        response = client.post('/api/v1/auth/login', json={...})
```

## 📝 Writing New Tests

### Template for New Test File

```python
"""
Tests for <feature> API endpoints
"""
import pytest


class TestFeatureEndpoints:
    """Test /<endpoint> endpoints"""

    def test_list_items(self, client, auth_headers):
        """Test listing items"""
        response = client.get('/api/v1/<endpoint>', headers=auth_headers)
        assert response.status_code == 200

    def test_create_item(self, client, auth_headers):
        """Test creating item"""
        response = client.post('/api/v1/<endpoint>',
            headers=auth_headers,
            json={'name': 'test'}
        )
        assert response.status_code == 201

    def test_unauthorized(self, client):
        """Test without auth"""
        response = client.get('/api/v1/<endpoint>')
        assert response.status_code == 401
```

## 🎨 Best Practices

### 1. Test Organization
- One test file per API module
- Group related tests in classes
- Use descriptive test names

### 2. Test Independence
- Each test should be independent
- Use fixtures for setup
- Database rolls back after each test

### 3. Coverage Goals
- Aim for >80% code coverage
- Test happy paths and error cases
- Test authentication and authorization

### 4. Assertions
- Test status codes
- Test response structure
- Test data accuracy
- Test error messages

### 5. Documentation
- Add docstrings to tests
- Comment complex test logic
- Keep tests readable

## 🚀 Quick Commands Reference

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test
pytest tests/test_api_auth.py::test_login_success

# Run and show print statements
pytest -s

# Run in parallel (if pytest-xdist installed)
pytest -n auto

# Generate HTML coverage report
pytest --cov=app --cov-report=html
open htmlcov/index.html

# Run tests on file change (if pytest-watch installed)
ptw
```

## 📞 Support

For issues or questions:
- Check Swagger docs at `/api/docs`
- Review test examples in `/tests/`
- See API implementation in `/app/api_v1/`
- Refer to CONVERSION_GUIDE.md for architecture details

Happy Testing! 🎉
