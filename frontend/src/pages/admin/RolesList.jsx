import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rolesAPI } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import '../../components/AdminTable.css';

function RolesList() {
  const queryClient = useQueryClient();
  const { showError, confirm } = useNotification();
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: ''
  });
  const [error, setError] = useState('');

  // Fetch roles
  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await rolesAPI.getAll();
      return response.data;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => rolesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['roles']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to create role');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => rolesAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['roles']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to update role');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => rolesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['roles']);
    },
    onError: (err) => {
      showError(err.response?.data?.error || 'Failed to delete role');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      description: ''
    });
    setEditingRole(null);
    setError('');
  };

  const handleCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      displayName: role.displayName || '',
      description: role.description || ''
    });
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (role) => {
    const confirmed = await confirm(
      `Are you sure you want to delete role "${role.name}"?`,
      'Delete Role'
    );
    if (confirmed) {
      deleteMutation.mutate(role.id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <div className="admin-page"><div className="loading-state">Loading roles...</div></div>;
  }

  const roles = rolesData?.roles || [];

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Roles Management</h1>
        <div className="admin-actions">
          <button className="btn btn-primary" onClick={handleCreate}>
            + Add Role
          </button>
        </div>
      </div>

      <div className="admin-table-container">
        {roles.length === 0 ? (
          <div className="empty-state">No roles found</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Display Name</th>
                <th>Description</th>
                <th>User Count</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(role => (
                <tr key={role.id}>
                  <td><strong>{role.name}</strong></td>
                  <td>{role.displayName || '-'}</td>
                  <td>{role.description || '-'}</td>
                  <td>{role.userCount || 0}</td>
                  <td>
                    {role.isProtected ? (
                      <span className="badge badge-secondary">System Managed</span>
                    ) : (
                      <div className="table-actions">
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(role)}>
                          Edit
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(role)}>
                          Delete
                        </button>
                      </div>
                    )}
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
              <h2>{editingRole ? 'Edit Role' : 'Create Role'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                  <span className="help-text">Role identifier (e.g., "administrator", "user_admin")</span>
                </div>

                <div className="form-group">
                  <label>Display Name</label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="Human-readable name shown in UI"
                  />
                  <span className="help-text">Optional friendly name shown in the UI (e.g., "User Admin")</span>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description of the role"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingRole ? 'Update' : 'Create'} Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RolesList;
