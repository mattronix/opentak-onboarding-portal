# API Architecture

## Overview
This application now uses a pure API + React SPA architecture with legacy server-side templates removed.

## Active API Endpoints

### API v1 (Modern RESTful API)
**Base URL:** `/api/v1/`

Used by the React frontend for all user and admin operations:
- `/api/v1/auth/*` - Authentication (login, register, verify email, change password)
- `/api/v1/users/*` - User management
- `/api/v1/roles/*` - Role management
- `/api/v1/onboarding-codes/*` - Onboarding code management
- `/api/v1/pending-registrations/*` - Pending registration management (create, edit, resend verification)
- `/api/v1/tak-profiles/*` - TAK profile management
- `/api/v1/meshtastic/*` - Meshtastic configuration management
- `/api/v1/radios/*` - Radio device management
- `/api/v1/qr/*` - QR code generation
- `/api/v1/settings/*` - Application settings

**Authentication:** JWT tokens (Authorization: Bearer <token>)

### Device Integration API (Legacy)
**Base URL:** `/api/`

Defined in `app/api_views.py` - Used by external automation tools:

#### `/api/meshtastic/config/<configid>/<radioid>` (GET)
- Downloads YAML configuration for Meshtastic radios
- Performs template variable replacement (${longName}, ${shortName}, ${channelURL})
- Used by `scripts/meshtastic/meshtastic-api-cli.py` for auto-configuration
- **Authentication:** API Key (X-API-KEY header)

#### `/api/radio` (POST)
- Creates or updates radio inventory from device telemetry
- Accepts full device info JSON payload
- Used by `scripts/meshtastic/meshtastic-api-cli.py` for auto-inventory
- **Authentication:** API Key (X-API-KEY header)

## Authentication Methods

### JWT (JSON Web Tokens)
- Used by: API v1 endpoints
- Header: `Authorization: Bearer <token>`
- Managed by: Flask-JWT-Extended
- Use case: Frontend authentication, user sessions

### API Key
- Used by: Device Integration API
- Header: `X-API-KEY: <api_key>`
- Configured in: `app/settings.py` (API_KEY)
- Use case: External scripts, device automation

## Removed Components

### Legacy Server-Side Views (Removed Oct 2025)
The following files have been **permanently deleted**:
- `app/views.py` - Main Flask routes with Jinja2 templates
- `app/admin_views*.py` - Admin panel routes
- `app/jinja_filters.py` - Template filters

**Reason:** Replaced with React frontend + API v1

### Cleaned Up Decorators
From `app/decorators.py`, removed:
- `@login_required` - Session-based auth (was for templates)
- `@role_required` - Template-based role checking

**Kept:**
- `@api_login_required` - API key validation for device endpoints

## Frontend Architecture

