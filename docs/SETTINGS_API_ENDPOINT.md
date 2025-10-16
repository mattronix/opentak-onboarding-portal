# Settings API Endpoint

Complete documentation for the `/api/v1/settings` endpoint that exposes backend configuration to the frontend.

## Overview

The settings endpoint provides a centralized way for the frontend to access backend configuration, enabling dynamic UI behavior based on environment variables without hardcoding values.

## Endpoint Details

### URL
```
GET /api/v1/settings
```

### Authentication
**Public endpoint** - No authentication required

### Response Format
```json
{
  "brand_name": "string",
  "primary_color": "string",
  "secondary_color": "string",
  "accent_color": "string",
  "logo_path": "string",
  "help_link": "string",
  "help_email": "string",
  "generate_itak_qr_code": boolean,
  "itak_hostname": "string",
  "ots_hostname": "string",
  "ots_url": "string",
  "itak_homepage_icon_enabled": boolean,
  "truststore_homepage_icon_enabled": boolean,
  "zerotier_icon": boolean,
  "enable_repo": boolean,
  "enable_claim_radio": boolean,
  "forgot_password_enabled": boolean
}
```

## Settings Configuration

All settings are configured via environment variables in `.env` file:

### Branding Settings

#### `BRAND_NAME`
- **Type:** String
- **Default:** `"My OTS Portal"`
- **Description:** Portal name displayed in header and titles
- **Example:** `BRAND_NAME="KGG Dutchies TAK Portal"`

#### `PRIMARY_COLOR`
- **Type:** String (hex color)
- **Default:** `"#000000"`
- **Description:** Primary color for role badges and accents
- **Example:** `PRIMARY_COLOR="#333333"`

#### `SECONDARY_COLOR`
- **Type:** String (hex color)
- **Default:** `"orange"`
- **Description:** Secondary color (currently unused)
- **Example:** `SECONDARY_COLOR="#ff9800"`

#### `ACCENT_COLOR`
- **Type:** String (hex color)
- **Default:** `"orange"`
- **Description:** Accent color for buttons and highlights
- **Example:** `ACCENT_COLOR="#ff9800"`

#### `LOGO_PATH`
- **Type:** String (path)
- **Default:** `"/static/img/logo.png"`
- **Description:** Path to portal logo (relative to static folder)
- **Example:** `LOGO_PATH="/static/img/custom-logo.png"`

### Help & Support Settings

#### `HELP_LINK`
- **Type:** String (URL)
- **Default:** `"https://www.google.com"`
- **Description:** URL for help documentation
- **Example:** `HELP_LINK="https://docs.example.com/setup-guide.pdf"`

#### `HELP_EMAIL`
- **Type:** String (email)
- **Default:** `"help@example.nl"`
- **Description:** Support email address
- **Example:** `HELP_EMAIL="support@mydomain.com"`

### TAK Server Settings

#### `GENERATE_ITAK_QR_CODE`
- **Type:** Boolean
- **Default:** `True`
- **Description:** Enable/disable QR code generation for TAK connection
- **Frontend Impact:** Shows/hides Step 2 (Login to ATAK) section
- **Example:** `GENERATE_ITAK_QR_CODE=True`

#### `ITAK_HOSTNAME`
- **Type:** String
- **Default:** `""`
- **Description:** Hostname for iTAK server
- **Example:** `ITAK_HOSTNAME="tak.example.com"`

#### `OTS_HOSTNAME`
- **Type:** String
- **Default:** `""`
- **Description:** Hostname for OTS server
- **Example:** `OTS_HOSTNAME="tak.example.com"`

#### `OTS_URL`
- **Type:** String (URL)
- **Default:** `""`
- **Description:** Full URL to OTS server (used for QR codes and truststore)
- **Example:** `OTS_URL="https://tak.example.com:8080"`

### Feature Flags

#### `ITAK_HOMEPAGE_ICON_ENABLED`
- **Type:** Boolean
- **Default:** `True`
- **Description:** Show/hide iTAK download icon in Step 1
- **Frontend Impact:** Shows "Get iTAK" icon with iPhone download link
- **Example:** `ITAK_HOMEPAGE_ICON_ENABLED=True`

#### `TRUSTSTORE_HOMEPAGE_ICON_ENABLED`
- **Type:** Boolean
- **Default:** `True`
- **Description:** Show/hide TrustStore download icon in Step 1
- **Frontend Impact:** Shows "TrustStore" icon with download link
- **Example:** `TRUSTSTORE_HOMEPAGE_ICON_ENABLED=False`

#### `ZEROTIER_ICON`
- **Type:** Boolean
- **Default:** `False`
- **Description:** Show/hide ZeroTier download icon in Step 1
- **Frontend Impact:** Shows "Get Zerotier" icon with iPhone/Android links
- **Example:** `ZEROTIER_ICON=True`

