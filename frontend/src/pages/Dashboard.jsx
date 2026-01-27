import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { takProfilesAPI, meshtasticAPI, radiosAPI, settingsAPI, qrAPI } from '../services/api';
import { QRCodeSVG } from 'qrcode.react';
import './Dashboard.css';

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
  const [copiedMeshtastic, setCopiedMeshtastic] = useState(null);

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await settingsAPI.get();
      return response.data;
    },
  });

  const { data: takProfiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ['takProfiles'],
    queryFn: async () => {
      const response = await takProfilesAPI.getAll();
      return response.data.profiles;
    },
  });

  const { data: meshtasticConfigs, isLoading: loadingMeshtastic } = useQuery({
    queryKey: ['meshtastic'],
    queryFn: async () => {
      const response = await meshtasticAPI.getAll();
      return response.data.configs;
    },
  });

  const { data: radios, isLoading: loadingRadios } = useQuery({
    queryKey: ['radios'],
    queryFn: async () => {
      const response = await radiosAPI.getAll();
      return response.data.radios;
    },
  });

  // Fetch ATAK QR string from backend (polls every 10s to check usage)
  const { data: atakQrData, isLoading: loadingAtakQR, isFetching: fetchingAtakQR, error: atakError } = useQuery({
    queryKey: ['atakQR', user?.username],
    queryFn: async () => {
      const response = await qrAPI.getAtakQRString();
      return response.data;
    },
    enabled: !!settings?.generate_atak_qr_code && !!user,
    staleTime: 5000, // Consider data fresh for 5 seconds
    retry: false,
    refetchInterval: 10000, // Poll every 10 seconds to check if token was used
    refetchIntervalInBackground: false, // Don't poll when tab is not active
    placeholderData: (prev) => prev, // Keep previous data during refetch to prevent flickering
  });

  // Fetch iTAK QR string from backend (no polling - iTAK doesn't have usage tracking)
  const { data: itakQrData, isLoading: loadingItakQR, error: itakError } = useQuery({
    queryKey: ['itakQR', user?.username],
    queryFn: async () => {
      const response = await qrAPI.getItakQRString();
      return response.data;
    },
    enabled: !!user,
    staleTime: Infinity, // iTAK connection strings don't change
    retry: false,
  });

  const handleDownloadProfile = (profileId) => {
    takProfilesAPI.download(profileId);
  };

  const handleOpenAtakLink = () => {
    if (atakQrData?.qr_string) {
      window.location.href = atakQrData.qr_string;
    }
  };

  const handleRefreshAtakQR = async () => {
    try {
      // Force refresh by calling API with refresh=true
      await qrAPI.getAtakQRString(true);
      // Then invalidate to refetch with new data
      queryClient.invalidateQueries(['atakQR']);
    } catch (err) {
      console.error('Failed to refresh ATAK QR:', err);
      queryClient.invalidateQueries(['atakQR']);
    }
  };


  const handleCopyMeshtasticLink = (url, configId) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedMeshtastic(configId);
      setTimeout(() => setCopiedMeshtastic(null), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  // Format expiry time
  const formatExpiry = (expiresAt) => {
    if (!expiresAt) return null;
    const expiryDate = new Date(expiresAt * 1000);
    const now = new Date();
    const diffMs = expiryDate - now;

    if (diffMs <= 0) return 'Expired';

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;

    if (diffHours > 0) {
      return `${diffHours}h ${remainingMins}m`;
    }
    return `${diffMins}m`;
  };

  // Get logo URL from backend static
  const getLogoURL = () => {
    if (settings?.logo_path) {
      return `${API_BASE_URL}${settings.logo_path}`;
    }
    return `${API_BASE_URL}/static/img/logo.png`;
  };

  // Get TAK icon from backend
  const getTAKIconURL = () => {
    return `${API_BASE_URL}/static/img/atak.png`;
  };

  // Get iTAK icon from backend
  const getItakIconURL = () => {
    return `${API_BASE_URL}/static/img/itak.jpg`;
  };

  const brandName = settings?.brand_name || 'My OTS Portal';
  const primaryColor = settings?.primary_color || '#000000';
  const accentColor = settings?.accent_color || '#ff9800';

  // Check if any QR code is enabled
  const hasAnyQRCode = settings?.generate_atak_qr_code;

  return (
    <div className="dashboard" style={{ '--accent-color': accentColor }}>
      <div className="dashboard-header">
        <h1>Welcome, {user?.callsign || user?.username}</h1>
        <p className="portal-name" style={{ color: accentColor }}>{brandName}</p>
      </div>

      {/* User Info Section - moved to top */}
      <div className="user-info-section">
        <div className="info-grid">
          <div className="info-card">
            <h3>Roles</h3>
            <div className="roles-list">
              {user?.roles?.map((role) => (
                <span key={role.name || role} className="role-badge" style={{ background: primaryColor }}>
                  {role.displayName || role.name || role}
                </span>
              )) || <span className="role-badge" style={{ background: primaryColor }}>user</span>}
            </div>
          </div>

          <div className="info-card">
            <h3>Assigned Radios</h3>
            {loadingRadios ? (
              <p>Loading...</p>
            ) : radios && radios.length > 0 ? (
              <div className="radios-list">
                {radios.filter(r => r.assignedTo === user?.id).map((radio) => (
                  <span key={radio.id} className="radio-badge">
                    {radio.name} ({radio.platform})
                  </span>
                ))}
                {radios.filter(r => r.assignedTo === user?.id).length === 0 && (
                  <p className="no-items">No radios assigned</p>
                )}
              </div>
            ) : (
              <p className="no-items">No radios assigned</p>
            )}
          </div>
        </div>

        <div className="action-buttons">
          <button
            className="action-btn edit-profile"
            style={{ background: accentColor }}
            onClick={() => navigate('/edit-profile')}
          >
            EDIT PROFILE
          </button>
          <button
            className="action-btn change-password"
            style={{ background: accentColor }}
            onClick={() => navigate('/change-password')}
          >
            CHANGE PASSWORD
          </button>
        </div>
      </div>

      <div className="welcome-section">
        <div className="welcome-text">
          <p>
            This portal is designed to help you get your ATAK client setup and ready to use.
            If you do not have ATAK you can download it using the icons below, once you
            have ATAK you can download and import the profiles.
          </p>
        </div>
      </div>

      <div className="get-started-section">
        <h1>Get started with ATAK</h1>

        <div className="steps-container">
          {/* Step 1: Install ATAK */}
          <div className="step-card">
            <h2>1. Install ATAK</h2>
            <div className="install-options">
              {/* Meshtastic - only show if enabled */}
              {settings && settings.meshtastic_homepage_icon_enabled === true && (
                <div className="install-item">
                  <img
                    src={`${API_BASE_URL}/static/img/meshtastic.png`}
                    alt="Meshtastic"
                    className="icon"
                    style={{ width: '100px', height: '100px' }}
                    onError={(e) => {
                      e.target.parentElement.remove();
                    }}
                  />
                  <p>Get Meshtastic</p>
                  <div className="links">
                    <a href="https://apps.apple.com/in/app/meshtastic/id1586432531" target="_blank" rel="noopener noreferrer">iPhone</a>
                    {' / '}
                    <a href="https://play.google.com/store/apps/details?id=com.geeksville.mesh&hl=en" target="_blank" rel="noopener noreferrer">Android</a>
                  </div>
                </div>
              )}

              {/* ATAK - only show if enabled */}
              {settings?.atak_homepage_icon_enabled && (
                <div className="install-item">
                  <img
                    src={`${API_BASE_URL}/static/img/atak.png`}
                    alt="ATAK"
                    className="icon"
                    style={{ width: '100px', height: '100px' }}
                    onError={(e) => {
                      e.target.parentElement.remove();
                    }}
                  />
                  <p>Get ATAK</p>
                  <div className="links">
                    <a href={settings?.atak_installer_qr_url || "https://play.google.com/store/apps/details?id=com.atakmap.app.civ&hl=en"} target="_blank" rel="noopener noreferrer">Android</a>
                  </div>
                  {settings?.atak_installer_qr_enabled && settings?.atak_installer_qr_url && (
                    <div className="installer-qr">
                      <QRCodeSVG
                        value={settings.atak_installer_qr_url}
                        size={80}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* iTAK - only show if enabled */}
              {settings?.itak_homepage_icon_enabled && (
                <div className="install-item">
                  <img
                    src={`${API_BASE_URL}/static/img/itak.jpg`}
                    alt="iTAK"
                    className="icon"
                    style={{ width: '100px', height: '100px' }}
                    onError={(e) => {
                      e.target.parentElement.remove();
                    }}
                  />
                  <p>Get iTAK</p>
                  <div className="links">
                    <a href={settings?.itak_installer_qr_url || "https://apps.apple.com/app/itak/id1561656396"} target="_blank" rel="noopener noreferrer">iPhone</a>
                  </div>
                  {settings?.itak_installer_qr_enabled && settings?.itak_installer_qr_url && (
                    <div className="installer-qr">
                      <QRCodeSVG
                        value={settings.itak_installer_qr_url}
                        size={80}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* TrustStore - only show if enabled */}
              {settings?.truststore_homepage_icon_enabled && (
                <div className="install-item">
                  <img
                    src={`${API_BASE_URL}/static/img/certificate.png`}
                    alt="TrustStore"
                    className="icon"
                    style={{ width: '100px', height: '100px' }}
                    onError={(e) => {
                      e.target.parentElement.remove();
                    }}
                  />
                  <p>TrustStore</p>
                  <div className="links">
                    <a href={`${settings?.ots_url || API_BASE_URL.replace(':5000', ':8080')}/api/truststore`} target="_blank" rel="noopener noreferrer">Download</a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Login to ATAK/iTAK */}
          {hasAnyQRCode && (
            <div className="step-card">
              <h2>2. Login to ATAK/iTAK</h2>
              <div className="qr-codes-grid">
                {/* ATAK QR Code */}
                {settings?.generate_atak_qr_code && (
                  <div className="qr-code-section">
                    <h3 className="qr-label">ATAK (Android)</h3>
                    {loadingAtakQR ? (
                      <div className="qr-loading">Loading QR code...</div>
                    ) : atakError ? (
                      <div className="qr-error">
                        <p>Failed to load ATAK QR code</p>
                        <button
                          onClick={handleRefreshAtakQR}
                          className="refresh-btn"
                          style={{ background: accentColor }}
                        >
                          Retry
                        </button>
                      </div>
                    ) : atakQrData?.qr_string ? (
                      <>
                        <div className="qr-code-container">
                          <QRCodeSVG
                            value={atakQrData.qr_string}
                            size={250}
                            level="H"
                            includeMargin={true}
                            className="qr-code-large"
                          />
                          <div className="tak-logo-overlay">
                            <img
                              src={getTAKIconURL()}
                              alt="ATAK"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        </div>
                        <div className="qr-info">
                          {(atakQrData.expires_at || atakQrData.max_uses != null) && (
                            <p className="expiry-info">
                              {atakQrData.expires_at && (
                                <>Expires in: <strong>{formatExpiry(atakQrData.expires_at)}</strong></>
                              )}
                              {atakQrData.max_uses != null && (
                                <>{atakQrData.expires_at ? ' | ' : ''}Uses: <strong>{atakQrData.total_uses ?? 0}/{atakQrData.max_uses}</strong></>
                              )}
                            </p>
                          )}
                          <div className="qr-actions">
                            <button
                              onClick={handleRefreshAtakQR}
                              className="refresh-btn"
                              disabled={fetchingAtakQR}
                              style={{ background: accentColor }}
                            >
                              {fetchingAtakQR ? 'Refreshing...' : 'Refresh Code'}
                            </button>
                            <button
                              onClick={handleOpenAtakLink}
                              className="open-btn"
                              style={{ background: accentColor }}
                            >
                              Open in ATAK
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="qr-error">
                        <p>QR code not available</p>
                        <button
                          onClick={handleRefreshAtakQR}
                          className="refresh-btn"
                          style={{ background: accentColor }}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* iTAK QR Code - no expiry/usage tracking, no refresh needed */}
                <div className="qr-code-section">
                  <h3 className="qr-label">iTAK (iOS)</h3>
                  {loadingItakQR ? (
                    <div className="qr-loading">Loading QR code...</div>
                  ) : itakError ? (
                    <div className="qr-error">
                      <p>Failed to load iTAK QR code</p>
                      <small>Your OTS server may not support iTAK enrollment</small>
                    </div>
                  ) : itakQrData?.qr_string ? (
                    <>
                      <div className="qr-code-container">
                        <QRCodeSVG
                          value={itakQrData.qr_string}
                          size={250}
                          level="H"
                          includeMargin={true}
                          className="qr-code-large"
                        />
                        <div className="tak-logo-overlay">
                          <img
                            src={getItakIconURL()}
                            alt="iTAK"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="qr-error">
                      <p>QR code not available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Download Data Packages */}
          <div className="step-card">
            <h2>{hasAnyQRCode ? '3' : '2'}. Download Data Packages</h2>
            {loadingProfiles ? (
              <p>Loading...</p>
            ) : takProfiles && takProfiles.length > 0 ? (
              <>
                <table className="packages-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {takProfiles.map((profile) => (
                      <tr key={profile.id}>
                        <td>{profile.name}</td>
                        <td>{profile.description || 'TAK Profile'}</td>
                        <td>
                          <button
                            className="download-btn"
                            onClick={() => handleDownloadProfile(profile.id)}
                            style={{ background: accentColor }}
                          >
                            DOWNLOAD
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p>No TAK profiles available.</p>
            )}
          </div>
        </div>
      </div>

      {/* Meshtastic Configs Section */}
      {meshtasticConfigs && meshtasticConfigs.length > 0 && (
        <div className="meshtastic-section">
          <h1>{hasAnyQRCode ? '4' : '3'}. Meshtastic Configs</h1>
          <div className="meshtastic-grid">
            {meshtasticConfigs.map((config) => (
              <div key={config.id} className="config-card">
                <h3>{config.name}</h3>
                {config.url && (
                  <div className="qr-section" style={{ marginBottom: '1rem' }}>
                    <QRCodeSVG
                      value={config.url}
                      size={200}
                      level="H"
                      includeMargin={true}
                      className="qr-code"
                      imageSettings={{
                        src: `${API_BASE_URL}/static/img/meshtastic.png`,
                        height: 40,
                        width: 40,
                        excavate: true,
                      }}
                    />
                  </div>
                )}
                <p>{config.description}</p>
                {config.url && (
                  <>
                    <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid #ddd' }} />
                    <p style={{ fontSize: '0.9rem', color: '#666' }}>
                      Can't Scan?{' '}
                      <button
                        onClick={() => handleCopyMeshtasticLink(config.url, config.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copiedMeshtastic === config.id ? '#28a745' : '#007bff',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          padding: 0,
                          font: 'inherit',
                          fontWeight: 500
                        }}
                      >
                        {copiedMeshtastic === config.id ? 'Copied!' : 'Copy Link'}
                      </button>
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
