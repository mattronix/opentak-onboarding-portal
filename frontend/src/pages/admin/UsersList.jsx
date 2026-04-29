import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usersAPI, rolesAPI, groupsAPI } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import '../../components/AdminTable.css';

function UsersList() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { showError, showSuccess, confirm } = useNotification();
  const { hasRole, isAdmin, startImpersonation, user: currentUser } = useAuth();
  const canEdit = hasRole('user_admin') || hasRole('administrator');
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
    roles: [],
    groups: []
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

  // Fetch groups for the form
  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const response = await groupsAPI.getAll();
      return response.data;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => usersAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      queryClient.invalidateQueries(['groups']);
      queryClient.invalidateQueries(['group-members']);
      setShowModal(false);
      resetForm();
      showSuccess(t('admin.users.userCreated'));
    },
    onError: (err) => {
      setError(err.response?.data?.error || t('admin.users.failedCreate'));
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => usersAPI.update(id, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['users']);
      queryClient.invalidateQueries(['groups']);
      queryClient.invalidateQueries(['group-members']);
      setShowModal(false);
      resetForm();
      if (response.data?.passwordChanged) {
        showSuccess(t('admin.users.userUpdatedPassword'));
      } else {
        showSuccess(t('admin.users.userUpdated'));
      }
    },
    onError: (err) => {
      setError(err.response?.data?.error || t('admin.users.failedUpdate'));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => usersAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
    },
    onError: (err) => {
      showError(err.response?.data?.error || t('admin.users.failedDelete'));
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
      roles: [],
      groups: []
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
      roles: user.roles?.map(r => r.name) || [],
      groups: user.groups?.map(g => ({ id: g.id, direction: g.direction || 'BOTH' })) || []
    });
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (user) => {
    const confirmed = await confirm(
      t('admin.users.deleteConfirm', { username: user.username }),
      t('admin.users.deleteUser')
    );
    if (confirmed) {
      deleteMutation.mutate(user.id);
    }
  };

  const handleImpersonate = async (user) => {
    const confirmed = await confirm(
      t('admin.users.impersonateConfirm', { username: user.username }),
      t('admin.users.impersonateUser')
    );
    if (!confirmed) return;
    const result = await startImpersonation(user.id);
    if (result.success) {
      navigate('/dashboard');
    } else {
      showError(result.error || t('admin.users.failedUpdate'));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // Validate username format (only letters and numbers, no spaces, underscores, dashes, or special chars)
    const username = formData.username.toLowerCase().trim();
    const usernamePattern = /^[a-z0-9]+$/;
    if (!usernamePattern.test(username)) {
      setError(t('auth.usernameOnlyLetters'));
      return;
    }

    // Validate username length
    if (username.length < 3 || username.length > 32) {
      setError(t('auth.usernameLength'));
      return;
    }

    // Validate password if provided
    if (formData.password) {
      const disallowedChars = /[&^$]/;
      if (disallowedChars.test(formData.password)) {
        setError(t('auth.passwordNoSpecial'));
        return;
      }
    }

    // Ensure roles data is loaded before submitting
    if (!rolesData?.roles) {
      setError(t('admin.users.rolesNotLoaded'));
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
      firstName: formData.firstName,
      lastName: formData.lastName,
      callsign: formData.callsign,
      password: formData.password,
      expiryDate: formData.expiryDate || null,
      roleIds: roleIds,
      groups: formData.groups
    };

    // Remove password if empty on update
    if (editingUser && !submitData.password) {
      delete submitData.password;
    }

    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: submitData });
    } else {
      if (!submitData.password) {
        setError(t('admin.users.passwordRequired'));
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
    return <div className="admin-page"><div className="loading-state">{t('common.loading')}</div></div>;
  }

  const users = usersData?.users || [];
  const total = usersData?.total || 0;
  const perPage = usersData?.per_page || 20;
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>{t('admin.users.title')}</h1>
        <div className="admin-actions">
          <input
            type="text"
            className="search-box"
            placeholder={t('admin.users.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {canEdit && (
            <button className="btn btn-primary" onClick={handleCreate}>
              {t('admin.users.addUser')}
            </button>
          )}
        </div>
      </div>

      <div className="admin-table-container">
        {users.length === 0 ? (
          <div className="empty-state">{t('admin.users.noUsers')}</div>
        ) : (
          <>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.users.username')}</th>
                  <th>{t('admin.users.name')}</th>
                  <th>{t('admin.users.email')}</th>
                  <th>{t('admin.users.callsign')}</th>
                  <th>{t('admin.users.roles')}</th>
                  <th>{t('admin.users.expiryDate')}</th>
                  {canEdit && <th>{t('common.actions')}</th>}
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
                    <td>{user.expiryDate ? new Date(user.expiryDate).toLocaleDateString() : t('common.never')}</td>
                    {canEdit && (
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(user)}>
                            {t('common.edit')}
                          </button>
                          {isAdmin() && user.id !== currentUser?.id && (
                            <button className="btn btn-sm btn-warning" onClick={() => handleImpersonate(user)}>
                              {t('admin.users.impersonate')}
                            </button>
                          )}
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(user)}>
                            {t('common.delete')}
                          </button>
                        </div>
                      </td>
                    )}
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
                  {t('common.previous')}
                </button>
                <span className="pagination-info">
                  {t('admin.users.pageInfo', { page, totalPages, total })}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  {t('common.next')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingUser ? t('admin.users.editUser') : t('admin.users.createUser')}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-group">
                  <label>{t('admin.users.usernameLabel')}</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    disabled={!!editingUser}
                    minLength={3}
                    maxLength={32}
                  />
                  {!editingUser && <span className="help-text">{t('admin.users.usernameHelp')}</span>}
                </div>

                <div className="form-group">
                  <label>{t('admin.users.emailLabel')}</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{t('admin.users.firstNameLabel')}</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{t('admin.users.lastNameLabel')}</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{t('admin.users.callsignLabel')}</label>
                  <input
                    type="text"
                    value={formData.callsign}
                    onChange={(e) => setFormData({ ...formData, callsign: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{t('admin.users.passwordLabel')} {!editingUser && '*'}</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                  />
                  <span className="help-text">
                    {t('admin.users.passwordHelp')}
                  </span>
                </div>

                <div className="form-group">
                  <label>{t('admin.users.expiryDateLabel')}</label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  />
                  <span className="help-text">{t('admin.users.expiryDateHelp')}</span>
                </div>

                <div className="form-group">
                  <label>{t('admin.users.roles')}</label>
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

                <div className="form-group">
                  <label>{t('admin.users.otsGroups')}</label>
                  {groupsData?.groups?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {groupsData.groups.filter(g => g.active).map(group => {
                        const groupEntry = formData.groups.find(fg => fg.id === group.id);
                        const isSelected = !!groupEntry;
                        return (
                          <div key={group.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => setFormData(prev => ({
                                ...prev,
                                groups: isSelected
                                  ? prev.groups.filter(fg => fg.id !== group.id)
                                  : [...prev.groups, { id: group.id, direction: 'BOTH' }]
                              }))}
                            />
                            <span style={{ minWidth: '120px' }}>{group.displayName || group.name}</span>
                            {isSelected && (
                              <select
                                value={groupEntry.direction}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  groups: prev.groups.map(fg =>
                                    fg.id === group.id ? { ...fg, direction: e.target.value } : fg
                                  )
                                }))}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-input)', borderRadius: '4px' }}
                              >
                                <option value="BOTH">{t('common.both')}</option>
                                <option value="IN">{t('common.inOnly')}</option>
                                <option value="OUT">{t('common.outOnly')}</option>
                              </select>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      {t('admin.users.noGroupsAvailable')}
                    </div>
                  )}
                  <span className="help-text">{t('admin.users.otsGroupsHelp')}</span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingUser ? t('admin.users.updateUser') : t('admin.users.createUser')}
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
