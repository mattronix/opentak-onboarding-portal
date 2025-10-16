# Settings Flow Diagram

Visual representation of how settings flow from environment variables to the frontend UI.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ENVIRONMENT VARIABLES                        │
│                              (.env file)                             │
├─────────────────────────────────────────────────────────────────────┤
│  BRAND_NAME="My Portal"                                             │
│  PRIMARY_COLOR="#000000"                                            │
│  ACCENT_COLOR="orange"                                              │
│  GENERATE_ITAK_QR_CODE=True                                         │
│  ITAK_HOMEPAGE_ICON_ENABLED=True                                    │
│  TRUSTSTORE_HOMEPAGE_ICON_ENABLED=True                              │
│  ZEROTIER_ICON=False                                                │
│  FORGOT_PASSWORD_ENABLED=True                                       │
│  ... and more ...                                                   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ Loaded by Flask
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         FLASK APPLICATION                            │
│                        (app/settings.py)                            │
├─────────────────────────────────────────────────────────────────────┤
│  class Config:                                                      │
│      BRAND_NAME = environ.get('BRAND_NAME', 'My OTS Portal')       │
│      PRIMARY_COLOR = environ.get('PRIMARY_COLOR', '#000000')       │
│      ACCENT_COLOR = environ.get('ACCENT_COLOR', 'orange')          │
│      ...                                                            │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ Exposed via API
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       SETTINGS API ENDPOINT                          │
│                    (app/api_v1/settings.py)                         │
├─────────────────────────────────────────────────────────────────────┤
│  GET /api/v1/settings                                               │
│                                                                     │
│  @api_v1.route('/settings', methods=['GET'])                       │
│  def get_settings():                                                │
│      return jsonify({                                               │
│          'brand_name': current_app.config.get('BRAND_NAME'),       │
│          'primary_color': current_app.config.get('PRIMARY_COLOR'), │
│          'accent_color': current_app.config.get('ACCENT_COLOR'),   │
│          'generate_itak_qr_code': current_app.config.get(...),     │
│          ...                                                        │
│      })                                                             │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ HTTP GET Request
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       FRONTEND API SERVICE                           │
│                   (frontend/src/services/api.js)                    │
├─────────────────────────────────────────────────────────────────────┤
│  export const settingsAPI = {                                       │
│    get: () => api.get('/settings')                                  │
│  };                                                                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ React Query
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      REACT COMPONENT                                 │
│                  (frontend/src/pages/Dashboard.jsx)                 │
├─────────────────────────────────────────────────────────────────────┤
│  const { data: settings } = useQuery({                              │
│    queryKey: ['settings'],                                          │
│    queryFn: async () => {                                           │
│      const response = await settingsAPI.get();                      │
│      return response.data;                                          │
│    }                                                                │
│  });                                                                │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ Conditional Rendering
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            USER INTERFACE                            │
└─────────────────────────────────────────────────────────────────────┘
```

## Settings Impact on UI

### Step 1: Install ATAK

```
┌──────────────────────────────────────────────────────────────┐
│                    1. Install ATAK                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐               │
│  │ Meshtast │   │   ATAK   │   │   iTAK   │               │
│  │   Always │   │  Always  │   │ Conditnl │               │
│  └──────────┘   └──────────┘   └──────────┘               │
│                                      ▲                       │
│                                      │                       │
│                         ITAK_HOMEPAGE_ICON_ENABLED          │
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐               │
│  │TrustStore│   │ ZeroTier │   │ iTAK QR  │               │
│  │ Conditnl │   │ Conditnl │   │ Conditnl │               │
│  └──────────┘   └──────────┘   └──────────┘               │
│       ▲              ▲               ▲                       │
│       │              │               │                       │
│  TRUSTSTORE_    ZEROTIER_ICON   GENERATE_ITAK_QR_CODE      │
│  HOMEPAGE_                       && ITAK_HOMEPAGE_           │
│  ICON_ENABLED                    ICON_ENABLED                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Step 2: Login to ATAK (Conditional)

```
┌──────────────────────────────────────────────────────────────┐
│             2. Login to ATAK! (Optional)                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│              ┌─────────────────┐                            │
│              │                 │                            │
│              │   Large QR Code │                            │
│              │   with TAK Logo │                            │
│              │                 │                            │
│              └─────────────────┘                            │
│                                                              │
│            Can't Scan? Copy/Click Link                      │
│                                                              │
│  This entire step shows only if:                            │
│  GENERATE_ITAK_QR_CODE=True                                 │
│                                                              │
│  If False:                                                  │
│    - This step is hidden                                    │
│    - Next step renumbered from "3" to "2"                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Step 3/2: Download Data Packages

```
┌──────────────────────────────────────────────────────────────┐
│        {QR ? '3' : '2'}. Download Data Packages              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Name       │ Description      │ Download          │     │
│  ├────────────────────────────────────────────────────┤     │
│  │ Profile 1  │ Main profile     │ [DOWNLOAD]        │     │
│  │ Profile 2  │ Backup profile   │ [DOWNLOAD]        │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  [HELP / HOW TO INSTALL]                                    │
│          ▲                                                   │
│          │                                                   │
│      HELP_LINK                                              │
│                                                              │
│  Step numbering depends on:                                 │
│    GENERATE_ITAK_QR_CODE=True  → "3. Download..."          │
│    GENERATE_ITAK_QR_CODE=False → "2. Download..."          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### User Info Section

