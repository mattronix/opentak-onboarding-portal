import { useState, useEffect } from 'react';
import { apiKeysAPI } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import './ApiKeysList.css';

function ApiKeysList() {
  const { showSuccess, showError, confirm } = useNotification();
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
      showError(err.response?.data?.error || 'Failed to load API keys');
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
        showSuccess('API key created successfully. Copy the key now - it will not be shown again!');
        fetchApiKeys();
      } else {
        await apiKeysAPI.update(selectedKey.id, data);
        showSuccess('API key updated successfully');
        setShowModal(false);
        fetchApiKeys();
      }
    } catch (err) {
      console.error('Error saving API key:', err);
      setFormError(err.response?.data?.error || 'Failed to save API key');
    }
  };

  const handleDelete = async (apiKey) => {
    const confirmed = await confirm(
      `Are you sure you want to delete the API key "${apiKey.name}"?`,
      'Delete API Key'
    );
    if (!confirmed) return;

    try {
      await apiKeysAPI.delete(apiKey.id);
      showSuccess('API key deleted successfully');
      fetchApiKeys();
    } catch (err) {
      console.error('Error deleting API key:', err);
      showError(err.response?.data?.error || 'Failed to delete API key');
    }
  };

  const handleRegenerate = async (apiKey) => {
    const confirmed = await confirm(
      `Are you sure you want to regenerate the API key "${apiKey.name}"? The old key will stop working immediately.`,
      'Regenerate API Key'
    );
    if (!confirmed) return;

    try {
      const response = await apiKeysAPI.regenerate(apiKey.id);
      setSelectedKey(apiKey);
      setNewKeyValue(response.data.raw_key);
      setModalMode('regenerate');
      setShowModal(true);
      showSuccess('API key regenerated successfully. Copy the new key now!');
      fetchApiKeys();
    } catch (err) {
      console.error('Error regenerating API key:', err);
      showError(err.response?.data?.error || 'Failed to regenerate API key');
    }
  };

  const handleToggleActive = async (apiKey) => {
    try {
      await apiKeysAPI.update(apiKey.id, { is_active: !apiKey.is_active });
      showSuccess(`API key ${apiKey.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchApiKeys();
    } catch (err) {
      console.error('Error toggling API key:', err);
      showError(err.response?.data?.error || 'Failed to update API key');
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
    showSuccess('Copied to clipboard!');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
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
          <h1>API Keys</h1>
        </div>
        <div className="loading">Loading API keys...</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>API Keys</h1>
        <button className="btn-primary" onClick={handleCreate}>
          Create API Key
        </button>
      </div>

      <div className="api-keys-info">
        <p>API keys allow external applications to access your API. Each key can have specific permissions and rate limits.</p>
        <p>Use the <code>X-API-Key</code> header to authenticate requests.</p>
      </div>

      <div className="api-keys-list">
        {apiKeys.length === 0 ? (
          <div className="empty-state">
            <p>No API keys created yet.</p>
            <button className="btn-primary" onClick={handleCreate}>
              Create your first API key
            </button>
          </div>
        ) : (
          <table className="api-keys-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Key Prefix</th>
                <th>Status</th>
                <th>Permissions</th>
                <th>Usage</th>
                <th>Last Used</th>
                <th>Expires</th>
                <th>Actions</th>
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
                      {isExpired(apiKey.expires_at) ? 'Expired' : apiKey.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <span className="permission-count">{apiKey.permissions?.length || 0} permissions</span>
                  </td>
                  <td>{apiKey.usage_count.toLocaleString()} requests</td>
                  <td>{formatDate(apiKey.last_used_at)}</td>
                  <td>{apiKey.expires_at ? formatDate(apiKey.expires_at) : 'Never'}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-small btn-edit" onClick={() => handleEdit(apiKey)} title="Edit">
                        Edit
                      </button>
                      <button className="btn-small btn-regenerate" onClick={() => handleRegenerate(apiKey)} title="Regenerate">
                        Regenerate
                      </button>
                      <button
                        className={`btn-small ${apiKey.is_active ? 'btn-deactivate' : 'btn-activate'}`}
                        onClick={() => handleToggleActive(apiKey)}
                        title={apiKey.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {apiKey.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button className="btn-small btn-delete" onClick={() => handleDelete(apiKey)} title="Delete">
                        Delete
                      </button>
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
                {modalMode === 'create' && 'Create API Key'}
                {modalMode === 'edit' && 'Edit API Key'}
                {modalMode === 'regenerate' && 'API Key Regenerated'}
              </h2>
              {!newKeyValue && (
                <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
              )}
            </div>

            {newKeyValue ? (
              <div className="modal-body">
                <div className="new-key-display">
                  <div className="warning-message">
                    <strong>Important:</strong> Copy this API key now. You won't be able to see it again!
                  </div>
                  <div className="key-value-container">
                    <code className="key-value">{newKeyValue}</code>
                    <button className="btn-copy" onClick={() => copyToClipboard(newKeyValue)}>
                      Copy
                    </button>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn-primary" onClick={() => { setShowModal(false); setNewKeyValue(null); }}>
                    I've copied the key
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="form-group">
                    <label htmlFor="name">Name *</label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Production API Key"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Optional description for this API key"
                      rows={2}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="rate_limit">Rate Limit (requests/hour)</label>
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
                    <label htmlFor="expires_at">Expiration Date (optional)</label>
                    <input
                      type="date"
                      id="expires_at"
                      value={formData.expires_at}
                      onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div className="form-group">
                    <label>Permissions</label>
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
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    {modalMode === 'create' ? 'Create API Key' : 'Save Changes'}
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
