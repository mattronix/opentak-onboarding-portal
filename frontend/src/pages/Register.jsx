import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { onboardingCodesAPI, settingsAPI } from '../services/api';
import './Auth.css';

function Register() {
  const { t } = useTranslation();
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
        setError(response.data.error || t('auth.invalidCode'));
      }
    } catch (err) {
      setError(err.response?.data?.error || t('auth.invalidCode'));
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
      setError(t('auth.usernameOnlyLetters'));
      return;
    }

    // Validate username length
    if (username.length < 3 || username.length > 32) {
      setError(t('auth.usernameLength'));
      return;
    }

    // Check for disallowed characters in password
    const disallowedChars = /[&^$]/;
    if (disallowedChars.test(formData.password)) {
      setError(t('auth.passwordNoSpecial'));
      return;
    }

    if (formData.password !== formData.passwordConfirm) {
      setError(t('auth.passwordsNoMatch'));
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
          <h2>{t('auth.validatingCode')}</h2>
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
          <h2>{t('auth.invalidCode')}</h2>
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
        <h3>{t('auth.register')}</h3>

        {codeInfo && (
          <div className="alert alert-info">
            {t('auth.registeringWith')}{codeInfo.name}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">{t('auth.usernameLabel')}</label>
            <input
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder={t('auth.chooseUsername')}
              pattern="[a-zA-Z0-9]+"
              title={t('auth.usernameOnlyLetters')}
              minLength="3"
              maxLength="32"
            />
            <small style={{ color: '#666', fontSize: '0.85em' }}>
              {t('auth.usernameHelp')}
            </small>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">{t('auth.passwordLabel')}</label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder={t('auth.enterPassword')}
              />
              <small style={{ color: '#666', fontSize: '0.85em' }}>
                {t('auth.passwordHelp')}
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="passwordConfirm">{t('auth.confirmPasswordLabel')}</label>
              <input
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                value={formData.passwordConfirm}
                onChange={handleChange}
                required
                placeholder={t('auth.confirmPassword')}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">{t('auth.emailLabel')}</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder={t('auth.emailPlaceholder')}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">{t('auth.firstNameLabel')}</label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                value={formData.firstName}
                onChange={handleChange}
                required
                placeholder={t('auth.firstName')}
              />
            </div>

            <div className="form-group">
              <label htmlFor="lastName">{t('auth.lastNameLabel')}</label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={formData.lastName}
                onChange={handleChange}
                required
                placeholder={t('auth.lastName')}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="callsign">{t('auth.callsignLabel')}</label>
            <input
              id="callsign"
              name="callsign"
              type="text"
              value={formData.callsign}
              onChange={handleChange}
              required
              placeholder={t('auth.callsignPlaceholder')}
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-block">
            {loading ? t('auth.registering') : t('auth.register')}
          </button>
        </form>

        <div className="auth-footer">
          <p><a href="/login">{t('auth.alreadyHaveAccount')}</a></p>
        </div>
      </div>
    </div>
  );
}

export default Register;