#### `ENABLE_REPO`
- **Type:** Boolean
- **Default:** `False`
- **Description:** Enable repository feature (future use)
- **Example:** `ENABLE_REPO=False`

#### `ENABLE_CLAIM_RADIO`
- **Type:** Boolean
- **Default:** `False`
- **Description:** Enable radio claiming feature
- **Frontend Impact:** Shows claim radio functionality
- **Example:** `ENABLE_CLAIM_RADIO=True`

#### `FORGOT_PASSWORD_ENABLED`
- **Type:** Boolean
- **Default:** `True`
- **Description:** Enable/disable forgot password feature
- **Frontend Impact:** Shows/hides "Change Password" button
- **Example:** `FORGOT_PASSWORD_ENABLED=True`

## Frontend Integration

### React Query Usage

```javascript
import { useQuery } from '@tanstack/react-query';
import { settingsAPI } from '../services/api';

function MyComponent() {
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await settingsAPI.get();
      return response.data;
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading settings</div>;

  return (
    <div>
      <h1>{settings.brand_name}</h1>
      {settings.generate_itak_qr_code && (
        <QRCodeSection />
      )}
    </div>
  );
}
```

### Conditional Rendering Examples

#### Show/Hide iTAK Icon
```javascript
{settings?.itak_homepage_icon_enabled && (
  <div className="install-item">
    <img src={`${API_BASE_URL}/static/img/itak.jpg`} alt="iTAK" />
    <p>Get iTAK</p>
    <a href="https://apps.apple.com/app/itak/id1561656396">iPhone</a>
  </div>
)}
```

#### Show/Hide QR Code Section
```javascript
{settings?.generate_itak_qr_code && (
  <div className="step-card">
    <h2>2. Login to ATAK!</h2>
    <img src={getQRCodeURL()} alt="QR Code" />
  </div>
)}
```

#### Dynamic Step Numbering
```javascript
{/* Step number changes based on whether QR section is shown */}
<h2>{settings?.generate_itak_qr_code ? '3' : '2'}. Download Data Packages</h2>
```

#### Dynamic Colors
```javascript
const accentColor = settings?.accent_color || '#ff9800';
const primaryColor = settings?.primary_color || '#000000';

<button style={{ background: accentColor }}>
  Download
</button>

<span className="role-badge" style={{ background: primaryColor }}>
  Admin
</span>
```

## Testing the Endpoint

### cURL
```bash
curl http://localhost:5000/api/v1/settings | python -m json.tool
```

### Browser
```
http://localhost:5000/api/v1/settings
```

### Postman/Insomnia
```
GET http://localhost:5000/api/v1/settings
Headers: None required
```

## Example Response

```json
{
  "accent_color": "orange",
  "brand_name": "KGG Dutchies TAK Portal",
  "enable_claim_radio": true,
  "enable_repo": false,
  "forgot_password_enabled": true,
  "generate_itak_qr_code": true,
  "help_email": "support@example.com",
  "help_link": "https://docs.example.com/guide.pdf",
  "itak_homepage_icon_enabled": false,
  "itak_hostname": "tak.example.com",
  "logo_path": "/static/img/logo.png",
  "ots_hostname": "tak.example.com",
  "ots_url": "https://tak.example.com:8080",
  "primary_color": "#000000",
  "secondary_color": "orange",
  "truststore_homepage_icon_enabled": false,
  "zerotier_icon": false
}
```

## Implementation Details

### Backend Code
File: [app/api_v1/settings.py](../app/api_v1/settings.py)

```python
from flask import jsonify, current_app
from app.api_v1 import api_v1

@api_v1.route('/settings', methods=['GET'])
def get_settings():
    """Get public application settings"""
    settings = {
        'brand_name': current_app.config.get('BRAND_NAME', 'My OTS Portal'),
        'primary_color': current_app.config.get('PRIMARY_COLOR', '#000000'),
        'secondary_color': current_app.config.get('SECONDARY_COLOR', 'orange'),
        'accent_color': current_app.config.get('ACCENT_COLOR', 'orange'),
        'logo_path': current_app.config.get('LOGO_PATH', '/static/img/logo.png'),
        'help_link': current_app.config.get('HELP_LINK', 'https://www.google.com'),
        'help_email': current_app.config.get('HELP_EMAIL', 'help@example.nl'),
        'generate_itak_qr_code': current_app.config.get('GENERATE_ITAK_QR_CODE', True),
        'itak_hostname': current_app.config.get('ITAK_HOSTNAME', ''),
        'ots_hostname': current_app.config.get('OTS_HOSTNAME', ''),
        'ots_url': current_app.config.get('OTS_URL', ''),
        'itak_homepage_icon_enabled': current_app.config.get('ITAK_HOMEPAGE_ICON_ENABLED', True),
        'truststore_homepage_icon_enabled': current_app.config.get('TRUSTSTORE_HOMEPAGE_ICON_ENABLED', True),
        'zerotier_icon': current_app.config.get('ZEROTIER_ICON', False),
        'enable_repo': current_app.config.get('ENABLE_REPO', False),
        'enable_claim_radio': current_app.config.get('ENABLE_CLAIM_RADIO', False),
        'forgot_password_enabled': current_app.config.get('FORGOT_PASSWORD_ENABLED', True),
    }
    return jsonify(settings), 200
```

