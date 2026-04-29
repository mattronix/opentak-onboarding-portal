import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { rolesAPI } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import '../../components/AdminTable.css';

function RolesList() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, confirm } = useNotification();
  const { hasRole } = useAuth();
  const canEdit = hasRole('role_admin') || hasRole('administrator');
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
      setError(err.response?.data?.error || t('admin.roles.failedCreate'));
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
      setError(err.response?.data?.error || t('admin.roles.failedUpdate'));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => rolesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['roles']);
    },
    onError: (err) => {
      showError(err.response?.data?.error || t('admin.roles.failedDelete'));
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
      t('admin.roles.deleteConfirm', { name: role.name }),
      t('admin.roles.deleteRole')
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
    return <div className="admin-page"><div className="loading-state">{t('common.loading')}</div></div>;
  }

  const roles = rolesData?.roles || [];

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>{t('admin.roles.title')}</h1>
        <div className="admin-actions">
          {canEdit && (
            <button className="btn btn-primary" onClick={handleCreate}>
              {t('admin.roles.addRole')}
            </button>
          )}
        </div>
      </div>

      <div className="admin-table-container">
        {roles.length === 0 ? (
          <div className="empty-state">{t('admin.roles.noRoles')}</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('common.name')}</th>
                <th>{t('admin.roles.displayName')}</th>
                <th>{t('common.description')}</th>
                <th>{t('admin.roles.userCount')}</th>
                <th>{t('common.actions')}</th>
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
                      <span className="badge badge-secondary">{t('admin.roles.systemManaged')}</span>
                    ) : (
                      <div className="table-actions">
                        {canEdit && (
                          <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(role)}>
                            {t('common.edit')}
                          </button>
                        )}
                        {canEdit && (
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(role)}>
                            {t('common.delete')}
                          </button>
                        )}
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
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingRole ? t('admin.roles.editRole') : t('admin.roles.createRole')}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-group">
                  <label>{t('admin.roles.nameLabel')}</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                  <span className="help-text">{t('admin.roles.nameHelp')}</span>
                </div>

                <div className="form-group">
                  <label>{t('admin.roles.displayNameLabel')}</label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder={t('admin.roles.displayNameHelpExtra')}
                  />
                  <span className="help-text">{t('admin.roles.displayNameHelp')}</span>
                </div>

                <div className="form-group">
                  <label>{t('admin.roles.descriptionLabel')}</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('admin.roles.descriptionHelp')}
                  />
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
                  {editingRole ? t('admin.roles.updateRole') : t('admin.roles.createRole')}
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
