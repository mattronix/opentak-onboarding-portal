# OpenTAK Onboarding Portal - API + SPA Conversion Guide

## Overview

This application has been converted from a traditional Flask forms-based application to a modern API + SPA architecture:

- **Backend**: Flask RESTful API (located in `/app/api_v1/`)
- **Frontend**: React Single Page Application (located in `/frontend/`)

## Backend API

### API Structure

The API is organized into the following modules under `/app/api_v1/`:

1. **auth.py** - Authentication endpoints
   - POST `/api/v1/auth/login` - User login
   - POST `/api/v1/auth/register` - User registration
   - POST `/api/v1/auth/refresh` - Refresh access token
   - GET `/api/v1/auth/me` - Get current user
   - POST `/api/v1/auth/forgot-password` - Request password reset
   - POST `/api/v1/auth/reset-password` - Reset password
   - POST `/api/v1/auth/change-password` - Change password

2. **users.py** - User management (admin only)
   - GET `/api/v1/users` - List all users (paginated)
   - GET `/api/v1/users/<id>` - Get user by ID
   - POST `/api/v1/users` - Create new user
   - PUT `/api/v1/users/<id>` - Update user
   - DELETE `/api/v1/users/<id>` - Delete user

3. **roles.py** - Role management
   - GET `/api/v1/roles` - List all roles
   - GET `/api/v1/roles/<id>` - Get role by ID
   - POST `/api/v1/roles` - Create new role (admin)
   - PUT `/api/v1/roles/<id>` - Update role (admin)
   - DELETE `/api/v1/roles/<id>` - Delete role (admin)

4. **onboarding_codes.py** - Onboarding code management
   - GET `/api/v1/onboarding-codes` - List all codes (admin)
   - GET `/api/v1/onboarding-codes/<id>` - Get code by ID (admin)
   - GET `/api/v1/onboarding-codes/validate/<code>` - Validate code (public)
   - POST `/api/v1/onboarding-codes` - Create code (admin)
   - PUT `/api/v1/onboarding-codes/<id>` - Update code (admin)
   - DELETE `/api/v1/onboarding-codes/<id>` - Delete code (admin)

5. **tak_profiles.py** - TAK profile management
   - GET `/api/v1/tak-profiles` - List accessible profiles
   - GET `/api/v1/tak-profiles/<id>` - Get profile details
   - GET `/api/v1/tak-profiles/<id>/download` - Download profile ZIP
   - POST `/api/v1/tak-profiles` - Create profile (admin)
   - PUT `/api/v1/tak-profiles/<id>` - Update profile (admin)
   - DELETE `/api/v1/tak-profiles/<id>` - Delete profile (admin)

6. **meshtastic.py** - Meshtastic radio config management
   - GET `/api/v1/meshtastic` - List accessible configs
   - GET `/api/v1/meshtastic/<id>` - Get config details
   - POST `/api/v1/meshtastic` - Create config (admin)
   - PUT `/api/v1/meshtastic/<id>` - Update config (admin)
   - DELETE `/api/v1/meshtastic/<id>` - Delete config (admin)

7. **radios.py** - Radio device management
   - GET `/api/v1/radios` - List accessible radios
   - GET `/api/v1/radios/<id>` - Get radio details
   - POST `/api/v1/radios` - Create radio (admin)
   - PUT `/api/v1/radios/<id>` - Update radio (admin)
   - PUT `/api/v1/radios/<id>/assign` - Assign radio to user (admin)
   - POST `/api/v1/radios/<id>/claim` - Claim radio ownership
   - DELETE `/api/v1/radios/<id>` - Delete radio (admin)

8. **packages.py** - ATAK package management
   - GET `/api/v1/packages` - List all packages
   - GET `/api/v1/packages/<id>` - Get package details
   - GET `/api/v1/packages/<id>/download` - Download package APK
   - POST `/api/v1/packages` - Create package (admin)
   - PUT `/api/v1/packages/<id>` - Update package (admin)
   - DELETE `/api/v1/packages/<id>` - Delete package (admin)

### Authentication

The API uses JWT (JSON Web Tokens) for authentication:

- **Access tokens**: Valid for 12 hours
- **Refresh tokens**: Valid for 30 days

Include the access token in the `Authorization` header:
```
Authorization: Bearer <access_token>
```

### CORS Configuration

CORS is enabled for all `/api/*` endpoints. Configure allowed origins in `app/__init__.py`:

```python
CORS(app, resources={
    r"/api/*": {
        "origins": app.config.get('CORS_ORIGINS', '*'),
        ...
    }
})
```

## Frontend SPA

### Structure

