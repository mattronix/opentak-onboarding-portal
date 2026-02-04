import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { settingsAPI, oidcAPI, magicLinkAPI } from '../services/api';
import './Auth.css';

const API_BASE_URL = window.location.origin;

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, oidcLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await settingsAPI.get();
      return response.data;
    },
  });

  // Fetch OIDC providers for login buttons
  const { data: oidcData } = useQuery({
    queryKey: ['oidc-providers'],
    queryFn: async () => {
      const response = await oidcAPI.getProviders();
      return response.data;
    },
  });

  const oidcProviders = oidcData?.providers || [];

  const brandName = settings?.brand_name || 'OpenTAK Onboarding Portal';
  const logoEnabled = settings?.custom_logo_enabled === true || settings?.custom_logo_enabled === 'true';
  const logoPath = logoEnabled && settings?.custom_logo_path
    ? settings.custom_logo_path
    : settings?.default_logo_path;
  const forgotPasswordEnabled = settings?.forgot_password_enabled !== false;

  // Magic link state
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  // Handle OIDC callback and magic link token
  useEffect(() => {
    const oidcToken = searchParams.get('oidc_token');
    const oidcRefresh = searchParams.get('oidc_refresh');
    const oidcError = searchParams.get('oidc_error');
    const needsPassword = searchParams.get('needs_password') === 'true';
    const needsProfile = searchParams.get('needs_profile') === 'true';
    const magicToken = searchParams.get('magic_token');

    if (oidcError) {
      setError(decodeURIComponent(oidcError.replace(/\+/g, ' ')));
      setSearchParams({});
      return;
    }

    if (oidcToken && oidcRefresh) {
      setSearchParams({});
      setLoading(true);

      oidcLogin(oidcToken, oidcRefresh).then((result) => {
        if (result.success) {
          // Check for pending kiosk session
          const kioskSession = localStorage.getItem('kiosk_session_pending');
          if (kioskSession) {
            localStorage.removeItem('kiosk_session_pending');
            navigate(`/kiosk-login/${kioskSession}`);
          } else if (needsPassword) {
            navigate('/set-password');
          } else if (needsProfile) {
            navigate('/complete-profile');
          } else {
            navigate('/dashboard');
          }
        } else {
          setError(result.error || 'OIDC login failed');
        }
        setLoading(false);
      });
      return;
    }

    // Handle magic link token
    if (magicToken) {
      setSearchParams({});
      setLoading(true);

      magicLinkAPI.verifyToken(magicToken)
        .then(async (response) => {
          const { access_token, refresh_token, needs_password, needs_profile } = response.data;
          const result = await oidcLogin(access_token, refresh_token);
          if (result.success) {
            if (needs_password) navigate('/set-password');
            else if (needs_profile) navigate('/complete-profile');
            else navigate('/dashboard');
          } else {
            setError(result.error || 'Magic link login failed');
          }
          setLoading(false);
        })
        .catch((err) => {
          setError(err.response?.data?.error || 'Invalid or expired magic link');
          setLoading(false);
        });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);

    if (result.success) {
      if (result.needsProfileCompletion) {
        navigate('/complete-profile');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleOIDCLogin = (providerId) => {
    // Full page navigation to the backend OIDC authorize endpoint
    window.location.href = `${API_BASE_URL}/api/v1/auth/oidc/${providerId}/authorize`;
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {logoPath && (
          <div className="auth-logo">
            <img src={logoPath} alt={brandName} />
          </div>
        )}
        <h2>{brandName}</h2>
        <h3>Login</h3>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

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

          {forgotPasswordEnabled && (
            <div className="auth-links">
              <p>
                <Link to="/forgot-password">forgot your password?</Link>
              </p>
            </div>
          )}
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

        {/* Magic Link Login */}
        {settings?.magic_link_login_enabled && (
          <div className="oidc-providers">
            {oidcProviders.length === 0 && (
              <div className="oidc-divider">
                <span>or</span>
              </div>
            )}
            {!showMagicLink ? (
              <button
                type="button"
                className="btn btn-block btn-secondary"
                onClick={() => setShowMagicLink(true)}
                disabled={loading}
              >
                Email me a login link
              </button>
            ) : !magicLinkSent ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setMagicLinkLoading(true);
                  setError('');
                  try {
                    await magicLinkAPI.requestLink(magicLinkEmail);
                    setMagicLinkSent(true);
                  } catch (err) {
                    setError(err.response?.data?.error || 'Failed to send login link');
                  } finally {
                    setMagicLinkLoading(false);
                  }
                }}
              >
                <div className="form-group">
                  <label htmlFor="magicEmail">Email Address</label>
                  <input
                    id="magicEmail"
                    type="email"
                    value={magicLinkEmail}
                    onChange={(e) => setMagicLinkEmail(e.target.value)}
                    required
                    placeholder="Enter your email"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  disabled={magicLinkLoading}
                >
                  {magicLinkLoading ? 'Sending...' : 'Send Login Link'}
                </button>
                <button
                  type="button"
                  className="btn btn-block"
                  style={{ marginTop: '0.5rem', background: 'transparent', color: '#666' }}
                  onClick={() => setShowMagicLink(false)}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div className="alert" style={{ background: '#d4edda', color: '#155724', padding: '0.75rem', borderRadius: '8px' }}>
                  Check your email for a login link
                </div>
                <button
                  type="button"
                  className="btn btn-block"
                  style={{ marginTop: '0.75rem', background: 'transparent', color: '#666' }}
                  onClick={() => { setShowMagicLink(false); setMagicLinkSent(false); setMagicLinkEmail(''); }}
                >
                  Back to login
                </button>
              </div>
            )}
          </div>
        )}

        <div className="auth-footer">
          <p>Need an account? Contact your administrator for an onboarding code.</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
