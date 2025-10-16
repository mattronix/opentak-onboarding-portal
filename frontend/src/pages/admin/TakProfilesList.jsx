import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { takProfilesAPI, rolesAPI } from '../../services/api';
import '../../components/AdminTable.css';

function TakProfilesList() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: false,
    takPrefFileLocation: '',
    file: null,
    roleIds: []
  });
  const [error, setError] = useState('');
  const [fileTree, setFileTree] = useState(null);
  const [showFileBrowser, setShowFileBrowser] = useState(false);

  const { data: profilesData, isLoading } = useQuery({
    queryKey: ['takProfiles'],
    queryFn: async () => {
      const response = await takProfilesAPI.getAll();
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

  const createMutation = useMutation({
    mutationFn: (formData) => takProfilesAPI.create(formData),
    onSuccess: () => {
      queryClient.invalidateQueries(['takProfiles']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to create profile'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, formData }) => takProfilesAPI.update(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries(['takProfiles']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to update profile'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => takProfilesAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['takProfiles']),
    onError: (err) => alert(err.response?.data?.error || 'Failed to delete profile'),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      isPublic: false,
      takPrefFileLocation: '',
      file: null,
      roleIds: []
    });
    setEditing(null);
    setFileTree(null);
    setShowFileBrowser(false);
    setError('');
  };

  const handleEdit = async (profile) => {
    try {
      // Fetch full profile details
      const response = await takProfilesAPI.getById(profile.id);
      const fullProfile = response.data;

      // Fetch file tree if profile has uploaded files
      let tree = null;
      try {
        const filesResponse = await takProfilesAPI.getFiles(profile.id);
        tree = filesResponse.data.fileTree;
      } catch (err) {
        console.log('No file tree available:', err);
      }

      setEditing(fullProfile);
      setFileTree(tree);
      setFormData({
        name: fullProfile.name,
        description: fullProfile.description || '',
        isPublic: fullProfile.isPublic || false,
        takPrefFileLocation: fullProfile.takPrefFileLocation || '',
        file: null,
        roleIds: fullProfile.roles?.map(r => r.id) || []
      });
      setError('');
      setShowModal(true);
    } catch (err) {
      alert('Failed to load profile details: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const data = new FormData();
    data.append('name', formData.name);
    data.append('description', formData.description);
    data.append('isPublic', formData.isPublic.toString());
    data.append('takPrefFileLocation', formData.takPrefFileLocation);

    // Only add file if provided
    if (formData.file) {
      data.append('datapackage', formData.file);
    } else if (!editing) {
      // File is required for creation
      setError('Profile file is required for new profiles');
      return;
    }

    // Add role IDs
    formData.roleIds.forEach(roleId => {
      data.append('roleIds[]', roleId);
    });

    if (editing) {
      updateMutation.mutate({ id: editing.id, formData: data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Render file tree recursively
  const renderFileTree = (node, level = 0) => {
    if (!node) return null;

    const handleFileClick = (path) => {
      setFormData({ ...formData, takPrefFileLocation: path });
      setShowFileBrowser(false);
    };

    return (
      <div style={{ marginLeft: `${level * 20}px` }}>
        {node.isDir ? (
          <div>
            <div style={{ fontWeight: 'bold', padding: '4px 0', color: '#333' }}>
              📁 {node.name}
            </div>
            {node.children?.map((child, idx) => (
              <div key={idx}>{renderFileTree(child, level + 1)}</div>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: '4px 0',
              cursor: 'pointer',
              color: '#0066cc'
            }}
            onClick={() => handleFileClick(node.path)}
            onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
          >
            📄 {node.name}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) return <div className="admin-page"><div className="loading-state">Loading...</div></div>;

  const profiles = profilesData?.profiles || [];

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>TAK Profiles Management</h1>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          + Add Profile
        </button>
      </div>

      <div className="admin-table-container">
        {profiles.length === 0 ? (
          <div className="empty-state">No TAK profiles found</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Public</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(profile => (
                <tr key={profile.id}>
                  <td><strong>{profile.name}</strong></td>
                  <td>{profile.description || '-'}</td>
                  <td>
                    <span className={`badge ${profile.isPublic ? 'badge-success' : 'badge-warning'}`}>
                      {profile.isPublic ? 'Public' : 'Private'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-sm btn-success" onClick={() => takProfilesAPI.download(profile.id)}>
                        Download
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(profile)}>
                        Edit
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => {
                        if (window.confirm(`Delete "${profile.name}"?`)) deleteMutation.mutate(profile.id);
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
              <h2>{editing ? 'Edit TAK Profile' : 'Upload TAK Profile'}</h2>
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
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                  <span className="help-text">Display name for this TAK profile</span>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Optional description of this profile"
                  />
                </div>

                <div className="form-group">
                  <label>Profile File (.zip) {!editing && '*'}</label>
                  <input
                    type="file"
                    accept=".zip"
                    onChange={(e) => setFormData({...formData, file: e.target.files[0]})}
                    required={!editing}
                  />
                  {editing && <span className="help-text">Leave blank to keep current file</span>}
                  {!editing && <span className="help-text">ZIP file containing TAK profile configuration</span>}
                </div>

                <div className="form-group">
                  <label>TAK Preference File Location</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={formData.takPrefFileLocation}
                      onChange={(e) => setFormData({...formData, takPrefFileLocation: e.target.value})}
                      placeholder="e.g., ATAK/preference.pref"
                      style={{ flex: 1 }}
                    />
                    {editing && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          if (fileTree) {
                            setShowFileBrowser(!showFileBrowser);
                          } else {
                            alert('No files available. Upload a profile file first or the profile may not have files extracted yet.');
                          }
                        }}
                        style={{ whiteSpace: 'nowrap' }}
                        disabled={!fileTree}
                      >
                        📁 Browse Files
                      </button>
                    )}
                  </div>
                  <span className="help-text">
                    {editing && fileTree ? 'Type manually or click Browse Files to select from uploaded ZIP' : 'Optional path to preference file within the ZIP'}
                  </span>

                  {showFileBrowser && fileTree && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      backgroundColor: '#f9f9f9'
                    }}>
                      <div style={{ marginBottom: '0.5rem', fontWeight: 'bold', color: '#666' }}>
                        Click a file to select it:
                      </div>
                      {renderFileTree(fileTree)}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <span>Public (visible to all users)</span>
                    <input
                      type="checkbox"
                      checked={formData.isPublic}
                      onChange={(e) => setFormData({...formData, isPublic: e.target.checked})}
                    />
                  </label>
                </div>

                <div className="form-group">
                  <label>Roles</label>
                  <div className="checkbox-list">
                    {rolesData?.roles?.map(role => (
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
                  <span className="help-text">Assign this profile to specific roles</span>
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
                  {editing ? 'Update' : 'Upload'} Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TakProfilesList;
