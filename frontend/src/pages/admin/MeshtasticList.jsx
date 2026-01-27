import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meshtasticAPI, rolesAPI } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import '../../components/AdminTable.css';

function MeshtasticList() {
  const queryClient = useQueryClient();
  const { showError, confirm } = useNotification();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', url: '', description: '', yamlConfig: '', isPublic: false, defaultRadioConfig: false, showOnHomepage: false, roleIds: [] });
  const [error, setError] = useState('');

  const { data: configsData, isLoading } = useQuery({
    queryKey: ['meshtastic'],
    queryFn: async () => {
      const response = await meshtasticAPI.getAll();
      return response.data;
    },
  });

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await rolesAPI.getAll();
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => meshtasticAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['meshtastic']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to create config'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => meshtasticAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['meshtastic']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to update config'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => meshtasticAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['meshtastic']),
    onError: (err) => showError(err.response?.data?.error || 'Failed to delete config'),
  });

  const resetForm = () => {
    setFormData({ name: '', url: '', description: '', yamlConfig: '', isPublic: false, defaultRadioConfig: false, showOnHomepage: false, roleIds: [] });
    setEditing(null);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) return <div className="admin-page"><div className="loading-state">Loading...</div></div>;

  const configs = configsData?.configs || [];

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Meshtastic Configurations</h1>
        <button className="btn btn-primary" onClick={() => {resetForm(); setShowModal(true);}}>+ Add Config</button>
      </div>
      <div className="admin-table-container">
        {configs.length === 0 ? (
          <div className="empty-state">No configurations found</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs.map(config => (
                <tr key={config.id}>
                  <td><strong>{config.name}</strong></td>
                  <td>{config.description || '-'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-sm btn-secondary" onClick={async () => {
                        // Fetch full config details including yamlConfig
                        try {
                          const response = await meshtasticAPI.getById(config.id);
                          const fullConfig = response.data;
                          setEditing(fullConfig);
                          setFormData({
                            name: fullConfig.name,
                            url: fullConfig.url || '',
                            description: fullConfig.description || '',
                            yamlConfig: fullConfig.yamlConfig || '',
                            isPublic: fullConfig.isPublic || false,
                            defaultRadioConfig: fullConfig.defaultRadioConfig || false,
                            showOnHomepage: fullConfig.showOnHomepage || false,
                            roleIds: fullConfig.roles?.map(r => r.id) || []
                          });
                          setShowModal(true);
                        } catch (err) {
                          showError('Failed to load config details: ' + (err.response?.data?.error || err.message));
                        }
                      }}>Edit</button>
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit' : 'Create'} Meshtastic Config</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label>Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>YAML Configuration *</label>
                  <textarea
                    value={formData.yamlConfig}
                    onChange={(e) => setFormData({...formData, yamlConfig: e.target.value})}
                    placeholder="Enter YAML configuration for Meshtastic device"
                    required
                    style={{ fontFamily: 'monospace', minHeight: '150px' }}
                  />
                  <span className="help-text">Enter valid YAML configuration</span>
                </div>
                <div className="form-group">
                  <label>URL</label>
                  <input type="url" value={formData.url} onChange={(e) => setFormData({...formData, url: e.target.value})} placeholder="Optional configuration URL" />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={formData.isPublic} onChange={(e) => setFormData({...formData, isPublic: e.target.checked})} />
                    Public (visible to all users)
                  </label>
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={formData.defaultRadioConfig} onChange={(e) => setFormData({...formData, defaultRadioConfig: e.target.checked})} />
                    Default Radio Configuration
                  </label>
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={formData.showOnHomepage} onChange={(e) => setFormData({...formData, showOnHomepage: e.target.checked})} />
                    Show on Homepage
                  </label>
                </div>
                <div className="form-group">
                  <label>Roles</label>
                  <div className="checkbox-list">
                    {rolesData?.roles?.map(role => (
                      <label key={role.id} className="checkbox-label">
                        <input type="checkbox" checked={formData.roleIds.includes(role.id)} onChange={() => setFormData(prev => ({...prev, roleIds: prev.roleIds.includes(role.id) ? prev.roleIds.filter(r => r !== role.id) : [...prev.roleIds, role.id]}))} />
                        {role.displayName || role.name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MeshtasticList;
