# OpenTAK Onboarding Portal - API + SPA

Modern RESTful API with React SPA frontend for the OpenTAK Onboarding Portal.

## 🚀 Quick Start (2 minutes)

### Backend API
```bash
pip install --index-url https://pypi.org/simple Flask-CORS
echo "ENABLE_API=True" >> .env
flask run
```
→ API: http://localhost:5000/api/v1/
→ Docs: http://localhost:5000/api/docs

### Frontend SPA
```bash
cd frontend && npm run dev
```
→ App: http://localhost:5173/

### Testing
```bash
pytest --cov=app
```

## 📚 Documentation

- [QUICK_START.md](QUICK_START.md) - Setup guide
- [API_TESTING_GUIDE.md](API_TESTING_GUIDE.md) - Testing & Swagger
- [FINAL_STATUS.md](FINAL_STATUS.md) - Complete status
- [CONVERSION_GUIDE.md](CONVERSION_GUIDE.md) - Technical details

## 🎯 API Endpoints

**47 endpoints** organized into:
- Authentication (8) - Login, register, token management
- Users (5) - User CRUD
- Roles (5) - Role management
- Onboarding Codes (6) - Code management
- TAK Profiles (6) - Profile management + download
- Meshtastic (5) - Radio config management
- Radios (7) - Device management
- Packages (5) - ATAK package management

## 🔐 Authentication

```bash
# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Use token
export TOKEN="<access_token>"
curl http://localhost:5000/api/v1/users \
  -H "Authorization: Bearer $TOKEN"
```

## 🧪 Testing

```bash
pytest                    # Run all tests
pytest -v                 # Verbose
pytest --cov=app          # With coverage
pytest tests/test_api_auth.py  # Specific file
```

## ✨ Features

- ✅ JWT authentication with auto-refresh
- ✅ Role-based access control
- ✅ Interactive Swagger documentation
- ✅ CORS enabled for SPA
- ✅ File uploads/downloads
- ✅ Automated test suite
- ✅ React SPA with routing
- ✅ Production ready (Docker + Gunicorn)

## 📦 Tech Stack

**Backend**: Flask, SQLAlchemy, Flask-JWT-Extended, Flasgger
**Frontend**: React, Vite, React Router, Axios, TanStack Query
**Testing**: Pytest, pytest-flask, pytest-cov, requests-mock
**Docs**: Swagger UI, OpenAPI 3.0.3

## 🎉 Status

**100% Complete** - All features implemented, tested, and documented.

See [FINAL_STATUS.md](FINAL_STATUS.md) for complete details.
