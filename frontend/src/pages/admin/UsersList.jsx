import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersAPI, rolesAPI } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import '../../components/AdminTable.css';

function UsersList() {
  const queryClient = useQueryClient();
  const { showError, confirm } = useNotification();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 when search changes
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [search]);

  // Fetch users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', page, debouncedSearch],
    queryFn: async () => {
      const response = await usersAPI.getAll({ page, per_page: 20, search: debouncedSearch });
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
      showError(err.response?.data?.error || 'Failed to delete user');
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
      roles: user.roles?.map(r => r.name) || []
    });
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (user) => {
    const confirmed = await confirm(
      `Are you sure you want to delete user "${user.username}"?`,
      'Delete User'
    );
    if (confirmed) {
      deleteMutation.mutate(user.id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // Validate username format (only letters and numbers, no spaces, underscores, dashes, or special chars)
    const username = formData.username.toLowerCase().trim();
    const usernamePattern = /^[a-z0-9]+$/;
    if (!usernamePattern.test(username)) {
      setError('Username can only contain letters and numbers (no spaces, underscores, dashes, or special characters)');
      return;
    }

    // Validate username length
    if (username.length < 3 || username.length > 32) {
      setError('Username must be between 3 and 32 characters');
      return;
    }

    // Validate password if provided
    if (formData.password) {
      const disallowedChars = /[&^$]/;
      if (disallowedChars.test(formData.password)) {
        setError('Password cannot contain &, ^, or $ characters');
        return;
      }
    }

    // Ensure roles data is loaded before submitting
    if (!rolesData?.roles) {
      setError('Roles data not loaded. Please try again.');
      return;
    }

    // Convert role names to role IDs for the backend
    const roleIds = formData.roles
      .map(roleName => {
        const role = rolesData.roles.find(r => r.name === roleName);
        return role?.id;
      })
      .filter(id => id !== undefined);

    const submitData = {
      username: username,
      email: formData.email,
      first_name: formData.firstName,
      last_name: formData.lastName,
      callsign: formData.callsign,
      password: formData.password,
      expiry_date: formData.expiryDate || null,
      role_ids: roleIds
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
            onChange={(e) => setSearch(e.target.value)}
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
                        <span key={role.name} className="badge badge-primary">
                          {role.displayName || role.name}
                        </span>
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
                    minLength={3}
                    maxLength={32}
                  />
                  {!editingUser && <span className="help-text">Letters and numbers only (3-32 characters)</span>}
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
                  <span className="help-text">
                    {editingUser ? 'Leave blank to keep current password. ' : ''}
                    Cannot contain &amp;, ^, or $ characters.
                  </span>
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
                        {role.displayName || role.name}
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
