# Frontend Dashboard Implementation

## Overview

Complete redesign of the user dashboard to match the original OTS Portal design, featuring a step-by-step onboarding flow with QR codes, download links, and user information cards. **Fully responsive and mobile-friendly** for devices from 320px to 1400px+.

## Features Implemented

### ✅ Dashboard Components

1. **Welcome Header**
   - User greeting with username
   - Portal branding (My OTS Portal)

2. **Welcome Section**
   - Informational text about portal usage
   - Instructions for getting started

3. **Step 1: Install ATAK**
   - Meshtastic app links (iPhone/Android)
   - ATAK app link (Android)
   - QR code for iTAK configuration
   - Custom icons and styling

4. **Step 2: Login to ATAK**
   - Large QR code for easy scanning
   - TAK logo overlay
   - "Can't Scan?" link for manual connection
   - Fallback messaging if QR unavailable

5. **Step 3: Download Data Packages**
   - Table of TAK profiles with descriptions
   - Download buttons for each profile
   - Help/How to Install button
   - Proper filename handling with callsign

6. **User Info Cards**
   - User roles display with badges
   - Assigned radios list
   - Edit Profile button
   - Change Password button

7. **Step 4: Meshtastic Configs** (if available)
   - Grid layout of configurations
   - Download links for each config

## File Structure

```
frontend/src/pages/
├── Dashboard.jsx        # Main dashboard component
└── Dashboard.css        # Dashboard styling
```

## Key Features

### QR Code Integration

The dashboard generates QR codes dynamically based on the user's session:

```javascript
const getQRCodeURL = () => {
  const baseURL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
  const otsURL = baseURL.replace(':5000', ':8080'); // OTS typically on port 8080
  return `${otsURL}/Marti/api/tls/config/qr?clientUid=${user?.username || 'user'}`;
};
```

### Download with JWT Token

TAK profile downloads use the fixed query parameter authentication:

```javascript
const handleDownloadProfile = (profileId) => {
  takProfilesAPI.download(profileId);
};
```

The API service automatically includes the JWT token in the download request.

### Responsive Design

The dashboard is **fully mobile-responsive** with comprehensive breakpoints:
- **Desktop (>1024px):** 3-column layout for steps, 2-column info grid
- **Tablet (768-1024px):** 2-column layout for steps
- **Mobile (<768px):** Single column stack, full-width buttons
- **Small mobile (<480px):** Optimized spacing and smaller images

See [DASHBOARD_MOBILE_RESPONSIVE.md](./DASHBOARD_MOBILE_RESPONSIVE.md) for complete responsive design documentation.

### Error Handling

QR codes include fallback messages if the OTS server is unavailable:

```jsx
<img
  src={getQRCodeURL()}
  alt="QR Code"
  onError={(e) => {
    e.target.style.display = 'none';
    e.target.nextSibling.style.display = 'block';
  }}
/>
<div style={{display: 'none'}}>
  <p>QR Code unavailable</p>
</div>
```

## Styling

### Color Scheme

- **Primary**: Orange (#ff9800, #f57c00)
- **Secondary**: Black (#333)
- **Background**: Light gray (#f5f5f5)
- **Cards**: White with subtle shadows

### Component Styles

- **Badges**: Rounded pills for roles and radios
- **Buttons**: Orange theme with hover effects
- **Cards**: White backgrounds with box-shadow
- **Tables**: Clean borders with alternating row colors

## Configuration

### Environment Variables

Add to `.env`:
```
VITE_API_BASE_URL=http://localhost:5000
```

### API Base URL

The dashboard automatically detects the API base URL and constructs OTS URLs for QR codes.

## Usage

### Basic Flow

1. User logs in → Dashboard loads
2. User sees step-by-step instructions
3. User scans QR code to configure ATAK
4. User downloads TAK profiles
5. User imports profiles into ATAK

### Admin vs Regular User

The dashboard adapts based on user roles:
- All users see their assigned TAK profiles
- All users see their assigned radios
- Admin users see "administrator" badge

## API Integration

### Endpoints Used

```javascript
// Get all TAK profiles
takProfilesAPI.getAll()

// Download specific profile
takProfilesAPI.download(profileId)

// Get Meshtastic configurations
meshtasticAPI.getAll()

// Get assigned radios
radiosAPI.getAll()
```

### Query Parameters

The dashboard uses React Query for efficient data fetching:

```javascript
const { data: takProfiles, isLoading: loadingProfiles } = useQuery({
  queryKey: ['takProfiles'],
  queryFn: async () => {
    const response = await takProfilesAPI.getAll();
    return response.data.profiles;
  },
});
```

## Assets Required

The dashboard expects these assets in `/public`:

- `/tak-icon.png` - TAK logo for display and overlay

If assets are missing, the dashboard will show placeholder icons.

## Future Enhancements

### Potential Improvements

1. **Profile Selection**
   - Allow users to select which profiles to download
   - Bulk download multiple profiles

2. **Installation Guide**
   - Modal with step-by-step instructions
   - Screenshots and videos

3. **Status Indicators**
   - Show if user has downloaded profiles
   - Track ATAK connection status

4. **Customization**
   - Allow branding customization via config
   - Theme selection (light/dark mode)

5. **Help System**
   - Integrated tooltips
   - FAQ section
   - Support chat

6. **Mobile Optimization**
   - Native app feel on mobile
   - Touch-optimized controls

## Troubleshooting

### QR Codes Not Loading

**Issue**: QR codes show "QR Code unavailable"

**Solutions**:
1. Check OTS server is running on port 8080
2. Verify OTS_URL in backend .env
3. Check CORS settings allow requests from frontend
4. Check browser console for network errors

### Downloads Not Working

**Issue**: "Failed to download profile" error

**Solutions**:
1. Verify JWT token is valid (check localStorage)
2. Check API_ONLY_MODE is set correctly
3. Verify TAK profile files exist on server
4. Check backend logs for specific error

### Styling Issues

**Issue**: Dashboard looks broken or unstyled

**Solutions**:
1. Ensure Dashboard.css is being imported
2. Clear browser cache and reload
3. Check for CSS conflicts with other stylesheets
4. Verify Vite build is including CSS

## Testing

### Manual Testing Checklist

- [ ] Dashboard loads without errors
- [ ] User greeting shows correct username
- [ ] QR codes display (or show fallback)
- [ ] TAK profiles list displays
- [ ] Download buttons work
- [ ] User roles display correctly
- [ ] Assigned radios display
- [ ] All links open correctly
- [ ] Responsive design works on mobile
- [ ] Help button is visible

### Browser Compatibility

Tested on:
- Chrome 120+
- Firefox 120+
- Safari 17+
- Edge 120+

## Related Documentation

- [Dashboard Mobile Responsive Design](./DASHBOARD_MOBILE_RESPONSIVE.md) - Complete mobile/responsive guide
- [API-Only Mode](./API_ONLY_MODE.md) - API-only mode configuration
- [API Test Results](./API_TEST_RESULTS_FINAL.md) - Test suite results
- [JWT Query Parameter Fix](./JWT_QUERY_PARAMETER_FIX.md) - Download authentication fix
- [TAK Profile Download Fixes](./TAK_PROFILE_DOWNLOAD_FIXES.md) - Profile download implementation
