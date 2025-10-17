Flask Onboarding Portal for OpenTAK
# What is this project?

This project is an Opensource ATAK Portal that works with OpenTak Server to provide a self service onboarding experiance for end users.

**✨ NEW: Now includes a modern RESTful API + React SPA!** See [API Documentation](#api--spa-architecture) below.

# Features 
* Temporary access and cleanup of temporary accounts
* Registration by secure link withn max uses and email notification to link owner 
* Meshtastic QR Code Display
* Data package automatic Config of call sign
* Role Based Access Control to Datapackages and Meshtastic Configs
* Email Notifications for New Registrations
* Max Link Usage
* Link Expiry
* User Expiry
* Forgot Password and E-Mail Reset (bit basic still as it uses a token that is time invalidated FIXED Soon)
* Data Package Structure Viewer (really basic)
* Uses OPENTAK Server for authentication
* Admins in Opentak are Admin's in Portal
* TAK Update Server Generator/Manager
* Meshtastic Radio Config via the script meshtastic-api-cli configure 
* Meshtastic Radio Inventory via the script meshtastic-api-cli inventory 
* Meshtastic YAML Config Profiles in the Meshtastic Admin Section


# Setup

## Initial Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd opentak-onboarding-portal
   ```

2. Copy configuration templates:
   ```bash
   cp .env.example .env
   cp docker-compose.yml.dist docker-compose.yml
   ```

3. Edit `.env` and replace with your actual configuration

## Docker Compose Setup

If you want to expose a TAK update server via OTS and this container runs on the same host as OTS, uncomment the volume line in docker-compose.yml.

Build and start the containers:
```bash
# Build with version info
./docker-build.sh

# Start containers
docker compose up -d

# Run database migrations
docker compose exec web flask db upgrade
```

# upgrade
```
git pull
docker compose build
docker compose up -d
docker compose exec web flask db upgrade
```

# Update Server Info

If you want to expose a tak update server via OTS and this container runs on the same host as OTS uncomment the volume line in docker-compose.yml 

Otherwise by default its exposed on /updates but for ATAK clients to work you will need to add the webserver certificate in a trust-store and add it to the "update trust store" of the ATAK device.

WARNING: You will want to add a volume bind mount to ensure the data is not lost when the container restarts this can be done by adding a volume to the docker-compose.yml 
Example Volume Mount: 

```
version: '2'
services:
    web:
        volumes:
          - ./:/app
           #  Used to export updates to the host
          - ./update:/app/updates
```

# DEV 

## Creating Migrations
```
flask db migrate -m "Migration Description."
```
## Executing Migrations
```
flask db upgrade
```

## Development Environment
To run this project inside of docker just type:
```
flask run --debug

# Debug Flag will enable auto refresh
```


# Screenshots

Here are some screenshots of the project:

## Homepage
![Screenshot 1](screenshots/home.png)
## Admin Menu
![Screenshot 2](screenshots/admin.png)
## Onboarding Listing Page
![Screenshot 3](screenshots/editor_onboarding.png)
## User Registration
![Screenshot 4](screenshots/registration.png)





---

# API + SPA Architecture

This portal now includes a **RESTful API** and **React Single Page Application** alongside the traditional forms interface.

## 🚀 Quick Start

### Traditional Forms UI (existing)
```bash
docker compose up -d
```
Access at: http://localhost:5000/

### API + SPA (new)

**Backend API:**
```bash
# Enable API in .env
echo "ENABLE_API=True" >> .env

flask run
```
- API: http://localhost:5000/api/v1/
- Interactive Docs: http://localhost:5000/api/docs

**Frontend SPA:**
```bash
cd frontend
npm install
npm run dev
```
- SPA: http://localhost:5173/

## 📚 Documentation

All documentation is in the [`/docs`](./docs/) folder:

### Getting Started
- **[Quick Start Guide](./docs/QUICK_START.md)** - Get the API + SPA running in 5 minutes
- **[API Testing Guide](./docs/API_TESTING_GUIDE.md)** - Using Swagger, pytest, and curl

### Technical Details
- **[Conversion Guide](./docs/CONVERSION_GUIDE.md)** - Complete technical documentation
- **[Conversion Summary](./docs/CONVERSION_SUMMARY.md)** - Overview of all changes
- **[Final Status](./docs/FINAL_STATUS.md)** - Project completion status
- **[API README](./docs/README_API.md)** - Quick API reference

### Frontend & Configuration
- **[Frontend Dashboard](./docs/FRONTEND_DASHBOARD.md)** - React dashboard implementation
- **[Dashboard Mobile Responsive](./docs/DASHBOARD_MOBILE_RESPONSIVE.md)** - Mobile responsive design guide
- **[Settings API Endpoint](./docs/SETTINGS_API_ENDPOINT.md)** - Configuration API documentation
- **[Settings Flow Diagram](./docs/SETTINGS_FLOW_DIAGRAM.md)** - Visual settings architecture
- **[Dashboard Implementation Summary](./docs/DASHBOARD_IMPLEMENTATION_SUMMARY.md)** - Complete implementation overview
- **[API-Only Mode](./docs/API_ONLY_MODE.md)** - Disable traditional routes

### Architecture
- **[Fixes Applied](./docs/FIXES_APPLIED.md)** - Bug fixes and improvements

### Original Docs
- [Settings Guide](./docs/settings.md)
- [Nginx Configuration](./docs/nginx.md)
- [Meshtastic Setup](./docs/meshtastic.md)
- [Installer Guide](./docs/installer.md)

## 🎯 API Features

- **47 RESTful endpoints** across 8 modules
- **JWT authentication** with auto-refresh tokens
- **Role-based access control** for admin endpoints
- **Swagger UI** for interactive API testing
- **CORS enabled** for SPA integration
- **File uploads/downloads** for TAK profiles and packages
- **Automated testing** with pytest (21 tests, 81% coverage)

### API Endpoints

All endpoints are available at `/api/v1/`:

- **Authentication** (8 endpoints) - Login, register, password management
- **Users** (5 endpoints) - User CRUD operations
- **Roles** (5 endpoints) - Role management
- **Onboarding Codes** (6 endpoints) - Code management
- **TAK Profiles** (6 endpoints) - Profile management + downloads
- **Meshtastic** (5 endpoints) - Radio configuration
- **Radios** (7 endpoints) - Device inventory
- **Packages** (5 endpoints) - ATAK package management
- **Settings** (1 endpoint) - Public configuration for frontend

### ⚙️ Settings API

The `/api/v1/settings` endpoint exposes backend configuration to the frontend, enabling dynamic UI behavior:

```bash
# Test the settings endpoint
curl http://localhost:5000/api/v1/settings
```

**Response includes:**
- Branding (portal name, colors, logo)
- Feature flags (show/hide UI elements)
- TAK server configuration
- Help links and support email

**Example configuration in `.env`:**
```bash
BRAND_NAME="My TAK Portal"
PRIMARY_COLOR="#000000"
ACCENT_COLOR="#ff9800"
GENERATE_ITAK_QR_CODE=True
ITAK_HOMEPAGE_ICON_ENABLED=True
TRUSTSTORE_HOMEPAGE_ICON_ENABLED=True
ZEROTIER_ICON=False
FORGOT_PASSWORD_ENABLED=True
```

See [Settings API Documentation](./docs/SETTINGS_API_ENDPOINT.md) for complete details.

## 🧪 Testing

```bash
# Run all tests
pytest

# Run with coverage report
pytest --cov=app --cov-report=html
open htmlcov/index.html
```

See [API Testing Guide](./docs/API_TESTING_GUIDE.md) for complete testing documentation.

## 🏗️ Architecture

The application now supports two architectures:

### Traditional (existing)
- Server-side rendering with Jinja2
- Form-based POST/GET requests
- Session-based authentication
- Full page reloads

### Modern (new)
- RESTful API backend
- React SPA frontend
- JWT token authentication
- Client-side routing
- No page reloads

Both can run **simultaneously** and share the same database!

## 📦 Tech Stack

**Backend:**
- Flask 2.2.4
- Flask-JWT-Extended (JWT auth)
- Flask-CORS (CORS support)
- Flasgger (Swagger/OpenAPI docs)
- SQLAlchemy (ORM)
- Pytest (testing)

**Frontend:**
- React 18
- Vite (build tool)
- React Router (routing)
- Axios (HTTP client)
- TanStack Query (data fetching)

## 🔐 API Authentication

```bash
# Login to get JWT token
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Use token for authenticated requests
curl http://localhost:5000/api/v1/users \
  -H "Authorization: Bearer <your_token>"
```

Or use the **Swagger UI** at http://localhost:5000/api/docs for interactive testing!

## 🎨 Frontend Development

```bash
cd frontend

# Development server with hot reload
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

The SPA includes:
- User authentication with JWT
- Dashboard with TAK profiles and radios
- User profile editing
- Admin panel (with role-based access)
- Protected routes
- Automatic token refresh

## 📝 Migration Path

You can migrate gradually:

1. **Keep using forms** - Everything still works as before
2. **Test the API** - Use Swagger UI to explore endpoints
3. **Try the SPA** - Modern interface for users
4. **Build mobile apps** - Use the API for iOS/Android
5. **Customize** - Extend the API or SPA as needed

Both systems share the same:
- Database
- OTS integration
- User accounts
- Roles and permissions

## 🆘 Support

- **Issues**: Open an issue on this repository
- **Documentation**: Check the [`/docs`](./docs/) folder
- **API Docs**: http://localhost:5000/api/docs
- **Tests**: Run `pytest` to verify everything works

---

**Original project features continue to work exactly as before!**


