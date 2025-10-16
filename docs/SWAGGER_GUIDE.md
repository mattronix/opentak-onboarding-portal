# Swagger UI Testing Guide

Complete guide to testing your API endpoints using the interactive Swagger UI.

## 🚀 Quick Start

1. **Start the Flask server**:
   ```bash
   flask run
   ```

2. **Open Swagger UI**:
   ```
   http://localhost:5000/api/docs
   ```

You should see the interactive API documentation with all 47 endpoints!

## 🔐 Step-by-Step: Testing with Authentication

### Step 1: Login to Get JWT Token

1. **Find the `/auth/login` endpoint**:
   - Scroll down or use the search box
   - Look for the `Authentication` section
   - Click on `POST /auth/login`

2. **Click "Try it out"** button (top right of the endpoint)

3. **Edit the request body**:
   ```json
   {
     "username": "admin",
     "password": "your_password"
   }
   ```

4. **Click "Execute"** button

5. **Copy the access_token** from the response:
   ```json
   {
     "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
     "refresh_token": "...",
     "user": {...}
   }
   ```

### Step 2: Authorize Swagger UI

1. **Click the "Authorize" button** at the top of the page (🔓 icon)

2. **In the dialog that appears**:
   - Enter: `Bearer <your_access_token>`
   - Example: `Bearer eyJ0eXAiOiJKV1QiLCJhbGc...`
   - Make sure to include the word "Bearer" and a space!

3. **Click "Authorize"** button

4. **Click "Close"**

Now all authenticated endpoints will use your token! 🎉

### Step 3: Test Protected Endpoints

Now you can test any endpoint. For example, let's list users:

1. **Find `/users` endpoint** (GET)
   - Under the `Users` section
   - Shows a 🔒 icon indicating it requires authentication

2. **Click "Try it out"**

3. **Set parameters** (optional):
   - `page`: 1
   - `per_page`: 50
   - `search`: (leave empty or enter search term)

4. **Click "Execute"**

5. **View the response**:
   - Response code: 200 (success)
   - Response body: JSON with list of users

## 📋 Testing Different Endpoint Types

### GET Requests (Retrieving Data)

**Example: Get current user**

1. Navigate to `GET /auth/me`
2. Click "Try it out"
3. Click "Execute"
4. View your user profile in the response

**Example: Get user by ID**

1. Navigate to `GET /users/{id}`
2. Click "Try it out"
3. Enter a user ID (e.g., `1`)
4. Click "Execute"

### POST Requests (Creating Data)

**Example: Create a role**

1. Navigate to `POST /roles`
2. Click "Try it out"
3. Edit the request body:
   ```json
   {
     "name": "operator",
     "description": "System operator role"
   }
   ```
4. Click "Execute"
5. Check response code (201 = created successfully)

### PUT Requests (Updating Data)

**Example: Update a user**

1. Navigate to `PUT /users/{id}`
2. Click "Try it out"
3. Enter the user ID
4. Edit the request body:
   ```json
   {
     "email": "newemail@example.com",
     "firstName": "Updated"
   }
   ```
5. Click "Execute"

### DELETE Requests (Deleting Data)

**Example: Delete a role**

1. Navigate to `DELETE /roles/{id}`
2. Click "Try it out"
3. Enter the role ID
4. Click "Execute"
5. Confirm 200 response

## 🎯 Testing Common Workflows

### Workflow 1: User Registration

1. **Validate onboarding code** (no auth required):
   ```
   GET /onboarding-codes/validate/{code}
   ```
   - Enter your code
   - Execute
   - Check if valid

2. **Register new user**:
   ```
   POST /auth/register
   ```
   - Fill in all required fields
   - Execute
   - Check for 201 response

### Workflow 2: Create and Assign Resources

1. **Create a TAK profile** (admin):
   ```
   POST /tak-profiles
   ```
   - Upload datapackage file
   - Set name and description
   - Select roles

2. **Assign to user**:
   - User will automatically see it if they have the role

3. **Download profile**:
   ```
   GET /tak-profiles/{id}/download
   ```
   - Get the profile ID
   - Execute to download ZIP

### Workflow 3: Radio Management

1. **List radios**:
   ```
   GET /radios
   ```

2. **Assign radio to user**:
   ```
   PUT /radios/{id}/assign
   ```
   - Enter radio ID
   - Set userId in body

3. **Claim radio** (as user):
   ```
   POST /radios/{id}/claim
   ```

## 🔍 Understanding Responses

### Success Responses

- **200 OK**: Request successful, data returned
- **201 Created**: Resource created successfully
- **204 No Content**: Success, no data to return

### Error Responses

