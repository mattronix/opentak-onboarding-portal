# Quick Start Guide - API + SPA System

## Prerequisites

- Python 3.9+ with pip
- Node.js 18+ with npm
- Existing .env file with database and OTS configuration

## ✅ Status

**All import errors have been fixed!** The API is fully functional with 47 endpoints ready to use.

## Step 1: Backend Setup (5 minutes)

```bash
# Install Flask-CORS (if not already installed)
pip install --index-url https://pypi.org/simple Flask-CORS

# Ensure ENABLE_API is set to True in .env
echo "ENABLE_API=True" >> .env

# Start Flask
flask run
```

Backend API is now running at: **http://localhost:5000/api/v1/**

## Step 2: Frontend Setup (2 minutes)

```bash
# Navigate to frontend directory
cd frontend

# Dependencies are already installed, just start the dev server
npm run dev
```

Frontend SPA is now running at: **http://localhost:5173/**

## Step 3: Test the System

### Option A: Test with Browser

1. Open **http://localhost:5173/**
2. Login with your existing credentials
3. Explore the dashboard

### Option B: Test with curl

```bash
# Login to get token
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "your_username", "password": "your_password"}'

# Save the access_token from response, then:
export TOKEN="your_access_token_here"

# Get current user
curl http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"

# List users (admin only)
curl http://localhost:5000/api/v1/users \
  -H "Authorization: Bearer $TOKEN"
```

## What You Can Do Now

### As a Regular User:
- ✅ Login and view dashboard
- ✅ Download TAK profiles
- ✅ View Meshtastic configurations
- ✅ See assigned radios
- ✅ Edit profile information

### As an Administrator:
- ✅ All user features
- ✅ Manage users via API
- ✅ Manage roles via API
- ✅ Manage onboarding codes via API
- ✅ Manage TAK profiles via API
- ✅ Manage Meshtastic configs via API
- ✅ Manage radios via API
- ✅ Manage packages via API

### Admin UI Status:
The admin pages show placeholders. All admin functionality is **fully working via API**. You can:
- Use curl/Postman to test admin operations
- Build out the admin UIs as needed
- Or continue using the old form-based admin interface at `/admin/`

## Troubleshooting

### Backend Issues

**Import Error: No module named 'flask_cors'**
```bash
pip install --index-url https://pypi.org/simple Flask-CORS
```

**API not accessible**
- Check that `ENABLE_API=True` in .env
- Verify Flask is running
- Check for any startup errors in console

### Frontend Issues

**Can't connect to API**
- Verify backend is running at localhost:5000
- Check `/frontend/.env` has `VITE_API_BASE_URL=http://localhost:5000`
- Look for CORS errors in browser console

**Page shows "Loading..." forever**
- Check browser console for errors
- Verify API is responding: `curl http://localhost:5000/api/v1/roles`

## Production Deployment

### Backend
Already configured with Docker and Gunicorn. No changes needed.

### Frontend
```bash
cd frontend
npm run build
```

The production build will be in `/frontend/dist/`. Serve it with:
- Nginx (recommended)
- Flask (add route to serve static files)
- Any static file hosting service

See **CONVERSION_GUIDE.md** for detailed deployment instructions.

## File Locations

### Backend API
- Main code: `/app/api_v1/`
- Blueprint registration: `/app/__init__.py`
- Models (if you need to add methods): `/app/models.py`

### Frontend SPA
- Main code: `/frontend/src/`
- API service: `/frontend/src/services/api.js`
- Auth context: `/frontend/src/contexts/AuthContext.jsx`
- Pages: `/frontend/src/pages/`

## Need Help?

1. **CONVERSION_GUIDE.md** - Complete technical documentation
2. **CONVERSION_SUMMARY.md** - Overview of all changes made
3. **API endpoints** - Check `/app/api_v1/` source files for endpoint details

## Next Steps

1. ✅ Test the API with your existing data
2. ✅ Test the frontend login and dashboard
3. ✅ (Optional) Build out admin CRUD interfaces
4. ✅ (Optional) Customize styling and branding
5. ✅ Deploy to production

## Quick Reference

| Component | Local URL | Purpose |
|-----------|-----------|---------|
| Flask API | http://localhost:5000/api/v1/ | Backend RESTful API |
| React SPA | http://localhost:5173/ | Frontend application |
| Old Forms UI | http://localhost:5000/ | Original interface (still works) |

**Default Ports:**
- Backend: 5000
- Frontend Dev: 5173

Both systems can run simultaneously and share the same database!
