import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsAPI, usersAPI } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import '../../components/AdminTable.css';

function GroupsList() {
  const queryClient = useQueryClient();
  const { showError, confirm } = useNotification();
  const { hasRole } = useAuth();
  const canEdit = hasRole('group_admin') || hasRole('administrator');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    active: true
  });
  const [error, setError] = useState('');

  const { data: groupsData, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const response = await groupsAPI.getAll();
      return response.data;
    },
  });

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['group-members', editing?.id],
    queryFn: async () => {
      const response = await groupsAPI.getMembers(editing.id);
      return response.data;
    },
    enabled: !!editing?.id,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await usersAPI.getAll({ per_page: 1000 });
      return response.data;
    },
    enabled: showModal && canEdit,
  });

  const createMutation = useMutation({
    mutationFn: (data) => groupsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['groups']);
      closeModal();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to create group'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => groupsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['groups']);
      closeModal();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to update group'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => groupsAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['groups']),
    onError: (err) => showError(err.response?.data?.error || 'Failed to delete group'),
  });

  const syncMutation = useMutation({
    mutationFn: () => groupsAPI.syncFromOts(),
    onSuccess: () => {
      queryClient.invalidateQueries(['groups']);
      setError('');
    },
    onError: (err) => showError(err.response?.data?.error || 'Failed to sync groups from OTS'),
  });

  const addMemberMutation = useMutation({
    mutationFn: (data) => groupsAPI.addMember(editing.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['group-members', editing?.id]);
      queryClient.invalidateQueries(['groups']);
      queryClient.invalidateQueries(['users']);
    },
    onError: (err) => showError(err.response?.data?.error || 'Failed to add member'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ username, direction }) => groupsAPI.removeMember(editing.id, username, direction),
    onSuccess: () => {
      queryClient.invalidateQueries(['group-members', editing?.id]);
      queryClient.invalidateQueries(['groups']);
      queryClient.invalidateQueries(['users']);
    },
    onError: (err) => showError(err.response?.data?.error || 'Failed to remove member'),
  });

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormData({ name: '', displayName: '', description: '', active: true });
    setMemberSearch('');
    setError('');
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', displayName: '', description: '', active: true });
    setMemberSearch('');
    setError('');
    setShowModal(true);
  };

  const openEdit = (group) => {
    setEditing(group);
    setFormData({
      name: group.name || '',
      displayName: group.displayName || '',
      description: group.description || '',
      active: group.active !== false
    });
    setMemberSearch('');
    setError('');
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const submitData = {
      name: formData.name,
      displayName: formData.displayName || formData.name,
      description: formData.description,
      active: formData.active
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  // Merge OTS members into a per-user map with combined direction
  const memberMap = useMemo(() => {
    const map = {};
    const members = membersData?.members || [];
    for (const m of members) {
      if (!m.username) continue;
      if (map[m.username]) {
        if (map[m.username].direction !== m.direction) {
          map[m.username].direction = 'BOTH';
        }
      } else {
        map[m.username] = { ...m };
      }
    }
    return map;
  }, [membersData]);

  const allUsers = usersData?.users || [];

  // Build display list: current members first, then filtered non-members
  const displayUsers = useMemo(() => {
    const currentMembers = allUsers
      .filter(u => memberMap[u.username])
      .map(u => ({ ...u, isMember: true, direction: memberMap[u.username].direction }));

    const searchLower = memberSearch.toLowerCase();
    const nonMembers = memberSearch
      ? allUsers
          .filter(u => !memberMap[u.username])
          .filter(u =>
            u.username?.toLowerCase().includes(searchLower) ||
            u.callsign?.toLowerCase().includes(searchLower) ||
            u.firstName?.toLowerCase().includes(searchLower) ||
            u.lastName?.toLowerCase().includes(searchLower)
          )
          .slice(0, 20)
      : [];

    return [...currentMembers, ...nonMembers.map(u => ({ ...u, isMember: false, direction: 'BOTH' }))];
  }, [allUsers, memberMap, memberSearch]);

  const handleToggleMember = (user) => {
    if (memberMap[user.username]) {
      removeMemberMutation.mutate({ username: user.username, direction: memberMap[user.username].direction });
    } else {
      addMemberMutation.mutate({ userId: user.id, direction: 'BOTH' });
    }
  };

  const handleDirectionChange = (user, newDirection) => {
    addMemberMutation.mutate({ userId: user.id, direction: newDirection });
  };

  if (isLoading) return <div className="admin-page"><div className="loading-state">Loading...</div></div>;

  const groups = groupsData?.groups || [];

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>OTS Groups Management</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {canEdit && (
            <button
              className="btn btn-secondary"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? 'Syncing...' : 'Sync from OTS'}
            </button>
          )}
          {canEdit && (
            <button className="btn btn-primary" onClick={openCreate}>
              + Add Group
            </button>
          )}
        </div>
      </div>

      {syncMutation.isSuccess && (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          {syncMutation.data?.data?.message || 'Groups synced successfully'}
        </div>
      )}

      <div className="admin-table-container">
        {groups.length === 0 ? (
          <div className="empty-state">
            No groups found. Click "Sync from OTS" to import groups from your OpenTAK Server.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Display Name</th>
                <th>Active</th>
                <th>Users</th>
                <th>Onboarding Codes</th>
                <th>Last Synced</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                <tr key={group.id}>
                  <td>
                    <strong
                      style={{ cursor: 'pointer', color: 'var(--text-link, #2563eb)' }}
                      onClick={() => openEdit(group)}
                    >
                      {group.name}
                    </strong>
                  </td>
                  <td>{group.displayName || '-'}</td>
                  <td>
                    <span className={`badge ${group.active ? 'badge-success' : 'badge-danger'}`}>
                      {group.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{group.userCount || 0}</td>
                  <td>{group.onboardingCodeCount || 0}</td>
                  <td>{group.syncedAt ? new Date(group.syncedAt).toLocaleString() : 'Never'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(group)}>
                        Edit
                      </button>
                      {canEdit && (
                        <button className="btn btn-sm btn-danger" onClick={async () => {
                          const confirmed = await confirm(`Delete group "${group.name}"? This will also remove it from OTS.`, 'Delete Group');
                          if (confirmed) deleteMutation.mutate(group.id);
                        }}>
                          Delete
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

      {/* Combined Edit + Members Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h2>{editing ? `Manage ${editing.name}` : 'Create Group'}</h2>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    disabled={!!editing}
                  />
                  <span className="help-text">{editing ? 'Group name cannot be changed' : 'This will create the group in OTS as well'}</span>
                </div>

                <div className="form-group">
                  <label>Display Name</label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                  />
                  <span className="help-text">Friendly name shown in the portal</span>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({...formData, active: e.target.checked})}
                      style={{ width: 'auto' }}
                    />
                    <span style={{ fontWeight: 'normal' }}>Active</span>
                  </label>
                  <span className="help-text">Inactive groups will not be assigned during registration</span>
                </div>

                {canEdit && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                      {createMutation.isPending ? 'Creating in OTS...' : updateMutation.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Create Group'}
                    </button>
                  </div>
                )}

                {/* Members section - only show when editing */}
                {editing && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <div className="form-group">
                      <label>Members</label>
                      <input
                        type="text"
                        placeholder="Search users to add..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                      />
                      <span className="help-text">Current members shown below. Search to add new users.</span>
                    </div>

                    {membersLoading ? (
                      <div className="loading-state">Loading members...</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                        {displayUsers.length === 0 && !memberSearch && (
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            No members in this group. Search to add users.
                          </div>
                        )}
                        {displayUsers.length === 0 && memberSearch && (
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            No matching users found.
                          </div>
                        )}
                        {displayUsers.map(user => {
                          const isMember = !!memberMap[user.username];
                          const currentDirection = memberMap[user.username]?.direction || 'BOTH';
                          return (
                            <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <input
                                type="checkbox"
                                checked={isMember}
                                onChange={() => handleToggleMember(user)}
                                disabled={addMemberMutation.isPending || removeMemberMutation.isPending}
                              />
                              <span style={{ minWidth: '150px' }}>
                                {user.username}
                                {user.callsign ? ` (${user.callsign})` : ''}
                              </span>
                              {isMember && (
                                <select
                                  value={currentDirection}
                                  onChange={(e) => handleDirectionChange(user, e.target.value)}
                                  disabled={addMemberMutation.isPending || removeMemberMutation.isPending}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-input)', borderRadius: '4px' }}
                                >
                                  <option value="BOTH">Both (IN + OUT)</option>
                                  <option value="IN">IN only</option>
                                  <option value="OUT">OUT only</option>
                                </select>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupsList;
