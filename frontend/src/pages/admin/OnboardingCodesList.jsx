import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { onboardingCodesAPI, rolesAPI, usersAPI } from '../../services/api';
import '../../components/AdminTable.css';

function OnboardingCodesList() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    onboardingCode: '',
    maxUses: '',
    onboardContact: null,
    expiryDate: '',
    userExpiryDate: '',
    roleIds: []
  });
  const [error, setError] = useState('');

  const { data: codesData, isLoading } = useQuery({
    queryKey: ['onboardingCodes'],
    queryFn: async () => {
      const response = await onboardingCodesAPI.getAll();
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

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await usersAPI.getAll({ per_page: 1000 });
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => onboardingCodesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['onboardingCodes']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to create code'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => onboardingCodesAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['onboardingCodes']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to update code'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => onboardingCodesAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['onboardingCodes']),
    onError: (err) => alert(err.response?.data?.error || 'Failed to delete code'),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      onboardingCode: '',
      maxUses: '',
      onboardContact: null,
      expiryDate: '',
      userExpiryDate: '',
      roleIds: []
    });
    setEditing(null);
    setError('');
  };

  const copyOnboardingUrl = (code) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/register/${code}`;

    navigator.clipboard.writeText(url).then(() => {
      alert(`Onboarding URL copied to clipboard!\n\n${url}`);
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert(`Onboarding URL copied to clipboard!\n\n${url}`);
    });
  };

  const handleEdit = async (code) => {
    try {
      const response = await onboardingCodesAPI.getById(code.id);
      const fullCode = response.data;

      setEditing(fullCode);
      setFormData({
        name: fullCode.name || '',
        description: fullCode.description || '',
        onboardingCode: fullCode.onboardingCode || '',
        maxUses: fullCode.maxUses || '',
        onboardContact: fullCode.onboardContact?.id || null,
        expiryDate: fullCode.expiryDate ? fullCode.expiryDate.split('T')[0] : '',
        userExpiryDate: fullCode.userExpiryDate ? fullCode.userExpiryDate.split('T')[0] : '',
        roleIds: fullCode.roles?.map(r => r.id) || []
      });
      setError('');
      setShowModal(true);
    } catch (err) {
      alert('Failed to load code details: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const submitData = {
      ...formData,
      maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
      onboardContact: formData.onboardContact || null,
      expiryDate: formData.expiryDate || null,
      userExpiryDate: formData.userExpiryDate || null
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  if (isLoading) return <div className="admin-page"><div className="loading-state">Loading...</div></div>;

  const codes = codesData?.codes || [];
  const users = usersData?.users || [];
  const roles = rolesData?.roles || [];

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Onboarding Codes Management</h1>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          + Add Code
        </button>
      </div>

      <div className="admin-table-container">
        {codes.length === 0 ? (
          <div className="empty-state">No onboarding codes found</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Uses</th>
                <th>Contact</th>
                <th>Expiry</th>
                <th>Roles</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(code => (
                <tr key={code.id}>
                  <td><strong>{code.name}</strong></td>
                  <td><code>{code.onboardingCode}</code></td>
                  <td>{code.uses} / {code.maxUses || '∞'}</td>
                  <td>{code.onboardContact?.username || '-'}</td>
                  <td>{code.expiryDate ? new Date(code.expiryDate).toLocaleDateString() : 'Never'}</td>
                  <td>
                    {code.roles?.map(role => (
                      <span key={role.id} className="badge badge-primary">{role.name}</span>
                    ))}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-sm btn-success" onClick={() => copyOnboardingUrl(code.onboardingCode)} title="Copy registration URL">
                        📋 Copy URL
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(code)}>
                        Edit
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => {
                        if (window.confirm(`Delete code "${code.name}"?`)) deleteMutation.mutate(code.id);
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
              <h2>{editing ? 'Edit Onboarding Code' : 'Create Onboarding Code'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-group">
                  <label>Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                  <span className="help-text">Friendly name for this code</span>
                </div>

                <div className="form-group">
                  <label>Code *</label>
                  <input type="text" value={formData.onboardingCode} onChange={(e) => setFormData({...formData, onboardingCode: e.target.value})} required disabled={!!editing} />
                  <span className="help-text">{editing ? 'Code cannot be changed' : 'Unique code for registration'}</span>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>Max Uses</label>
                  <input type="number" value={formData.maxUses} onChange={(e) => setFormData({...formData, maxUses: e.target.value})} min="0" placeholder="Unlimited" />
                  <span className="help-text">Leave blank for unlimited uses</span>
                </div>

                <div className="form-group">
                  <label>Onboard Contact</label>
                  <select value={formData.onboardContact || ''} onChange={(e) => setFormData({...formData, onboardContact: e.target.value ? parseInt(e.target.value) : null})}>
                    <option value="">No Contact</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.username} ({user.firstName} {user.lastName})</option>
                    ))}
                  </select>
                  <span className="help-text">User who will receive new registrations</span>
                </div>

                <div className="form-group">
                  <label>Code Expiry Date</label>
                  <input type="date" value={formData.expiryDate} onChange={(e) => setFormData({...formData, expiryDate: e.target.value})} />
                  <span className="help-text">When this code expires</span>
                </div>

                <div className="form-group">
                  <label>User Account Expiry Date</label>
                  <input type="date" value={formData.userExpiryDate} onChange={(e) => setFormData({...formData, userExpiryDate: e.target.value})} />
                  <span className="help-text">When accounts created with this code expire</span>
                </div>

                <div className="form-group">
                  <label>Roles</label>
                  <div className="checkbox-list">
                    {roles.map(role => (
                      <label key={role.id} className="checkbox-label">
                        <span>{role.name}</span>
                        <input
                          type="checkbox"
                          checked={formData.roleIds.includes(role.id)}
                          onChange={() => setFormData(prev => ({
                            ...prev,
                            roleIds: prev.roleIds.includes(role.id)
                              ? prev.roleIds.filter(r => r !== role.id)
                              : [...prev.roleIds, role.id]
                          }))}
                        />
                      </label>
                    ))}
                  </div>
                  <span className="help-text">Roles assigned to new users</span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editing ? 'Update' : 'Create'} Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OnboardingCodesList;
