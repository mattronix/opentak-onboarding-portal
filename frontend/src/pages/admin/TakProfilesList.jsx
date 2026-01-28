import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { takProfilesAPI, rolesAPI } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import '../../components/AdminTable.css';
import './TakProfilesList.css';

function TakProfilesList() {
  const queryClient = useQueryClient();
  const { showError, showWarning, confirm } = useNotification();
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
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [currentBrowserPath, setCurrentBrowserPath] = useState([]);
  const [fileSearchQuery, setFileSearchQuery] = useState('');

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
    onError: (err) => showError(err.response?.data?.error || 'Failed to delete profile'),
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
    setExpandedFolders(new Set());
    setCurrentBrowserPath([]);
    setFileSearchQuery('');
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
      showError('Failed to load profile details: ' + (err.response?.data?.error || err.message));
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

  const toggleFolder = (path) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // SVG Icons
  const FolderIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#5C9DED">
      <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
    </svg>
  );

  const FileIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#90A4AE">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
    </svg>
  );

  const BackIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#666">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
    </svg>
  );

  // Recursively collect all files from tree
  const getAllFiles = (node, parentPath = '') => {
    if (!node) return [];
    const results = [];
    const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;

    if (!node.isDir) {
      results.push({ ...node, fullPath: currentPath });
    }

    if (node.children) {
      for (const child of node.children) {
        results.push(...getAllFiles(child, node.name === fileTree?.name ? '' : currentPath));
      }
    }
    return results;
  };

  // Get search results
  const getSearchResults = () => {
    if (!fileTree || !fileSearchQuery.trim()) return [];
    const query = fileSearchQuery.toLowerCase();
    const allFiles = getAllFiles(fileTree);
    return allFiles
      .filter(f => f.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  // Get current directory contents
  const getCurrentDirContents = () => {
    if (!fileTree) return [];

    let current = fileTree;
    for (const segment of currentBrowserPath) {
      const found = current.children?.find(c => c.name === segment && c.isDir);
      if (found) {
        current = found;
      } else {
        return [];
      }
    }

    // Sort: folders first, then files, alphabetically
    const children = current.children || [];
    const folders = children.filter(c => c.isDir).sort((a, b) => a.name.localeCompare(b.name));
    const files = children.filter(c => !c.isDir).sort((a, b) => a.name.localeCompare(b.name));
    return [...folders, ...files];
  };

  const handleFolderClick = (folderName) => {
    setCurrentBrowserPath([...currentBrowserPath, folderName]);
  };

  const handleBackClick = () => {
    setCurrentBrowserPath(currentBrowserPath.slice(0, -1));
  };

  const handleFileSelect = (filePath) => {
    setFormData({ ...formData, takPrefFileLocation: filePath });
    setShowFileBrowser(false);
  };

  const getBreadcrumbPath = () => {
    return ['Root', ...currentBrowserPath].join(' / ');
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
                      <button className="btn btn-sm btn-danger" onClick={async () => {
                        const confirmed = await confirm(`Delete "${profile.name}"?`, 'Delete Profile');
                        if (confirmed) deleteMutation.mutate(profile.id);
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
        <div className="modal-overlay">
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
                            showWarning('No files available. Upload a profile file first or the profile may not have files extracted yet.');
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
                    <div className="file-browser">
                      <div className="file-browser-header">
                        <div className="file-browser-breadcrumb">{fileSearchQuery ? 'Search Results' : getBreadcrumbPath()}</div>
                        <button
                          type="button"
                          className="file-browser-close"
                          onClick={() => setShowFileBrowser(false)}
                        >
                          &times;
                        </button>
                      </div>
                      <div className="file-browser-search">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#999">
                          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                        </svg>
                        <input
                          type="text"
                          placeholder="Search files..."
                          value={fileSearchQuery}
                          onChange={(e) => setFileSearchQuery(e.target.value)}
                        />
                        {fileSearchQuery && (
                          <button
                            type="button"
                            className="search-clear"
                            onClick={() => setFileSearchQuery('')}
                          >
                            &times;
                          </button>
                        )}
                      </div>
                      <div className="file-browser-content">
                        <table className="file-browser-table">
                          <thead>
                            <tr>
                              <th>Name</th>
                              {fileSearchQuery && <th>Path</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {fileSearchQuery ? (
                              // Search results view
                              <>
                                {getSearchResults().map((item, idx) => (
                                  <tr
                                    key={idx}
                                    className={`file-row selectable ${formData.takPrefFileLocation === item.path ? 'selected' : ''}`}
                                    onClick={() => handleFileSelect(item.path)}
                                  >
                                    <td>
                                      <div className="file-cell">
                                        <FileIcon />
                                        <span className="file-name">{item.name}</span>
                                      </div>
                                    </td>
                                    <td className="file-path">{item.path}</td>
                                  </tr>
                                ))}
                                {getSearchResults().length === 0 && (
                                  <tr>
                                    <td colSpan="2" className="empty-message">No files match your search</td>
                                  </tr>
                                )}
                              </>
                            ) : (
                              // Directory view
                              <>
                                {currentBrowserPath.length > 0 && (
                                  <tr className="file-row" onClick={handleBackClick}>
                                    <td>
                                      <div className="file-cell">
                                        <BackIcon />
                                        <span className="file-name">..</span>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                                {getCurrentDirContents().map((item, idx) => (
                                  <tr
                                    key={idx}
                                    className={`file-row ${!item.isDir ? 'selectable' : ''} ${formData.takPrefFileLocation === item.path ? 'selected' : ''}`}
                                    onClick={() => item.isDir ? handleFolderClick(item.name) : handleFileSelect(item.path)}
                                  >
                                    <td>
                                      <div className="file-cell">
                                        {item.isDir ? <FolderIcon /> : <FileIcon />}
                                        <span className="file-name">{item.name}</span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                                {getCurrentDirContents().length === 0 && currentBrowserPath.length === 0 && (
                                  <tr>
                                    <td className="empty-message">No files found</td>
                                  </tr>
                                )}
                              </>
                            )}
                          </tbody>
                        </table>
                      </div>
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
