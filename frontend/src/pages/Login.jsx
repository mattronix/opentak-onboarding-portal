import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { settingsAPI, oidcAPI } from '../services/api';
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

  // Handle OIDC callback — tokens arrive as query params after redirect from backend
  useEffect(() => {
    const oidcToken = searchParams.get('oidc_token');
    const oidcRefresh = searchParams.get('oidc_refresh');
    const oidcError = searchParams.get('oidc_error');
    const needsPassword = searchParams.get('needs_password') === 'true';
    const needsProfile = searchParams.get('needs_profile') === 'true';

    if (oidcError) {
      setError(decodeURIComponent(oidcError.replace(/\+/g, ' ')));
      // Clean up URL params
      setSearchParams({});
      return;
    }

    if (oidcToken && oidcRefresh) {
      // Clean up URL params immediately
      setSearchParams({});
      setLoading(true);

      // Process OIDC login
      oidcLogin(oidcToken, oidcRefresh).then((result) => {
        if (result.success) {
          if (needsPassword) {
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

        <div className="auth-footer">
          <p>Need an account? Contact your administrator for an onboarding code.</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
