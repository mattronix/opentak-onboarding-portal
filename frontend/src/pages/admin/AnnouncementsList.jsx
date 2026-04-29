import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { announcementsAPI, rolesAPI, usersAPI } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import '../../components/AdminTable.css';

// Quill editor modules configuration
const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'align': [] }],
    ['link'],
    ['clean']
  ],
};

const quillFormats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'list', 'bullet',
  'align',
  'link'
];

function AnnouncementsList() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showSuccess, showError, confirm } = useNotification();
  const { hasRole } = useAuth();
  const canEdit = hasRole('announcement_admin') || hasRole('administrator');
  const [showModal, setShowModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    targetType: 'all',
    roleIds: [],
    userIds: [],
    sendEmail: false,
    scheduledAt: '',
    sendImmediately: false
  });
  const [error, setError] = useState('');

  // Fetch announcements
  const { data: announcementsData, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const response = await announcementsAPI.admin.getAll();
      return response.data;
    },
  });

  // Fetch roles for targeting
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await rolesAPI.getAll();
      return response.data;
    },
  });

  // Fetch users for targeting
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await usersAPI.getAll({ per_page: 1000 });
      return response.data;
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data) => announcementsAPI.admin.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['announcements']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => setError(err.response?.data?.error || t('admin.announcements.failedCreate')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => announcementsAPI.admin.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['announcements']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => setError(err.response?.data?.error || t('admin.announcements.failedUpdate')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => announcementsAPI.admin.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['announcements']),
    onError: (err) => showError(err.response?.data?.error || t('admin.announcements.failedDelete')),
  });

  const sendNowMutation = useMutation({
    mutationFn: (id) => announcementsAPI.admin.sendNow(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['announcements']);
      showSuccess(t('admin.announcements.sentSuccess'));
    },
    onError: (err) => showError(err.response?.data?.error || t('admin.announcements.failedSend')),
  });

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      targetType: 'all',
      roleIds: [],
      userIds: [],
      sendEmail: false,
      scheduledAt: '',
      sendImmediately: false
    });
    setEditing(null);
    setError('');
  };

  const handleEdit = async (announcement) => {
    try {
      const response = await announcementsAPI.admin.getById(announcement.id);
      const full = response.data;

      setEditing(full);
      setFormData({
        title: full.title,
        content: full.content,
        targetType: full.targetType,
        roleIds: full.targetRoles?.map(r => r.id) || [],
        userIds: full.targetUsers?.map(u => u.id) || [],
        sendEmail: full.sendEmail,
        scheduledAt: full.scheduledAt ? full.scheduledAt.slice(0, 16) : '',
        sendImmediately: false
      });
      setError('');
      setShowModal(true);
    } catch (err) {
      showError(t('admin.announcements.failedLoadDetails'));
    }
  };

  const handleViewStats = async (announcement) => {
    try {
      const response = await announcementsAPI.admin.getById(announcement.id);
      setSelectedAnnouncement(response.data);
      setShowStatsModal(true);
    } catch (err) {
      showError(t('admin.announcements.failedLoadStats'));
    }
  };

  const handlePreview = async (announcement) => {
    try {
      const response = await announcementsAPI.admin.getById(announcement.id);
      setSelectedAnnouncement(response.data);
      setShowPreviewModal(true);
    } catch (err) {
      showError(t('admin.announcements.failedLoadDetails'));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const submitData = {
      title: formData.title,
      content: formData.content,
      targetType: formData.targetType,
      roleIds: formData.targetType === 'roles' ? formData.roleIds : [],
      userIds: formData.targetType === 'users' ? formData.userIds : [],
      sendEmail: formData.sendEmail,
      scheduledAt: formData.scheduledAt || null,
      sendImmediately: formData.sendImmediately
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: 'badge-warning',
      scheduled: 'badge-primary',
      sent: 'badge-success'
    };
    return badges[status] || 'badge-primary';
  };

  if (isLoading) return <div className="admin-page"><div className="loading-state">{t('common.loading')}</div></div>;

  const announcements = announcementsData?.announcements || [];
  const roles = rolesData?.roles || [];
  const users = usersData?.users || [];

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>{t('admin.announcements.title')}</h1>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
            {t('admin.announcements.createAnnouncement')}
          </button>
        )}
      </div>

      <div className="admin-table-container">
        {announcements.length === 0 ? (
          <div className="empty-state">{t('admin.announcements.noAnnouncements')}</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('common.title')}</th>
                <th>{t('common.status')}</th>
                <th>{t('admin.announcements.target')}</th>
                <th>{t('admin.announcements.email')}</th>
                <th>{t('admin.announcements.scheduled')}</th>
                <th>{t('admin.announcements.read')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {announcements.map(a => (
                <tr key={a.id}>
                  <td><strong>{a.title}</strong></td>
                  <td><span className={`badge ${getStatusBadge(a.status)}`}>{a.status}</span></td>
                  <td>
                    {a.targetType === 'all' && t('admin.announcements.allUsers')}
                    {a.targetType === 'roles' && (
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {a.targetRoles?.map(r => (
                          <span key={r.id} className="badge badge-primary" style={{ fontSize: '0.75rem' }}>{r.displayName || r.name}</span>
                        ))}
                      </div>
                    )}
                    {a.targetType === 'users' && t('admin.announcements.nUsers', { count: a.targetUsers?.length || 0 })}
                  </td>
                  <td>{a.sendEmail ? t('common.yes') : t('common.no')}</td>
                  <td>{a.scheduledAt ? new Date(a.scheduledAt).toLocaleString() : '-'}</td>
                  <td>{a.readCount} / {a.totalTargeted}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-sm btn-secondary" onClick={() => handlePreview(a)}>
                        {t('common.view')}
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleViewStats(a)}>
                        {t('admin.announcements.stats')}
                      </button>
                      {canEdit && a.status !== 'sent' && (
                        <>
                          <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(a)}>
                            {t('common.edit')}
                          </button>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={async () => {
                              const confirmed = await confirm(t('admin.announcements.sendConfirm'), t('admin.announcements.sendAnnouncement'));
                              if (confirmed) sendNowMutation.mutate(a.id);
                            }}
                          >
                            {t('admin.announcements.sendNow')}
                          </button>
                        </>
                      )}
                      {canEdit && (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={async () => {
                            const confirmed = await confirm(t('admin.announcements.deleteConfirm'), t('admin.announcements.deleteAnnouncement'));
                            if (confirmed) deleteMutation.mutate(a.id);
                          }}
                        >
                          {t('common.delete')}
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2>{editing ? t('admin.announcements.editTitle') : t('admin.announcements.createTitle')}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>x</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-group">
                  <label>{t('common.title')} *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{t('admin.announcements.contentLabel')}</label>
                  <div style={{ background: 'white', borderRadius: '4px' }}>
                    <ReactQuill
                      theme="snow"
                      value={formData.content}
                      onChange={(value) => setFormData({...formData, content: value})}
                      modules={quillModules}
                      formats={quillFormats}
                      style={{ minHeight: '200px' }}
                      placeholder={t('admin.announcements.contentPlaceholder')}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>{t('admin.announcements.targetAudience')}</label>
                  <select
                    value={formData.targetType}
                    onChange={(e) => setFormData({...formData, targetType: e.target.value})}
                  >
                    <option value="all">{t('admin.announcements.allUsers')}</option>
                    <option value="roles">{t('admin.announcements.specificRoles')}</option>
                    <option value="users">{t('admin.announcements.specificUsers')}</option>
                  </select>
                </div>

                {formData.targetType === 'roles' && (
                  <div className="form-group">
                    <label>{t('admin.announcements.selectRoles')}</label>
                    <div className="checkbox-list">
                      {roles.map(role => (
                        <label key={role.id} className="checkbox-label">
                          <span>{role.displayName || role.name}</span>
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
                  </div>
                )}

                {formData.targetType === 'users' && (
                  <div className="form-group">
                    <label>{t('admin.announcements.selectUsers')}</label>
                    <div className="checkbox-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {users.map(user => (
                        <label key={user.id} className="checkbox-label">
                          <span>{user.username} ({user.email})</span>
                          <input
                            type="checkbox"
                            checked={formData.userIds.includes(user.id)}
                            onChange={() => setFormData(prev => ({
                              ...prev,
                              userIds: prev.userIds.includes(user.id)
                                ? prev.userIds.filter(u => u !== user.id)
                                : [...prev.userIds, user.id]
                            }))}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="checkbox-label">
                    <span>{t('admin.announcements.sendAsEmail')}</span>
                    <input
                      type="checkbox"
                      checked={formData.sendEmail}
                      onChange={(e) => setFormData({...formData, sendEmail: e.target.checked})}
                    />
                  </label>
                  <span className="help-text">{t('admin.announcements.sendAsEmailHelp')}</span>
                </div>

                <div className="form-group">
                  <label>{t('admin.announcements.scheduleFor')}</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={(e) => setFormData({...formData, scheduledAt: e.target.value, sendImmediately: false})}
                  />
                  <span className="help-text">{t('admin.announcements.scheduleHelp')}</span>
                </div>

                {!editing && (
                  <div className="form-group">
                    <label className="checkbox-label">
                      <span>{t('admin.announcements.sendImmediately')}</span>
                      <input
                        type="checkbox"
                        checked={formData.sendImmediately}
                        onChange={(e) => setFormData({...formData, sendImmediately: e.target.checked, scheduledAt: ''})}
                      />
                    </label>
                  </div>
                )}
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
                  {editing ? t('common.update') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {showStatsModal && selectedAnnouncement && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>{t('admin.announcements.readStatistics')}</h2>
              <button className="modal-close" onClick={() => setShowStatsModal(false)}>x</button>
            </div>
            <div className="modal-body">
              <h3>{selectedAnnouncement.title}</h3>
              <p><strong>{t('common.status')}:</strong> {selectedAnnouncement.status}</p>
              <p><strong>{t('admin.announcements.totalTargeted')}:</strong> {selectedAnnouncement.stats?.totalTargeted || 0}</p>
              <p><strong>{t('admin.announcements.totalReads')}:</strong> {selectedAnnouncement.stats?.totalReads || 0}</p>
              {selectedAnnouncement.sendEmail && (
                <p><strong>{t('admin.announcements.emailOpens')}:</strong> {selectedAnnouncement.stats?.emailOpens || 0}</p>
              )}

              {selectedAnnouncement.reads && selectedAnnouncement.reads.length > 0 && (
                <>
                  <h4 style={{ marginTop: '1.5rem' }}>{t('admin.announcements.readBy')}:</h4>
                  <table className="admin-table" style={{ fontSize: '0.9rem' }}>
                    <thead>
                      <tr>
                        <th>{t('admin.announcements.user')}</th>
                        <th>{t('admin.announcements.readAt')}</th>
                        {selectedAnnouncement.sendEmail && <th>{t('admin.announcements.emailOpened')}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAnnouncement.reads.map(r => (
                        <tr key={r.userId}>
                          <td>{r.username}</td>
                          <td>{new Date(r.readAt).toLocaleString()}</td>
                          {selectedAnnouncement.sendEmail && (
                            <td>{r.emailOpened ? new Date(r.emailOpenedAt).toLocaleString() : t('common.no')}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowStatsModal(false)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && selectedAnnouncement && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2>{selectedAnnouncement.title}</h2>
              <button className="modal-close" onClick={() => setShowPreviewModal(false)}>x</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '4px', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <span><strong>{t('common.status')}:</strong> <span className={`badge ${getStatusBadge(selectedAnnouncement.status)}`}>{selectedAnnouncement.status}</span></span>
                  <span><strong>{t('admin.announcements.target')}:</strong> {selectedAnnouncement.targetType === 'all' ? t('admin.announcements.allUsers') : selectedAnnouncement.targetType === 'roles' ? t('admin.announcements.specificRoles') : t('admin.announcements.specificUsers')}</span>
                  <span><strong>{t('admin.announcements.email')}:</strong> {selectedAnnouncement.sendEmail ? t('common.yes') : t('common.no')}</span>
                </div>
                {selectedAnnouncement.sentAt && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <strong>{t('admin.announcements.sent')}:</strong> {new Date(selectedAnnouncement.sentAt).toLocaleString()}
                  </div>
                )}
                {selectedAnnouncement.scheduledAt && selectedAnnouncement.status === 'scheduled' && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <strong>{t('admin.announcements.scheduled')}:</strong> {new Date(selectedAnnouncement.scheduledAt).toLocaleString()}
                  </div>
                )}
              </div>
              <div
                className="announcement-preview-content"
                style={{
                  padding: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: 'white',
                  minHeight: '150px'
                }}
                dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content }}
              />
            </div>
            <div className="modal-footer">
              {canEdit && selectedAnnouncement.status !== 'sent' && (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowPreviewModal(false);
                    handleEdit(selectedAnnouncement);
                  }}
                >
                  {t('common.edit')}
                </button>
              )}
              <button className="btn btn-primary" onClick={() => setShowPreviewModal(false)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnnouncementsList;
