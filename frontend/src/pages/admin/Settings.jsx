import { useState, useEffect, useRef } from 'react';
import { settingsAPI } from '../../services/api';
import './Admin.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;

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

// Color name to hex mapping
const colorNameToHex = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  orange: '#ff9800',
  purple: '#800080',
  pink: '#ffc0cb',
  gray: '#808080',
  grey: '#808080',
  brown: '#a52a2a',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  lime: '#00ff00',
  navy: '#000080',
  teal: '#008080',
  maroon: '#800000',
  olive: '#808000',
  silver: '#c0c0c0',
};

// Convert color value to hex for the color picker
const toHexColor = (value) => {
  if (!value) return '#000000';
  // Already a hex value
  if (value.startsWith('#')) return value;
  // Check color name mapping
  const hex = colorNameToHex[value.toLowerCase()];
  if (hex) return hex;
  // Default fallback
  return '#000000';
};

// Component for color settings
function ColorSettingItem({ setting, onSave, saving, formatSettingName }) {
  const [localValue, setLocalValue] = useState(setting?.value || '#000000');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setLocalValue(setting?.value || '#000000');
    setIsEditing(false);
  }, [setting?.value]);

  const handleSave = () => {
    onSave(setting.id, localValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalValue(setting?.value || '#000000');
    setIsEditing(false);
  };

  // When color picker changes, update text to hex value
  const handleColorPickerChange = (e) => {
    setLocalValue(e.target.value);
    setIsEditing(true);
  };

  return (
    <div className="setting-item setting-item-color">
      <div className="setting-info">
        <h4>{formatSettingName(setting.key)}</h4>
        <p className="setting-description">{setting.description}</p>
      </div>
      <div className="setting-color-input">
        <input
          type="color"
          value={toHexColor(localValue)}
          onChange={handleColorPickerChange}
          disabled={saving}
          className="color-picker"
        />
        <input
          type="text"
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            setIsEditing(true);
          }}
          placeholder="#ff9800"
          disabled={saving}
          className="color-text"
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

