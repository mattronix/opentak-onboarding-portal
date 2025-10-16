import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersAPI, rolesAPI } from '../../services/api';
import '../../components/AdminTable.css';

function UsersList() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    callsign: '',
    password: '',
    expiryDate: '',
    roles: []
  });
  const [error, setError] = useState('');

  // Fetch users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', page, search],
    queryFn: async () => {
      const response = await usersAPI.getAll({ page, per_page: 20, search });
      return response.data;
    },
  });

  // Fetch roles for the form
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await rolesAPI.getAll();
      return response.data;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => usersAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to create user');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => usersAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to update user');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => usersAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
    },
    onError: (err) => {
      alert(err.response?.data?.error || 'Failed to delete user');
    },
  });

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      callsign: '',
      password: '',
      expiryDate: '',
      roles: []
    });
    setEditingUser(null);
    setError('');
  };

  const handleCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      callsign: user.callsign || '',
      password: '',
      expiryDate: user.expiryDate ? user.expiryDate.split('T')[0] : '',
      roles: user.roles || []
    });
    setError('');
    setShowModal(true);
  };

  const handleDelete = (user) => {
    if (window.confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      deleteMutation.mutate(user.id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const submitData = {
      ...formData,
      expiryDate: formData.expiryDate || null
    };

    // Remove password if empty on update
    if (editingUser && !submitData.password) {
      delete submitData.password;
    }

    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: submitData });
    } else {
      if (!submitData.password) {
        setError('Password is required for new users');
        return;
      }
      createMutation.mutate(submitData);
    }
  };

  const handleRoleToggle = (roleName) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(roleName)
        ? prev.roles.filter(r => r !== roleName)
        : [...prev.roles, roleName]
    }));
  };

  if (isLoading) {
    return <div className="admin-page"><div className="loading-state">Loading users...</div></div>;
  }

  const users = usersData?.users || [];
  const total = usersData?.total || 0;
  const perPage = usersData?.per_page || 20;
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Users Management</h1>
        <div className="admin-actions">
          <input
            type="text"
            className="search-box"
            placeholder="Search users..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <button className="btn btn-primary" onClick={handleCreate}>
            + Add User
          </button>
        </div>
      </div>

      <div className="admin-table-container">
        {users.length === 0 ? (
          <div className="empty-state">No users found</div>
        ) : (
          <>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Callsign</th>
                  <th>Roles</th>
                  <th>Expiry Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.firstName} {user.lastName}</td>
                    <td>{user.email}</td>
                    <td>{user.callsign}</td>
                    <td>
                      {user.roles?.map(role => (
                        <span key={role} className="badge badge-primary">{role}</span>
                      ))}
                    </td>
                    <td>{user.expiryDate ? new Date(user.expiryDate).toLocaleDateString() : 'Never'}</td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(user)}>
                          Edit
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(user)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </button>
                <span className="pagination-info">
                  Page {page} of {totalPages} ({total} total)
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingUser ? 'Edit User' : 'Create User'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-group">
                  <label>Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    disabled={!!editingUser}
                  />
                </div>

                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Callsign *</label>
                  <input
                    type="text"
                    value={formData.callsign}
                    onChange={(e) => setFormData({ ...formData, callsign: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Password {!editingUser && '*'}</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                  />
                  {editingUser && <span className="help-text">Leave blank to keep current password</span>}
                </div>

                <div className="form-group">
                  <label>Expiry Date</label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  />
                  <span className="help-text">Leave blank for no expiry</span>
                </div>

                <div className="form-group">
                  <label>Roles</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {rolesData?.roles?.map(role => (
                      <label key={role.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                        <input
                          type="checkbox"
                          checked={formData.roles.includes(role.name)}
                          onChange={() => handleRoleToggle(role.name)}
                        />
                        {role.name}
                      </label>
                    ))}
                  </div>
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
                  {editingUser ? 'Update' : 'Create'} User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersList;
