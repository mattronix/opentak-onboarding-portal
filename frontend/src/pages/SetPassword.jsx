import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, settingsAPI } from '../services/api';
import './Auth.css';

function SetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.newPassword || !formData.confirmPassword) {
      setError(t('auth.bothFieldsRequired'));
      return;
    }

    if (formData.newPassword.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    const disallowedChars = /[&^$]/;
    if (disallowedChars.test(formData.newPassword)) {
      setError(t('auth.passwordNoSpecial'));
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError(t('auth.passwordsNoMatch'));
      return;
    }

    setLoading(true);

    try {
      await authAPI.setPassword(formData.newPassword);
      await updateUser();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || t('auth.failedSetPassword'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {logoPath && (
          <div className="auth-logo">
            <img src={logoPath} alt={brandName} />
          </div>
        )}
        <h2>{t('auth.setPasswordTitle')}</h2>
        <p>{t('auth.setPasswordDesc')}</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="newPassword">{t('auth.newPassword')} *</label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              value={formData.newPassword}
              onChange={handleChange}
              required
              autoFocus
              autoComplete="new-password"
              minLength={8}
              placeholder={t('auth.enterAPassword')}
            />
            <small style={{ color: '#666', fontSize: '0.8rem' }}>
              {t('auth.passwordMinLength')}
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">{t('auth.confirmNewPassword')} *</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
              minLength={8}
              placeholder={t('auth.confirmYourPassword')}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-block"
          >
            {loading ? t('auth.settingPassword') : t('auth.setPassword')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default SetPassword;