```
┌──────────────────────────────────────────────────────────────┐
│                        User Info                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Roles:                                                      │
│    ┌──────────────┐ ┌──────────────┐                       │
│    │ Administrator│ │     User     │                       │
│    └──────────────┘ └──────────────┘                       │
│          ▲                                                   │
│          │                                                   │
│    PRIMARY_COLOR                                            │
│                                                              │
│  Assigned Radios:                                           │
│    Radio 1 (SHORT1)  Radio 2 (SHORT2)                      │
│                                                              │
│  ┌──────────────────┐  ┌─────────────────────┐            │
│  │  EDIT PROFILE    │  │  CHANGE PASSWORD    │            │
│  └──────────────────┘  └─────────────────────┘            │
│           ▲                       ▲                         │
│           │                       │                         │
│      ACCENT_COLOR    FORGOT_PASSWORD_ENABLED               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow Sequence

```
User Opens Dashboard
        │
        ▼
Component Mounts
        │
        ▼
React Query Triggers
        │
        ▼
settingsAPI.get()
        │
        ▼
HTTP GET /api/v1/settings
        │
        ▼
Flask Endpoint Handler
        │
        ▼
Read current_app.config
        │
        ▼
Build JSON Response
        │
        ▼
Return to Frontend
        │
        ▼
React Query Caches Data
        │
        ▼
Component Receives Settings
        │
        ▼
Conditional Rendering
        │
        ├─► Show/Hide iTAK Icon
        ├─► Show/Hide TrustStore Icon
        ├─► Show/Hide ZeroTier Icon
        ├─► Show/Hide QR Code Step
        ├─► Adjust Step Numbering
        ├─► Apply Colors (buttons, badges)
        ├─► Show/Hide Change Password
        └─► Display Brand Name
```

## Configuration Examples

### Example 1: Full Features

```bash
# .env
GENERATE_ITAK_QR_CODE=True
ITAK_HOMEPAGE_ICON_ENABLED=True
TRUSTSTORE_HOMEPAGE_ICON_ENABLED=True
ZEROTIER_ICON=True
FORGOT_PASSWORD_ENABLED=True
```

**Result:**
```
Step 1: Meshtastic, ATAK, iTAK, TrustStore, ZeroTier, iTAK QR
Step 2: Large Login QR Code
Step 3: Download Packages
User Profile: Edit Profile + Change Password buttons
```

### Example 2: Minimal Setup

```bash
# .env
GENERATE_ITAK_QR_CODE=False
ITAK_HOMEPAGE_ICON_ENABLED=False
TRUSTSTORE_HOMEPAGE_ICON_ENABLED=False
ZEROTIER_ICON=False
FORGOT_PASSWORD_ENABLED=False
```

**Result:**
```
Step 1: Meshtastic, ATAK only
Step 2: Download Packages (renumbered from 3)
User Profile: Edit Profile button only
```

### Example 3: TAK-Only

```bash
# .env
GENERATE_ITAK_QR_CODE=True
ITAK_HOMEPAGE_ICON_ENABLED=True
TRUSTSTORE_HOMEPAGE_ICON_ENABLED=True
ZEROTIER_ICON=False  # No ZeroTier
FORGOT_PASSWORD_ENABLED=True
```

**Result:**
```
Step 1: Meshtastic, ATAK, iTAK, TrustStore, iTAK QR
Step 2: Large Login QR Code
Step 3: Download Packages
User Profile: Edit Profile + Change Password buttons
```

## Update Flow

When environment variables change:

```
1. Update .env file
        ↓
2. Restart Flask server
        ↓
3. Flask loads new config
        ↓
4. Frontend makes new request
        ↓
5. Gets updated settings
        ↓
6. UI updates automatically
```

**Note:** Frontend caches settings, so users may need to refresh the page to see changes.

## Related Documentation

- [Settings API Endpoint](./SETTINGS_API_ENDPOINT.md) - Complete API documentation
- [Frontend Dashboard Guide](./FRONTEND_DASHBOARD.md) - Dashboard implementation
- [Dashboard Implementation Summary](./DASHBOARD_IMPLEMENTATION_SUMMARY.md) - Full summary

---

**Last Updated:** 2025-10-16
**Status:** ✅ Production Ready
