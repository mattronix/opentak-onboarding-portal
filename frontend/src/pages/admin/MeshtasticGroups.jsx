import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meshtasticGroupsAPI, meshtasticAPI, rolesAPI } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import { Link } from 'react-router-dom';
import '../../components/AdminTable.css';

function MeshtasticGroups() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, showSuccess, confirm } = useNotification();
  const [showModal, setShowModal] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', isPublic: false, showOnHomepage: true, roleIds: [], yamlConfig: '' });
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
      showSuccess(t('admin.meshtasticGroups.groupCreated'));
    },
    onError: (err) => setError(err.response?.data?.error || t('admin.meshtasticGroups.failedCreate')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => meshtasticGroupsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['meshtasticGroupsAdmin']);
      setShowModal(false);
      resetForm();
      showSuccess(t('admin.meshtasticGroups.groupUpdated'));
    },
    onError: (err) => setError(err.response?.data?.error || t('admin.meshtasticGroups.failedUpdate')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => meshtasticGroupsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['meshtasticGroupsAdmin']);
      queryClient.invalidateQueries(['meshtasticAdmin']);
      showSuccess(t('admin.meshtasticGroups.groupDeleted'));
    },
    onError: (err) => showError(err.response?.data?.error || t('admin.meshtasticGroups.failedDelete')),
  });

  const addChannelMutation = useMutation({
    mutationFn: ({ groupId, channelId, slotNumber }) =>
      meshtasticGroupsAPI.addChannel(groupId, channelId, slotNumber),
    onSuccess: () => {
      queryClient.invalidateQueries(['meshtasticGroupsAdmin']);
      queryClient.invalidateQueries(['meshtasticAdmin']);
      setShowSlotModal(false);
      setSlotData({ channelId: '', slotNumber: 0 });
      showSuccess(t('admin.meshtasticGroups.channelAddedSuccess'));
    },
    onError: (err) => setError(err.response?.data?.error || t('admin.meshtasticGroups.failedAddChannel')),
  });

  const removeChannelMutation = useMutation({
    mutationFn: ({ groupId, channelId }) =>
      meshtasticGroupsAPI.removeChannel(groupId, channelId),
    onSuccess: () => {
      queryClient.invalidateQueries(['meshtasticGroupsAdmin']);
      queryClient.invalidateQueries(['meshtasticAdmin']);
      showSuccess(t('admin.meshtasticGroups.channelRemovedSuccess'));
    },
    onError: (err) => showError(err.response?.data?.error || t('admin.meshtasticGroups.failedRemoveChannel')),
  });

  const regenerateUrlMutation = useMutation({
    mutationFn: (groupId) => meshtasticGroupsAPI.regenerateUrl(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries(['meshtasticGroupsAdmin']);
      showSuccess(t('admin.meshtasticGroups.urlRegeneratedSuccess'));
    },
    onError: (err) => showError(err.response?.data?.error || t('admin.meshtasticGroups.failedRegenerate')),
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', isPublic: false, showOnHomepage: true, roleIds: [], yamlConfig: '' });
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

  if (isLoading) return <div className="admin-page"><div className="loading-state">{t('common.loading')}</div></div>;

  // Show API errors if any
  if (groupsError) {
    return (
      <div className="admin-page">
        <div className="alert alert-error">
          {t('admin.meshtasticGroups.failedLoad')}: {groupsError.response?.data?.error || groupsError.message}
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
          <h1>{t('admin.meshtasticGroups.title')}</h1>
          <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {t('admin.meshtasticGroups.subtitle')} <Link to="/admin/meshtastic">{t('admin.meshtasticGroups.manageChannels')}</Link>
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => {resetForm(); setShowModal(true);}}>{t('admin.meshtasticGroups.createGroup')}</button>
      </div>

      <div className="admin-table-container">
        {groups.length === 0 ? (
          <div className="empty-state">
            {t('admin.meshtasticGroups.noGroups')}
            {allChannels.length > 0 && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                {t('admin.meshtasticGroups.channelsAvailable', { count: allChannels.length })}
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
                    {group.isPublic && <span className="badge badge-success">{t('common.public')}</span>}
                    <span className="badge badge-secondary">{t('admin.meshtasticGroups.slotsCount', { count: group.channel_count })}</span>
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
                        showOnHomepage: fullGroup.showOnHomepage !== false,
                        roleIds: fullGroup.roles?.map(r => r.id) || [],
                        yamlConfig: fullGroup.yamlConfig || ''
                      });
                      setShowModal(true);
                    } catch (err) {
                      showError(t('admin.meshtasticGroups.failedLoadDetails'));
                    }
                  }}>{t('common.edit')}</button>
                  <button className="btn btn-sm btn-danger" onClick={async () => {
                    const confirmed = await confirm(t('admin.meshtasticGroups.deleteConfirm', { name: group.name }), t('admin.meshtasticGroups.deleteGroup'));
                    if (confirmed) deleteMutation.mutate(group.id);
                  }}>{t('common.delete')}</button>
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
                        {t('admin.meshtasticGroups.slot')} {slot}{slot === 0 ? ` (${t('common.primary')})` : ''}
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
                              const confirmed = await confirm(t('admin.meshtasticGroups.removeChannelConfirm', { name: channel.name, slot }), t('admin.meshtasticGroups.removeChannelTitle'));
                              if (confirmed) {
                                removeChannelMutation.mutate({ groupId: group.id, channelId: channel.id });
                              }
                            }}
                          >
                            {t('common.remove')}
                          </button>
                        </>
                      ) : (
                        <div style={{ color: '#999', fontSize: '0.8rem' }}>{t('common.empty')}</div>
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
                    {t('admin.meshtasticGroups.addChannel')}
                  </button>
                )}
                {group.channel_count > 0 && (
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => regenerateUrlMutation.mutate(group.id)}
                    disabled={regenerateUrlMutation.isPending}
                  >
                    {regenerateUrlMutation.isPending ? t('admin.meshtasticGroups.regenerating') : t('admin.meshtasticGroups.regenerateQr')}
                  </button>
                )}
              </div>

              {group.combined_url && (
                <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#f5f5f5', borderRadius: '4px' }}>
                  <strong>{t('admin.meshtasticGroups.combinedUrl')}:</strong>
                  <code style={{ fontSize: '0.8rem', wordBreak: 'break-all', display: 'block', marginTop: '0.25rem' }}>
                    {group.combined_url}
                  </code>
                </div>
              )}
              {!group.combined_url && group.channel_count > 0 && (
                <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#fff3cd', borderRadius: '4px', color: '#856404' }}>
                  {t('admin.meshtasticGroups.noCombinedUrl')}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Group Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? t('admin.meshtasticGroups.editGroup') : t('admin.meshtasticGroups.createGroupTitle')}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label>{t('admin.meshtasticGroups.nameLabel')} *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    placeholder={t('admin.meshtasticGroups.namePlaceholder')}
                  />
                </div>
                <div className="form-group">
                  <label>{t('admin.meshtasticGroups.descriptionLabel')}</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder={t('admin.meshtasticGroups.descriptionPlaceholder')}
                  />
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.isPublic}
                      onChange={(e) => setFormData({...formData, isPublic: e.target.checked})}
                    />
                    {t('admin.meshtasticGroups.publicLabel')}
                  </label>
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.showOnHomepage}
                      onChange={(e) => setFormData({...formData, showOnHomepage: e.target.checked})}
                    />
                    {t('admin.meshtasticGroups.showOnHomepage')}
                  </label>
                </div>
                <div className="form-group">
                  <label>{t('admin.meshtasticGroups.rolesLabel')}</label>
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
                <div className="form-group">
                  <label>{t('admin.meshtasticGroups.deviceConfigLabel')}</label>
                  <textarea
                    value={formData.yamlConfig}
                    onChange={(e) => setFormData({...formData, yamlConfig: e.target.value})}
                    placeholder={`# Optional device settings for radio programming
# Supports placeholders:
#   \${shortName} - Radio's short name (4 chars)
#   \${longName}  - Radio's long name
#   \${mac}       - Radio's MAC address
#   \${callsign}  - Assigned user's callsign
#
# Example:
device:
  role: CLIENT
  serialEnabled: true
lora:
  region: EU_868
  txPower: 20
bluetooth:
  enabled: true`}
                    style={{ fontFamily: 'monospace', minHeight: '180px' }}
                  />
                  <span className="help-text">
                    {t('admin.meshtasticGroups.deviceConfigHelp')}
                  </span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editing ? t('common.update') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Channel to Slot Modal */}
      {showSlotModal && selectedGroup && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('admin.meshtasticGroups.addChannelTitle', { name: selectedGroup.name })}</h2>
              <button className="modal-close" onClick={() => setShowSlotModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddChannelSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label>{t('admin.meshtasticGroups.selectChannel')} *</label>
                  <select
                    value={slotData.channelId}
                    onChange={(e) => setSlotData({...slotData, channelId: e.target.value})}
                    required
                  >
                    <option value="">{t('admin.meshtasticGroups.selectChannelDefault')}</option>
                    {getAvailableChannelsForGroup(selectedGroup).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {getAvailableChannelsForGroup(selectedGroup).length === 0 && (
                    <span className="help-text">{t('admin.meshtasticGroups.noAvailableChannels')} <Link to="/admin/meshtastic">{t('admin.meshtasticGroups.manageChannels')}</Link></span>
                  )}
                </div>
                <div className="form-group">
                  <label>{t('admin.meshtasticGroups.slotNumber')} *</label>
                  <select
                    value={slotData.slotNumber}
                    onChange={(e) => setSlotData({...slotData, slotNumber: parseInt(e.target.value)})}
                    required
                  >
                    {getAvailableSlots(selectedGroup).map(slot => (
                      <option key={slot} value={slot}>
                        {t('admin.meshtasticGroups.slot')} {slot}{slot === 0 ? ` (${t('common.primary')})` : ''}
                      </option>
                    ))}
                  </select>
                  <span className="help-text">{t('admin.meshtasticGroups.slotHelp')}</span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSlotModal(false)}>{t('common.cancel')}</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addChannelMutation.isPending || !slotData.channelId}
                >
                  {t('admin.meshtasticGroups.addChannel')}
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
