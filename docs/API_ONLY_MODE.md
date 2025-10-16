# API-Only Mode Configuration

## Overview

The OpenTAK Onboarding Portal now supports an **API-Only Mode** that disables traditional form-based Flask routes, allowing you to run the application as a pure API backend for the React SPA frontend.

## Configuration

### Environment Variable

Add to your `.env` file:

```bash
# Enable API-Only Mode (disable traditional Flask routes)
# Default: True (API-only)
API_ONLY_MODE=True

# Must also enable the API
ENABLE_API=True
```

### Settings

**File:** [app/settings.py](../app/settings.py#L55-L57)

```python
# API-Only Mode: Disable traditional form-based routes
# Set to True to run API-only mode (SPA frontend), False to enable traditional Flask routes
API_ONLY_MODE = strtobool(environ.get('API_ONLY_MODE', 'True'))
```

## Modes

### API-Only Mode (Default)

**Configuration:**
```bash
API_ONLY_MODE=True
ENABLE_API=True
```

**Enabled Routes:**
- ✅ `/api/v1/*` - RESTful API endpoints
- ✅ `/api/docs` - Swagger UI documentation
- ✅ `/api/v1/swagger.json` - OpenAPI specification
- ❌ `/` - Traditional Flask homepage (disabled)
- ❌ `/admin/*` - Traditional admin routes (disabled)
- ❌ `/profile/*` - Traditional profile routes (disabled)

**Use Case:**
- Running with React SPA frontend
- Modern single-page application architecture
- API-first development
- Microservices architecture

### Hybrid Mode

**Configuration:**
```bash
API_ONLY_MODE=False
ENABLE_API=True
```

**Enabled Routes:**
- ✅ `/api/v1/*` - RESTful API endpoints
- ✅ `/api/docs` - Swagger UI documentation
- ✅ `/` - Traditional Flask homepage
- ✅ `/admin/*` - Traditional admin routes
- ✅ `/profile/*` - Traditional profile routes

**Use Case:**
- Gradual migration from forms to API
- Supporting both old and new clients
- Backward compatibility during transition
- Testing both interfaces simultaneously

### Traditional Mode (Legacy)

**Configuration:**
```bash
API_ONLY_MODE=False
ENABLE_API=False
```

**Enabled Routes:**
- ❌ `/api/v1/*` - RESTful API endpoints (disabled)
- ✅ `/` - Traditional Flask homepage
- ✅ `/admin/*` - Traditional admin routes
- ✅ `/profile/*` - Traditional profile routes

**Use Case:**
- Legacy deployments
- Running original form-based application
- No API needed

## Implementation

### Backend

**File:** [app/__init__.py](../app/__init__.py#L52-L61)

```python
# Register traditional form-based blueprints (unless API-only mode is enabled)
if not app.config.get('API_ONLY_MODE', False):
    app.register_blueprint(routes)
    app.register_blueprint(admin_routes)
    app.register_blueprint(admin_routes_onboarding)
    app.register_blueprint(admin_routes_users)
    app.register_blueprint(admin_routes_takprofiles)
    app.register_blueprint(admin_routes_roles)
    app.register_blueprint(admin_routes_meshtastic)
    app.register_blueprint(admin_routes_radios)

# Register API blueprints
if app.config['ENABLE_API']:
    from app.api_views import api_routes
    app.register_blueprint(api_routes)

    # Register new RESTful API v1
    from app.api_v1 import api_v1
    app.register_blueprint(api_v1)
```

### Frontend

The React SPA frontend always communicates with the API endpoints (`/api/v1/*`), regardless of the mode setting. The API-only mode only affects backend route registration.

## Migration Guide

### From Traditional to API-Only

1. **Test API endpoints work:**
   ```bash
   curl http://localhost:5000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"test","password":"test"}'
   ```

2. **Deploy React frontend:**
   ```bash
   cd frontend
   npm run build
   # Deploy dist/ to web server
   ```

3. **Update .env:**
   ```bash
   API_ONLY_MODE=True
   ENABLE_API=True
   ```

4. **Restart application:**
   ```bash
   # Restart your Flask app
   ```

5. **Verify traditional routes are disabled:**
   ```bash
   curl http://localhost:5000/
   # Should return 404 or redirect to SPA
   ```

### From API-Only to Hybrid

If you need to re-enable traditional routes:

1. **Update .env:**
   ```bash
   API_ONLY_MODE=False
   ENABLE_API=True
   ```

2. **Restart application**

3. **Verify both interfaces work:**
   - Traditional: http://localhost:5000/
   - API: http://localhost:5000/api/v1/
   - SPA: http://localhost:5173/ (dev) or your deployed URL

## Benefits of API-Only Mode

### Performance

- ✅ Reduced memory footprint (fewer routes loaded)
- ✅ Faster startup time
- ✅ Reduced attack surface (fewer endpoints)

### Security

- ✅ Cleaner separation of concerns
- ✅ Easier to secure (only API endpoints to protect)
- ✅ JWT-based authentication only
- ✅ No session management complexity

### Development

- ✅ Clear API-first architecture
- ✅ Frontend and backend fully decoupled
- ✅ Easier to test API endpoints
- ✅ Better documentation (Swagger)

### Deployment

- ✅ API and SPA can be deployed separately
- ✅ Easier to scale (API server can be replicated)
- ✅ CDN-friendly (SPA is static files)
- ✅ Microservices-ready

## Troubleshooting

### Issue: Traditional routes return 404

**Cause**: API-Only Mode is enabled

**Solution**:
```bash
# Set in .env
API_ONLY_MODE=False

# Or disable completely
# API_ONLY_MODE=True (keep API-only)
```

### Issue: API routes return 404

**Cause**: ENABLE_API is not set

**Solution**:
```bash
# Set in .env
ENABLE_API=True
```

### Issue: Both modes not working

**Cause**: Configuration conflict

**Solution**:
```bash
# For API-only (recommended)
API_ONLY_MODE=True
ENABLE_API=True

# For hybrid (both interfaces)
API_ONLY_MODE=False
ENABLE_API=True

# For traditional only
API_ONLY_MODE=False
ENABLE_API=False
```

## Verification

### Check Current Mode

**View application logs on startup:**

```
API-Only Mode: Enabled
Registered Routes:
  - /api/v1/auth/login
  - /api/v1/users
  - /api/docs
  ...
```

Or:

```
API-Only Mode: Disabled
Registered Routes:
  - /
  - /admin
  - /api/v1/auth/login
  ...
```

### Test Mode

**API-Only Mode:**
```bash
# Should work
curl http://localhost:5000/api/v1/auth/login

# Should return 404
curl http://localhost:5000/
```

**Hybrid Mode:**
```bash
# Both should work
curl http://localhost:5000/api/v1/auth/login
curl http://localhost:5000/
```

## Production Recommendations

### Recommended Setup

```bash
# Backend (.env)
API_ONLY_MODE=True
ENABLE_API=True
```

**Why:**
- Clean separation of concerns
- Better security
- Easier to scale
- Modern architecture

### Deployment Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│  CDN / Nginx │────▶│   React     │
│             │     │  (Frontend)  │     │   SPA       │
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                            │ /api/v1/*
                            ▼
                    ┌──────────────┐
                    │   Flask API  │
                    │   (Backend)  │
                    └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │   Database   │
                    └──────────────┘
```

## Environment Variables Reference

```bash
# API Configuration
ENABLE_API=True                 # Enable API endpoints
API_ONLY_MODE=True             # Disable traditional routes

# JWT Configuration
JWT_SECRET_KEY=your-secret-key

# CORS (if frontend on different domain)
CORS_ORIGINS=http://localhost:5173,https://yourdomain.com

# OTS Configuration
OTS_URL=https://your-ots-server.com
OTS_USERNAME=admin
OTS_PASSWORD=your-password

# Database
SQLALCHEMY_DATABASE_URI=sqlite:///db.sqlite

# Application
DEBUG=False
SECRET_KEY=your-secret-key
```

## Related Documentation

- [API Testing Guide](./API_TESTING_GUIDE.md)
- [Frontend Dashboard](./FRONTEND_DASHBOARD.md)
- [Conversion Guide](./CONVERSION_GUIDE.md)
- [API Test Results](./API_TEST_RESULTS_FINAL.md)