### React SPA
- **Location:** `/frontend/src/`
- **Build output:** `/frontend/dist/`
- **Dev server:** Vite (http://localhost:5173)
- **Production:** Served by Flask from `/frontend/dist/`

### Routing
- **Client-side:** React Router handles all `/admin/*`, `/profile/*`, etc.
- **Server-side:** Flask serves `index.html` for all non-API routes
- **API routes:** Handled by Flask blueprints (bypass SPA serving)

## External Scripts

### Meshtastic Auto-Configuration Tool
**Location:** `scripts/meshtastic/meshtastic-api-cli.py`

**Purpose:**
- Monitors USB ports for newly connected Meshtastic radios
- Auto-downloads configuration from server
- Flashes config to device
- Updates radio inventory in database

**Usage:**
```bash
# Auto-configure radios
python meshtastic-api-cli.py configure --url http://localhost:5000 --apikey <API_KEY>

# Auto-inventory radios
python meshtastic-api-cli.py inventory --url http://localhost:5000 --apikey <API_KEY>

# Debug mode (no API calls)
python meshtastic-api-cli.py debug
```

**Dependencies:** Uses Device Integration API endpoints

## Migration Notes

### If You Need to Add New Device Endpoints
1. Add to `app/api_views.py` (device-facing)
2. Use `@api_login_required` decorator
3. Document in this file

### If You Need to Add New User/Admin Endpoints
1. Add to appropriate `app/api_v1/<feature>.py` file
2. Use `@jwt_required()` from Flask-JWT-Extended
3. Register in `app/api_v1/__init__.py`
4. Update frontend React components

### Authentication Flow
```
User Login → API v1 /auth/login → JWT token → Stored in localStorage
→ Used for all subsequent API v1 requests

Device Script → API /radio → X-API-KEY header → Validates against settings.API_KEY
→ Creates/updates device records
```

## API Endpoint Details

### Pending Registrations API (`/api/v1/pending-registrations/`)

Admin-only endpoints for managing user registrations awaiting email verification.

#### `GET /api/v1/pending-registrations`
List all pending registrations.

**Response:**
```json
{
  "pending_registrations": [{
    "id": 1,
    "username": "testuser",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "callsign": "ALPHA1",
    "onboarding_code_id": 5,
    "onboarding_code": { "id": 5, "name": "VRU", "code": "ABC123" },
    "created_at": "2025-10-17T10:00:00",
    "expires_at": "2025-10-18T10:00:00",
    "is_expired": false
  }]
}
```

#### `POST /api/v1/pending-registrations`
Create a new pending registration manually (sends verification email).

**Request Body:**
```json
{
  "username": "testuser",
  "password": "securepass123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "callsign": "ALPHA1",
  "onboarding_code_id": 5
}
```

**Response:** `201 Created`
```json
{
  "message": "Pending registration created successfully",
  "id": 1,
  "username": "testuser",
  "email": "user@example.com",
  "expires_at": "2025-10-18T10:00:00"
}
```

**Features:**
- Username automatically converted to lowercase
- Username validation: only letters and numbers (no spaces, underscores, periods)
- Generates verification token (24-hour expiry)
- Sends verification email automatically

#### `PUT /api/v1/pending-registrations/<id>`
Update a pending registration (sends new verification email, extends expiry by 24 hours).

**Request Body:** (all fields optional)
```json
{
  "username": "newusername",
  "email": "newemail@example.com",
  "password": "newpassword",
  "firstName": "Jane",
  "lastName": "Smith",
  "callsign": "BRAVO2",
  "onboarding_code_id": 6
}
```

**Response:** `200 OK`
```json
{
  "message": "Pending registration updated and verification email sent",
  "id": 1,
  "username": "newusername",
  "email": "newemail@example.com",
  "expires_at": "2025-10-18T10:00:00"
}
```

**Features:**
- Generates new verification token
- Extends expiry by 24 hours
- Sends updated verification email
- Password optional (leave blank to keep current)

#### `POST /api/v1/pending-registrations/<id>/resend`
Resend verification email and extend expiry by 24 hours (works for expired registrations too).

**Response:** `200 OK`
```json
{
  "message": "Verification email resent to user@example.com"
}
```

**Features:**
- Generates new verification token
- Extends expiry by 24 hours from now
- Works even if registration is expired
- Perfect for "restart registration" functionality

#### `DELETE /api/v1/pending-registrations/<id>`
Delete a pending registration.

**Response:** `200 OK`
```json
{
  "message": "Pending registration for testuser deleted successfully"
}
```

#### `POST /api/v1/pending-registrations/cleanup-expired`
Delete all expired pending registrations.

**Response:** `200 OK`
```json
{
  "message": "Cleaned up 5 expired pending registrations"
}
```

### Authentication API Updates (`/api/v1/auth/`)

#### `POST /api/v1/auth/change-password` (Updated)
Change password for authenticated user (no current password required).

**Request Body:**
```json
{
  "newPassword": "newsecurepass123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Password changed successfully"
}
```

**Changes:**
- No longer requires current password
- User just needs to be authenticated (logged in)
- Uses admin OTS credentials to reset password directly

### Username Validation Rules

All username-related endpoints now enforce strict validation:
- **Only letters and numbers** (a-z, 0-9)
- **No spaces, underscores, periods, or hyphens**
- **3-32 characters**
- **Automatically converted to lowercase**

### Role Mapping for OTS

When creating users in OTS, roles are mapped:
- Roles named `'administrator'` or `'admin'` → `'administrator'` in OTS
- All other roles → `'user'` in OTS

This ensures compatibility with OTS's two-role system while maintaining flexible role management in the portal database.

### Settings API (`/api/v1/admin/settings/`)

Admin-only endpoints for managing system settings.

#### `GET /api/v1/admin/settings`
Get all system settings grouped by category.

**Authentication:** Required (admin only)

**Response:** `200 OK`
```json
{
  "notifications": [
    {
      "id": 1,
      "key": "notify_admin_pending_registration",
      "value": "true",
      "description": "Send notification to admin when a new pending registration is created"
    },
    {
      "id": 2,
      "key": "notify_admin_new_registration",
      "value": "true",
      "description": "Send notification to admin when a new user completes registration"
    }
  ],
  "email": [],
  "security": [],
  "general": []
}
```

**Features:**
- Returns settings organized by category (notifications, email, security, general)
- Automatically initializes default settings if they don't exist
- Admin-only access required

#### `PUT /api/v1/admin/settings/<id>`
Update a system setting by ID.

**Authentication:** Required (admin only)

**Request Body:**
```json
{
  "value": "false"
}
```

**Response:** `200 OK`
```json
{
  "message": "Setting updated successfully",
  "setting": {
    "id": 1,
    "key": "notify_admin_pending_registration",
    "value": "false",
    "description": "Send notification to admin when a new pending registration is created"
  }
}
```

#### `PUT /api/v1/admin/settings/key/<key>`
Update a system setting by key name.

**Authentication:** Required (admin only)

**Request Body:**
```json
{
  "value": true
}
```

**Response:** `200 OK`
```json
{
  "message": "Setting updated successfully",
  "setting": {
    "id": 1,
    "key": "notify_admin_pending_registration",
    "value": "true",
    "description": "Send notification to admin when a new pending registration is created"
  }
}
```

**Available Settings:**
- `notify_admin_pending_registration` (default: true) - Send notification when new pending registration created
- `notify_admin_new_registration` (default: true) - Send notification when user completes registration

**Notes:**
- Boolean values are stored as strings ("true"/"false")
- Settings are automatically created with defaults on first access
- Only administrators can view or modify settings

## Documentation
- API v1 Swagger docs: http://localhost:5000/api/docs
- OpenAPI spec: http://localhost:5000/api/v1/swagger.json
