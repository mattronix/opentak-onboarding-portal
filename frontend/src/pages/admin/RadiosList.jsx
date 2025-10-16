import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { radiosAPI, usersAPI } from '../../services/api';
import '../../components/AdminTable.css';

function RadiosList() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    platform: 'meshtastic',
    radioType: '',
    description: '',
    softwareVersion: '',
    model: '',
    vendor: '',
    shortName: '',
    longName: '',
    mac: '',
    assignedTo: null,
    owner: null
  });
  const [error, setError] = useState('');

  const { data: radiosData, isLoading } = useQuery({
    queryKey: ['radios'],
    queryFn: async () => {
      const response = await radiosAPI.getAll();
      return response.data;
    },
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await usersAPI.getAll({ per_page: 1000 });
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => radiosAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['radios']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to create radio'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => radiosAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['radios']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to update radio'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => radiosAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['radios']),
    onError: (err) => alert(err.response?.data?.error || 'Failed to delete radio'),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      platform: 'meshtastic',
      radioType: '',
      description: '',
      softwareVersion: '',
      model: '',
      vendor: '',
      shortName: '',
      longName: '',
      mac: '',
      assignedTo: null,
      owner: null
    });
    setEditing(null);
    setError('');
  };

  const handleEdit = async (radio) => {
    try {
      const response = await radiosAPI.getById(radio.id);
      const fullRadio = response.data;

      setEditing(fullRadio);
      setFormData({
        name: fullRadio.name || '',
        platform: fullRadio.platform || 'meshtastic',
        radioType: fullRadio.radioType || '',
        description: fullRadio.description || '',
        softwareVersion: fullRadio.softwareVersion || '',
        model: fullRadio.model || '',
        vendor: fullRadio.vendor || '',
        shortName: fullRadio.shortName || '',
        longName: fullRadio.longName || '',
        mac: fullRadio.mac || '',
        assignedTo: fullRadio.assignedTo || null,
        owner: fullRadio.owner || null
      });
      setError('');
      setShowModal(true);
    } catch (err) {
      alert('Failed to load radio details: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // Convert empty strings to null for user IDs
    const submitData = {
      ...formData,
      assignedTo: formData.assignedTo || null,
      owner: formData.owner || null
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  if (isLoading) return <div className="admin-page"><div className="loading-state">Loading...</div></div>;

  const radios = radiosData?.radios || [];
  const users = usersData?.users || [];

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Radios Management</h1>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          + Add Radio
        </button>
      </div>

      <div className="admin-table-container">
        {radios.length === 0 ? (
          <div className="empty-state">No radios found</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Platform</th>
                <th>Type</th>
                <th>Model</th>
                <th>MAC</th>
                <th>Assigned To</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {radios.map(radio => (
                <tr key={radio.id}>
                  <td><strong>{radio.name}</strong></td>
                  <td><span className="badge badge-primary">{radio.platform}</span></td>
                  <td>{radio.radioType || '-'}</td>
                  <td>{radio.model || '-'}</td>
                  <td>{radio.mac || '-'}</td>
                  <td>{users.find(u => u.id === radio.assignedTo)?.username || '-'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(radio)}>
                        Edit
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => {
                        if (window.confirm(`Delete "${radio.name}"?`)) deleteMutation.mutate(radio.id);
                      }}>
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Radio' : 'Create Radio'}</h2>
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
                  <label>Platform *</label>
                  <select value={formData.platform} onChange={(e) => setFormData({...formData, platform: e.target.value})} required>
                    <option value="meshtastic">Meshtastic</option>
                    <option value="atak">ATAK</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Radio Type</label>
                  <input type="text" value={formData.radioType} onChange={(e) => setFormData({...formData, radioType: e.target.value})} placeholder="e.g., LoRa, UHF" />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>Model</label>
                  <input type="text" value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})} placeholder="e.g., T-Beam, Heltec" />
                </div>

                <div className="form-group">
                  <label>Vendor</label>
                  <input type="text" value={formData.vendor} onChange={(e) => setFormData({...formData, vendor: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>Software Version</label>
                  <input type="text" value={formData.softwareVersion} onChange={(e) => setFormData({...formData, softwareVersion: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>Short Name</label>
                  <input type="text" value={formData.shortName} onChange={(e) => setFormData({...formData, shortName: e.target.value})} maxLength={4} />
                  <span className="help-text">4 character identifier</span>
                </div>

                <div className="form-group">
                  <label>Long Name</label>
                  <input type="text" value={formData.longName} onChange={(e) => setFormData({...formData, longName: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>MAC Address</label>
                  <input type="text" value={formData.mac} onChange={(e) => setFormData({...formData, mac: e.target.value})} placeholder="AA:BB:CC:DD:EE:FF" />
                </div>

                <div className="form-group">
                  <label>Assigned To</label>
                  <select value={formData.assignedTo || ''} onChange={(e) => setFormData({...formData, assignedTo: e.target.value ? parseInt(e.target.value) : null})}>
                    <option value="">Unassigned</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.username} ({user.firstName} {user.lastName})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Owner</label>
                  <select value={formData.owner || ''} onChange={(e) => setFormData({...formData, owner: e.target.value ? parseInt(e.target.value) : null})}>
                    <option value="">No Owner</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.username} ({user.firstName} {user.lastName})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editing ? 'Update' : 'Create'} Radio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RadiosList;
