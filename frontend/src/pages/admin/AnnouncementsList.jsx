import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { announcementsAPI, rolesAPI, usersAPI } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
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
  const queryClient = useQueryClient();
  const { showSuccess, showError, confirm } = useNotification();
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
    onError: (err) => setError(err.response?.data?.error || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => announcementsAPI.admin.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['announcements']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => announcementsAPI.admin.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['announcements']),
    onError: (err) => showError(err.response?.data?.error || 'Failed to delete'),
  });

  const sendNowMutation = useMutation({
    mutationFn: (id) => announcementsAPI.admin.sendNow(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['announcements']);
      showSuccess('Announcement sent successfully!');
    },
    onError: (err) => showError(err.response?.data?.error || 'Failed to send'),
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
      showError('Failed to load announcement details');
    }
  };

  const handleViewStats = async (announcement) => {
    try {
      const response = await announcementsAPI.admin.getById(announcement.id);
      setSelectedAnnouncement(response.data);
      setShowStatsModal(true);
    } catch (err) {
      showError('Failed to load statistics');
    }
  };

  const handlePreview = async (announcement) => {
    try {
      const response = await announcementsAPI.admin.getById(announcement.id);
      setSelectedAnnouncement(response.data);
      setShowPreviewModal(true);
    } catch (err) {
      showError('Failed to load announcement');
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

  if (isLoading) return <div className="admin-page"><div className="loading-state">Loading...</div></div>;

  const announcements = announcementsData?.announcements || [];
  const roles = rolesData?.roles || [];
  const users = usersData?.users || [];

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Announcements</h1>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          + Create Announcement
        </button>
      </div>

      <div className="admin-table-container">
        {announcements.length === 0 ? (
          <div className="empty-state">No announcements found</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Target</th>
                <th>Email</th>
                <th>Scheduled</th>
                <th>Read</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {announcements.map(a => (
                <tr key={a.id}>
                  <td><strong>{a.title}</strong></td>
                  <td><span className={`badge ${getStatusBadge(a.status)}`}>{a.status}</span></td>
                  <td>
                    {a.targetType === 'all' && 'All Users'}
                    {a.targetType === 'roles' && (
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {a.targetRoles?.map(r => (
                          <span key={r.id} className="badge badge-primary" style={{ fontSize: '0.75rem' }}>{r.displayName || r.name}</span>
                        ))}
                      </div>
                    )}
                    {a.targetType === 'users' && `${a.targetUsers?.length || 0} users`}
                  </td>
                  <td>{a.sendEmail ? 'Yes' : 'No'}</td>
                  <td>{a.scheduledAt ? new Date(a.scheduledAt).toLocaleString() : '-'}</td>
                  <td>{a.readCount} / {a.totalTargeted}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-sm btn-secondary" onClick={() => handlePreview(a)}>
                        View
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleViewStats(a)}>
                        Stats
                      </button>
                      {a.status !== 'sent' && (
                        <>
                          <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(a)}>
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={async () => {
                              const confirmed = await confirm('Send this announcement now?', 'Send Announcement');
                              if (confirmed) sendNowMutation.mutate(a.id);
                            }}
                          >
                            Send Now
                          </button>
                        </>
                      )}
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={async () => {
                          const confirmed = await confirm('Delete this announcement?', 'Delete Announcement');
                          if (confirmed) deleteMutation.mutate(a.id);
                        }}
                      >
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
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Announcement' : 'Create Announcement'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>x</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-group">
                  <label>Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Content *</label>
                  <div style={{ background: 'white', borderRadius: '4px' }}>
                    <ReactQuill
                      theme="snow"
                      value={formData.content}
                      onChange={(value) => setFormData({...formData, content: value})}
                      modules={quillModules}
                      formats={quillFormats}
                      style={{ minHeight: '200px' }}
                      placeholder="Write your announcement..."
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Target Audience</label>
                  <select
                    value={formData.targetType}
                    onChange={(e) => setFormData({...formData, targetType: e.target.value})}
                  >
                    <option value="all">All Users</option>
                    <option value="roles">Specific Roles</option>
                    <option value="users">Specific Users</option>
                  </select>
                </div>

                {formData.targetType === 'roles' && (
                  <div className="form-group">
                    <label>Select Roles</label>
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
                    <label>Select Users</label>
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
                    <span>Send as Email</span>
                    <input
                      type="checkbox"
                      checked={formData.sendEmail}
                      onChange={(e) => setFormData({...formData, sendEmail: e.target.checked})}
                    />
                  </label>
                  <span className="help-text">Also send via email to targeted users</span>
                </div>

                <div className="form-group">
                  <label>Schedule For</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={(e) => setFormData({...formData, scheduledAt: e.target.value, sendImmediately: false})}
                  />
                  <span className="help-text">Leave empty to save as draft</span>
                </div>

                {!editing && (
                  <div className="form-group">
                    <label className="checkbox-label">
                      <span>Send Immediately</span>
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editing ? 'Update' : 'Create'}
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
              <h2>Read Statistics</h2>
              <button className="modal-close" onClick={() => setShowStatsModal(false)}>x</button>
            </div>
            <div className="modal-body">
              <h3>{selectedAnnouncement.title}</h3>
              <p><strong>Status:</strong> {selectedAnnouncement.status}</p>
              <p><strong>Total Targeted:</strong> {selectedAnnouncement.stats?.totalTargeted || 0}</p>
              <p><strong>Total Reads:</strong> {selectedAnnouncement.stats?.totalReads || 0}</p>
              {selectedAnnouncement.sendEmail && (
                <p><strong>Email Opens:</strong> {selectedAnnouncement.stats?.emailOpens || 0}</p>
              )}

              {selectedAnnouncement.reads && selectedAnnouncement.reads.length > 0 && (
                <>
                  <h4 style={{ marginTop: '1.5rem' }}>Read By:</h4>
                  <table className="admin-table" style={{ fontSize: '0.9rem' }}>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Read At</th>
                        {selectedAnnouncement.sendEmail && <th>Email Opened</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAnnouncement.reads.map(r => (
                        <tr key={r.userId}>
                          <td>{r.username}</td>
                          <td>{new Date(r.readAt).toLocaleString()}</td>
                          {selectedAnnouncement.sendEmail && (
                            <td>{r.emailOpened ? new Date(r.emailOpenedAt).toLocaleString() : 'No'}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowStatsModal(false)}>Close</button>
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
                  <span><strong>Status:</strong> <span className={`badge ${getStatusBadge(selectedAnnouncement.status)}`}>{selectedAnnouncement.status}</span></span>
                  <span><strong>Target:</strong> {selectedAnnouncement.targetType === 'all' ? 'All Users' : selectedAnnouncement.targetType === 'roles' ? 'Specific Roles' : 'Specific Users'}</span>
                  <span><strong>Email:</strong> {selectedAnnouncement.sendEmail ? 'Yes' : 'No'}</span>
                </div>
                {selectedAnnouncement.sentAt && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <strong>Sent:</strong> {new Date(selectedAnnouncement.sentAt).toLocaleString()}
                  </div>
                )}
                {selectedAnnouncement.scheduledAt && selectedAnnouncement.status === 'scheduled' && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <strong>Scheduled:</strong> {new Date(selectedAnnouncement.scheduledAt).toLocaleString()}
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
              {selectedAnnouncement.status !== 'sent' && (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowPreviewModal(false);
                    handleEdit(selectedAnnouncement);
                  }}
                >
                  Edit
                </button>
              )}
              <button className="btn btn-primary" onClick={() => setShowPreviewModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnnouncementsList;
