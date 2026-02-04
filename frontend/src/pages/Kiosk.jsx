import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { kioskAPI, settingsAPI } from '../services/api';
import { meshtasticSerial } from '../services/meshtasticSerial';
import ProgramRadioModal from '../components/ProgramRadioModal';
import ConfigValidatorModal from '../components/ConfigValidatorModal';
import './Kiosk.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;

function Kiosk() {
  const [state, setState] = useState('loading'); // loading, qr, authenticated, disabled, error
  const [sessionId, setSessionId] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [kioskUser, setKioskUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // Authenticated view state
  const [atakQrData, setAtakQrData] = useState(null);
  const [itakQrData, setItakQrData] = useState(null);
  const [radios, setRadios] = useState([]);
  const [programmingRadio, setProgrammingRadio] = useState(null);
  const [validatingRadio, setValidatingRadio] = useState(null);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const pollRef = useRef(null);
  const timerRef = useRef(null);
  const timeoutMinutesRef = useRef(10);

  // Create an axios instance authenticated with the kiosk token
  const getKioskApi = useCallback(() => {
    if (!accessToken) return null;
    return axios.create({
      baseURL: `${API_BASE_URL}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }, [accessToken]);

  // Load settings on mount
  useEffect(() => {
    settingsAPI.get().then((res) => {
      setSettings(res.data);
      if (!res.data?.kiosk_enrollment_enabled) {
        setState('disabled');
      } else {
        createNewSession();
      }
    }).catch(() => {
      setState('error');
      setErrorMessage('Failed to load settings');
    });
  }, []);

  // Create a new kiosk session
  const createNewSession = async () => {
    setState('loading');
    try {
      const res = await kioskAPI.createSession();
      setSessionId(res.data.session_id);
      setQrUrl(res.data.qr_url);
      setState('qr');
    } catch (err) {
      if (err.response?.status === 403) {
        setState('disabled');
      } else {
        setState('error');
        setErrorMessage('Failed to create kiosk session');
      }
    }
  };

  // Poll for session status when in QR state
  useEffect(() => {
    if (state !== 'qr' || !sessionId) return;

    const poll = async () => {
      try {
        const res = await kioskAPI.getSessionStatus(sessionId);
        if (res.data.status === 'authenticated') {
          setAccessToken(res.data.access_token);
          setRefreshToken(res.data.refresh_token);
          setKioskUser(res.data.user);
          setState('authenticated');
        } else if (res.data.status === 'expired') {
          // Session expired, create a new one
          createNewSession();
        }
      } catch {
        // Ignore poll errors
      }
    };

    pollRef.current = setInterval(poll, 2500);
    return () => clearInterval(pollRef.current);
  }, [state, sessionId]);

  // When authenticated, fetch QR codes and radios, start countdown
  useEffect(() => {
    if (state !== 'authenticated' || !accessToken) return;

    const kioskApi = getKioskApi();
    if (!kioskApi) return;

    // Fetch ATAK QR
    if (settings?.generate_atak_qr_code) {
      kioskApi.get('/qr/atak').then(res => setAtakQrData(res.data)).catch(() => {});
    }

    // Fetch iTAK QR
    if (settings?.generate_itak_qr_code) {
      kioskApi.get('/qr/itak').then(res => setItakQrData(res.data)).catch(() => {});
    }

    // Fetch user's assigned radios only
    kioskApi.get('/radios').then(res => {
      const list = res.data?.radios || [];
      setRadios(list.filter(r => r.radioType === 'meshtastic' && r.assignedTo === kioskUser.id));
    }).catch(() => {});

    // Start countdown timer
    const timeoutStr = settings?.kiosk_session_timeout_minutes || '10';
    const timeout = parseInt(timeoutStr) || 10;
    timeoutMinutesRef.current = timeout;
    const totalSeconds = timeout * 60;
    setTimeRemaining(totalSeconds);

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleSignOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [state, accessToken]);

  const handleSignOut = () => {
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
    setAccessToken(null);
    setRefreshToken(null);
    setKioskUser(null);
    setAtakQrData(null);
    setItakQrData(null);
    setRadios([]);
    setProgrammingRadio(null);
    setValidatingRadio(null);
    setShowPasswordForm(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess('');
    createNewSession();
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    if (/[&^$]/.test(newPassword)) {
      setPasswordError('Password cannot contain &, ^, or $ characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const kioskApi = getKioskApi();
      await kioskApi.post('/auth/change-password', { newPassword });
      setPasswordSuccess('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess('');
      }, 3000);
    } catch (err) {
      setPasswordError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Prevent navigation away from kiosk
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (state === 'authenticated') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state]);

  // Loading state
  if (state === 'loading') {
    return (
      <div className="kiosk-container">
        <div className="kiosk-loading">
          <div className="kiosk-spinner" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Disabled state
  if (state === 'disabled') {
    return (
      <div className="kiosk-container">
        <div className="kiosk-message">
          <h2>Kiosk Enrollment</h2>
          <p>Kiosk enrollment is not enabled. Contact your administrator.</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="kiosk-container">
        <div className="kiosk-message">
          <h2>Error</h2>
          <p>{errorMessage || 'Something went wrong.'}</p>
          <button className="kiosk-retry-btn" onClick={createNewSession}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // QR display state
  if (state === 'qr') {
    return (
      <div className="kiosk-container">
        <div className="kiosk-qr-screen">
          {settings?.custom_logo_enabled && settings?.custom_logo_path ? (
            <img src={`${API_BASE_URL}${settings.custom_logo_path}`} alt="Logo" className="kiosk-logo" />
          ) : (
            <img src={`${API_BASE_URL}/static/img/logo.png`} alt="Logo" className="kiosk-logo" />
          )}
          <h1>{settings?.brand_name || 'OpenTAK Portal'}</h1>
          <p className="kiosk-subtitle">Scan to log in</p>
          <div className="kiosk-qr-code">
            {qrUrl && <QRCodeSVG value={qrUrl} size={280} level="M" />}
          </div>
          <p className="kiosk-qr-instruction">
            Scan this QR code with your phone to authenticate
            <span className="kiosk-polling-dot" />
          </p>
        </div>
      </div>
    );
  }

  // Authenticated kiosk view
  if (state === 'authenticated' && kioskUser) {
    const isWarning = timeRemaining < 60;

    return (
      <div className="kiosk-container">
        <div className="kiosk-dashboard">
          <div className="kiosk-header">
            <div className="kiosk-header-brand">
              {settings?.custom_logo_enabled && settings?.custom_logo_path ? (
                <img src={`${API_BASE_URL}${settings.custom_logo_path}`} alt="Logo" className="kiosk-header-logo" />
              ) : (
                <img src={`${API_BASE_URL}/static/img/logo.png`} alt="Logo" className="kiosk-header-logo" />
              )}
              <h1>Welcome, {kioskUser.callsign || kioskUser.username}</h1>
            </div>
            <div className="kiosk-header-actions">
              <span className={`kiosk-timer ${isWarning ? 'warning' : ''}`}>
                Session: {formatTime(timeRemaining)}
              </span>
              <button className="kiosk-signout-btn" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          </div>

          <div className="kiosk-sections">
            {/* QR Codes Section */}
            {(atakQrData || itakQrData) && (
              <div className="kiosk-section">
                <h2>TAK Enrollment QR Codes</h2>
                <div className="kiosk-qr-pair">
                  {atakQrData?.qr_string && (
                    <div className="kiosk-qr-item">
                      <QRCodeSVG value={atakQrData.qr_string} size={180} level="M" />
                      <p>ATAK</p>
                    </div>
                  )}
                  {itakQrData?.qr_string && (
                    <div className="kiosk-qr-item">
                      <QRCodeSVG value={itakQrData.qr_string} size={180} level="M" />
                      <p>iTAK</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Radio Programming Section */}
            {radios.length > 0 && (
              <div className="kiosk-section">
                <h2>Radio Programming</h2>
                <div className="kiosk-radio-list">
                  {radios.map(radio => (
                    <div key={radio.id} className="kiosk-radio-item">
                      <span className="kiosk-radio-name">{radio.name}</span>
                      <div className="kiosk-radio-actions">
                        <button
                          className="kiosk-btn-validate"
                          onClick={() => setValidatingRadio(radio)}
                        >
                          Validate
                        </button>
                        <button
                          className="kiosk-btn-program"
                          onClick={() => setProgrammingRadio(radio)}
                        >
                          Program
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* User Info Section */}
            <div className="kiosk-section">
              <h2>Account</h2>
              <p><strong>Username:</strong> {kioskUser.username}</p>
              <p><strong>Name:</strong> {kioskUser.firstName} {kioskUser.lastName}</p>
              <p><strong>Callsign:</strong> {kioskUser.callsign || '-'}</p>

              {!showPasswordForm ? (
                <button
                  className="kiosk-btn-program"
                  style={{ marginTop: '1rem' }}
                  onClick={() => setShowPasswordForm(true)}
                >
                  Change Password
                </button>
              ) : (
                <form className="kiosk-password-form" onSubmit={handleChangePassword} style={{ marginTop: '1rem' }}>
                  {passwordError && <div className="kiosk-alert kiosk-alert-error">{passwordError}</div>}
                  {passwordSuccess && <div className="kiosk-alert kiosk-alert-success">{passwordSuccess}</div>}
                  <input
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                  <div className="kiosk-form-actions">
                    <button type="submit" className="btn-primary" disabled={changingPassword}>
                      {changingPassword ? 'Changing...' : 'Change Password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setPasswordError('');
                        setPasswordSuccess('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
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
      </div>
    );
  }

  return null;
}

export default Kiosk;
