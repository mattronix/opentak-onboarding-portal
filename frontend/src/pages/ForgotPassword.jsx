import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { settingsAPI } from '../services/api';
import './Auth.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;

function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await settingsAPI.get();
      return response.data;
    },
  });

  const brandName = settings?.brand_name || 'OpenTAK Portal';
  const logoEnabled = settings?.custom_logo_enabled === true || settings?.custom_logo_enabled === 'true';
  const logoPath = logoEnabled && settings?.custom_logo_path
    ? settings.custom_logo_path
    : settings?.default_logo_path;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await axios.post(`${API_BASE_URL}/api/v1/auth/forgot-password`, { email });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || t('auth.failedSendReset'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          {logoPath && (
            <div className="auth-logo">
              <img src={logoPath} alt={brandName} />
            </div>
          )}
          <h2>{t('auth.checkYourEmail')}</h2>
          <div className="alert alert-success">
            <p>{t('auth.resetEmailSent')}</p>
          </div>
          <div className="auth-links">
            <p>
              <Link to="/login">{t('auth.backToLogin')}</Link>
            </p>
          </div>
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
        <h2>{t('auth.forgotPasswordTitle')}</h2>
        <p>{t('auth.forgotPasswordDesc')}</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">{t('auth.emailAddress')}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder={t('auth.enterEmail')}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-block"
          >
            {loading ? t('auth.sending') : t('auth.sendResetLink')}
          </button>

          <div className="auth-links">
            <p>
              <Link to="/login">{t('auth.backToLogin')}</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ForgotPassword;
