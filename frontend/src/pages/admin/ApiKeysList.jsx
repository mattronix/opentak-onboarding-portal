import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiKeysAPI } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import './ApiKeysList.css';

function ApiKeysList() {
  const { t } = useTranslation();
  const { showSuccess, showError, confirm } = useNotification();
  const { hasRole } = useAuth();
  const canEdit = hasRole('api_key_admin') || hasRole('administrator');
  const [apiKeys, setApiKeys] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [selectedKey, setSelectedKey] = useState(null);
  const [newKeyValue, setNewKeyValue] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [],
    rate_limit: 1000,
    expires_at: '',
  });

  useEffect(() => {
    fetchApiKeys();
    fetchPermissions();
  }, []);

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const response = await apiKeysAPI.getAll();
      setApiKeys(response.data.api_keys || []);
    } catch (err) {
      console.error('Error fetching API keys:', err);
      showError(err.response?.data?.error || t('admin.apiKeys.failedLoad'));
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await apiKeysAPI.getPermissions();
      setAvailablePermissions(response.data.permissions || []);
    } catch (err) {
      console.error('Error fetching permissions:', err);
    }
  };

  const handleCreate = () => {
    setModalMode('create');
    setFormData({
      name: '',
      description: '',
      permissions: [],
      rate_limit: 1000,
      expires_at: '',
    });
    setNewKeyValue(null);
    setShowModal(true);
  };

  const handleEdit = (apiKey) => {
    setModalMode('edit');
    setSelectedKey(apiKey);
    setFormData({
      name: apiKey.name,
      description: apiKey.description || '',
      permissions: apiKey.permissions || [],
      rate_limit: apiKey.rate_limit || 1000,
      expires_at: apiKey.expires_at ? apiKey.expires_at.split('T')[0] : '',
    });
    setNewKeyValue(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    try {
      const data = {
        ...formData,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
      };

      if (modalMode === 'create') {
        const response = await apiKeysAPI.create(data);
        setNewKeyValue(response.data.raw_key);
        showSuccess(t('admin.apiKeys.createdSuccess'));
        fetchApiKeys();
      } else {
        await apiKeysAPI.update(selectedKey.id, data);
        showSuccess(t('admin.apiKeys.updatedSuccess'));
        setShowModal(false);
        fetchApiKeys();
      }
    } catch (err) {
      console.error('Error saving API key:', err);
      setFormError(err.response?.data?.error || t('admin.apiKeys.failedSave'));
    }
  };

  const handleDelete = async (apiKey) => {
    const confirmed = await confirm(
      t('admin.apiKeys.deleteConfirm', { name: apiKey.name }),
      t('admin.apiKeys.deleteKey')
    );
    if (!confirmed) return;

    try {
      await apiKeysAPI.delete(apiKey.id);
      showSuccess(t('admin.apiKeys.deletedSuccess'));
      fetchApiKeys();
    } catch (err) {
      console.error('Error deleting API key:', err);
      showError(err.response?.data?.error || t('admin.apiKeys.failedDelete'));
    }
  };

  const handleRegenerate = async (apiKey) => {
    const confirmed = await confirm(
      t('admin.apiKeys.regenerateConfirm', { name: apiKey.name }),
      t('admin.apiKeys.regenerateKey')
    );
    if (!confirmed) return;

    try {
      const response = await apiKeysAPI.regenerate(apiKey.id);
      setSelectedKey(apiKey);
      setNewKeyValue(response.data.raw_key);
      setModalMode('regenerate');
      setShowModal(true);
      showSuccess(t('admin.apiKeys.regeneratedSuccess'));
      fetchApiKeys();
    } catch (err) {
      console.error('Error regenerating API key:', err);
      showError(err.response?.data?.error || t('admin.apiKeys.failedRegenerate'));
    }
  };

  const handleToggleActive = async (apiKey) => {
    try {
      await apiKeysAPI.update(apiKey.id, { is_active: !apiKey.is_active });
      showSuccess(apiKey.is_active ? t('admin.apiKeys.deactivatedSuccess') : t('admin.apiKeys.activatedSuccess'));
      fetchApiKeys();
    } catch (err) {
      console.error('Error toggling API key:', err);
      showError(err.response?.data?.error || t('admin.apiKeys.failedToggle'));
    }
  };

  const handlePermissionChange = (permKey) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permKey)
        ? prev.permissions.filter(p => p !== permKey)
        : [...prev.permissions, permKey]
    }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showSuccess(t('admin.apiKeys.copiedClipboard'));
  };

  const formatDate = (dateString) => {
    if (!dateString) return t('common.never');
    return new Date(dateString).toLocaleString();
  };

  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-header">
          <h1>{t('admin.apiKeys.title')}</h1>
        </div>
        <div className="loading">{t('admin.apiKeys.loadingKeys')}</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>{t('admin.apiKeys.title')}</h1>
        {canEdit && (
          <button className="btn-primary" onClick={handleCreate}>
            {t('admin.apiKeys.createKey')}
          </button>
        )}
      </div>

      <div className="api-keys-info">
        <p>{t('admin.apiKeys.introText')}</p>
        <p>{t('admin.apiKeys.headerUsage')}</p>
      </div>

      <div className="api-keys-list">
        {apiKeys.length === 0 ? (
          <div className="empty-state">
            <p>{t('admin.apiKeys.noKeys')}</p>
            {canEdit && (
              <button className="btn-primary" onClick={handleCreate}>
                {t('admin.apiKeys.createFirst')}
              </button>
            )}
          </div>
        ) : (
          <table className="api-keys-table">
            <thead>
              <tr>
                <th>{t('common.name')}</th>
                <th>{t('admin.apiKeys.keyPrefix')}</th>
                <th>{t('common.status')}</th>
                <th>{t('admin.apiKeys.permissions')}</th>
                <th>{t('admin.apiKeys.usage')}</th>
                <th>{t('admin.apiKeys.lastUsed')}</th>
                <th>{t('admin.apiKeys.expires')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((apiKey) => (
                <tr key={apiKey.id} className={!apiKey.is_active || isExpired(apiKey.expires_at) ? 'inactive' : ''}>
                  <td>
                    <div className="key-name">
                      <strong>{apiKey.name}</strong>
                      {apiKey.description && <span className="key-description">{apiKey.description}</span>}
                    </div>
                  </td>
                  <td>
                    <code className="key-prefix">{apiKey.key_prefix}...</code>
                  </td>
                  <td>
                    <span className={`status-badge ${apiKey.is_active && !isExpired(apiKey.expires_at) ? 'active' : 'inactive'}`}>
                      {isExpired(apiKey.expires_at) ? t('common.expired') : apiKey.is_active ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  <td>
                    <span className="permission-count">{t('admin.apiKeys.nPermissions', { count: apiKey.permissions?.length || 0 })}</span>
                  </td>
                  <td>{t('admin.apiKeys.nRequests', { count: apiKey.usage_count.toLocaleString() })}</td>
                  <td>{formatDate(apiKey.last_used_at)}</td>
                  <td>{apiKey.expires_at ? formatDate(apiKey.expires_at) : t('common.never')}</td>
                  <td>
                    <div className="action-buttons">
                      {canEdit && (
                        <button className="btn-small btn-edit" onClick={() => handleEdit(apiKey)} title={t('common.edit')}>
                          {t('common.edit')}
                        </button>
                      )}
                      {canEdit && (
                        <button className="btn-small btn-regenerate" onClick={() => handleRegenerate(apiKey)} title={t('admin.apiKeys.regenerate')}>
                          {t('admin.apiKeys.regenerate')}
                        </button>
                      )}
                      {canEdit && (
                        <button
                          className={`btn-small ${apiKey.is_active ? 'btn-deactivate' : 'btn-activate'}`}
                          onClick={() => handleToggleActive(apiKey)}
                          title={apiKey.is_active ? t('admin.apiKeys.deactivate') : t('admin.apiKeys.activate')}
                        >
                          {apiKey.is_active ? t('admin.apiKeys.deactivate') : t('admin.apiKeys.activate')}
                        </button>
                      )}
                      {canEdit && (
                        <button className="btn-small btn-delete" onClick={() => handleDelete(apiKey)} title={t('common.delete')}>
                          {t('common.delete')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {modalMode === 'create' && t('admin.apiKeys.createKey')}
                {modalMode === 'edit' && t('admin.apiKeys.editKey')}
                {modalMode === 'regenerate' && t('admin.apiKeys.keyRegenerated')}
              </h2>
              {!newKeyValue && (
                <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
              )}
            </div>

            {newKeyValue ? (
              <div className="modal-body">
                <div className="new-key-display">
                  <div className="warning-message">
                    <strong>{t('admin.apiKeys.important')}:</strong> {t('admin.apiKeys.copyWarning')}
                  </div>
                  <div className="key-value-container">
                    <code className="key-value">{newKeyValue}</code>
                    <button className="btn-copy" onClick={() => copyToClipboard(newKeyValue)}>
                      {t('admin.apiKeys.copy')}
                    </button>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn-primary" onClick={() => { setShowModal(false); setNewKeyValue(null); }}>
                    {t('admin.apiKeys.copiedKey')}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="form-group">
                    <label htmlFor="name">{t('common.name')} *</label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t('admin.apiKeys.namePlaceholder')}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="description">{t('common.description')}</label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={t('admin.apiKeys.descriptionHelp')}
                      rows={2}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="rate_limit">{t('admin.apiKeys.rateLimit')}</label>
                    <input
                      type="number"
                      id="rate_limit"
                      value={formData.rate_limit}
                      onChange={(e) => setFormData({ ...formData, rate_limit: parseInt(e.target.value) || 1000 })}
                      min={1}
                      max={100000}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="expires_at">{t('admin.apiKeys.expirationDate')}</label>
                    <input
                      type="date"
                      id="expires_at"
                      value={formData.expires_at}
                      onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div className="form-group">
                    <label>{t('admin.apiKeys.permissions')}</label>
                    <div className="permissions-grid">
                      {availablePermissions.map((perm) => (
                        <label key={perm.key} className="permission-checkbox">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(perm.key)}
                            onChange={() => handlePermissionChange(perm.key)}
                          />
                          <span className="permission-label">
                            <strong>{perm.label}</strong>
                            <span className="permission-description">{perm.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="btn-primary">
                    {modalMode === 'create' ? t('admin.apiKeys.createKey') : t('admin.apiKeys.saveChanges')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ApiKeysList;
