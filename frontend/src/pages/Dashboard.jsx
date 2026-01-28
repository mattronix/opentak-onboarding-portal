import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { takProfilesAPI, meshtasticAPI, meshtasticGroupsAPI, radiosAPI, settingsAPI, qrAPI } from '../services/api';
import { QRCodeSVG } from 'qrcode.react';
import { meshtasticSerial } from '../services/meshtasticSerial';
import ProgramRadioModal from '../components/ProgramRadioModal';
import './Dashboard.css';

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
  const [copiedMeshtastic, setCopiedMeshtastic] = useState(null);
  const [expandedSteps, setExpandedSteps] = useState(new Set([0])); // First step expanded by default
  const [programmingRadio, setProgrammingRadio] = useState(null);

  // Step expansion helpers
  const toggleStep = (stepIndex) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepIndex)) {
        newSet.delete(stepIndex);
      } else {
        newSet.add(stepIndex);
      }
      return newSet;
    });
  };

  const collapseAll = () => {
    setExpandedSteps(new Set());
  };

  const expandAll = (totalSteps) => {
    setExpandedSteps(new Set(Array.from({ length: totalSteps }, (_, i) => i)));
  };

  const goToNextStep = (currentIndex, totalSteps) => {
    if (currentIndex < totalSteps - 1) {
      setExpandedSteps(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentIndex);
        newSet.add(currentIndex + 1);
        return newSet;
      });
      setTimeout(() => {
        const nextStep = document.querySelector(`[data-step-index="${currentIndex + 1}"]`);
        if (nextStep) {
          nextStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await settingsAPI.get();
      return response.data;
    },
  });

  const { data: takProfiles } = useQuery({
    queryKey: ['takProfiles'],
    queryFn: async () => {
      const response = await takProfilesAPI.getAll();
      return response.data.profiles;
    },
  });

  const { data: meshtasticConfigs = [] } = useQuery({
    queryKey: ['dashboardMeshtastic'],
    queryFn: async () => {
      try {
        const response = await meshtasticAPI.getAll();
        return response.data?.configs || [];
      } catch (err) {
        console.error('Failed to fetch meshtastic configs:', err);
        return [];
      }
    },
    retry: false,
    placeholderData: [],
  });

  const { data: meshtasticGroups = [] } = useQuery({
    queryKey: ['dashboardMeshtasticGroups'],
    queryFn: async () => {
      try {
        const response = await meshtasticGroupsAPI.getAll();
        return response.data?.groups || [];
      } catch (err) {
        console.error('Failed to fetch meshtastic groups:', err);
        return [];
      }
    },
    retry: false,
    placeholderData: [],
  });

  const { data: radios, isLoading: loadingRadios } = useQuery({
    queryKey: ['radios'],
    queryFn: async () => {
      const response = await radiosAPI.getAll();
      return response.data.radios;
    },
  });

  const { data: atakQrData, isLoading: loadingAtakQR, isFetching: fetchingAtakQR, error: atakError } = useQuery({
    queryKey: ['atakQR', user?.username],
    queryFn: async () => {
      const response = await qrAPI.getAtakQRString();
      return response.data;
    },
    enabled: !!settings?.generate_atak_qr_code && !!user,
    staleTime: 5000,
    retry: false,
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    placeholderData: (prev) => prev,
  });

  const { data: itakQrData, isLoading: loadingItakQR, error: itakError } = useQuery({
    queryKey: ['itakQR', user?.username],
    queryFn: async () => {
      const response = await qrAPI.getItakQRString();
      return response.data;
    },
    enabled: !!user,
    staleTime: Infinity,
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
      await qrAPI.getAtakQRString(true);
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

  const getTAKIconURL = () => `${API_BASE_URL}/static/img/atak.png`;
  const getItakIconURL = () => `${API_BASE_URL}/static/img/itak.jpg`;

  const brandName = settings?.brand_name || 'My OTS Portal';
  const primaryColor = settings?.primary_color || '#000000';
  const accentColor = settings?.accent_color || '#ff9800';
  const hasAnyQRCode = settings?.generate_atak_qr_code || settings?.generate_itak_qr_code;

  const getCallsignQRUrl = () => {
    const callsign = user?.callsign || user?.username || '';
    return `tak://com.atakmap.app/preference?key1=locationCallsign&type1=string&value1=${encodeURIComponent(callsign)}`;
  };

  const handleOpenCallsignLink = () => {
    window.location.href = getCallsignQRUrl();
  };

  // Build steps array dynamically based on what's enabled
  const steps = [];
  let stepIndex = 0;

  // Step 1: Install Apps (always shown)
  steps.push({
    index: stepIndex++,
    title: 'Install Apps',
    content: (
      <div className="install-options">
        {settings?.meshtastic_homepage_icon_enabled && (
          <div className="install-item">
            <img src={`${API_BASE_URL}/static/img/meshtastic.png`} alt="Meshtastic" className="icon" style={{ width: '100px', height: '100px' }} onError={(e) => { e.target.parentElement.remove(); }} />
            <p>Get Meshtastic</p>
            <div className="links">
              {settings?.meshtastic_installer_qr_android_enabled && (
                <a href={settings?.meshtastic_installer_qr_android_url || "https://play.google.com/store/apps/details?id=com.geeksville.mesh"} target="_blank" rel="noopener noreferrer">Android</a>
              )}
              {settings?.meshtastic_installer_qr_android_enabled && settings?.meshtastic_installer_qr_iphone_enabled && ' | '}
              {settings?.meshtastic_installer_qr_iphone_enabled && (
                <a href={settings?.meshtastic_installer_qr_iphone_url || "https://apps.apple.com/app/meshtastic/id1586432531"} target="_blank" rel="noopener noreferrer">iPhone</a>
              )}
            </div>
            <div className="installer-qr-group">
              {settings?.meshtastic_installer_qr_android_enabled && settings?.meshtastic_installer_qr_android_url && (
                <div className="installer-qr">
                  <span className="qr-platform-label">Android</span>
                  <QRCodeSVG value={settings.meshtastic_installer_qr_android_url} size={80} level="M" />
                </div>
              )}
              {settings?.meshtastic_installer_qr_iphone_enabled && settings?.meshtastic_installer_qr_iphone_url && (
                <div className="installer-qr">
                  <span className="qr-platform-label">iPhone</span>
                  <QRCodeSVG value={settings.meshtastic_installer_qr_iphone_url} size={80} level="M" />
                </div>
              )}
            </div>
          </div>
        )}
        {settings?.atak_homepage_icon_enabled && (
          <div className="install-item">
            <img src={`${API_BASE_URL}/static/img/atak.png`} alt="ATAK" className="icon" style={{ width: '100px', height: '100px' }} onError={(e) => { e.target.parentElement.remove(); }} />
            <p>Get ATAK</p>
            <div className="links">
              <a href={settings?.atak_installer_qr_url || "https://play.google.com/store/apps/details?id=com.atakmap.app.civ&hl=en"} target="_blank" rel="noopener noreferrer">Android</a>
            </div>
            {settings?.atak_installer_qr_enabled && settings?.atak_installer_qr_url && (
              <div className="installer-qr">
                <QRCodeSVG value={settings.atak_installer_qr_url} size={80} level="M" />
              </div>
            )}
          </div>
        )}
        {settings?.itak_homepage_icon_enabled && (
          <div className="install-item">
            <img src={`${API_BASE_URL}/static/img/itak.jpg`} alt="iTAK" className="icon" style={{ width: '100px', height: '100px' }} onError={(e) => { e.target.parentElement.remove(); }} />
            <p>Get iTAK</p>
            <div className="links">
              <a href={settings?.itak_installer_qr_url || "https://apps.apple.com/app/itak/id1561656396"} target="_blank" rel="noopener noreferrer">iPhone</a>
            </div>
            {settings?.itak_installer_qr_enabled && settings?.itak_installer_qr_url && (
              <div className="installer-qr">
                <QRCodeSVG value={settings.itak_installer_qr_url} size={80} level="M" />
              </div>
            )}
          </div>
        )}
        {settings?.truststore_homepage_icon_enabled && (
          <div className="install-item">
            <img src={`${API_BASE_URL}/static/img/certificate.png`} alt="TrustStore" className="icon" style={{ width: '100px', height: '100px' }} onError={(e) => { e.target.parentElement.remove(); }} />
            <p>TrustStore</p>
            <div className="links">
              <a href={`${settings?.ots_url || API_BASE_URL.replace(':5000', ':8080')}/api/truststore`} target="_blank" rel="noopener noreferrer">Download</a>
            </div>
          </div>
        )}
      </div>
    )
  });

  // Step 2: Login to ATAK (if QR codes enabled)
  if (hasAnyQRCode) {
    steps.push({
      index: stepIndex++,
      title: 'Login to ATAK',
      content: (
        <div className="qr-codes-grid">
          {settings?.generate_atak_qr_code && (
            <div className="qr-code-section">
              <h3 className="qr-label">ATAK (Android)</h3>
              {loadingAtakQR ? (
                <div className="qr-loading">Loading QR code...</div>
              ) : atakError ? (
                <div className="qr-error">
                  <p>Failed to load ATAK QR code</p>
                  <button onClick={handleRefreshAtakQR} className="refresh-btn" style={{ background: accentColor }}>Retry</button>
                </div>
              ) : atakQrData?.qr_string ? (
                <>
                  <div className="qr-code-container">
                    <QRCodeSVG value={atakQrData.qr_string} size={250} level="H" className="qr-code-large" />
                    <div className="tak-logo-overlay">
                      <img src={getTAKIconURL()} alt="ATAK" onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                  </div>
                  <div className="qr-info">
                    {(atakQrData.expires_at || atakQrData.max_uses != null) && (
                      <p className="expiry-info">
                        {atakQrData.expires_at && (<>Expires in: <strong>{formatExpiry(atakQrData.expires_at)}</strong></>)}
                        {atakQrData.max_uses != null && (<>{atakQrData.expires_at ? ' | ' : ''}Uses: <strong>{atakQrData.total_uses ?? 0}/{atakQrData.max_uses}</strong></>)}
                      </p>
                    )}
                    <div className="qr-actions">
                      <button onClick={handleRefreshAtakQR} className="refresh-btn" disabled={fetchingAtakQR} style={{ background: accentColor }}>{fetchingAtakQR ? 'Refreshing...' : 'Refresh Code'}</button>
                      <button onClick={handleOpenAtakLink} className="open-btn" style={{ background: accentColor }}>Open in ATAK</button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="qr-error">
                  <p>QR code not available</p>
                  <button onClick={handleRefreshAtakQR} className="refresh-btn" style={{ background: accentColor }}>Retry</button>
                </div>
              )}
            </div>
          )}
          {settings?.generate_itak_qr_code && (
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
                <div className="qr-code-container">
                  <QRCodeSVG value={itakQrData.qr_string} size={250} level="H" className="qr-code-large" />
                  <div className="tak-logo-overlay">
                    <img src={getItakIconURL()} alt="iTAK" onError={(e) => { e.target.style.display = 'none'; }} />
                  </div>
                </div>
              ) : (
                <div className="qr-error"><p>QR code not available</p></div>
              )}
            </div>
          )}
        </div>
      )
    });
  }

  // Step 3: Set Callsign (if enabled)
  if (settings?.callsign_qr_code_enabled && user?.callsign) {
    steps.push({
      index: stepIndex++,
      title: 'Set Your Callsign',
      content: (
        <>
          <p className="step-description">Scan this QR code with ATAK to automatically set your callsign to <strong>{user.callsign}</strong></p>
          <div className="qr-codes-grid">
            <div className="qr-code-section">
              <h3 className="qr-label">ATAK Callsign</h3>
              <div className="qr-code-container">
                <QRCodeSVG value={getCallsignQRUrl()} size={250} level="H" className="qr-code-large" />
                <div className="tak-logo-overlay">
                  <img src={getTAKIconURL()} alt="ATAK" onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
              </div>
              <div className="qr-info">
                <div className="qr-actions">
                  <button onClick={handleOpenCallsignLink} className="open-btn" style={{ background: accentColor }}>Open in ATAK</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )
    });
  }

  // Step 4: Download Data Packages (if profiles exist)
  if (takProfiles && takProfiles.length > 0) {
    steps.push({
      index: stepIndex++,
      title: 'Download Data Packages',
      content: (
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
                  <button className="download-btn" onClick={() => handleDownloadProfile(profile.id)} style={{ background: accentColor }}>DOWNLOAD</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    });
  }

  // Step 5: Meshtastic Channel Groups (if any)
  const groupsWithChannels = (meshtasticGroups || []).filter(g => g.channel_count > 0);
  if (groupsWithChannels.length > 0) {
    steps.push({
      index: stepIndex++,
      title: 'Meshtastic Channel Groups',
      content: (
        <>
          <p style={{ color: '#666', marginBottom: '1rem' }}>Scan to configure channels in the group.</p>
          <div className="meshtastic-grid" style={{ justifyContent: 'center' }}>
            {groupsWithChannels.map((group) => {
              const slotMap = {};
              group.channels.forEach(c => { slotMap[c.slot_number] = c.name; });
              return (
                <div key={group.id} style={{ flex: '1 1 calc(50% - 1rem)', minWidth: '420px', maxWidth: '520px', padding: '1.5rem', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3>{group.name}</h3>
                  {group.description && <p style={{ color: '#666' }}>{group.description}</p>}
                  {group.combined_url ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2rem', margin: '1rem 0' }}>
                        <div className="qr-section" style={{ flexShrink: 0 }}>
                          <QRCodeSVG value={group.combined_url} size={300} level="H" className="qr-code" imageSettings={{ src: `${API_BASE_URL}/static/img/meshtastic.png`, height: 50, width: 50, excavate: true }} />
                        </div>
                        <div style={{ padding: '1rem 0', minWidth: '180px' }}>
                          <p style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#333', fontWeight: 600 }}>Slots:</p>
                          {[0, 1, 2, 3, 4, 5, 6, 7].map(slot => (
                            <p key={slot} style={{ margin: '0.5rem 0', fontSize: '1.1rem', color: slotMap[slot] ? '#333' : '#999' }}>
                              {slot}: {slotMap[slot] ? <strong>{slotMap[slot]}</strong> : <em>unused</em>}
                            </p>
                          ))}
                        </div>
                      </div>
                      <div className="qr-actions">
                        <button onClick={() => window.location.href = group.combined_url} className="open-btn" style={{ background: accentColor }}>Open in Meshtastic</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {group.channels.filter(c => c.url).map((channel) => (
                        <div key={channel.id} style={{ textAlign: 'center', padding: '0.5rem', background: '#f9f9f9', borderRadius: '4px' }}>
                          <p style={{ margin: '0 0 0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>Slot {channel.slot_number}: {channel.name}</p>
                          <div className="qr-section">
                            <QRCodeSVG value={channel.url} size={150} level="H" className="qr-code" imageSettings={{ src: `${API_BASE_URL}/static/img/meshtastic.png`, height: 30, width: 30, excavate: true }} />
                          </div>
                          <div className="qr-actions" style={{ marginTop: '0.5rem' }}>
                            <button onClick={() => window.location.href = channel.url} className="open-btn" style={{ background: accentColor, fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>Open in Meshtastic</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )
    });
  }

  // Step 6: Meshtastic Channels (individual, not in groups)
  const ungroupedChannels = meshtasticConfigs.filter(c => c.url && !c.group_id);
  if (ungroupedChannels.length > 0) {
    steps.push({
      index: stepIndex++,
      title: 'Meshtastic Channels',
      content: (
        <div className="meshtastic-grid" style={{ justifyContent: 'center' }}>
          {ungroupedChannels.map((config) => (
            <div key={config.id} className="meshtastic-config-item">
              <h3>{config.name}</h3>
              {config.url && (
                <div className="qr-section" style={{ marginBottom: '1rem' }}>
                  <QRCodeSVG value={config.url} size={200} level="H" className="qr-code" imageSettings={{ src: `${API_BASE_URL}/static/img/meshtastic.png`, height: 40, width: 40, excavate: true }} />
                </div>
              )}
              <p>{config.description}</p>
              {config.url && (
                <>
                  <div className="qr-actions" style={{ marginTop: '1rem' }}>
                    <button onClick={() => window.location.href = config.url} className="open-btn" style={{ background: accentColor }}>Open in Meshtastic</button>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.75rem' }}>
                    Can't Scan?{' '}
                    <button onClick={() => handleCopyMeshtasticLink(config.url, config.id)} style={{ background: 'none', border: 'none', color: copiedMeshtastic === config.id ? '#28a745' : '#007bff', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit', fontWeight: 500 }}>
                      {copiedMeshtastic === config.id ? 'Copied!' : 'Copy Link'}
                    </button>
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )
    });
  }

  const totalSteps = steps.length;

  return (
    <div className="dashboard" style={{ '--accent-color': accentColor }}>
      <div className="dashboard-header">
        <h1>Welcome, {user?.callsign || user?.username}</h1>
        <p className="portal-name" style={{ color: accentColor }}>{brandName}</p>
      </div>

      {/* User Info Section */}
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
                  <span
                    key={radio.id}
                    className={`radio-badge ${settings?.user_program_radio_enabled && radio.platform === 'meshtastic' ? 'clickable' : ''}`}
                    onClick={() => {
                      if (settings?.user_program_radio_enabled && radio.platform === 'meshtastic' && meshtasticSerial.getBrowserSupport().isSupported) {
                        setProgrammingRadio(radio);
                      }
                    }}
                    title={settings?.user_program_radio_enabled && radio.platform === 'meshtastic' ? 'Click to program this radio' : undefined}
                  >
                    {radio.name} ({radio.platform})
                    {settings?.user_program_radio_enabled && radio.platform === 'meshtastic' && (
                      <span className="program-hint"> - Click to Program</span>
                    )}
                  </span>
                ))}
                {radios.filter(r => r.assignedTo === user?.id).length === 0 && <p className="no-items">No radios assigned</p>}
              </div>
            ) : (
              <p className="no-items">No radios assigned</p>
            )}
          </div>
        </div>
        <div className="action-buttons">
          <button className="action-btn edit-profile" style={{ background: accentColor }} onClick={() => navigate('/edit-profile')}>EDIT PROFILE</button>
          <button className="action-btn change-password" style={{ background: accentColor }} onClick={() => navigate('/change-password')}>CHANGE PASSWORD</button>
        </div>
      </div>

      <div className="welcome-section">
        <div className="welcome-text">
          <p>This portal is designed to help you get your ATAK client setup and ready to use. If you do not have ATAK you can download it using the icons below, once you have ATAK you can download and import the profiles.</p>
        </div>
      </div>

      <div className="get-started-section">
        <div className="workflow-header">
          <h1>Get started with ATAK</h1>
          <div className="workflow-controls">
            <button className="workflow-btn" onClick={collapseAll} style={{ background: accentColor }}>Collapse All</button>
            <button className="workflow-btn" onClick={() => expandAll(totalSteps)} style={{ background: accentColor }}>Expand All</button>
          </div>
        </div>

        <div className="steps-container">
          {steps.map((step, idx) => (
            <div
              key={step.index}
              className={`step-card collapsible ${expandedSteps.has(idx) ? 'expanded' : 'collapsed'}`}
              data-step-index={idx}
            >
              <div className="step-header" onClick={() => toggleStep(idx)}>
                <h2>{idx + 1}. {step.title}</h2>
                <span className="step-toggle">{expandedSteps.has(idx) ? '−' : '+'}</span>
              </div>
              <div className="step-content">
                {step.content}
                <div className="step-navigation">
                  {idx < totalSteps - 1 && (
                    <button
                      className="next-step-btn"
                      onClick={(e) => { e.stopPropagation(); goToNextStep(idx, totalSteps); }}
                      style={{ background: accentColor }}
                    >
                      Next Step →
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Program Radio Modal */}
      {programmingRadio && (
        <ProgramRadioModal
          radio={programmingRadio}
          onClose={() => setProgrammingRadio(null)}
        />
      )}
    </div>
  );
}

export default Dashboard;