```
frontend/
├── src/
│   ├── components/       # Reusable React components
│   │   └── Layout.jsx    # Main layout with navigation
│   ├── contexts/         # React contexts
│   │   └── AuthContext.jsx
│   ├── pages/            # Page components
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Profile.jsx
│   │   └── admin/        # Admin pages
│   │       ├── AdminDashboard.jsx
│   │       ├── UsersList.jsx
│   │       ├── RolesList.jsx
│   │       ├── OnboardingCodesList.jsx
│   │       ├── TakProfilesList.jsx
│   │       ├── MeshtasticList.jsx
│   │       ├── RadiosList.jsx
│   │       └── PackagesList.jsx
│   ├── services/         # API service layer
│   │   └── api.js
│   ├── App.jsx           # Main app with routing
│   └── main.jsx          # Entry point
```

### Key Features

1. **Authentication Context**: Manages user state and authentication
2. **Protected Routes**: Automatically redirect unauthenticated users
3. **Admin Routes**: Require 'administrator' role
4. **API Service Layer**: Centralized API calls with axios
5. **Automatic Token Refresh**: Intercepts 401 responses and refreshes tokens

### Environment Configuration

Create `/frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000
```

### Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

The SPA will run on `http://localhost:5173` by default.

### Building for Production

```bash
cd frontend
npm run build
```

This creates a production build in `/frontend/dist/`.

## Deployment

### Development

1. **Backend**:
   ```bash
   # Install dependencies
   pip install -r requirements.txt

   # Enable API in .env
   ENABLE_API=True

   # Run Flask dev server
   flask run
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

### Production

1. **Backend**:
   - Already configured with Gunicorn in Docker
   - API is enabled when `ENABLE_API=True`

2. **Frontend**:
   - Build the SPA: `npm run build`
   - Serve `/frontend/dist/` using Nginx or integrate with Flask

#### Serving SPA with Flask

Add to `app/__init__.py`:

```python
from flask import send_from_directory

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    if path and os.path.exists(os.path.join('frontend/dist', path)):
        return send_from_directory('frontend/dist', path)
    return send_from_directory('frontend/dist', 'index.html')
```

#### Serving with Nginx

```nginx
server {
    listen 80;

    # Serve SPA
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to Flask
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Migration Path

The original form-based views still exist and can run alongside the API:

- Forms-based routes: `/`, `/login`, `/admin/*`, etc.
- API routes: `/api/v1/*`

You can gradually migrate users to the SPA or run both simultaneously.

## Next Steps to Complete

The API backend is complete. To finish the SPA frontend, create these component files:

### Required Component Files

1. `/frontend/src/components/Layout.jsx` - Main layout with navigation
2. `/frontend/src/pages/Login.jsx` - Login page
3. `/frontend/src/pages/Register.jsx` - Registration with code validation
4. `/frontend/src/pages/Dashboard.jsx` - User dashboard
5. `/frontend/src/pages/Profile.jsx` - User profile editing
6. `/frontend/src/pages/admin/AdminDashboard.jsx` - Admin home
7. `/frontend/src/pages/admin/UsersList.jsx` - User management CRUD
8. `/frontend/src/pages/admin/RolesList.jsx` - Role management CRUD
9. `/frontend/src/pages/admin/OnboardingCodesList.jsx` - Code management CRUD
10. `/frontend/src/pages/admin/TakProfilesList.jsx` - TAK profile CRUD
11. `/frontend/src/pages/admin/MeshtasticList.jsx` - Meshtastic config CRUD
12. `/frontend/src/pages/admin/RadiosList.jsx` - Radio inventory CRUD
13. `/frontend/src/pages/admin/PackagesList.jsx` - Package management CRUD

### Example Login Component

```jsx
// /frontend/src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px' }}>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}

        <div style={{ marginBottom: '15px' }}>
          <label>Username:</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '10px', background: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

export default Login;
```

## Testing the API

### Using curl

```bash
# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'

# Get current user
curl -X GET http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer <access_token>"

# List users (admin)
curl -X GET http://localhost:5000/api/v1/users \
  -H "Authorization: Bearer <access_token>"
```

### Using Postman

Import the API endpoints or create a collection with the endpoints listed above.

## Troubleshooting

### CORS Errors

Make sure `CORS_ORIGINS` is set correctly in your environment or config.

### Token Expired

The frontend automatically refreshes tokens. If you see repeated 401 errors, clear localStorage and login again.

### Module Import Errors

Ensure all dependencies are installed:
- Backend: `pip install -r requirements.txt`
- Frontend: `cd frontend && npm install`

### Database Errors

Run migrations if needed:
```bash
flask db upgrade
```

## Additional Resources

- Flask-JWT-Extended: https://flask-jwt-extended.readthedocs.io/
- React Router: https://reactrouter.com/
- Axios: https://axios-http.com/
- TanStack Query: https://tanstack.com/query/latest
