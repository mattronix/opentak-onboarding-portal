import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { takProfilesAPI, meshtasticAPI, meshtasticGroupsAPI, radiosAPI, settingsAPI, qrAPI } from '../services/api';
import { QRCodeSVG } from 'qrcode.react';
import { meshtasticSerial } from '../services/meshtasticSerial';
import ProgramRadioModal from '../components/ProgramRadioModal';
import EnrollRadioModal from '../components/EnrollRadioModal';
import ConfigValidatorModal from '../components/ConfigValidatorModal';
import './Dashboard.css';

function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
  const [copiedMeshtastic, setCopiedMeshtastic] = useState(null);
  const [expandedSteps, setExpandedSteps] = useState(new Set([0])); // First step expanded by default
  const [programmingRadio, setProgrammingRadio] = useState(null);
  const [validatingRadio, setValidatingRadio] = useState(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);

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

  const { data: takProfiles = [] } = useQuery({
    queryKey: ['takProfiles'],
    queryFn: async () => {
      try {
        const response = await takProfilesAPI.getAll();
        const profiles = response.data?.profiles;
        return Array.isArray(profiles) ? profiles : [];
      } catch (err) {
        console.error('Failed to fetch tak profiles:', err);
        return [];
      }
    },
    placeholderData: [],
  });

  const { data: meshtasticConfigs = [] } = useQuery({
    queryKey: ['dashboardMeshtastic'],
    queryFn: async () => {
      try {
        const response = await meshtasticAPI.getAll();
        const configs = response.data?.configs;
        return Array.isArray(configs) ? configs : [];
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
        const groups = response.data?.groups;
        return Array.isArray(groups) ? groups : [];
      } catch (err) {
        console.error('Failed to fetch meshtastic groups:', err);
        return [];
      }
    },
    retry: false,
    placeholderData: [],
  });

  const { data: radios = [], isLoading: loadingRadios } = useQuery({
    queryKey: ['radios'],
    queryFn: async () => {
      try {
        const response = await radiosAPI.getAll();
        const radiosList = response.data?.radios;
        return Array.isArray(radiosList) ? radiosList : [];
      } catch (err) {
        console.error('Failed to fetch radios:', err);
        return [];
      }
    },
    placeholderData: [],
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

  const handleOpenInAtak = async (profileId) => {
    try {
      const downloadUrl = await takProfilesAPI.getDownloadUrl(profileId);
      window.location.href = `tak://import?url=${encodeURIComponent(downloadUrl)}`;
    } catch (err) {
      console.error('Failed to generate download link:', err);
    }
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
    title: t('dashboard.installApps'),
    content: (
      <div className="install-options">
        {settings?.meshtastic_homepage_icon_enabled && (
          <div className="install-item">
            <img src={`${API_BASE_URL}/static/img/meshtastic.png`} alt="Meshtastic" className="icon" style={{ width: '100px', height: '100px' }} onError={(e) => { e.target.parentElement.remove(); }} />
            <p>{t('dashboard.getMeshtastic')}</p>
            <div className="links">
              {settings?.meshtastic_installer_qr_android_enabled && (
                <a href={settings?.meshtastic_installer_qr_android_url || "https://play.google.com/store/apps/details?id=com.geeksville.mesh"} target="_blank" rel="noopener noreferrer">{t('dashboard.android')}</a>
              )}
              {settings?.meshtastic_installer_qr_android_enabled && settings?.meshtastic_installer_qr_iphone_enabled && ' | '}
              {settings?.meshtastic_installer_qr_iphone_enabled && (
                <a href={settings?.meshtastic_installer_qr_iphone_url || "https://apps.apple.com/app/meshtastic/id1586432531"} target="_blank" rel="noopener noreferrer">{t('dashboard.iphone')}</a>
              )}
            </div>
            <div className="installer-qr-group">
              {settings?.meshtastic_installer_qr_android_enabled && settings?.meshtastic_installer_qr_android_url && (
                <div className="installer-qr">
                  <span className="qr-platform-label">{t('dashboard.android')}</span>
                  <QRCodeSVG value={settings.meshtastic_installer_qr_android_url} size={80} level="M" />
                </div>
              )}
              {settings?.meshtastic_installer_qr_iphone_enabled && settings?.meshtastic_installer_qr_iphone_url && (
                <div className="installer-qr">
                  <span className="qr-platform-label">{t('dashboard.iphone')}</span>
                  <QRCodeSVG value={settings.meshtastic_installer_qr_iphone_url} size={80} level="M" />
                </div>
              )}
            </div>
          </div>
        )}
        {settings?.atak_homepage_icon_enabled && (
          <div className="install-item">
            <img src={`${API_BASE_URL}/static/img/atak.png`} alt="ATAK" className="icon" style={{ width: '100px', height: '100px' }} onError={(e) => { e.target.parentElement.remove(); }} />
            <p>{t('dashboard.getAtak')}</p>
            <div className="links">
              <a href={settings?.atak_installer_qr_url || "https://play.google.com/store/apps/details?id=com.atakmap.app.civ&hl=en"} target="_blank" rel="noopener noreferrer">{t('dashboard.android')}</a>
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
            <p>{t('dashboard.getItak')}</p>
            <div className="links">
              <a href={settings?.itak_installer_qr_url || "https://apps.apple.com/app/itak/id1561656396"} target="_blank" rel="noopener noreferrer">{t('dashboard.iphone')}</a>
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
            <p>{t('dashboard.trustStore')}</p>
            <div className="links">
              <a href={`${settings?.ots_url || API_BASE_URL.replace(':5000', ':8080')}/api/truststore`} target="_blank" rel="noopener noreferrer">{t('common.download')}</a>
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
      title: t('dashboard.loginToAtak'),
      content: (
        <div className="qr-codes-grid">
          {settings?.generate_atak_qr_code && (
            <div className="qr-code-section">
              <h3 className="qr-label">{t('dashboard.atakAndroid')}</h3>
              {loadingAtakQR ? (
                <div className="qr-loading">{t('dashboard.loadingQr')}</div>
              ) : atakError ? (
                <div className="qr-error">
                  <p>{t('dashboard.failedLoadAtakQr')}</p>
                  <button onClick={handleRefreshAtakQR} className="refresh-btn" style={{ background: accentColor }}>{t('common.retry')}</button>
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
                        {atakQrData.expires_at && (<>{t('dashboard.expiresIn')} <strong>{formatExpiry(atakQrData.expires_at)}</strong></>)}
                        {atakQrData.max_uses != null && (<>{atakQrData.expires_at ? ' | ' : ''}{t('dashboard.uses')} <strong>{atakQrData.total_uses ?? 0}/{atakQrData.max_uses}</strong></>)}
                      </p>
                    )}
                    <div className="qr-actions">
                      <button onClick={handleRefreshAtakQR} className="refresh-btn" disabled={fetchingAtakQR} style={{ background: accentColor }}>{fetchingAtakQR ? t('common.refreshing') : t('dashboard.refreshCode')}</button>
                      <button onClick={handleOpenAtakLink} className="open-btn" style={{ background: accentColor }}>{t('dashboard.openInAtak')}</button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="qr-error">
                  <p>{t('dashboard.qrNotAvailable')}</p>
                  <button onClick={handleRefreshAtakQR} className="refresh-btn" style={{ background: accentColor }}>{t('common.retry')}</button>
                </div>
              )}
            </div>
          )}
          {settings?.generate_itak_qr_code && (
            <div className="qr-code-section">
              <h3 className="qr-label">{t('dashboard.itakIos')}</h3>
              {loadingItakQR ? (
                <div className="qr-loading">{t('dashboard.loadingQr')}</div>
              ) : itakError ? (
                <div className="qr-error">
                  <p>{t('dashboard.failedLoadItakQr')}</p>
                  <small>{t('dashboard.itakNotSupported')}</small>
                </div>
              ) : itakQrData?.qr_string ? (
                <div className="qr-code-container">
                  <QRCodeSVG value={itakQrData.qr_string} size={250} level="H" className="qr-code-large" />
                  <div className="tak-logo-overlay">
                    <img src={getItakIconURL()} alt="iTAK" onError={(e) => { e.target.style.display = 'none'; }} />
                  </div>
                </div>
              ) : (
                <div className="qr-error"><p>{t('dashboard.qrNotAvailable')}</p></div>
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
      title: t('dashboard.setCallsign'),
      content: (
        <>
          <p className="step-description">{t('dashboard.scanCallsignQr')} <strong>{user.callsign}</strong></p>
          <div className="qr-codes-grid">
            <div className="qr-code-section">
              <h3 className="qr-label">{t('dashboard.atakCallsign')}</h3>
              <div className="qr-code-container">
                <QRCodeSVG value={getCallsignQRUrl()} size={250} level="H" className="qr-code-large" />
                <div className="tak-logo-overlay">
                  <img src={getTAKIconURL()} alt="ATAK" onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
              </div>
              <div className="qr-info">
                <div className="qr-actions">
                  <button onClick={handleOpenCallsignLink} className="open-btn" style={{ background: accentColor }}>{t('dashboard.openInAtak')}</button>
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
      title: t('dashboard.downloadDataPackages'),
      content: (
        <table className="packages-table">
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('common.description')}</th>
              <th>{t('common.download')}</th>
            </tr>
          </thead>
          <tbody>
            {takProfiles.map((profile) => (
              <tr key={profile.id}>
                <td>{profile.name}</td>
                <td>{profile.description || t('dashboard.takProfile')}</td>
                <td>
                  {settings?.open_in_atak_enabled && (
                    <button className="download-btn" onClick={() => handleOpenInAtak(profile.id)} style={{ background: '#4CAF50' }}>{t('dashboard.openInAtak')}</button>
                  )}
                  <button className="download-btn" onClick={() => handleDownloadProfile(profile.id)} style={{ background: accentColor }}>{t('common.download')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    });
  }

  // Step 5: Meshtastic Channel Groups (if any)
  const groupsWithChannels = (Array.isArray(meshtasticGroups) ? meshtasticGroups : []).filter(g => g.channel_count > 0 && g.showOnHomepage !== false);
  if (groupsWithChannels.length > 0) {
    steps.push({
      index: stepIndex++,
      title: t('dashboard.meshtasticChannelGroups'),
      content: (
        <>
          <p style={{ color: '#666', marginBottom: '1rem' }}>{t('dashboard.scanToConfigureChannels')}</p>
          <div className="meshtastic-grid" style={{ justifyContent: 'center' }}>
            {groupsWithChannels.map((group) => {
              const slotMap = {};
              (Array.isArray(group.channels) ? group.channels : []).forEach(c => { slotMap[c.slot_number] = c.name; });
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
                          <p style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#333', fontWeight: 600 }}>{t('dashboard.slot')}:</p>
                          {[0, 1, 2, 3, 4, 5, 6, 7].map(slot => (
                            <p key={slot} style={{ margin: '0.5rem 0', fontSize: '1.1rem', color: slotMap[slot] ? '#333' : '#999' }}>
                              {slot}: {slotMap[slot] ? <strong>{slotMap[slot]}</strong> : <em>{t('dashboard.unused')}</em>}
                            </p>
                          ))}
                        </div>
                      </div>
                      <div className="qr-actions">
                        <button onClick={() => window.location.href = group.combined_url} className="open-btn" style={{ background: accentColor }}>{t('dashboard.openInMeshtastic')}</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {(Array.isArray(group.channels) ? group.channels : []).filter(c => c.url).map((channel) => (
                        <div key={channel.id} style={{ textAlign: 'center', padding: '0.5rem', background: '#f9f9f9', borderRadius: '4px' }}>
                          <p style={{ margin: '0 0 0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>{t('dashboard.slot')} {channel.slot_number}: {channel.name}</p>
                          <div className="qr-section">
                            <QRCodeSVG value={channel.url} size={150} level="H" className="qr-code" imageSettings={{ src: `${API_BASE_URL}/static/img/meshtastic.png`, height: 30, width: 30, excavate: true }} />
                          </div>
                          <div className="qr-actions" style={{ marginTop: '0.5rem' }}>
                            <button onClick={() => window.location.href = channel.url} className="open-btn" style={{ background: accentColor, fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>{t('dashboard.openInMeshtastic')}</button>
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
  const ungroupedChannels = (Array.isArray(meshtasticConfigs) ? meshtasticConfigs : []).filter(c => c.url && !c.group_id);
  if (ungroupedChannels.length > 0) {
    steps.push({
      index: stepIndex++,
      title: t('dashboard.meshtasticChannels'),
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
                    <button onClick={() => window.location.href = config.url} className="open-btn" style={{ background: accentColor }}>{t('dashboard.openInMeshtastic')}</button>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.75rem' }}>
                    {t('dashboard.cantScan')}{' '}
                    <button onClick={() => handleCopyMeshtasticLink(config.url, config.id)} style={{ background: 'none', border: 'none', color: copiedMeshtastic === config.id ? '#28a745' : '#007bff', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit', fontWeight: 500 }}>
                      {copiedMeshtastic === config.id ? t('common.copied') : t('dashboard.copyLink')}
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

  // Step 7: Meshtastic Radios (if user has assigned radios or can register)
  const userRadios = (Array.isArray(radios) ? radios : []).filter(r => r.assignedTo === user?.id);
  const showRadiosStep = userRadios.length > 0 || settings?.user_radio_enrollment_enabled;
  if (showRadiosStep) {
    steps.push({
      index: stepIndex++,
      title: t('dashboard.yourRadios'),
      content: (
        <div style={{ textAlign: 'center' }}>
          {loadingRadios ? (
            <p>{t('dashboard.loadingRadios')}</p>
          ) : userRadios.length > 0 ? (
            <div className="radios-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', marginBottom: '1rem' }}>
              {userRadios.map((radio) => (
                <div key={radio.id} className="radio-card">
                  <div className="radio-info">
                    <span className="radio-name">{radio.name}</span>
                    <span className="radio-platform">{radio.platform}</span>
                  </div>
                  {radio.platform === 'meshtastic' && meshtasticSerial.getBrowserSupport().isSupported && (settings?.user_program_radio_enabled || settings?.user_validate_radio_enabled) && (
                    <div className="radio-actions">
                      {settings?.user_validate_radio_enabled && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setValidatingRadio(radio)}
                          title={t('dashboard.compareConfig')}
                        >
                          {t('common.validate')}
                        </button>
                      )}
                      {settings?.user_program_radio_enabled && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => setProgrammingRadio(radio)}
                          title={t('dashboard.programConfig')}
                        >
                          {t('common.program')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#666', marginBottom: '1rem' }}>{t('dashboard.noRadiosAssigned')}</p>
          )}
          {settings?.user_radio_enrollment_enabled && (
            <button
              className="btn btn-primary"
              onClick={() => setShowEnrollModal(true)}
            >
              {t('dashboard.registerRadio')}
            </button>
          )}
        </div>
      )
    });
  }

  const totalSteps = steps.length;

  return (
    <div className="dashboard" style={{ '--accent-color': accentColor }}>
      <div className="dashboard-header">
        <h1>{t('dashboard.welcome')}{user?.callsign || user?.username}</h1>
        <p className="portal-name" style={{ color: accentColor }}>{brandName}</p>
      </div>

      {/* User Info Section */}
      <div className="user-info-section">
        <div className="info-grid">
          <div className="info-card">
            <h3>{t('common.roles')}</h3>
            <div className="roles-list">
              {user?.roles?.map((role) => (
                <span key={role.name || role} className="role-badge" style={{ background: primaryColor }}>
                  {role.displayName || role.name || role}
                </span>
              )) || <span className="role-badge" style={{ background: primaryColor }}>{t('dashboard.user')}</span>}
            </div>
          </div>
        </div>
        <div className="action-buttons">
          <button className="action-btn edit-profile" style={{ background: accentColor }} onClick={() => navigate('/edit-profile')}>{t('dashboard.editProfile')}</button>
          <button className="action-btn change-password" style={{ background: accentColor }} onClick={() => navigate('/change-password')}>{t('dashboard.changePassword')}</button>
        </div>
      </div>

      <div className="welcome-section">
        <div className="welcome-text">
          <p>{t('dashboard.introText')}</p>
        </div>
        {(settings?.help_link_enabled || settings?.help_email_enabled) && (
          <div className="help-buttons">
            {settings?.help_link_enabled && settings?.help_link_value && (
              <a href={settings.help_link_value} target="_blank" rel="noopener noreferrer" className="action-btn" style={{ background: accentColor }}>
                {t('dashboard.helpLink')}
              </a>
            )}
            {settings?.help_email_enabled && settings?.help_email_value && (
              <>
                <a href={`mailto:${settings.help_email_value}`} className="action-btn" style={{ background: accentColor }}>
                  {t('dashboard.helpEmail')}
                </a>
                <span className="help-email-text">{settings.help_email_value}</span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="get-started-section">
        <div className="workflow-header">
          <h1>{t('dashboard.getStarted')}</h1>
          <div className="workflow-controls">
            <button className="workflow-btn" onClick={collapseAll} style={{ background: accentColor }}>{t('dashboard.collapseAll')}</button>
            <button className="workflow-btn" onClick={() => expandAll(totalSteps)} style={{ background: accentColor }}>{t('dashboard.expandAll')}</button>
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
                      {t('dashboard.nextStep')}
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

      {/* Config Validator Modal */}
      {validatingRadio && (
        <ConfigValidatorModal
          radio={validatingRadio}
          onClose={() => setValidatingRadio(null)}
        />
      )}

      {/* Enroll Radio Modal */}
      {showEnrollModal && (
        <EnrollRadioModal
          onClose={() => setShowEnrollModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['radios']);
          }}
        />
      )}
    </div>
  );
}

export default Dashboard;