// Component for logo upload
function LogoUploadSetting({ logoSettings, onUpload, onDelete, onDisplayModeChange, saving }) {
  const [preview, setPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (file) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Please use PNG, JPG, or GIF.');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('File too large. Maximum size is 2MB.');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);

    // Upload
    onUpload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const currentLogo = logoSettings?.custom_logo_enabled && logoSettings?.custom_logo_path
    ? `${API_BASE_URL}${logoSettings.custom_logo_path}`
    : logoSettings?.default_logo_path
      ? `${API_BASE_URL}${logoSettings.default_logo_path}`
      : null;

  return (
    <div className="setting-item setting-item-logo">
      <div className="setting-header">
        <div className="setting-info">
          <h4>Portal Logo</h4>
          <p className="setting-description">Upload a custom logo for the portal. Supports PNG, JPG, GIF (max 2MB)</p>
        </div>
      </div>

      <div className="logo-upload-section">
        {/* Current Logo Preview */}
        {(preview || currentLogo) && (
          <div className="logo-preview-container">
            <img
              src={preview || currentLogo}
              alt="Current logo"
              className="logo-preview"
            />
          </div>
        )}

        {/* Upload Zone */}
        <div
          className={`logo-dropzone ${dragOver ? 'drag-over' : ''}`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept=".png,.jpg,.jpeg,.gif"
            onChange={(e) => handleFileSelect(e.target.files[0])}
            style={{ display: 'none' }}
          />
          <p>Drop image here or click to upload</p>
        </div>

        {/* Display Mode */}
        <div className="logo-display-mode">
          <label>Display Mode:</label>
          <select
            value={logoSettings?.logo_display_mode || 'logo_and_text'}
            onChange={(e) => onDisplayModeChange(e.target.value)}
            disabled={saving}
          >
            <option value="logo_only">Logo Only</option>
            <option value="text_only">Text Only</option>
            <option value="logo_and_text">Logo and Text</option>
          </select>
        </div>

        {/* Actions */}
        {logoSettings?.custom_logo_enabled && (
          <button
            className="btn-cancel-setting"
            onClick={onDelete}
            disabled={saving}
          >
            Reset to Default
          </button>
        )}
      </div>
    </div>
  );
}

function Settings() {
  const [settings, setSettings] = useState({});
  const [logoSettings, setLogoSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // Paired settings - these have both _enabled and _value (or _url) variants
  const pairedSettingKeys = ['brand_name', 'atak_installer_qr', 'itak_installer_qr', 'meshtastic_installer_qr_android', 'meshtastic_installer_qr_iphone'];

  useEffect(() => {
    fetchSettings();
    fetchLogoSettings();
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

  const fetchLogoSettings = async () => {
    try {
      const response = await settingsAPI.admin.getLogo();
      setLogoSettings(response.data);
    } catch (err) {
      console.error('Error fetching logo settings:', err);
    }
  };

  const handleLogoUpload = async (file) => {
    try {
      setSaving(true);
      setError('');
      await settingsAPI.admin.uploadLogo(file);
      setSuccess('Logo uploaded successfully');
      fetchLogoSettings();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error uploading logo:', err);
      setError(err.response?.data?.error || 'Failed to upload logo');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoDelete = async () => {
    try {
      setSaving(true);
      setError('');
      await settingsAPI.admin.deleteLogo();
      setSuccess('Logo reset to default');
      fetchLogoSettings();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting logo:', err);
      setError(err.response?.data?.error || 'Failed to reset logo');
    } finally {
      setSaving(false);
    }
  };

  const handleDisplayModeChange = async (mode) => {
    try {
      setSaving(true);
      setError('');
      await settingsAPI.admin.updateByKey('logo_display_mode', mode);
      setSuccess('Display mode updated');
      fetchLogoSettings();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating display mode:', err);
      setError(err.response?.data?.error || 'Failed to update display mode');
    } finally {
      setSaving(false);
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
      // Look for both _value and _url suffixes
      const valueSetting = categorySettings?.find(s => s.key === `${baseKey}_value`) ||
                          categorySettings?.find(s => s.key === `${baseKey}_url`);

      if (enabledSetting) {
        pairs.push({ enabledSetting, valueSetting });
        processed.add(`${baseKey}_enabled`);
        if (valueSetting) processed.add(valueSetting.key);
      }
    }

    return { pairs, processed };
  };

  // Color setting keys
  const colorSettingKeys = ['primary_color', 'accent_color'];

  // Get regular (non-paired) settings from a category
  const getRegularSettings = (categorySettings, processedKeys) => {
    // Settings managed by dedicated components (not shown as toggles)
    const managedSettings = ['custom_logo_path', 'logo_display_mode', ...colorSettingKeys];
    return categorySettings?.filter(s => !processedKeys.has(s.key) && !managedSettings.includes(s.key)) || [];
  };

  // Get color settings from a category
  const getColorSettings = (categorySettings) => {
    return categorySettings?.filter(s => colorSettingKeys.includes(s.key)) || [];
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

        {/* Branding Section */}
        <div className="settings-section">
          <h2>Branding</h2>
          <div className="settings-list">
            <LogoUploadSetting
              logoSettings={logoSettings}
              onUpload={handleLogoUpload}
              onDelete={handleLogoDelete}
              onDisplayModeChange={handleDisplayModeChange}
              saving={saving}
            />
            {/* Color Settings */}
            {settings.branding && getColorSettings(settings.branding).map(setting => (
              <ColorSettingItem
                key={setting.id}
                setting={setting}
                onSave={handleTextChange}
                saving={saving}
                formatSettingName={formatSettingName}
              />
            ))}
            {settings.branding && renderCategorySettings(settings.branding)}
          </div>
        </div>

        {/* Radios Section */}
        {settings.radios && settings.radios.length > 0 && (
          <div className="settings-section">
            <h2>Radios</h2>
            <div className="settings-list">
              {renderCategorySettings(settings.radios)}
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
