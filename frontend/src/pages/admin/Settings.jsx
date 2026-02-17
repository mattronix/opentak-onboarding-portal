import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsAPI, oidcAPI, rolesAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import './Admin.css';
import '../../components/AdminTable.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;

// Component for numeric settings (number input with save button)
function NumericSettingItem({ setting, onSave, saving, formatSettingName, canEdit = true }) {
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
          disabled={saving || !canEdit}
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
function PairedSettingItem({ enabledSetting, valueSetting, onToggle, onSave, saving, formatSettingName, canEdit = true }) {
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
            disabled={saving || !canEdit}
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
              disabled={saving || !canEdit}
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
function ColorSettingItem({ setting, onSave, saving, formatSettingName, canEdit = true }) {
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
          disabled={saving || !canEdit}
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
          disabled={saving || !canEdit}
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

// Component for dropdown settings (e.g. theme selection)
function DropdownSettingItem({ setting, options, onSave, saving, formatSettingName, canEdit = true }) {
  const [localValue, setLocalValue] = useState(setting?.value || '');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setLocalValue(setting?.value || '');
    setIsEditing(false);
  }, [setting?.value]);

  const handleChange = (e) => {
    setLocalValue(e.target.value);
    setIsEditing(true);
  };

  const handleSave = () => {
    onSave(setting.id, localValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalValue(setting?.value || '');
    setIsEditing(false);
  };

  return (
    <div className="setting-item setting-item-color">
      <div className="setting-info">
        <h4>{formatSettingName(setting.key)}</h4>
        <p className="setting-description">{setting.description}</p>
      </div>
      <div className="setting-color-input">
        <select
          value={localValue}
          onChange={handleChange}
          disabled={saving || !canEdit}
          style={{ padding: '0.5rem 0.75rem', borderRadius: '4px', fontSize: '0.95rem' }}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
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
function LogoUploadSetting({ logoSettings, onUpload, onDelete, onDisplayModeChange, saving, canEdit = true }) {
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
        {canEdit && (
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
        )}

        {/* Display Mode */}
        <div className="logo-display-mode">
          <label>Display Mode:</label>
          <select
            value={logoSettings?.logo_display_mode || 'logo_and_text'}
            onChange={(e) => onDisplayModeChange(e.target.value)}
            disabled={saving || !canEdit}
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
            disabled={saving || !canEdit}
          >
            Reset to Default
          </button>
        )}
      </div>
    </div>
  );
}

// OIDC Provider Form Modal
function OIDCProviderModal({ provider, roles, onSave, onClose, saving, error: externalError }) {
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    button_color: '#4285F4',
    discovery_url: '',
    client_id: '',
    client_secret: '',
    role_claim: 'roles',
    sync_roles: true,
    enabled: true,
    role_mappings: {},
  });
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const iconInputRef = useRef(null);

  useEffect(() => {
    if (provider) {
      setFormData({
        name: provider.name || '',
        display_name: provider.display_name || '',
        button_color: provider.button_color || '#4285F4',
        discovery_url: provider.discovery_url || '',
        client_id: provider.client_id || '',
        client_secret: '',
        role_claim: provider.role_claim || 'roles',
        sync_roles: provider.sync_roles !== false,
        enabled: provider.enabled !== false,
        role_mappings: provider.role_mappings || {},
      });
      setIconFile(null);
      setIconPreview(null);
      setRemoveIcon(false);
    }
  }, [provider]);

  // Compute the effective icon URL for preview
  const effectiveIconUrl = removeIcon && !iconFile
    ? null
    : iconPreview || (provider?.icon_url ? `${API_BASE_URL}${provider.icon_url}` : null);

  const handleIconFileSelect = (file) => {
    if (!file) return;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Please use PNG, JPG, GIF, or SVG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('File too large. Maximum size is 2MB.');
      return;
    }
    setIconFile(file);
    setRemoveIcon(false);
    const reader = new FileReader();
    reader.onload = (e) => setIconPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveIconClick = () => {
    setIconFile(null);
    setIconPreview(null);
    setRemoveIcon(true);
    if (iconInputRef.current) iconInputRef.current.value = '';
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleAddMapping = () => {
    setFormData(prev => ({
      ...prev,
      role_mappings: { ...prev.role_mappings, '': '' },
    }));
  };

  const handleMappingKeyChange = (oldKey, newKey) => {
    setFormData(prev => {
      const mappings = { ...prev.role_mappings };
      const value = mappings[oldKey];
      delete mappings[oldKey];
      mappings[newKey] = value;
      return { ...prev, role_mappings: mappings };
    });
  };

  const handleMappingValueChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      role_mappings: { ...prev.role_mappings, [key]: value },
    }));
  };

  const handleRemoveMapping = (key) => {
    setFormData(prev => {
      const mappings = { ...prev.role_mappings };
      delete mappings[key];
      return { ...prev, role_mappings: mappings };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData };
    // Don't send empty client_secret on edit (means "keep existing")
    if (provider && !data.client_secret) {
      delete data.client_secret;
    }
    onSave(data, iconFile, removeIcon);
  };

  // Compute text color for button preview
  const getContrastColor = (hex) => {
    if (!hex || !hex.startsWith('#')) return '#ffffff';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal oidc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{provider ? 'Edit OIDC Provider' : 'Add OIDC Provider'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {externalError && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                {externalError}
              </div>
            )}
            <div className="oidc-form-grid">
              <div className="form-group">
                <label>Internal Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. keycloak, azure-ad"
                  required
                />
                <small>Unique identifier (no spaces)</small>
              </div>

              <div className="form-group">
                <label>Display Name *</label>
                <input
                  type="text"
                  name="display_name"
                  value={formData.display_name}
                  onChange={handleChange}
                  placeholder="e.g. Sign in with Keycloak"
                  required
                />
              </div>

              <div className="form-group">
                <label>Discovery URL *</label>
                <input
                  type="url"
                  name="discovery_url"
                  value={formData.discovery_url}
                  onChange={handleChange}
                  placeholder="https://idp.example.com/.well-known/openid-configuration"
                  required
                />
              </div>

              <div className="form-group">
                <label>Client ID *</label>
                <input
                  type="text"
                  name="client_id"
                  value={formData.client_id}
                  onChange={handleChange}
                  placeholder="your-client-id"
                  required
                />
              </div>

              <div className="form-group">
                <label>Client Secret {provider ? '' : '*'}</label>
                <input
                  type="password"
                  name="client_secret"
                  value={formData.client_secret}
                  onChange={handleChange}
                  placeholder={provider ? 'Leave blank to keep existing' : 'your-client-secret'}
                  required={!provider}
                />
              </div>

              <div className="form-group">
                <label>Role Claim Path</label>
                <input
                  type="text"
                  name="role_claim"
                  value={formData.role_claim}
                  onChange={handleChange}
                  placeholder="e.g. roles, realm_access.roles"
                />
                <small>Dot-path to roles in the ID token (e.g. realm_access.roles for Keycloak)</small>
              </div>

              <div className="form-group">
                <label>Button Color</label>
                <div className="oidc-color-row">
                  <input
                    type="color"
                    name="button_color"
                    value={toHexColor(formData.button_color)}
                    onChange={handleChange}
                    className="color-picker"
                  />
                  <input
                    type="text"
                    name="button_color"
                    value={formData.button_color}
                    onChange={handleChange}
                    placeholder="#4285F4"
                    className="color-text-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Button Icon</label>
                {effectiveIconUrl && (
                  <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <img src={effectiveIconUrl} alt="Icon preview" style={{ width: 32, height: 32, objectFit: 'contain', background: '#f0f0f0', borderRadius: 4, padding: 2 }} />
                    <button type="button" className="btn-cancel-setting" onClick={handleRemoveIconClick} style={{ fontSize: '0.8rem' }}>
                      Remove
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  ref={iconInputRef}
                  accept=".png,.jpg,.jpeg,.gif,.svg"
                  onChange={(e) => handleIconFileSelect(e.target.files[0])}
                />
                <small>Upload an icon image (PNG, JPG, GIF, SVG, max 2MB)</small>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    name="enabled"
                    checked={formData.enabled}
                    onChange={handleChange}
                  />
                  Enabled
                </label>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    name="sync_roles"
                    checked={formData.sync_roles}
                    onChange={handleChange}
                  />
                  Sync Roles from OIDC
                </label>
                <small>When enabled, roles from the OIDC provider will be mapped to local roles using the mappings below</small>
              </div>
            </div>

            {/* Button Preview */}
            <div className="oidc-preview-section">
              <label>Button Preview</label>
              <button
                type="button"
                className="oidc-btn-preview"
                style={{
                  backgroundColor: formData.button_color,
                  color: getContrastColor(toHexColor(formData.button_color)),
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                {effectiveIconUrl && (
                  <img src={effectiveIconUrl} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
                )}
                {formData.display_name || 'Sign in with Provider'}
              </button>
            </div>

            {/* Role Mappings - only show when sync_roles is enabled */}
            {formData.sync_roles && (
              <div className="oidc-role-mappings">
                <div className="oidc-role-mappings-header">
                  <label>Role Mappings</label>
                  <button type="button" className="btn-save-setting" onClick={handleAddMapping}>
                    + Add Mapping
                  </button>
                </div>
                <small style={{ color: '#666', display: 'block', marginBottom: '0.75rem' }}>
                  Map OIDC role names to local roles. Unmapped OIDC roles are ignored.
                </small>
                {Object.keys(formData.role_mappings).length === 0 ? (
                  <p style={{ color: '#999', fontSize: '0.9rem', fontStyle: 'italic' }}>
                    No role mappings configured. All users will keep their default roles.
                  </p>
                ) : (
                  <div className="oidc-mapping-list">
                    {Object.entries(formData.role_mappings).map(([oidcRole, localRole], idx) => (
                      <div key={idx} className="oidc-mapping-row">
                        <input
                          type="text"
                          value={oidcRole}
                          onChange={(e) => handleMappingKeyChange(oidcRole, e.target.value)}
                          placeholder="OIDC role name"
                          className="oidc-mapping-input"
                        />
                        <span className="oidc-mapping-arrow">&rarr;</span>
                        <select
                          value={localRole}
                          onChange={(e) => handleMappingValueChange(oidcRole, e.target.value)}
                          className="oidc-mapping-select"
                        >
                          <option value="">-- Select local role --</option>
                          {roles.map(role => (
                            <option key={role.id} value={role.name}>
                              {role.displayName || role.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="oidc-mapping-remove"
                          onClick={() => handleRemoveMapping(oidcRole)}
                          title="Remove mapping"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (provider ? 'Update Provider' : 'Add Provider')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Settings() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('settings_admin') || hasRole('administrator');

  const [settings, setSettings] = useState({});
  const [logoSettings, setLogoSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // OIDC Provider state
  const [oidcProviders, setOidcProviders] = useState([]);
  const [showOidcModal, setShowOidcModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [oidcSaving, setOidcSaving] = useState(false);
  const [oidcModalError, setOidcModalError] = useState('');

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await rolesAPI.getAll();
      return response.data;
    },
  });
  const roles = rolesData?.roles || [];

  // Paired settings - these have both _enabled and _value (or _url) variants
  const pairedSettingKeys = ['brand_name', 'atak_installer_qr', 'itak_installer_qr', 'meshtastic_installer_qr_android', 'meshtastic_installer_qr_iphone'];

  useEffect(() => {
    fetchSettings();
    fetchLogoSettings();
    fetchOidcProviders();
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

  const fetchOidcProviders = async () => {
    try {
      const response = await oidcAPI.admin.getAll();
      setOidcProviders(response.data.providers || []);
    } catch (err) {
      console.error('Error fetching OIDC providers:', err);
    }
  };

  const handleOidcSave = async (data, iconFile, removeIcon) => {
    try {
      setOidcSaving(true);
      setOidcModalError('');
      let response;
      if (editingProvider) {
        response = await oidcAPI.admin.update(editingProvider.id, data);
        setSuccess('OIDC provider updated');
      } else {
        response = await oidcAPI.admin.create(data);
        setSuccess('OIDC provider created');
      }

      const providerId = response.data.id;

      // Handle icon upload or deletion
      if (iconFile) {
        await oidcAPI.admin.uploadIcon(providerId, iconFile);
      } else if (removeIcon) {
        await oidcAPI.admin.deleteIcon(providerId);
      }

      setShowOidcModal(false);
      setEditingProvider(null);
      setOidcModalError('');
      fetchOidcProviders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving OIDC provider:', err);
      setOidcModalError(err.response?.data?.error || 'Failed to save OIDC provider');
    } finally {
      setOidcSaving(false);
    }
  };

  const handleOidcDelete = async (provider) => {
    if (!confirm(`Delete OIDC provider "${provider.display_name}"? This cannot be undone.`)) return;
    try {
      setSaving(true);
      setError('');
      await oidcAPI.admin.delete(provider.id);
      setSuccess('OIDC provider deleted');
      fetchOidcProviders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting OIDC provider:', err);
      setError(err.response?.data?.error || 'Failed to delete OIDC provider');
    } finally {
      setSaving(false);
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
            disabled={saving || !canEdit}
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
        canEdit={canEdit}
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

  // Dropdown setting keys (rendered with <select>)
  const dropdownSettingKeys = ['default_theme', 'kiosk_default_theme'];
  const dropdownOptions = {
    default_theme: [
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
    ],
    kiosk_default_theme: [
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
    ],
  };

  // Get regular (non-paired) settings from a category
  const getRegularSettings = (categorySettings, processedKeys) => {
    // Settings managed by dedicated components (not shown as toggles)
    const managedSettings = ['custom_logo_path', 'logo_display_mode', ...colorSettingKeys, ...dropdownSettingKeys];
    return categorySettings?.filter(s => !processedKeys.has(s.key) && !managedSettings.includes(s.key)) || [];
  };

  // Get color settings from a category
  const getColorSettings = (categorySettings) => {
    return categorySettings?.filter(s => colorSettingKeys.includes(s.key)) || [];
  };

  // Get dropdown settings from a category
  const getDropdownSettings = (categorySettings) => {
    return categorySettings?.filter(s => dropdownSettingKeys.includes(s.key)) || [];
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
            canEdit={canEdit}
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

        {/* OIDC Providers Section */}
        <div className="settings-section">
          <div className="oidc-section-header">
            <h2>OIDC Providers</h2>
            <button
              className="btn btn-primary"
              onClick={() => { setEditingProvider(null); setOidcModalError(''); setShowOidcModal(true); }}
              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
              disabled={!canEdit}
            >
              + Add Provider
            </button>
          </div>

          {oidcProviders.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>
              No OIDC providers configured. Add a provider to enable single sign-on.
            </p>
          ) : (
            <div className="oidc-providers-list">
              {oidcProviders.map(provider => (
                <div key={provider.id} className="oidc-provider-card">
                  <div className="oidc-provider-info">
                    <div className="oidc-provider-top">
                      <div>
                        <h4>{provider.display_name}</h4>
                        <span className="oidc-provider-name">{provider.name}</span>
                      </div>
                      <span className={`oidc-provider-status ${provider.enabled ? 'enabled' : 'disabled'}`}>
                        {provider.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <p className="oidc-provider-url">{provider.discovery_url}</p>
                    <div className="oidc-provider-preview">
                      <button
                        type="button"
                        className="oidc-btn-preview-small"
                        style={{
                          backgroundColor: provider.button_color || '#4285F4',
                          color: getContrastColorUtil(toHexColor(provider.button_color || '#4285F4')),
                          border: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        {provider.icon_url && (
                          <img src={`${API_BASE_URL}${provider.icon_url}`} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                        )}
                        {provider.display_name}
                      </button>
                    </div>
                    {provider.role_mappings && Object.keys(provider.role_mappings).length > 0 && (
                      <div className="oidc-provider-mappings">
                        <small>Role mappings: {Object.entries(provider.role_mappings).map(([k, v]) => `${k} → ${v}`).join(', ')}</small>
                      </div>
                    )}
                  </div>
                  <div className="oidc-provider-actions">
                    <button
                      className="btn-save-setting"
                      onClick={() => { setEditingProvider(provider); setOidcModalError(''); setShowOidcModal(true); }}
                      disabled={!canEdit}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-cancel-setting"
                      onClick={() => handleOidcDelete(provider)}
                      style={{ color: '#c33' }}
                      disabled={!canEdit}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
              canEdit={canEdit}
            />
            {/* Color Settings */}
            {settings.branding && getColorSettings(settings.branding).map(setting => (
              <ColorSettingItem
                key={setting.id}
                setting={setting}
                onSave={handleTextChange}
                saving={saving}
                formatSettingName={formatSettingName}
                canEdit={canEdit}
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

        {/* Kiosk Enrollment Section */}
        {settings.kiosk && settings.kiosk.length > 0 && (
          <div className="settings-section">
            <h2>Kiosk Enrollment</h2>
            <p className="setting-description" style={{ marginBottom: '1rem' }}>
              Once enabled, the kiosk screen is available at <a href="/kiosk" target="_blank" rel="noopener noreferrer"><code>/kiosk</code></a>
            </p>
            <div className="settings-list">
              {renderCategorySettings(settings.kiosk)}
            </div>
          </div>
        )}

        {/* Appearance Section */}
        {settings.appearance && settings.appearance.length > 0 && (
          <div className="settings-section">
            <h2>Appearance</h2>
            <div className="settings-list">
              {getDropdownSettings(settings.appearance).map(setting => (
                <DropdownSettingItem
                  key={setting.id}
                  setting={setting}
                  options={dropdownOptions[setting.key] || []}
                  onSave={handleTextChange}
                  saving={saving}
                  formatSettingName={formatSettingName}
                  canEdit={canEdit}
                />
              ))}
              {renderCategorySettings(settings.appearance)}
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

      {/* OIDC Provider Modal */}
      {showOidcModal && (
        <OIDCProviderModal
          provider={editingProvider}
          roles={roles}
          onSave={handleOidcSave}
          onClose={() => { setShowOidcModal(false); setEditingProvider(null); setOidcModalError(''); }}
          saving={oidcSaving}
          error={oidcModalError}
        />
      )}
    </div>
  );
}

// Utility for contrast color (used in settings list)
function getContrastColorUtil(hex) {
  if (!hex || !hex.startsWith('#')) return '#ffffff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export default Settings;