- **400 Bad Request**: Invalid input data
- **401 Unauthorized**: Missing or invalid token
- **403 Forbidden**: Insufficient permissions (need admin role)
- **404 Not Found**: Resource doesn't exist
- **409 Conflict**: Duplicate resource (e.g., username exists)

### Response Structure

Most successful responses look like:
```json
{
  "data": [...],  // The requested data
  "message": "Success"  // Optional message
}
```

Error responses look like:
```json
{
  "error": "Description of what went wrong"
}
```

## 🎨 Swagger UI Features

### Search and Filter

- **Search box** at top: Filter endpoints by name/path
- **Tags**: Click to expand/collapse sections
- **Filter**: Type to narrow down visible endpoints

### Request Examples

- Click "Example Value" to see request format
- Click "Schema" to see required fields
- Swagger shows data types for each field

### Response Examples

- Each endpoint shows possible responses
- Click response codes to see example data
- Shows response schemas

### Models/Schemas

- Scroll to bottom to see all data models
- Shows structure of User, Role, etc.
- Helpful for understanding data format

## 💡 Pro Tips

### 1. Keep Your Token Handy

- Tokens expire after 12 hours
- Use `/auth/refresh` to get new token
- Or just login again

### 2. Test Systematically

1. Start with GET endpoints (safe, read-only)
2. Test POST to create test data
3. Test PUT to update
4. Test DELETE last (removes data)

### 3. Use the Browser Dev Tools

- Open Developer Console (F12)
- Watch Network tab to see actual HTTP requests
- Helpful for debugging

### 4. Copy cURL Commands

- After executing, scroll down
- Find "curl" section
- Copy command for use in terminal

### 5. Save Your Work

- Swagger UI remembers your auth token
- But refresh will clear it
- Save important test data externally

## 🐛 Troubleshooting

### "Unauthorized" Error

**Problem**: 401 response even after authorizing

**Solution**:
1. Check your token hasn't expired (12 hours)
2. Make sure you included "Bearer " prefix
3. Try logging in again for fresh token

### "Forbidden" Error

**Problem**: 403 response on admin endpoints

**Solution**:
1. Check if your user has 'administrator' role
2. Use `GET /auth/me` to check your roles
3. Admin endpoints are marked with 🔒

### Can't Upload Files

**Problem**: File upload endpoints not working

**Solution**:
1. Click "Try it out"
2. Click "Choose File" button
3. Select your file
4. Fill in other form fields
5. Execute

### Response Shows Errors

**Problem**: Seeing error in response

**Solution**:
1. Read the error message carefully
2. Check required fields are filled
3. Verify data types match schema
4. Check parameter format

## 📚 Quick Reference

### Authentication Flow

```
1. POST /auth/login → Get access_token
2. Click "Authorize" → Enter "Bearer <token>"
3. Test any endpoint
4. Token lasts 12 hours
5. Use POST /auth/refresh to extend
```

### Testing Checklist

- [ ] Started Flask server (`flask run`)
- [ ] Opened http://localhost:5000/api/docs
- [ ] Logged in via `/auth/login`
- [ ] Copied access_token
- [ ] Clicked "Authorize" and pasted token
- [ ] Tested GET endpoint (e.g., `/auth/me`)
- [ ] Tested POST endpoint (e.g., create role)
- [ ] Tested PUT endpoint (e.g., update user)
- [ ] Tested DELETE endpoint (e.g., delete role)

## 🎯 Example Test Session

Here's a complete test session:

### 1. Authentication
```
POST /auth/login
Body: {"username": "admin", "password": "password"}
→ Copy access_token
→ Authorize with "Bearer <token>"
```

### 2. Check Your Profile
```
GET /auth/me
→ Verify you're logged in
→ Check your roles
```

### 3. List Resources
```
GET /roles
→ See existing roles

GET /users
→ See all users (admin only)
```

### 4. Create Something
```
POST /roles
Body: {"name": "tester", "description": "Test role"}
→ Note the role ID from response
```

### 5. Update It
```
PUT /roles/{id}
Body: {"description": "Updated test role"}
→ Verify changes
```

### 6. Clean Up
```
DELETE /roles/{id}
→ Remove test data
```

## 🎉 You're Ready!

Now you can:
- ✅ Test all 47 API endpoints
- ✅ Authenticate and authorize
- ✅ Create, read, update, delete data
- ✅ Download files (TAK profiles, packages)
- ✅ Test complex workflows
- ✅ Debug with detailed responses

Happy testing! 🚀

---

**Need more help?**
- [API Testing Guide](./API_TESTING_GUIDE.md) - Additional testing methods
- [Quick Start](./QUICK_START.md) - Getting started
- [Conversion Guide](./CONVERSION_GUIDE.md) - Complete API reference
