import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { onboardingCodesAPI, settingsAPI } from '../services/api';
import './Auth.css';

function Register() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    passwordConfirm: '',
    email: '',
    firstName: '',
    lastName: '',
    callsign: '',
    onboardingCode: code || '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeValid, setCodeValid] = useState(false);
  const [codeInfo, setCodeInfo] = useState(null);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await settingsAPI.get();
      return response.data;
    },
  });

  const brandName = settings?.brand_name || 'OpenTAK Onboarding Portal';
  const logoEnabled = settings?.custom_logo_enabled === true || settings?.custom_logo_enabled === 'true';
  const logoPath = logoEnabled && settings?.custom_logo_path
    ? settings.custom_logo_path
    : settings?.default_logo_path;

  useEffect(() => {
    if (code) {
      validateCode(code);
    }
  }, [code]);

  const validateCode = async (codeToValidate) => {
    try {
      const response = await onboardingCodesAPI.validate(codeToValidate);
      if (response.data.valid) {
        setCodeValid(true);
        setCodeInfo(response.data);
      } else {
        setError(response.data.error || 'Invalid onboarding code');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid onboarding code');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Convert username to lowercase and remove spaces
    const username = formData.username.toLowerCase().trim();

    // Validate username format (only letters and numbers, no spaces, underscores, dashes, or special chars)
    const usernamePattern = /^[a-z0-9]+$/;
    if (!usernamePattern.test(username)) {
      setError('Username can only contain letters and numbers (no spaces, underscores, dashes, or special characters)');
      return;
    }

    // Validate username length
    if (username.length < 3 || username.length > 32) {
      setError('Username must be between 3 and 32 characters');
      return;
    }

    // Check for disallowed characters in password
    const disallowedChars = /[&^$]/;
    if (disallowedChars.test(formData.password)) {
      setError('Password cannot contain &, ^, or $ characters');
      return;
    }

    if (formData.password !== formData.passwordConfirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    const result = await registerUser({
      ...formData,
      username: username
    });

    if (result.success) {
      if (result.autoApproved) {
        // Auto-approved: redirect to success page or login with message
        navigate('/registration-success', {
          state: {
            message: result.message || 'Your account has been created and is now active!',
            user: {
              username: username,
              email: formData.email,
              callsign: formData.callsign
            }
          }
        });
      } else if (result.pendingApproval) {
        // Pending approval: redirect to pending approval notice page
        navigate('/registration-pending', {
          state: {
            email: result.email || formData.email,
            message: result.message || 'Your registration is pending approval. You will receive an email once approved.'
          }
        });
      } else {
        // Standard flow: redirect to verify email notice page
        navigate('/verify-email-sent', {
          state: {
            email: result.email || formData.email,
            message: result.message
          }
        });
      }
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  if (!codeValid && !error) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          {logoPath && (
            <div className="auth-logo">
              <img src={logoPath} alt={brandName} />
            </div>
          )}
          <h2>Validating onboarding code...</h2>
        </div>
      </div>
    );
  }

  if (error && !codeValid) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          {logoPath && (
            <div className="auth-logo">
              <img src={logoPath} alt={brandName} />
            </div>
          )}
          <h2>Invalid Onboarding Code</h2>
          <div className="alert alert-error">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {logoPath && (
          <div className="auth-logo">
            <img src={logoPath} alt={brandName} />
          </div>
        )}
        <h2>{brandName}</h2>
        <h3>Register</h3>

        {codeInfo && (
          <div className="alert alert-info">
            Registering with: {codeInfo.name}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">Username *</label>
            <input
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="Choose a username"
              pattern="[a-zA-Z0-9]+"
              title="Username can only contain letters and numbers"
              minLength="3"
              maxLength="32"
            />
            <small style={{ color: '#666', fontSize: '0.85em' }}>
              Only letters and numbers (3-32 characters). Will be converted to lowercase.
            </small>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Enter password"
              />
              <small style={{ color: '#666', fontSize: '0.85em' }}>
                Cannot contain &amp;, ^, or $ characters.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="passwordConfirm">Confirm Password *</label>
              <input
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                value={formData.passwordConfirm}
                onChange={handleChange}
                required
                placeholder="Confirm password"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="your.email@example.com"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name *</label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                value={formData.firstName}
                onChange={handleChange}
                required
                placeholder="First name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name *</label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={formData.lastName}
                onChange={handleChange}
                required
                placeholder="Last name"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="callsign">Callsign *</label>
            <input
              id="callsign"
              name="callsign"
              type="text"
              value={formData.callsign}
              onChange={handleChange}
              required
              placeholder="Your callsign"
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-block">
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <a href="/login">Login here</a></p>
        </div>
      </div>
    </div>
  );
}

export default Register;
