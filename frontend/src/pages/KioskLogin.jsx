import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { kioskAPI, settingsAPI, oidcAPI } from '../services/api';
import './Auth.css';

const API_BASE_URL = window.location.origin;

function KioskLogin() {
  const { sessionId } = useParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState('checking'); // checking, login, confirm, success, error, expired

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await settingsAPI.get();
      return response.data;
    },
  });

  const { data: oidcData } = useQuery({
    queryKey: ['oidc-providers'],
    queryFn: async () => {
      const response = await oidcAPI.getProviders();
      return response.data;
    },
  });

  const oidcProviders = oidcData?.providers || [];
  const brandName = settings?.brand_name || 'OpenTAK Portal';
  const logoEnabled = settings?.custom_logo_enabled === true || settings?.custom_logo_enabled === 'true';
  const logoPath = logoEnabled && settings?.custom_logo_path
    ? settings.custom_logo_path
    : settings?.default_logo_path;

  // On mount, check session and auth status
  useEffect(() => {
    const checkStatus = async () => {
      // First check if the kiosk session is valid
      try {
        const statusRes = await kioskAPI.getSessionStatus(sessionId);
        if (statusRes.data.status === 'expired') {
          setState('expired');
          return;
        }
        if (statusRes.data.status === 'authenticated') {
          setState('expired'); // Already authenticated by someone else
          return;
        }
      } catch {
        setState('error');
        setError('Invalid kiosk session');
        return;
      }

      // Check if user is already logged in
      const token = localStorage.getItem('access_token');
      if (token) {
        setState('confirm');
      } else {
        setState('login');
      }
    };

    checkStatus();
  }, [sessionId]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const axios = (await import('axios')).default;
      const res = await axios.post(`${API_BASE_URL}/api/v1/auth/login`, {
        username,
        password
      });

      // Store tokens in localStorage so authenticateSession can use them
      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('refresh_token', res.data.refresh_token);

      setState('confirm');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');

    try {
      await kioskAPI.authenticateSession(sessionId);
      setState('success');
    } catch (err) {
      if (err.response?.status === 400) {
        setError(err.response.data?.error || 'Session expired or already used');
        setState('expired');
      } else {
        setError(err.response?.data?.error || 'Failed to authenticate kiosk session');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOIDCLogin = (providerId) => {
    // Store kiosk session ID so we can come back after OIDC
    localStorage.setItem('kiosk_session_pending', sessionId);
    window.location.href = `${API_BASE_URL}/api/v1/auth/oidc/${providerId}/authorize`;
  };

  // Check if we're returning from OIDC login with a pending kiosk session
  useEffect(() => {
    const pendingSession = localStorage.getItem('kiosk_session_pending');
    if (pendingSession && localStorage.getItem('access_token')) {
      localStorage.removeItem('kiosk_session_pending');
      if (pendingSession === sessionId) {
        setState('confirm');
      }
    }
  }, [sessionId]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        {logoPath && (
          <div className="auth-logo">
            <img src={logoPath} alt={brandName} />
          </div>
        )}
        <h2>{brandName}</h2>
        <h3>Kiosk Login</h3>

        {state === 'checking' && (
          <p style={{ textAlign: 'center', color: '#666' }}>Checking session...</p>
        )}

        {state === 'login' && (
          <>
            <p style={{ textAlign: 'center', color: '#666', marginBottom: '1rem' }}>
              Log in to authenticate the kiosk
            </p>
            <form onSubmit={handleLogin} className="auth-form">
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  placeholder="Enter your username"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-block"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            {/* OIDC Provider Buttons */}
            {oidcProviders.length > 0 && (
              <div className="oidc-providers">
                <div className="oidc-divider">
                  <span>or</span>
                </div>
                {oidcProviders.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    className="btn btn-block oidc-btn"
                    style={{
                      backgroundColor: provider.button_color || '#4285F4',
                      color: '#fff',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                    onClick={() => handleOIDCLogin(provider.id)}
                    disabled={loading}
                  >
                    {provider.icon_url && (
                      <img src={`${API_BASE_URL}${provider.icon_url}`} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
                    )}
                    {provider.display_name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {state === 'confirm' && (
          <div style={{ textAlign: 'center' }}>
            {error && <div className="alert alert-error">{error}</div>}
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              You are about to log in to a kiosk. This will allow the kiosk screen to access your account.
            </p>
            <button
              className="btn btn-primary btn-block"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Confirm Kiosk Login'}
            </button>
          </div>
        )}

        {state === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div className="alert" style={{ background: '#d4edda', color: '#155724', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              You are now logged in on the kiosk!
            </div>
            <p style={{ color: '#666' }}>You can close this page.</p>
          </div>
        )}

        {state === 'expired' && (
          <div style={{ textAlign: 'center' }}>
            <div className="alert alert-error">
              This kiosk session has expired or is no longer available.
            </div>
            <p style={{ color: '#666', marginTop: '1rem' }}>
              Please scan the QR code on the kiosk again.
            </p>
          </div>
        )}

        {state === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div className="alert alert-error">{error || 'Something went wrong.'}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default KioskLogin;
