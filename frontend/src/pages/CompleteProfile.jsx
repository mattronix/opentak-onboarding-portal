import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, settingsAPI } from '../services/api';
import './Auth.css';

function CompleteProfile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    email: user?.email || '',
    callsign: user?.callsign || '',
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

    // Validate required fields
    if (!user?.email && !formData.email) {
      setError(t('auth.emailRequired'));
      return;
    }
    if (!user?.callsign && !formData.callsign) {
      setError(t('auth.callsignRequired'));
      return;
    }

    setLoading(true);

    try {
      const dataToSubmit = {};
      if (!user?.email && formData.email) {
        dataToSubmit.email = formData.email;
      }
      if (!user?.callsign && formData.callsign) {
        dataToSubmit.callsign = formData.callsign;
      }

      await authAPI.completeProfile(dataToSubmit);
      await updateUser();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || t('auth.failedUpdateProfile'));
    } finally {
      setLoading(false);
    }
  };

  // Determine which fields need to be shown
  const needsEmail = !user?.email;
  const needsCallsign = !user?.callsign;

  return (
    <div className="auth-container">
      <div className="auth-card">
        {logoPath && (
          <div className="auth-logo">
            <img src={logoPath} alt={brandName} />
          </div>
        )}
        <h2>{t('auth.completeProfileTitle')}</h2>
        <p>{t('auth.completeProfileDesc')}</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          {needsEmail && (
            <div className="form-group">
              <label htmlFor="email">{t('auth.emailLabel')}</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoFocus
                placeholder={t('auth.emailPlaceholder')}
              />
            </div>
          )}

          {needsCallsign && (
            <div className="form-group">
              <label htmlFor="callsign">{t('auth.callsignLabel')}</label>
              <input
                id="callsign"
                name="callsign"
                type="text"
                value={formData.callsign}
                onChange={handleChange}
                required
                autoFocus={!needsEmail}
                placeholder={t('auth.callsignPlaceholder')}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-block"
          >
            {loading ? t('common.saving') : t('auth.continue')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CompleteProfile;
