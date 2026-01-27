import { useState, useEffect } from 'react';
import { settingsAPI } from '../../services/api';
import './Admin.css';

// Component for numeric settings (number input with save button)
function NumericSettingItem({ setting, onSave, saving, formatSettingName }) {
  const [localValue, setLocalValue] = useState(setting?.value || '');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setLocalValue(setting?.value || '');
    setIsEditing(false);
  }, [setting?.value]);

  const handleSave = () => {
    onSave(setting.id, localValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalValue(setting?.value || '');
    setIsEditing(false);
  };

  return (
    <div className="setting-item setting-item-numeric">
      <div className="setting-info">
        <h4>{formatSettingName(setting.key)}</h4>
        <p className="setting-description">{setting.description}</p>
      </div>
      <div className="setting-numeric-input">
        <input
          type="number"
          min="1"
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            setIsEditing(true);
          }}
          disabled={saving}
        />
        {isEditing && (
          <div className="setting-text-actions">
            <button
              className="btn-save-setting"
              onClick={handleSave}
              disabled={saving}
            >
              Save
            </button>
            <button
              className="btn-cancel-setting"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Component for paired settings (toggle + text value)
function PairedSettingItem({ enabledSetting, valueSetting, onToggle, onSave, saving, formatSettingName }) {
  const [localValue, setLocalValue] = useState(valueSetting?.value || '');
  const [isEditing, setIsEditing] = useState(false);
  const isEnabled = enabledSetting?.value === 'true';

  useEffect(() => {
    setLocalValue(valueSetting?.value || '');
    setIsEditing(false);
  }, [valueSetting?.value]);

  const handleSave = () => {
    onSave(valueSetting.id, localValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalValue(valueSetting?.value || '');
    setIsEditing(false);
  };

  // Extract the base name (remove _enabled suffix)
  const baseName = enabledSetting.key.replace('_enabled', '');
  const displayName = formatSettingName(baseName);

  return (
    <div className="setting-item setting-item-paired">
      <div className="setting-header">
        <div className="setting-info">
          <h4>{displayName}</h4>
          <p className="setting-description">{enabledSetting.description}</p>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={() => onToggle(enabledSetting.id, enabledSetting.value)}
            disabled={saving}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>
      {valueSetting && (
        <div className="setting-value-section">
          <p className="setting-value-description">{valueSetting.description}</p>
          <div className="setting-text-input">
            <input
              type="text"
              value={localValue}
              onChange={(e) => {
                setLocalValue(e.target.value);
                setIsEditing(true);
              }}
              placeholder="Enter value..."
              disabled={saving}
            />
            {isEditing && (
              <div className="setting-text-actions">
                <button
                  className="btn-save-setting"
                  onClick={handleSave}
                  disabled={saving}
                >
                  Save
                </button>
                <button
                  className="btn-cancel-setting"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // Paired settings - these have both _enabled and _value variants
  const pairedSettingKeys = ['brand_name', 'help_link', 'help_email'];

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

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating setting:', err);
      setError(err.response?.data?.error || 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const handleTextChange = async (settingId, newValue) => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await settingsAPI.admin.updateById(settingId, newValue);

      setSuccess('Setting updated successfully');
      fetchSettings();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating setting:', err);
      setError(err.response?.data?.error || 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const formatSettingName = (key) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Detect if a setting should be rendered as a number input
  const isNumericSetting = (setting) => {
    // Check if key suggests it's a numeric value
    const numericKeyPatterns = ['_minutes', '_uses', '_count', '_limit', '_timeout', '_size', '_max', '_min'];
    const keyIsNumeric = numericKeyPatterns.some(pattern => setting.key.includes(pattern));

    // Also check if the value is purely numeric
    const valueIsNumeric = /^\d+$/.test(setting.value);

    return keyIsNumeric || (valueIsNumeric && setting.value !== 'true' && setting.value !== 'false');
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

  const renderNumericSetting = (setting) => {
    return (
      <NumericSettingItem
        key={setting.id}
        setting={setting}
        onSave={handleTextChange}
        saving={saving}
        formatSettingName={formatSettingName}
      />
    );
  };

  // Get paired settings from a category
  const getPairedSettings = (categorySettings) => {
    const pairs = [];
    const processed = new Set();

    for (const baseKey of pairedSettingKeys) {
      const enabledSetting = categorySettings?.find(s => s.key === `${baseKey}_enabled`);
      const valueSetting = categorySettings?.find(s => s.key === `${baseKey}_value`);

      if (enabledSetting) {
        pairs.push({ enabledSetting, valueSetting });
        processed.add(`${baseKey}_enabled`);
        if (valueSetting) processed.add(`${baseKey}_value`);
      }
    }

    return { pairs, processed };
  };

  // Get regular (non-paired) settings from a category
  const getRegularSettings = (categorySettings, processedKeys) => {
    return categorySettings?.filter(s => !processedKeys.has(s.key)) || [];
  };

  const renderCategorySettings = (categorySettings) => {
    const { pairs, processed } = getPairedSettings(categorySettings);
    const regularSettings = getRegularSettings(categorySettings, processed);

    // Separate numeric and toggle settings
    const numericSettings = regularSettings.filter(s => isNumericSetting(s));
    const toggleSettings = regularSettings.filter(s => !isNumericSetting(s));

    return (
      <>
        {/* Render paired settings first */}
        {pairs.map(({ enabledSetting, valueSetting }) => (
          <PairedSettingItem
            key={enabledSetting.id}
            enabledSetting={enabledSetting}
            valueSetting={valueSetting}
            onToggle={handleToggle}
            onSave={handleTextChange}
            saving={saving}
            formatSettingName={formatSettingName}
          />
        ))}
        {/* Render numeric settings */}
        {numericSettings.map(setting => renderNumericSetting(setting))}
        {/* Render regular toggle settings */}
        {toggleSettings.map(setting => renderSettingToggle(setting))}
      </>
    );
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
              {renderCategorySettings(settings.notifications)}
            </div>
          </div>
        )}

        {/* Email Section */}
        {settings.email && settings.email.length > 0 && (
          <div className="settings-section">
            <h2>Email</h2>
            <div className="settings-list">
              {renderCategorySettings(settings.email)}
            </div>
          </div>
        )}

        {/* Registration Section */}
        {settings.registration && settings.registration.length > 0 && (
          <div className="settings-section">
            <h2>Registration</h2>
            <div className="settings-list">
              {renderCategorySettings(settings.registration)}
            </div>
          </div>
        )}

        {/* Security Section */}
        {settings.security && settings.security.length > 0 && (
          <div className="settings-section">
            <h2>Security</h2>
            <div className="settings-list">
              {renderCategorySettings(settings.security)}
            </div>
          </div>
        )}

        {/* QR Code Enrollment Section */}
        {settings.qr_enrollment && settings.qr_enrollment.length > 0 && (
          <div className="settings-section">
            <h2>QR Code Enrollment</h2>
            <div className="settings-list">
              {renderCategorySettings(settings.qr_enrollment)}
            </div>
          </div>
        )}

        {/* General Section */}
        {settings.general && settings.general.length > 0 && (
          <div className="settings-section">
            <h2>General</h2>
            <div className="settings-list">
              {renderCategorySettings(settings.general)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;
