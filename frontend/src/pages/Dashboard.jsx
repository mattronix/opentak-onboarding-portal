import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { takProfilesAPI, meshtasticAPI, radiosAPI, settingsAPI } from '../services/api';
import { QRCodeSVG } from 'qrcode.react';
import './Dashboard.css';

function Dashboard() {
  const { user } = useAuth();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;

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

  const handleDownloadProfile = (profileId) => {
    takProfilesAPI.download(profileId);
  };

  const handleCopyQRLink = () => {
    const qrUrl = getQRCodeURL();
    if (qrUrl) {
      navigator.clipboard.writeText(qrUrl).then(() => {
        alert('QR code link copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy link. Please try again.');
      });
    }
  };

  const handleCopyMeshtasticLink = (url) => {
    navigator.clipboard.writeText(url).then(() => {
      alert('Meshtastic link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy link. Please try again.');
    });
  };

  // Get QR code URL for ATAK connection (Step 2 - large QR code)
  const getQRCodeURL = () => {
    if (!settings?.generate_itak_qr_code) return null;

    const otsURL = settings?.ots_url || API_BASE_URL.replace(':5000', ':8080');
    return `${otsURL}/Marti/api/tls/config/qr?clientUid=${user?.username || 'user'}`;
  };

  // Get iTAK QR code URL for Step 1 (small QR code with brand name)
  const getItakQRCodeURL = () => {
    if (!settings?.generate_itak_qr_code || !settings?.itak_homepage_icon_enabled) return null;

    const brandName = settings?.brand_name || 'My OTS Portal';
    const itakHostname = settings?.itak_hostname || '';

    // This should generate a QR code similar to: brand_name,hostname,8089,SSL
    // For now, we'll use the backend to generate it
    const otsURL = settings?.ots_url || API_BASE_URL.replace(':5000', ':8080');
    // The backend should have an endpoint that generates this QR code
    // For now, we can construct a data URL or use a QR code generation service
    return null; // Backend needs to provide this endpoint
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

  const brandName = settings?.brand_name || 'My OTS Portal';
  const primaryColor = settings?.primary_color || '#000000';
  const accentColor = settings?.accent_color || '#ff9800';

  return (
    <div className="dashboard" style={{ '--accent-color': accentColor }}>
      <div className="dashboard-header">
        <h1>Welcome {user?.username}</h1>
        <p className="portal-name" style={{ color: accentColor }}>{brandName}</p>
      </div>

      <div className="welcome-section">
        <h2>Welcome</h2>
        <p>
          This portal is designed to help you get your ATAK client setup and ready to use.
          If you do not have ATAK you can download it using the icons on the right, once you
          have ATAK you can download and import the profiles below.
        </p>
      </div>

      <div className="get-started-section">
        <h1>Get started with ATAK</h1>

        <div className="steps-container">
          {/* Step 1: Install ATAK */}
          <div className="step-card">
            <h2>1. Install ATAK</h2>
            <div className="install-options">
              {/* Meshtastic */}
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

              {/* ATAK */}
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
                  <a href="https://play.google.com/store/apps/details?id=com.atakmap.app.civ&hl=en" target="_blank" rel="noopener noreferrer">Android</a>
                </div>
              </div>

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
                    <a href="https://apps.apple.com/app/itak/id1561656396" target="_blank" rel="noopener noreferrer">iPhone</a>
                  </div>
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

              {/* ZeroTier - only show if enabled */}
              {settings?.zerotier_icon && (
                <div className="install-item">
                  <img
                    src={`${API_BASE_URL}/static/img/zerotier.png`}
                    alt="ZeroTier"
                    className="icon"
                    style={{ width: '100px', height: '100px' }}
                    onError={(e) => {
                      e.target.parentElement.remove();
                    }}
                  />
                  <p>Get Zerotier</p>
                  <div className="links">
                    <a href="https://apps.apple.com/us/app/zerotier-one/id1084101492" target="_blank" rel="noopener noreferrer">iPhone</a>
                    {' / '}
                    <a href="https://play.google.com/store/apps/details?id=com.zerotier.one&hl=en" target="_blank" rel="noopener noreferrer">Android</a>
                  </div>
                </div>
              )}

              {/* QR Code in Step 1 - only show if both settings are enabled */}
              {settings?.generate_itak_qr_code && settings?.itak_homepage_icon_enabled && (
                <div className="install-item qr-section">
                  {getItakQRCodeURL() && (
                    <>
                      <img
                        src={getItakQRCodeURL()}
                        alt="iTAK QR Code"
                        className="qr-code"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'block';
                        }}
                      />
                      <div style={{display: 'none'}}>
                        <p>QR Code unavailable</p>
                      </div>
                    </>
                  )}
                  <p>Scan this QR code in iTAK</p>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Login to ATAK */}
          {settings?.generate_itak_qr_code && getQRCodeURL() && (
            <div className="step-card">
              <h2>2. Login to ATAK!</h2>
              <div className="qr-login-section">
                <div className="qr-code-container">
                  <QRCodeSVG
                    value={getQRCodeURL()}
                    size={300}
                    level="H"
                    includeMargin={true}
                    className="qr-code-large"
                  />
                  <div className="tak-logo-overlay">
                    <img
                      src={getTAKIconURL()}
                      alt="TAK"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="cant-scan">
                <p>
                  Can't Scan?{' '}
                  <button
                    onClick={handleCopyQRLink}
                    className="copy-link-btn"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#007bff',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0,
                      font: 'inherit',
                      fontWeight: 500
                    }}
                  >
                    Copy Link
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Download Data Packages */}
          <div className="step-card">
            <h2>{settings?.generate_itak_qr_code ? '3' : '2'}. Download Data Packages</h2>
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
                <div className="help-section">
                  {settings?.help_link && (
                    <a href={settings.help_link} target="_blank" rel="noopener noreferrer">
                      <button className="help-btn">
                        <span>ℹ️</span> HELP / HOW TO INSTALL
                      </button>
                    </a>
                  )}
                </div>
              </>
            ) : (
              <p>No TAK profiles available.</p>
            )}
          </div>
        </div>

        {/* User Info Section */}
        <div className="user-info-section">
          <div className="info-grid">
            <div className="info-card">
              <h3>Roles</h3>
              <div className="roles-list">
                {user?.roles?.map((role) => (
                  <span key={role} className="role-badge" style={{ background: primaryColor }}>{role}</span>
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
            >
              EDIT PROFILE
            </button>
            {settings?.forgot_password_enabled && (
              <button
                className="action-btn change-password"
                style={{ background: accentColor }}
              >
                CHANGE PASSWORD
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Meshtastic Configs Section */}
      {meshtasticConfigs && meshtasticConfigs.length > 0 && (
        <div className="meshtastic-section">
          <h1>{settings?.generate_itak_qr_code ? '4' : '3'}. Meshtastic Configs</h1>
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
                        onClick={() => handleCopyMeshtasticLink(config.url)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#007bff',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          padding: 0,
                          font: 'inherit',
                          fontWeight: 500
                        }}
                      >
                        Copy Link
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
