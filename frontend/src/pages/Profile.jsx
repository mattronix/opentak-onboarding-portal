import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI } from '../services/api';

function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    email: user?.email || '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    callsign: user?.callsign || '',
    language: user?.language || i18n.language || 'en',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await usersAPI.update(user.id, formData);
      await updateUser();
      i18n.changeLanguage(formData.language);
      setSuccess(t('profile.profileUpdated'));
      setEditing(false);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || t('profile.failedUpdate'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1>{t('profile.title')}</h1>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginTop: '2rem' }}>
        {!editing ? (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <strong>{t('profile.usernameLabel')}</strong> {user?.username}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <strong>{t('profile.emailLabel')}</strong> {user?.email}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <strong>{t('profile.firstNameLabel')}</strong> {user?.firstName}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <strong>{t('profile.lastNameLabel')}</strong> {user?.lastName}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <strong>{t('profile.callsignLabel')}</strong> {user?.callsign}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <strong>{t('profile.languageLabel')}</strong>{' '}
              {user?.language === 'nl' ? 'Nederlands' : user?.language === 'de' ? 'Deutsch' : 'English'}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <strong>{t('profile.rolesLabel')}</strong>{' '}
              <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                {user?.roles?.map((r, index) => (
                  <span
                    key={index}
                    style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      backgroundColor: '#333',
                      color: '#fff',
                      borderRadius: '1rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                    }}
                  >
                    {r.displayName || r.name}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => setEditing(true)}
              style={{ padding: '0.5rem 1rem', background: '#f57c00', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {t('profile.editButton')}
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label><strong>{t('profile.emailLabel')}</strong></label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label><strong>{t('profile.firstNameLabel')}</strong></label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label><strong>{t('profile.lastNameLabel')}</strong></label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label><strong>{t('profile.callsignLabel')}</strong></label>
              <input
                type="text"
                name="callsign"
                value={formData.callsign}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label><strong>{t('profile.languageLabel')}</strong></label>
              <select
                name="language"
                value={formData.language}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              >
                <option value="en">English</option>
                <option value="nl">Nederlands</option>
                <option value="de">Deutsch</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="submit"
                disabled={loading}
                style={{ padding: '0.5rem 1rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                {loading ? t('common.saving') : t('profile.saveChanges')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError('');
                  setSuccess('');
                }}
                style={{ padding: '0.5rem 1rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Profile;