### Frontend Service
File: [frontend/src/services/api.js](../frontend/src/services/api.js)

```javascript
// Settings API
export const settingsAPI = {
  get: () => api.get('/settings'),
};
```

## Configuration Examples

### Example 1: Minimal Setup
```bash
# .env
BRAND_NAME="My TAK Portal"
OTS_URL="https://tak.example.com:8080"
HELP_EMAIL="admin@example.com"
```

Result: All other settings use defaults

### Example 2: Full Customization
```bash
# .env
BRAND_NAME="Custom TAK Portal"
PRIMARY_COLOR="#1a1a1a"
ACCENT_COLOR="#0066cc"
LOGO_PATH="/static/img/custom-logo.png"
HELP_LINK="https://docs.custom.com/guide.pdf"
HELP_EMAIL="support@custom.com"
GENERATE_ITAK_QR_CODE=True
ITAK_HOSTNAME="tak.custom.com"
OTS_HOSTNAME="tak.custom.com"
OTS_URL="https://tak.custom.com:8080"
ITAK_HOMEPAGE_ICON_ENABLED=True
TRUSTSTORE_HOMEPAGE_ICON_ENABLED=True
ZEROTIER_ICON=True
ENABLE_CLAIM_RADIO=True
FORGOT_PASSWORD_ENABLED=True
```

### Example 3: Minimal UI (No QR Codes, Few Icons)
```bash
# .env
BRAND_NAME="Simple Portal"
GENERATE_ITAK_QR_CODE=False
ITAK_HOMEPAGE_ICON_ENABLED=False
TRUSTSTORE_HOMEPAGE_ICON_ENABLED=False
ZEROTIER_ICON=False
```

Result:
- No Step 2 (Login QR)
- Only shows Meshtastic and ATAK icons
- Step 3 becomes Step 2 (renumbered)

## Troubleshooting

### Settings Not Loading

**Issue:** Frontend shows default values instead of configured values

**Solutions:**
1. Check backend is running: `curl http://localhost:5000/api/v1/settings`
2. Verify `.env` file exists and is loaded
3. Check environment variables: `printenv | grep BRAND_NAME`
4. Restart Flask server after changing `.env`

### Boolean Values Not Working

**Issue:** Boolean settings appear as integers (0/1) instead of true/false

**Solution:** This is expected - Python's `strtobool` returns 0 or 1. JavaScript treats these as falsy/truthy correctly:
```javascript
if (settings.generate_itak_qr_code) {
  // This works with both true and 1
}
```

### CORS Errors

**Issue:** Browser blocks settings request

**Solution:** Ensure CORS is configured in Flask app:
```python
from flask_cors import CORS
CORS(app)
```

### Settings Not Updating

**Issue:** Frontend shows old settings after changes

**Solutions:**
1. Clear React Query cache: `queryClient.invalidateQueries(['settings'])`
2. Hard refresh browser: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
3. Check browser console for cached responses

## Security Considerations

### Public Endpoint
This endpoint is **public** (no authentication required) because:
- Only exposes non-sensitive configuration
- No user data or secrets
- Needed before user logs in (for branding)

### What NOT to Include
**Never expose:**
- Database credentials
- API keys
- Private keys
- Internal hostnames (unless public)
- User data
- Session secrets

### Safe to Expose
**Safe to include:**
- Branding (name, colors, logo)
- Feature flags (show/hide UI elements)
- Public URLs
- Help links
- Public server hostnames

## Related Documentation

- [Frontend Dashboard Guide](./FRONTEND_DASHBOARD.md)
- [Dashboard Mobile Responsive](./DASHBOARD_MOBILE_RESPONSIVE.md)
- [Dashboard Implementation Summary](./DASHBOARD_IMPLEMENTATION_SUMMARY.md)
- [API-Only Mode](./API_ONLY_MODE.md)

---

**Last Updated:** 2025-10-16
**Endpoint:** `/api/v1/settings`
**Authentication:** None required
**Status:** ✅ Production Ready
