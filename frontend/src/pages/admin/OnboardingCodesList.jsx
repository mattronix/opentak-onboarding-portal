import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { onboardingCodesAPI, rolesAPI, usersAPI, groupsAPI } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import '../../components/AdminTable.css';

function OnboardingCodesList() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, confirm } = useNotification();
  const { hasRole } = useAuth();
  const canEdit = hasRole('onboarding_admin') || hasRole('administrator');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    onboardingCode: '',
    maxUses: '',
    onboardContact: null,
    expiryDate: '',
    userExpiryDate: '',
    roleIds: [],
    groups: [],
    autoApprove: false,
    requireApproval: false,
    approverRoleId: null
  });
  const [error, setError] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState(null);

  const { data: codesData, isLoading } = useQuery({
    queryKey: ['onboardingCodes'],
    queryFn: async () => {
      const response = await onboardingCodesAPI.getAll();
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

  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const response = await groupsAPI.getAll();
      return response.data;
    },
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await usersAPI.getAll({ per_page: 1000 });
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => onboardingCodesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['onboardingCodes']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => setError(err.response?.data?.error || t('admin.onboardingCodes.failedCreate')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => onboardingCodesAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['onboardingCodes']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => setError(err.response?.data?.error || t('admin.onboardingCodes.failedUpdate')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => onboardingCodesAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['onboardingCodes']),
    onError: (err) => showError(err.response?.data?.error || t('admin.onboardingCodes.failedDelete')),
  });

  const generateUUID = () => {
    // Use crypto.randomUUID if available, otherwise fallback to manual generation
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      onboardingCode: generateUUID(),
      maxUses: '',
      onboardContact: null,
      expiryDate: '',
      userExpiryDate: '',
      roleIds: [],
      groups: [],
      autoApprove: false,
      requireApproval: false,
      approverRoleId: null
    });
    setEditing(null);
    setError('');
  };

  const copyOnboardingUrl = (code, codeId) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/register/${code}`;

    navigator.clipboard.writeText(url).then(() => {
      setCopiedCodeId(codeId);
      setTimeout(() => setCopiedCodeId(null), 2000);
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedCodeId(codeId);
      setTimeout(() => setCopiedCodeId(null), 2000);
    });
  };

  const handleEdit = async (code) => {
    try {
      const response = await onboardingCodesAPI.getById(code.id);
      const fullCode = response.data;

      setEditing(fullCode);
      setFormData({
        name: fullCode.name || '',
        description: fullCode.description || '',
        onboardingCode: fullCode.onboardingCode || '',
        maxUses: fullCode.maxUses || '',
        onboardContact: fullCode.onboardContact?.id || null,
        expiryDate: fullCode.expiryDate ? fullCode.expiryDate.split('T')[0] : '',
        userExpiryDate: fullCode.userExpiryDate ? fullCode.userExpiryDate.split('T')[0] : '',
        roleIds: fullCode.roles?.map(r => r.id) || [],
        groups: fullCode.groups?.map(g => ({ id: g.id, direction: g.direction || 'BOTH' })) || [],
        autoApprove: fullCode.autoApprove || false,
        requireApproval: fullCode.requireApproval || false,
        approverRoleId: fullCode.approverRole?.id || null
      });
      setError('');
      setShowModal(true);
    } catch (err) {
      showError(t('admin.onboardingCodes.failedLoad') + ': ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const submitData = {
      name: formData.name,
      description: formData.description,
      onboardingCode: formData.onboardingCode,
      maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
      onboardContactId: formData.onboardContact || null,
      expiryDate: formData.expiryDate || null,
      userExpiryDate: formData.userExpiryDate || null,
      roleIds: formData.roleIds,
      groups: formData.groups,
      autoApprove: formData.autoApprove,
      requireApproval: formData.requireApproval,
      approverRoleId: formData.approverRoleId || null
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  if (isLoading) return <div className="admin-page"><div className="loading-state">{t('common.loading')}</div></div>;

  const codes = codesData?.codes || [];
  const users = usersData?.users || [];
  const roles = rolesData?.roles || [];
  const otsGroups = groupsData?.groups || [];

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>{t('admin.onboardingCodes.title')}</h1>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
            {t('admin.onboardingCodes.addCode')}
          </button>
        )}
      </div>

      <div className="admin-table-container">
        {codes.length === 0 ? (
          <div className="empty-state">{t('admin.onboardingCodes.noCodes')}</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('common.name')}</th>
                <th>{t('admin.onboardingCodes.code')}</th>
                <th>{t('admin.onboardingCodes.usesCol')}</th>
                <th>{t('admin.onboardingCodes.contact')}</th>
                <th>{t('admin.onboardingCodes.expiry')}</th>
                <th>{t('common.roles')}</th>
                <th>{t('admin.onboardingCodes.groups')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(code => (
                <tr key={code.id}>
                  <td>
                  <strong>{code.name}</strong>
                  {code.autoApprove && <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>{t('admin.onboardingCodes.auto')}</span>}
                  {code.requireApproval && <span className="badge badge-warning" style={{ marginLeft: '0.5rem' }}>{t('admin.onboardingCodes.approval')}</span>}
                </td>
                  <td><code>{code.onboardingCode}</code></td>
                  <td>{code.uses} / {code.maxUses || '∞'}</td>
                  <td>{code.onboardContact?.username || '-'}</td>
                  <td>{code.expiryDate ? new Date(code.expiryDate).toLocaleDateString() : t('common.never')}</td>
                  <td>
                    {code.roles?.map(role => (
                      <span key={role.id} className="badge badge-primary">{role.displayName || role.name}</span>
                    ))}
                  </td>
                  <td>
                    {code.groups?.map(group => (
                      <span key={group.id} className="badge badge-success">
                        {group.displayName || group.name}
                        {group.direction && group.direction !== 'BOTH' && ` (${group.direction})`}
                      </span>
                    ))}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => copyOnboardingUrl(code.onboardingCode, code.id)}
                        title={t('common.copyUrl')}
                      >
                        {copiedCodeId === code.id ? t('common.copied') : t('common.copyUrl')}
                      </button>
                      {canEdit && (
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(code)}>
                          {t('common.edit')}
                        </button>
                      )}
                      {canEdit && (
                        <button className="btn btn-sm btn-danger" onClick={async () => {
                          const confirmed = await confirm(t('admin.onboardingCodes.deleteConfirm', { name: code.name }), t('admin.onboardingCodes.deleteCode'));
                          if (confirmed) deleteMutation.mutate(code.id);
                        }}>
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
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? t('admin.onboardingCodes.editCode') : t('admin.onboardingCodes.createCode')}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-group">
                  <label>{t('admin.onboardingCodes.nameLabel')}</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                  <span className="help-text">{t('admin.onboardingCodes.nameHelp')}</span>
                </div>

                <div className="form-group">
                  <label>{t('admin.onboardingCodes.codeLabel')}</label>
                  <input type="text" value={formData.onboardingCode} onChange={(e) => setFormData({...formData, onboardingCode: e.target.value})} required disabled={!!editing} />
                  <span className="help-text">{editing ? t('admin.onboardingCodes.codeCannotChange') : t('admin.onboardingCodes.codeHelp')}</span>
                </div>

                <div className="form-group">
                  <label>{t('common.description')}</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>{t('admin.onboardingCodes.maxUses')}</label>
                  <input type="number" value={formData.maxUses} onChange={(e) => setFormData({...formData, maxUses: e.target.value})} min="0" placeholder={t('admin.onboardingCodes.unlimited')} />
                  <span className="help-text">{t('admin.onboardingCodes.maxUsesHelp')}</span>
                </div>

                <div className="form-group">
                  <label>{t('admin.onboardingCodes.onboardContact')}</label>
                  <select value={formData.onboardContact || ''} onChange={(e) => setFormData({...formData, onboardContact: e.target.value ? parseInt(e.target.value) : null})}>
                    <option value="">{t('admin.onboardingCodes.noContact')}</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.username}{(user.firstName || user.lastName) ? ` (${[user.firstName, user.lastName].filter(Boolean).join(' ')})` : ''}</option>
                    ))}
                  </select>
                  <span className="help-text">{t('admin.onboardingCodes.contactHelp')}</span>
                </div>

                <div className="form-group">
                  <label>{t('admin.onboardingCodes.codeExpiryDate')}</label>
                  <input type="date" value={formData.expiryDate} onChange={(e) => setFormData({...formData, expiryDate: e.target.value})} />
                  <span className="help-text">{t('admin.onboardingCodes.codeExpiryHelp')}</span>
                </div>

                <div className="form-group">
                  <label>{t('admin.onboardingCodes.userExpiryDate')}</label>
                  <input type="date" value={formData.userExpiryDate} onChange={(e) => setFormData({...formData, userExpiryDate: e.target.value})} />
                  <span className="help-text">{t('admin.onboardingCodes.userExpiryHelp')}</span>
                </div>

                <div className="form-group">
                  <label>{t('common.roles')}</label>
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
                  <span className="help-text">{t('admin.onboardingCodes.rolesHelp')}</span>
                </div>

                <div className="form-group">
                  <label>{t('admin.onboardingCodes.otsGroupsLabel')}</label>
                  {otsGroups.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '0.5rem 0' }}>
                      {t('admin.onboardingCodes.noGroupsAvailable')}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {otsGroups.filter(g => g.active).map(group => {
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
                  )}
                  <span className="help-text">{t('admin.onboardingCodes.otsGroupsHelp')}</span>
                </div>

                <div className="form-group">
                  <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.autoApprove}
                      onChange={(e) => setFormData({...formData, autoApprove: e.target.checked, requireApproval: e.target.checked ? false : formData.requireApproval})}
                      style={{ width: 'auto' }}
                    />
                    <span style={{ fontWeight: 'normal' }}>{t('admin.onboardingCodes.autoApprove')}</span>
                  </label>
                  <span className="help-text">{t('admin.onboardingCodes.autoApproveHelp')}</span>
                </div>

                <div className="form-group">
                  <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.requireApproval}
                      onChange={(e) => setFormData({...formData, requireApproval: e.target.checked, autoApprove: e.target.checked ? false : formData.autoApprove})}
                      style={{ width: 'auto' }}
                    />
                    <span style={{ fontWeight: 'normal' }}>{t('admin.onboardingCodes.requireApproval')}</span>
                  </label>
                  <span className="help-text">{t('admin.onboardingCodes.requireApprovalHelp')}</span>
                </div>

                {formData.requireApproval && (
                  <div className="form-group">
                    <label>{t('admin.onboardingCodes.approverRole')}</label>
                    <select
                      value={formData.approverRoleId || ''}
                      onChange={(e) => setFormData({...formData, approverRoleId: e.target.value ? parseInt(e.target.value) : null})}
                      required
                    >
                      <option value="">{t('admin.onboardingCodes.selectRole')}</option>
                      {roles.map(role => (
                        <option key={role.id} value={role.id}>{role.displayName || role.name}</option>
                      ))}
                    </select>
                    <span className="help-text">{t('admin.onboardingCodes.approverRoleHelp')}</span>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editing ? t('admin.onboardingCodes.updateCode') : t('admin.onboardingCodes.createCodeBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OnboardingCodesList;
