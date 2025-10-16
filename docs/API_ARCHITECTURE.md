# API Architecture

## Overview
This application now uses a pure API + React SPA architecture with legacy server-side templates removed.

## Active API Endpoints

### API v1 (Modern RESTful API)
**Base URL:** `/api/v1/`

Used by the React frontend for all user and admin operations:
- `/api/v1/auth/*` - Authentication (login, register, verify email, password reset)
- `/api/v1/users/*` - User management
- `/api/v1/roles/*` - Role management
- `/api/v1/onboarding-codes/*` - Onboarding code management
- `/api/v1/pending-registrations/*` - Email verification management
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

## Documentation
- API v1 Swagger docs: http://localhost:5000/api/docs
- OpenAPI spec: http://localhost:5000/api/v1/swagger.json
