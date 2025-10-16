# OpenTAK Onboarding Portal - Documentation

Welcome to the documentation for the OpenTAK Onboarding Portal API + SPA system.

## 📚 Quick Links

### Getting Started
- **[Quick Start Guide](./QUICK_START.md)** - Get up and running in 5 minutes
- **[API Quick Reference](./README_API.md)** - Essential API commands and endpoints

### API & Testing
- **[Swagger UI Guide](./SWAGGER_GUIDE.md)** - ⭐ Step-by-step guide to testing endpoints in the browser
- **[API Testing Guide](./API_TESTING_GUIDE.md)** - Complete guide to pytest and manual testing
- **[Swagger UI](http://localhost:5000/api/docs)** - Interactive API documentation (requires server running)

### Technical Documentation
- **[Conversion Guide](./CONVERSION_GUIDE.md)** - Complete technical documentation of the API + SPA conversion
- **[Conversion Summary](./CONVERSION_SUMMARY.md)** - Overview of all changes made
- **[Final Status](./FINAL_STATUS.md)** - Project completion status and deliverables
- **[Fixes Applied](./FIXES_APPLIED.md)** - Bug fixes and issues resolved

### Original Documentation
- **[Settings Guide](./settings.md)** - Configuration and environment variables
- **[Nginx Configuration](./nginx.md)** - Reverse proxy setup
- **[Meshtastic Setup](./meshtastic.md)** - Meshtastic radio configuration
- **[Installer Guide](./installer.md)** - Installation instructions
- **[Example Datapackage](./example_datapackage.md)** - TAK profile examples

## 🎯 What to Read First

### If you're new here:
1. [Quick Start Guide](./QUICK_START.md) - Get the API + SPA running
2. [API Quick Reference](./README_API.md) - Essential commands
3. [API Testing Guide](./API_TESTING_GUIDE.md) - Learn to use Swagger UI

### If you want technical details:
1. [Final Status](./FINAL_STATUS.md) - See what was delivered
2. [Conversion Guide](./CONVERSION_GUIDE.md) - Understand the architecture
3. [Conversion Summary](./CONVERSION_SUMMARY.md) - Overview of changes

### If you're developing:
1. [API Testing Guide](./API_TESTING_GUIDE.md) - Testing with pytest
2. [Conversion Guide](./CONVERSION_GUIDE.md) - API endpoint details
3. Open http://localhost:5000/api/docs for interactive docs

## 🚀 Quick Commands

### Start Backend API
```bash
flask run
# Access: http://localhost:5000/api/v1/
# Docs: http://localhost:5000/api/docs
```

### Start Frontend SPA
```bash
cd frontend && npm run dev
# Access: http://localhost:5173/
```

### Run Tests
```bash
pytest --cov=app
```

### Try an API Endpoint
```bash
# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

## 📊 Project Overview

This portal now includes:

- ✅ **47 RESTful API endpoints** across 8 modules
- ✅ **Interactive Swagger documentation** at /api/docs
- ✅ **React SPA** with modern UI
- ✅ **JWT authentication** with auto-refresh
- ✅ **21 automated tests** with 81% coverage
- ✅ **Complete documentation** (you're reading it!)

## 🏗️ Architecture

The application supports **two architectures** that can run simultaneously:

### Traditional (existing)
- Server-side rendered forms
- Session-based auth
- Available at: http://localhost:5000/

### Modern (new)
- RESTful API backend
- React SPA frontend
- JWT token auth
- API: http://localhost:5000/api/v1/
- SPA: http://localhost:5173/

Both share the same database and OTS integration!

## 📞 Need Help?

- **Check Swagger docs**: http://localhost:5000/api/docs
- **Run the tests**: `pytest` to verify everything works
- **Read the guides**: Start with [Quick Start](./QUICK_START.md)
- **Report issues**: Open an issue on the repository

## 📝 Documentation Index

| Document | Description |
|----------|-------------|
| [QUICK_START.md](./QUICK_START.md) | 5-minute setup guide |
| [README_API.md](./README_API.md) | API quick reference |
| [SWAGGER_GUIDE.md](./SWAGGER_GUIDE.md) | ⭐ Interactive testing with Swagger UI |
| [API_TESTING_GUIDE.md](./API_TESTING_GUIDE.md) | Complete testing guide |
| [CONVERSION_GUIDE.md](./CONVERSION_GUIDE.md) | Technical documentation |
| [CONVERSION_SUMMARY.md](./CONVERSION_SUMMARY.md) | Summary of changes |
| [FINAL_STATUS.md](./FINAL_STATUS.md) | Project status |
| [FIXES_APPLIED.md](./FIXES_APPLIED.md) | Bug fixes |
| [settings.md](./settings.md) | Configuration guide |
| [nginx.md](./nginx.md) | Nginx setup |
| [meshtastic.md](./meshtastic.md) | Meshtastic config |
| [installer.md](./installer.md) | Installation guide |

---

**Back to [Main README](../README.MD)**
