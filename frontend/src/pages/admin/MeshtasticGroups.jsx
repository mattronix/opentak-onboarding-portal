import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meshtasticGroupsAPI, meshtasticAPI, rolesAPI } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import { Link } from 'react-router-dom';
import '../../components/AdminTable.css';

function MeshtasticGroups() {
  const queryClient = useQueryClient();
  const { showError, showSuccess, confirm } = useNotification();
  const [showModal, setShowModal] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', isPublic: false, roleIds: [] });
  const [slotData, setSlotData] = useState({ channelId: '', slotNumber: 0 });
  const [error, setError] = useState('');

  // Fetch groups (admin endpoint returns all groups)
  const { data: groupsData, isLoading, error: groupsError } = useQuery({
    queryKey: ['meshtasticGroupsAdmin'],
    queryFn: async () => {
      const response = await meshtasticGroupsAPI.getAllAdmin();
      return response.data;
    },
  });

  // Fetch all channels (channels can now be in multiple groups)
  const { data: allChannelsData, error: channelsError } = useQuery({
    queryKey: ['meshtasticAdmin'],
    queryFn: async () => {
      const response = await meshtasticAPI.getAllAdmin();
      return response.data;
    },
  });

  // Fetch roles
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await rolesAPI.getAll();
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => meshtasticGroupsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['meshtasticGroupsAdmin']);
      setShowModal(false);
      resetForm();
      showSuccess('Channel group created');
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to create group'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => meshtasticGroupsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['meshtasticGroupsAdmin']);
      setShowModal(false);
      resetForm();
      showSuccess('Channel group updated');
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to update group'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => meshtasticGroupsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['meshtasticGroupsAdmin']);
      queryClient.invalidateQueries(['meshtasticAdmin']);
      showSuccess('Channel group deleted');
    },
    onError: (err) => showError(err.response?.data?.error || 'Failed to delete group'),
  });

  const addChannelMutation = useMutation({
    mutationFn: ({ groupId, channelId, slotNumber }) =>
      meshtasticGroupsAPI.addChannel(groupId, channelId, slotNumber),
    onSuccess: () => {
      queryClient.invalidateQueries(['meshtasticGroupsAdmin']);
      queryClient.invalidateQueries(['meshtasticAdmin']);
      setShowSlotModal(false);
      setSlotData({ channelId: '', slotNumber: 0 });
      showSuccess('Channel added to group');
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to add channel'),
  });

  const removeChannelMutation = useMutation({
    mutationFn: ({ groupId, channelId }) =>
      meshtasticGroupsAPI.removeChannel(groupId, channelId),
    onSuccess: () => {
      queryClient.invalidateQueries(['meshtasticGroupsAdmin']);
      queryClient.invalidateQueries(['meshtasticAdmin']);
      showSuccess('Channel removed from group');
    },
    onError: (err) => showError(err.response?.data?.error || 'Failed to remove channel'),
  });

  const regenerateUrlMutation = useMutation({
    mutationFn: (groupId) => meshtasticGroupsAPI.regenerateUrl(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries(['meshtasticGroupsAdmin']);
      showSuccess('Combined URL regenerated');
    },
    onError: (err) => showError(err.response?.data?.error || 'Failed to regenerate URL'),
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', isPublic: false, roleIds: [] });
    setEditing(null);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleAddChannelSubmit = (e) => {
    e.preventDefault();
    if (selectedGroup && slotData.channelId) {
      addChannelMutation.mutate({
        groupId: selectedGroup.id,
        channelId: parseInt(slotData.channelId),
        slotNumber: slotData.slotNumber
      });
    }
  };

  const openAddChannelModal = (group) => {
    setSelectedGroup(group);
    // Find first available slot
    const usedSlots = group.channels.map(c => c.slot_number);
    let firstAvailable = 0;
    for (let i = 0; i <= 7; i++) {
      if (!usedSlots.includes(i)) {
        firstAvailable = i;
        break;
      }
    }
    setSlotData({ channelId: '', slotNumber: firstAvailable });
    setError('');
    setShowSlotModal(true);
  };

  const getAvailableSlots = (group) => {
    const usedSlots = group.channels.map(c => c.slot_number);
    return [0, 1, 2, 3, 4, 5, 6, 7].filter(s => !usedSlots.includes(s));
  };

  if (isLoading) return <div className="admin-page"><div className="loading-state">Loading...</div></div>;

  // Show API errors if any
  if (groupsError) {
    return (
      <div className="admin-page">
        <div className="alert alert-error">
          Failed to load channel groups: {groupsError.response?.data?.error || groupsError.message}
        </div>
      </div>
    );
  }

  const groups = groupsData?.groups || [];
  const allChannels = allChannelsData?.configs || [];

  // Get channels available to add to a specific group (filter out channels already in that group)
  const getAvailableChannelsForGroup = (group) => {
    if (!group) return allChannels;
    const channelIdsInGroup = group.channels.map(c => c.id);
    return allChannels.filter(c => !channelIdsInGroup.includes(c.id));
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1>Meshtastic Channel Groups</h1>
          <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Group channels together (up to 8 per group) for combined QR codes. <Link to="/admin/meshtastic">Manage individual channels</Link>
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => {resetForm(); setShowModal(true);}}>+ Create Group</button>
      </div>

      <div className="admin-table-container">
        {groups.length === 0 ? (
          <div className="empty-state">
            No channel groups found. Create a group to organize your Meshtastic channels.
            {allChannels.length > 0 && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                You have {allChannels.length} channel(s) available to add to groups.
              </p>
            )}
          </div>
        ) : (
          groups.map(group => (
            <div key={group.id} className="group-card" style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem',
              background: '#fff'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{group.name}</h3>
                  {group.description && <p style={{ color: '#666', margin: '0.25rem 0 0' }}>{group.description}</p>}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {group.isPublic && <span className="badge badge-success">Public</span>}
                    <span className="badge badge-secondary">{group.channel_count}/8 slots</span>
                  </div>
                </div>
                <div className="table-actions">
                  <button className="btn btn-sm btn-secondary" onClick={async () => {
                    try {
                      const response = await meshtasticGroupsAPI.getById(group.id);
                      const fullGroup = response.data;
                      setEditing(fullGroup);
                      setFormData({
                        name: fullGroup.name,
                        description: fullGroup.description || '',
                        isPublic: fullGroup.isPublic || false,
                        roleIds: fullGroup.roles?.map(r => r.id) || []
                      });
                      setShowModal(true);
                    } catch (err) {
                      showError('Failed to load group details');
                    }
                  }}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={async () => {
                    const confirmed = await confirm(`Delete group "${group.name}"? Channels will be ungrouped but not deleted.`, 'Delete Group');
                    if (confirmed) deleteMutation.mutate(group.id);
                  }}>Delete</button>
                </div>
              </div>

              {/* Slot Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: '0.5rem',
                marginBottom: '0.5rem'
              }}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map(slot => {
                  const channel = group.channels.find(c => c.slot_number === slot);
                  return (
                    <div
                      key={slot}
                      style={{
                        border: channel ? '2px solid #28a745' : '2px dashed #ddd',
                        borderRadius: '4px',
                        padding: '0.5rem',
                        textAlign: 'center',
                        background: channel ? '#f8fff8' : '#fafafa',
                        minHeight: '60px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center'
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', color: '#999', marginBottom: '0.25rem' }}>
                        Slot {slot}{slot === 0 ? ' (Primary)' : ''}
                      </div>
                      {channel ? (
                        <>
                          <div style={{ fontSize: '0.85rem', fontWeight: 500, wordBreak: 'break-word' }}>
                            {channel.name}
                          </div>
                          <button
                            className="btn btn-sm"
                            style={{ fontSize: '0.7rem', padding: '2px 6px', marginTop: '4px' }}
                            onClick={async () => {
                              const confirmed = await confirm(`Remove "${channel.name}" from slot ${slot}?`, 'Remove Channel');
                              if (confirmed) {
                                removeChannelMutation.mutate({ groupId: group.id, channelId: channel.id });
                              }
                            }}
                          >
                            Remove
                          </button>
                        </>
                      ) : (
                        <div style={{ color: '#999', fontSize: '0.8rem' }}>Empty</div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {group.channel_count < 8 && getAvailableChannelsForGroup(group).length > 0 && (
                  <button
                    className="btn btn-sm btn-info"
                    onClick={() => openAddChannelModal(group)}
                  >
                    + Add Channel to Group
                  </button>
                )}
                {group.channel_count > 0 && (
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => regenerateUrlMutation.mutate(group.id)}
                    disabled={regenerateUrlMutation.isPending}
                  >
                    {regenerateUrlMutation.isPending ? 'Regenerating...' : 'Regenerate QR URL'}
                  </button>
                )}
              </div>

              {group.combined_url && (
                <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#f5f5f5', borderRadius: '4px' }}>
                  <strong>Combined URL:</strong>
                  <code style={{ fontSize: '0.8rem', wordBreak: 'break-all', display: 'block', marginTop: '0.25rem' }}>
                    {group.combined_url}
                  </code>
                </div>
              )}
              {!group.combined_url && group.channel_count > 0 && (
                <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#fff3cd', borderRadius: '4px', color: '#856404' }}>
                  No combined URL. Click "Regenerate QR URL" to generate.
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Group Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit' : 'Create'} Channel Group</h2>
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
                    placeholder="e.g., Field Operations Channels"
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Describe what this channel group is for"
                  />
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.isPublic}
                      onChange={(e) => setFormData({...formData, isPublic: e.target.checked})}
                    />
                    Public (visible to all users)
                  </label>
                </div>
                <div className="form-group">
                  <label>Roles</label>
                  <div className="checkbox-list">
                    {rolesData?.roles?.map(role => (
                      <label key={role.id} className="checkbox-label">
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
                        {role.displayName || role.name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Channel to Slot Modal */}
      {showSlotModal && selectedGroup && (
        <div className="modal-overlay" onClick={() => setShowSlotModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Channel to "{selectedGroup.name}"</h2>
              <button className="modal-close" onClick={() => setShowSlotModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddChannelSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label>Select Channel *</label>
                  <select
                    value={slotData.channelId}
                    onChange={(e) => setSlotData({...slotData, channelId: e.target.value})}
                    required
                  >
                    <option value="">-- Select a channel --</option>
                    {getAvailableChannelsForGroup(selectedGroup).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {getAvailableChannelsForGroup(selectedGroup).length === 0 && (
                    <span className="help-text">No available channels. All channels are already in this group or you need to <Link to="/admin/meshtastic">create a channel</Link> first.</span>
                  )}
                </div>
                <div className="form-group">
                  <label>Slot Number *</label>
                  <select
                    value={slotData.slotNumber}
                    onChange={(e) => setSlotData({...slotData, slotNumber: parseInt(e.target.value)})}
                    required
                  >
                    {getAvailableSlots(selectedGroup).map(slot => (
                      <option key={slot} value={slot}>
                        Slot {slot}{slot === 0 ? ' (Primary)' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="help-text">Slot 0 is the primary channel. All channels share the same LoRa settings.</span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSlotModal(false)}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addChannelMutation.isPending || !slotData.channelId}
                >
                  Add Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MeshtasticGroups;
