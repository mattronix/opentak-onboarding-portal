import { useState, useEffect } from 'react';
import { settingsAPI } from '../../services/api';
import './Admin.css';

function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.admin.getAll();
      setSettings(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError(err.response?.data?.error || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (settingId, currentValue) => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const newValue = currentValue === 'true' ? 'false' : 'true';
      await settingsAPI.admin.updateById(settingId, newValue);

      setSuccess('Setting updated successfully');
      fetchSettings();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating setting:', err);
      setError(err.response?.data?.error || 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const renderSettingToggle = (setting) => {
    const isEnabled = setting.value === 'true';

    return (
      <div key={setting.id} className="setting-item">
        <div className="setting-info">
          <h4>{formatSettingName(setting.key)}</h4>
          <p className="setting-description">{setting.description}</p>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={() => handleToggle(setting.id, setting.value)}
            disabled={saving}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>
    );
  };

  const formatSettingName = (key) => {
    // Convert snake_case to Title Case
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-header">
          <h1>Settings</h1>
        </div>
        <div className="loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Settings</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="settings-container">
        {/* Notifications Section */}
        {settings.notifications && settings.notifications.length > 0 && (
          <div className="settings-section">
            <h2>Notifications</h2>
            <div className="settings-list">
              {settings.notifications.map(setting => renderSettingToggle(setting))}
            </div>
          </div>
        )}

        {/* Email Section */}
        {settings.email && settings.email.length > 0 && (
          <div className="settings-section">
            <h2>Email</h2>
            <div className="settings-list">
              {settings.email.map(setting => renderSettingToggle(setting))}
            </div>
          </div>
        )}

        {/* Security Section */}
        {settings.security && settings.security.length > 0 && (
          <div className="settings-section">
            <h2>Security</h2>
            <div className="settings-list">
              {settings.security.map(setting => renderSettingToggle(setting))}
            </div>
          </div>
        )}

        {/* General Section */}
        {settings.general && settings.general.length > 0 && (
          <div className="settings-section">
            <h2>General</h2>
            <div className="settings-list">
              {settings.general.map(setting => renderSettingToggle(setting))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;
