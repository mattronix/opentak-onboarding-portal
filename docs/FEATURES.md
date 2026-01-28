# OpenTAK Onboarding Portal - Features Overview

A comprehensive self-service portal for TAK (Team Awareness Kit) user onboarding, integrated with OpenTAK Server.

---

## Core Features

### User Authentication & Registration

- **Self-service registration** - Users can create their own accounts
- **Email verification** - Optional email verification for new accounts
- **Password recovery** - Forgot password flow with email reset links
- **JWT-based authentication** - Secure token-based session management
- **Role-based access control** - Granular permissions via roles

### Profile Management

- **User profiles** - Display name, callsign, and email management
- **Profile completion flow** - Guides new users to complete their profile
- **Callsign management** - Tactical identifiers for TAK network visibility

---

## TAK Integration

### Server Connection (QR Codes)

- **ATAK QR codes** - One-scan enrollment for Android ATAK users
- **iTAK QR codes** - One-scan enrollment for iPhone iTAK users
- **Automatic credential provisioning** - Server creates user certificates automatically
- **Token expiration** - Configurable time limits for security
- **Usage limits** - Optional max uses per QR token
- **Live usage tracking** - See how many times a token has been used

### Callsign QR Codes

- **ATAK callsign QR** - Scan to automatically set callsign in ATAK
- **Profile-synced** - Uses callsign from user's portal profile

### Data Packages

- **TAK profile downloads** - Distribute configuration packages to users
- **Role-based access** - Packages visible based on user's assigned roles
- **Public packages** - Option to make packages available to all users
- **Descriptions** - Help users understand what each package contains

---

## Meshtastic Integration

### Channel Management

- **OTS sync** - Meshtastic channels sync with OpenTAK Server
- **QR code generation** - Each channel gets a scannable QR code
- **"Open in Meshtastic"** - Deep links for mobile devices
- **Copy link fallback** - For when QR scanning isn't possible

### Configuration Options

- **YAML configuration** - Optional advanced device settings
- **Role-based visibility** - Channels visible based on user roles
- **Public channels** - Make channels available to all users
- **Channel URL validation** - Validates meshtastic:// URLs

---

## Radio Asset Tracking

### Radio Management

- **Radio inventory** - Track all team radios
- **Platform types** - Support for multiple radio platforms
- **User assignments** - Assign radios to specific users
- **Dashboard visibility** - Users see their assigned radios

---

## Administration

### User Management

- **User listing** - View all registered users
- **Role assignment** - Assign roles to users
- **Account activation** - Enable/disable user accounts
- **Password reset** - Admin-initiated password resets

### Role Management

- **Custom roles** - Create roles with specific permissions
- **Display names** - Friendly names for roles
- **Role hierarchies** - Nested permission structures

### Settings & Branding

- **Custom branding** - Set organization name and colors
- **Logo upload** - Custom logo for navbar, login, and emails
- **Display modes** - Logo only, text only, or both
- **Primary/accent colors** - Customize the portal appearance

### Homepage Customization

Toggle visibility of homepage elements:

- ATAK installation section
- iTAK installation section
- Meshtastic installation section
- TrustStore download
- Installer QR codes
- Callsign QR code section

### QR Code Settings

Configure enrollment QR code behavior:

- Enable/disable ATAK QR generation
- Enable/disable iTAK QR generation
- Token expiration time
- Maximum uses per token
- Automatic OTS user creation

### Email Configuration

- **SMTP integration** - Send emails via your mail server
- **Email templates** - Branded HTML email templates
- **Verification emails** - Account verification flow
- **Password reset emails** - Secure reset link delivery

---

## OpenTAK Server Integration

### Automatic Sync

- **User provisioning** - Create OTS users when portal users register
- **Certificate management** - OTS handles certificate generation
- **QR string generation** - Fetch enrollment QR data from OTS
- **Meshtastic sync** - Bidirectional channel synchronization

### API Integration

Full integration with OTS API endpoints:

- User management
- Certificate operations
- QR string generation
- Meshtastic channel management
- Data package management

---

## Security Features

### Authentication

- JWT tokens with configurable expiration
- Secure password hashing
- Rate limiting (configurable)
- Session management

### Authorization

- Role-based access control (RBAC)
- Per-resource permissions
- Admin-only endpoints
- Public vs. authenticated resources

### Data Protection

- SSL/TLS support
- Secure cookie handling
- CSRF protection
- Input validation

---

## User Experience

### Dashboard

- Personalized welcome message
- Role display
- Assigned radio summary
- Quick action buttons
- Step-by-step onboarding flow

### Responsive Design

- Mobile-friendly interface
- Works on tablets and desktops
- Touch-friendly controls
- QR codes sized for easy scanning

### Accessibility

- High contrast options via theming
- Keyboard navigation
- Screen reader friendly structure

---

## Technical Features

### Backend (Flask/Python)

- RESTful API design
- SQLAlchemy ORM
- Flask-JWT-Extended authentication
- Modular blueprint architecture
- Database migrations (Alembic)

### Frontend (React)

- Vite build system
- TanStack Query for data fetching
- React Router for navigation
- Context-based state management
- CSS modules for styling

### Deployment

- Docker support
- Environment variable configuration
- Production-ready settings
- Logging and monitoring hooks

---

## API Reference

### Public Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/login` | POST | User login |
| `/api/v1/auth/register` | POST | New user registration |
| `/api/v1/auth/forgot-password` | POST | Request password reset |
| `/api/v1/settings` | GET | Public settings |

### Authenticated Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/me` | GET | Current user info |
| `/api/v1/me` | PUT | Update profile |
| `/api/v1/me/password` | PUT | Change password |
| `/api/v1/tak-profiles` | GET | Available profiles |
| `/api/v1/meshtastic` | GET | Available channels |
| `/api/v1/radios` | GET | Assigned radios |
| `/api/v1/qr/atak` | GET | ATAK QR string |
| `/api/v1/qr/itak` | GET | iTAK QR string |

### Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/admin/users` | GET | List all users |
| `/api/v1/admin/roles` | GET/POST | Manage roles |
| `/api/v1/admin/settings` | GET/PUT | System settings |
| `/api/v1/admin/logo` | POST/DELETE | Logo management |

---

## Configuration

### Environment Variables

```
# Database
DATABASE_URL=sqlite:///app.db

# JWT
JWT_SECRET_KEY=your-secret-key
JWT_ACCESS_TOKEN_EXPIRES=3600

# OpenTAK Server
OTS_URL=https://your-ots-server:8443
OTS_USERNAME=admin
OTS_PASSWORD=password
OTS_VERIFY_SSL=true

# Email (optional)
MAIL_ENABLED=true
MAIL_SERVER=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=user@example.com
MAIL_PASSWORD=password
MAIL_USE_TLS=true

# Portal
PORTAL_URL=https://your-portal.com
```

---

*For detailed setup instructions, see the README.md file.*
