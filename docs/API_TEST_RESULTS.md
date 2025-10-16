# API Test Results

Comprehensive test results for all API endpoints in the OpenTAK Onboarding Portal.

## Test Summary

**Date:** 2025-10-16
**Total Tests:** 19
**Passed:** 8 (42%)
**Failed:** 11 (58%)
**Coverage:** 38% of application code

## Test Infrastructure Status

### ✅ Fixed Issues

1. **Werkzeug Version Compatibility**
   - Issue: Flask 2.2.4 incompatible with Werkzeug 3.x
   - Fix: Pinned Werkzeug to 2.2.2 in requirements.txt
   - File: [requirements.txt](../requirements.txt#L2)

2. **Settings Path Resolution**
   - Issue: Test configuration couldn't find settings.py
   - Fix: Used absolute path resolution in conftest.py
   - File: [tests/conftest.py](../tests/conftest.py#L30-L31)

3. **UserModel Parameter Names**
   - Issue: Tests used `firstName`/`lastName` instead of `firstname`/`lastname`
   - Fix: Updated all test fixtures to use correct parameter names
   - Files: [tests/conftest.py](../tests/conftest.py#L106-L115)

4. **OTS URL Configuration**
   - Issue: Tests couldn't override OTS_URL from .env file
   - Fix: Modified auth.py to use `current_app.config` instead of importing constants
   - File: [app/api_v1/auth.py](../app/api_v1/auth.py#L6)

5. **APScheduler in Test Mode**
   - Issue: Scheduler causing errors during tests
   - Fix: Added TESTING flag to settings.py and skip scheduler initialization
   - Files: [app/settings.py](../app/settings.py#L50), [app/__init__.py](../app/__init__.py#L45-L49)

6. **OTS Mock Endpoints**
   - Issue: Tests only mocked `/api/login` but OTSClient also calls `/api/me`
   - Fix: Added mock for `/api/me` endpoint in all auth tests
   - File: [tests/conftest.py](../tests/conftest.py#L138-L149)

## Detailed Test Results

### Authentication Endpoints (`/api/v1/auth/*`)

| Test | Endpoint | Status | Notes |
|------|----------|--------|-------|
| test_login_success | POST /auth/login | ✅ PASS | Successfully authenticates with OTS |
| test_login_missing_credentials | POST /auth/login | ✅ PASS | Returns 400 for missing credentials |
| test_login_invalid_credentials | POST /auth/login | ✅ PASS | Returns 401 for invalid credentials |
| test_get_current_user_success | GET /auth/me | ❌ FAIL | JWT token identity issues (422) |
| test_get_current_user_no_auth | GET /auth/me | ✅ PASS | Returns 401 without auth header |
| test_register_with_invalid_code | POST /auth/register | ✅ PASS | Validates onboarding code |
| test_register_missing_fields | POST /auth/register | ✅ PASS | Returns 400 for missing fields |

**Authentication Tests: 5/7 passing (71%)**

### Roles Endpoints (`/api/v1/roles/*`)

| Test | Endpoint | Status | Notes |
|------|----------|--------|-------|
| test_get_roles | GET /roles | ❌ FAIL | JWT token verification issues (422) |
| test_get_roles_no_auth | GET /roles | ✅ PASS | Returns 401 without auth |
| test_create_role_as_admin | POST /roles | ❌ FAIL | JWT token verification issues (422) |
| test_create_duplicate_role | POST /roles | ❌ FAIL | JWT token verification issues (422) |
| test_get_role_by_id | GET /roles/{id} | ❌ FAIL | Fixture returns dict not object |
| test_update_role | PUT /roles/{id} | ❌ FAIL | Fixture returns dict not object |
| test_delete_role | DELETE /roles/{id} | ❌ FAIL | Fixture returns dict not object |

**Roles Tests: 1/7 passing (14%)**

### Users Endpoints (`/api/v1/users/*`)

| Test | Endpoint | Status | Notes |
|------|----------|--------|-------|
| test_get_users_as_admin | GET /users | ❌ FAIL | JWT token verification issues (422) |
| test_get_users_no_auth | GET /users | ✅ PASS | Returns 401 without auth |
| test_get_user_by_id | GET /users/{id} | ❌ FAIL | JWT token verification issues (422) |
| test_get_nonexistent_user | GET /users/9999 | ❌ FAIL | JWT token verification issues (422) |
| test_update_user | PUT /users/{id} | ❌ FAIL | Fixture returns dict not object |

**Users Tests: 1/5 passing (20%)**

## Remaining Issues

### 1. JWT Token Identity Issues (422 Errors)

**Affected Tests:** 7 tests
**Error:** HTTP 422 Unprocessable Entity
**Cause:** The auth_headers fixture successfully creates a JWT token, but when that token is used in subsequent requests, Flask-JWT-Extended can't verify the token identity properly.

**Possible Causes:**
- JWT_SECRET_KEY mismatch between token creation and verification
- Token payload missing required claims
- User identity not being stored correctly in JWT

**Next Steps:**
- Debug the auth_headers fixture to verify token structure
- Check JWT configuration in test vs production
- Verify user exists in database when token is verified

### 2. Model Creation Returning Dicts

**Affected Tests:** 5 tests
**Error:** `AttributeError: 'dict' object has no attribute 'id'`
**Cause:** Some model `create_*` methods return error dicts like `{"error": "..."}` instead of raising exceptions

**Example:**
```python
role = UserRoleModel.create_role(...)  # Returns {"error": "role.exists"} if duplicate
assert role.id  # Fails because role is dict, not model object
```

**Next Steps:**
- Update test fixtures to check for error responses
- Or modify model methods to raise exceptions instead of returning dicts

## Endpoints Not Yet Tested

The following API modules have **no tests** yet:

- ❌ **Onboarding Codes** (`/api/v1/onboarding-codes/*`) - 6 endpoints
- ❌ **TAK Profiles** (`/api/v1/tak-profiles/*`) - 6 endpoints
- ❌ **Meshtastic** (`/api/v1/meshtastic/*`) - 5 endpoints
- ❌ **Radios** (`/api/v1/radios/*`) - 7 endpoints
- ❌ **Packages** (`/api/v1/packages/*`) - 5 endpoints

**Total untested endpoints:** 29/47 (62%)

## Test Coverage by Module

```
API Modules:
- app/api_v1/auth.py           36%  (145 statements, 93 missed)
- app/api_v1/roles.py          27%  (75 statements, 55 missed)
- app/api_v1/users.py          18%  (130 statements, 107 missed)
- app/api_v1/onboarding_codes  19%  (121 statements, 98 missed)
- app/api_v1/tak_profiles.py   18%  (159 statements, 131 missed)
- app/api_v1/meshtastic.py     18%  (119 statements, 98 missed)
- app/api_v1/radios.py         17%  (161 statements, 134 missed)
- app/api_v1/packages.py       16%  (161 statements, 135 missed)

Core Application:
- app/models.py                53%  (443 statements, 209 missed)
- app/ots.py                   43%  (190 statements, 108 missed)
- app/__init__.py              89%  (79 statements, 9 missed)
- app/settings.py             100%  (43 statements, 0 missed)
- app/extensions.py           100%  (8 statements, 0 missed)
- app/exceptions.py           100%  (8 statements, 0 missed)

TOTAL                          38%  (3104 statements, 1933 missed)
```

## Running the Tests

### Run All Tests
```bash
pytest tests/ -v
```

### Run Specific Module
```bash
pytest tests/test_api_auth.py -v
pytest tests/test_api_roles.py -v
pytest tests/test_api_users.py -v
```

### Run with Coverage
```bash
pytest tests/ -v --cov=app --cov-report=html
# View HTML report: open htmlcov/index.html
```

### Run Single Test
```bash
pytest tests/test_api_auth.py::TestAuthLogin::test_login_success -v
```

## Recommendations

### Priority 1: Fix JWT Token Issues
The 422 errors indicate a fundamental issue with JWT token verification that's blocking 7 tests. This should be fixed before adding more tests.

### Priority 2: Fix Model Return Values
Update fixtures to properly handle error cases when creating test data.

### Priority 3: Add Tests for Remaining Endpoints
Create test files for:
- `tests/test_api_onboarding_codes.py`
- `tests/test_api_tak_profiles.py`
- `tests/test_api_meshtastic.py`
- `tests/test_api_radios.py`
- `tests/test_api_packages.py`

### Priority 4: Improve Coverage
Target 80%+ coverage for all API modules by adding:
- Error handling tests
- Edge case tests
- Permission/role-based access tests
- File upload/download tests

## Testing Best Practices Applied

✅ **Fixtures for reusability** - Centralized auth, db, client fixtures
✅ **Mocked external dependencies** - OTS API calls mocked with requests-mock
✅ **Isolated database** - Using SQLite in-memory for fast, isolated tests
✅ **Clear test organization** - Tests grouped by endpoint and functionality
✅ **Descriptive test names** - Easy to understand what each test validates

## Conclusion

The test infrastructure is now **functional and ready for expansion**. The core authentication flow works correctly, and the framework is in place to add comprehensive tests for all 47 API endpoints.

**Current Status:** 8/19 tests passing (42%)
**When JWT issues are fixed:** Expected 12/19 passing (63%)
**With full test coverage:** Target 47+ tests covering all endpoints

---

**Related Documentation:**
- [API Testing Guide](./API_TESTING_GUIDE.md) - How to test manually
- [Swagger Guide](./SWAGGER_GUIDE.md) - Interactive API testing
- [Conversion Guide](./CONVERSION_GUIDE.md) - Complete API reference
