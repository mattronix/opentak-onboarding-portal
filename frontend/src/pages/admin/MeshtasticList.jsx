import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meshtasticAPI } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import '../../components/AdminTable.css';

function MeshtasticList() {
  const queryClient = useQueryClient();
  const { showError, showSuccess, confirm } = useNotification();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', url: '', description: '' });
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);

  const { data: configsData, isLoading, error: configsError } = useQuery({
    queryKey: ['meshtasticAdmin'],
    queryFn: async () => {
      const response = await meshtasticAPI.getAllAdmin();
      return response.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => meshtasticAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['meshtasticAdmin']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to update config'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => meshtasticAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['meshtasticAdmin']),
    onError: (err) => showError(err.response?.data?.error || 'Failed to delete config'),
  });

  const syncToOtsMutation = useMutation({
    mutationFn: (id) => meshtasticAPI.syncToOts(id),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['meshtasticAdmin']);
      if (response.data.warning) {
        showError(response.data.warning);
      } else {
        showSuccess('Config pushed to OTS successfully');
      }
    },
    onError: (err) => showError(err.response?.data?.error || 'Failed to push config to OTS'),
  });

  const handleSyncFromOts = async () => {
    setSyncing(true);
    try {
      const response = await meshtasticAPI.syncFromOts();
      const { created, updated, errors } = response.data;
      queryClient.invalidateQueries(['meshtasticAdmin']);
      if (errors?.length) {
        showError(`Sync issues: ${errors.join(', ')}`);
      } else {
        showSuccess(`Sync complete: ${created} created, ${updated} updated`);
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to sync from OTS');
    } finally {
      setSyncing(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', url: '', description: '' });
    setEditing(null);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: formData });
    }
  };

  if (isLoading) return <div className="admin-page"><div className="loading-state">Loading...</div></div>;

  // Show API errors if any
  if (configsError) {
    return (
      <div className="admin-page">
        <div className="alert alert-error">
          Failed to load channels: {configsError.response?.data?.error || configsError.message}
        </div>
      </div>
    );
  }

  const configs = configsData?.configs || [];

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1>Meshtastic Channels</h1>
          <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Individual channels synced from OTS. <a href="/admin/meshtastic/groups">Manage channel groups</a>
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleSyncFromOts} disabled={syncing}>
          {syncing ? 'Syncing...' : 'Sync from OTS'}
        </button>
      </div>
      <div className="admin-table-container">
        {configs.length === 0 ? (
          <div className="empty-state">No channels found. Click "Sync from OTS" to import channels from OpenTAK Server.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>OTS Sync</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs.map(config => (
                <tr key={config.id}>
                  <td><strong>{config.name}</strong></td>
                  <td>{config.description || '-'}</td>
                  <td>
                    {config.synced_at ? (
                      <span className="badge badge-success" title={`Last synced: ${new Date(config.synced_at).toLocaleString()}`}>
                        Synced
                      </span>
                    ) : config.url ? (
                      <span className="badge badge-warning">Not synced</span>
                    ) : (
                      <span className="badge badge-secondary">No URL</span>
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-sm btn-secondary" onClick={async () => {
                        // Fetch full config details
                        try {
                          const response = await meshtasticAPI.getById(config.id);
                          const fullConfig = response.data;
                          setEditing(fullConfig);
                          setFormData({
                            name: fullConfig.name,
                            url: fullConfig.url || '',
                            description: fullConfig.description || ''
                          });
                          setShowModal(true);
                        } catch (err) {
                          showError('Failed to load config details: ' + (err.response?.data?.error || err.message));
                        }
                      }}>Edit</button>
                      {!config.synced_at && config.url && (
                        <button
                          className="btn btn-sm btn-info"
                          onClick={() => syncToOtsMutation.mutate(config.id)}
                          disabled={syncToOtsMutation.isPending}
                        >
                          Push to OTS
                        </button>
                      )}
                      <button className="btn btn-sm btn-danger" onClick={async () => {
                        const confirmed = await confirm(`Delete "${config.name}"?`, 'Delete Config');
                        if (confirmed) deleteMutation.mutate(config.id);
                      }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Meshtastic Channel</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label>Channel URL</label>
                  <input
                    type="text"
                    value={formData.url}
                    disabled={true}
                  />
                  <span className="help-text">Channel URL is synced from OTS and cannot be changed.</span>
                </div>
                <div className="form-group">
                  <label>Name (optional)</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    disabled={editing?.synced_at}
                    placeholder="Will be derived from channel if not provided"
                  />
                  {editing?.synced_at && <span className="help-text">Name is synced from OTS and cannot be changed.</span>}
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>Update</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MeshtasticList;
