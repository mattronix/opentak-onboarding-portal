import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import './PendingRegistrationsList.css';

function PendingRegistrationsList() {
  const { t } = useTranslation();
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [selectedPending, setSelectedPending] = useState(null);
  const [onboardingCodes, setOnboardingCodes] = useState([]);
  const [allowManualApproval, setAllowManualApproval] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    firstName: '',
    lastName: '',
    callsign: '',
    onboarding_code_id: ''
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const navigate = useNavigate();
  const { showSuccess, showError, confirm } = useNotification();
  const { hasRole } = useAuth();
  const canEdit = hasRole('registration_admin') || hasRole('administrator');

  const API_URL = window.location.origin;

  useEffect(() => {
    fetchPendingRegistrations();
    fetchOnboardingCodes();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/v1/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Find the allow_manual_approval setting
      const registrationSettings = response.data.registration || [];
      const manualApprovalSetting = registrationSettings.find(s => s.key === 'allow_manual_approval');
      setAllowManualApproval(manualApprovalSetting?.value === 'true');
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      // Default to true if settings can't be fetched
      setAllowManualApproval(true);
    }
  };

  const fetchPendingRegistrations = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/v1/pending-registrations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingRegistrations(response.data.pending_registrations);
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.error || t('admin.pendingRegistrations.failedFetch'));
      setLoading(false);
    }
  };

  const fetchOnboardingCodes = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/v1/onboarding-codes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Onboarding codes response:', response.data);
      // API returns 'codes' not 'onboarding_codes'
      const codes = response.data.codes || response.data.onboarding_codes || [];
      console.log('Fetched onboarding codes:', codes);
      setOnboardingCodes(codes);

      // Set default onboarding code when opening create modal
      if (codes.length > 0 && !formData.onboarding_code_id) {
        setFormData(prev => ({ ...prev, onboarding_code_id: codes[0].id }));
      }
    } catch (err) {
      console.error('Failed to fetch onboarding codes:', err);
      setError(t('admin.pendingRegistrations.failedLoadCodes'));
    }
  };

  const handleDelete = async (id, username) => {
    const confirmed = await confirm(
      t('admin.pendingRegistrations.deleteConfirm', { username }),
      t('admin.pendingRegistrations.deleteRegistration')
    );
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(`${API_URL}/api/v1/pending-registrations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showSuccess(t('admin.pendingRegistrations.deleteRegistration'));
      fetchPendingRegistrations(); // Refresh list
    } catch (err) {
      showError(err.response?.data?.error || t('admin.pendingRegistrations.failedDelete'));
    }
  };

  const handleResendEmail = async (id, email) => {
    const confirmed = await confirm(
      t('admin.pendingRegistrations.resendConfirm', { email }),
      t('admin.pendingRegistrations.resendEmail')
    );
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.post(`${API_URL}/api/v1/pending-registrations/${id}/resend`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showSuccess(response.data.message);
      fetchPendingRegistrations(); // Refresh to show updated expiry
    } catch (err) {
      showError(err.response?.data?.error || t('admin.pendingRegistrations.failedResend'));
    }
  };

  const handleCleanupExpired = async () => {
    const confirmed = await confirm(
      t('admin.pendingRegistrations.cleanUpConfirm'),
      t('admin.pendingRegistrations.cleanUpExpired')
    );
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.post(`${API_URL}/api/v1/pending-registrations/cleanup-expired`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showSuccess(response.data.message);
      fetchPendingRegistrations(); // Refresh list
    } catch (err) {
      showError(err.response?.data?.error || t('admin.pendingRegistrations.failedCleanup'));
    }
  };

  const handleApprove = async (id, username) => {
    const confirmed = await confirm(
      t('admin.pendingRegistrations.approveConfirm', { username }),
      t('admin.pendingRegistrations.approveManually')
    );
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.post(`${API_URL}/api/v1/pending-registrations/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showSuccess(response.data.message);
      fetchPendingRegistrations(); // Refresh list
    } catch (err) {
      showError(err.response?.data?.error || t('admin.pendingRegistrations.failedApprove'));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return t('common.unknown');
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return t('common.unknown');
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;

    if (diff <= 0) {
      return t('common.expired');
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  const openCreateModal = () => {
    setModalMode('create');
    console.log('Opening create modal, available codes:', onboardingCodes);
    const defaultCodeId = onboardingCodes.length > 0 ? onboardingCodes[0].id : '';
    console.log('Setting default onboarding code ID:', defaultCodeId);
    setFormData({
      username: '',
      password: '',
      email: '',
      firstName: '',
      lastName: '',
      callsign: '',
      onboarding_code_id: defaultCodeId
    });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (pending) => {
    setModalMode('edit');
    setSelectedPending(pending);
    setFormData({
      username: pending.username,
      password: '',
      email: pending.email,
      firstName: pending.firstName,
      lastName: pending.lastName,
      callsign: pending.callsign,
      onboarding_code_id: pending.onboarding_code_id
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedPending(null);
    setFormError('');
  };

  const handleFormChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // Validate username format (only letters and numbers)
    const username = formData.username.toLowerCase().trim();
    const usernamePattern = /^[a-z0-9]+$/;
    if (username && !usernamePattern.test(username)) {
      setFormError(t('auth.usernameOnlyLetters'));
      return;
    }

    // Validate username length
    if (username && (username.length < 3 || username.length > 32)) {
      setFormError(t('auth.usernameLength'));
      return;
    }

    // Validate password if provided
    if (formData.password) {
      const disallowedChars = /[&^$]/;
      if (disallowedChars.test(formData.password)) {
        setFormError(t('auth.passwordNoSpecial'));
        return;
      }
    }

    setFormLoading(true);

    try {
      const token = localStorage.getItem('access_token');

      // Convert username to lowercase
      const submitData = {
        ...formData,
        username: username
      };

      if (modalMode === 'create') {
        await axios.post(`${API_URL}/api/v1/pending-registrations`, submitData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showSuccess(t('admin.pendingRegistrations.createdSuccess'));
      } else {
        // For edit, only send fields that are filled
        const updateData = {};
        if (formData.username) updateData.username = formData.username.toLowerCase().trim();
        if (formData.password) updateData.password = formData.password;
        if (formData.email) updateData.email = formData.email;
        if (formData.firstName) updateData.firstName = formData.firstName;
        if (formData.lastName) updateData.lastName = formData.lastName;
        if (formData.callsign) updateData.callsign = formData.callsign;
        if (formData.onboarding_code_id) updateData.onboarding_code_id = formData.onboarding_code_id;

        await axios.put(`${API_URL}/api/v1/pending-registrations/${selectedPending.id}`, updateData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showSuccess(t('admin.pendingRegistrations.updatedSuccess'));
      }

      closeModal();
      fetchPendingRegistrations();
    } catch (err) {
      setFormError(err.response?.data?.error || t('admin.pendingRegistrations.failedSave'));
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>;
  }

  return (
    <div className="pending-registrations-container">
      <div className="pending-registrations-header">
        <h1>{t('admin.pendingRegistrations.title')}</h1>
        <div className="header-actions">
          {canEdit && (
            <button onClick={openCreateModal} className="btn-primary">
              {t('admin.pendingRegistrations.createNew')}
            </button>
          )}
          {canEdit && (
            <button onClick={handleCleanupExpired} className="btn-warning">
              {t('admin.pendingRegistrations.cleanUpExpired')}
            </button>
          )}
          <button onClick={fetchPendingRegistrations} className="btn-secondary">
            {t('admin.pendingRegistrations.restart')}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {pendingRegistrations.length === 0 ? (
        <div className="no-data">
          <p>{t('admin.pendingRegistrations.noRegistrations')}</p>
          <p className="hint">{t('admin.pendingRegistrations.noRegistrationsDesc')}</p>
        </div>
      ) : (
        <div className="pending-registrations-table-container">
          <table className="pending-registrations-table">
            <thead>
              <tr>
                <th>{t('common.username')}</th>
                <th>{t('common.email')}</th>
                <th>{t('common.name')}</th>
                <th>{t('admin.pendingRegistrations.callsignLabel')}</th>
                <th>{t('admin.pendingRegistrations.onboardingCode')}</th>
                <th>{t('admin.pendingRegistrations.created')}</th>
                <th>{t('admin.pendingRegistrations.expires')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pendingRegistrations.map((pending) => (
                <tr key={pending.id} className={pending.is_expired ? 'expired-row' : ''}>
                  <td>{pending.username}</td>
                  <td>{pending.email}</td>
                  <td>{pending.firstName} {pending.lastName}</td>
                  <td>{pending.callsign}</td>
                  <td>
                    {pending.onboarding_code ? (
                      <span title={pending.onboarding_code.code}>
                        {pending.onboarding_code.name}
                      </span>
                    ) : t('common.unknown')}
                  </td>
                  <td>{formatDate(pending.created_at)}</td>
                  <td>{formatDate(pending.expires_at)}</td>
                  <td>
                    {pending.approval_status === 'pending_approval' ? (
                      <div>
                        <span className="status-badge approval-pending" title={t('admin.pendingRegistrations.awaitingApproval')}>
                          {t('admin.pendingRegistrations.awaitingApproval')}
                        </span>
                        {pending.onboarding_code?.approverRole && (
                          <div className="approval-info" title={t('admin.pendingRegistrations.approveManually')}>
                            <small>{t('admin.pendingRegistrations.by')}: {pending.onboarding_code.approverRole.displayName || pending.onboarding_code.approverRole.name}</small>
                          </div>
                        )}
                      </div>
                    ) : pending.is_expired ? (
                      <span className="status-badge expired">
                        {t('common.expired')}
                      </span>
                    ) : (
                      <div>
                        <span className="status-badge pending" title={t('admin.pendingRegistrations.resendDesc')}>
                          {getTimeRemaining(pending.expires_at)}
                        </span>
                        {pending.approved_by && (
                          <div className="approval-info" title={t('admin.pendingRegistrations.approvedBy')}>
                            <small>{t('admin.pendingRegistrations.approvedBy')}: {pending.approved_by.firstName || pending.approved_by.username}</small>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="actions">
                    {canEdit && allowManualApproval && pending.approval_status !== 'pending_approval' && (
                      <button
                        onClick={() => handleApprove(pending.id, pending.username)}
                        className="btn-small btn-success"
                        title={t('admin.pendingRegistrations.approveManually')}
                      >
                        {t('admin.pendingRegistrations.approveManually')}
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => openEditModal(pending)}
                        className="btn-small btn-secondary"
                        title={t('admin.pendingRegistrations.editDesc')}
                      >
                        {t('common.edit')}
                      </button>
                    )}
                    {canEdit && pending.approval_status !== 'pending_approval' && (
                      <button
                        onClick={() => handleResendEmail(pending.id, pending.email)}
                        className="btn-small btn-info"
                        title={t('admin.pendingRegistrations.resendDesc')}
                      >
                        {pending.is_expired ? t('admin.pendingRegistrations.restart') : t('admin.pendingRegistrations.resend')}
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => handleDelete(pending.id, pending.username)}
                        className="btn-small btn-danger"
                        title={t('admin.pendingRegistrations.deleteDesc')}
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pending-registrations-stats">
        <p>
          {t('admin.pendingRegistrations.totalPending')}: <strong>{pendingRegistrations.length}</strong> |
          {t('common.expired')}: <strong>{pendingRegistrations.filter(p => p.is_expired).length}</strong> |
          {t('common.active')}: <strong>{pendingRegistrations.filter(p => !p.is_expired).length}</strong>
        </p>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? t('admin.pendingRegistrations.createPending') : t('admin.pendingRegistrations.editPending')}</h2>
              <button className="close-btn" onClick={closeModal}>&times;</button>
            </div>

            <form id="pending-registration-form" onSubmit={handleFormSubmit} className="modal-form">
              {formError && <div className="error-message">{formError}</div>}

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="username">{t('admin.pendingRegistrations.usernameLabel')} *</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleFormChange}
                    required={modalMode === 'create'}
                    placeholder={t('common.username')}
                    pattern="[a-zA-Z0-9]+"
                    title={t('auth.usernameOnlyLetters')}
                    minLength={3}
                    maxLength={32}
                  />
                  <small>{t('admin.pendingRegistrations.usernameHelp')}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="email">{t('admin.pendingRegistrations.emailLabel')} *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleFormChange}
                    required={modalMode === 'create'}
                    placeholder={t('admin.pendingRegistrations.emailPlaceholder')}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">{t('admin.pendingRegistrations.firstNameLabel')} *</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleFormChange}
                    required={modalMode === 'create'}
                    placeholder={t('admin.pendingRegistrations.firstNameLabel')}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="lastName">{t('admin.pendingRegistrations.lastNameLabel')} *</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleFormChange}
                    required={modalMode === 'create'}
                    placeholder={t('admin.pendingRegistrations.lastNameLabel')}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="callsign">{t('admin.pendingRegistrations.callsignLabel')} *</label>
                  <input
                    type="text"
                    id="callsign"
                    name="callsign"
                    value={formData.callsign}
                    onChange={handleFormChange}
                    required={modalMode === 'create'}
                    placeholder={t('admin.pendingRegistrations.callsignLabel')}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">{t('admin.pendingRegistrations.passwordLabel')} *</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleFormChange}
                    required={modalMode === 'create'}
                    placeholder={modalMode === 'edit' ? t('admin.pendingRegistrations.passwordHelpEdit') : t('admin.pendingRegistrations.passwordLabel')}
                  />
                  <small>
                    {modalMode === 'edit' ? t('admin.pendingRegistrations.passwordHelpEdit') + '. ' : ''}
                    {t('auth.passwordNoSpecial')}
                  </small>
                </div>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="onboarding_code_id">{t('admin.pendingRegistrations.onboardingCodeLabel')} *</label>
                <select
                  id="onboarding_code_id"
                  name="onboarding_code_id"
                  value={formData.onboarding_code_id}
                  onChange={handleFormChange}
                  required={modalMode === 'create'}
                  style={{
                    backgroundColor: 'white',
                    color: '#333',
                    appearance: 'auto'
                  }}
                >
                  <option value="">{t('admin.pendingRegistrations.selectCode')}</option>
                  {onboardingCodes.map((code) => (
                    <option key={code.id} value={code.id}>
                      {code.name} ({code.onboardingCode})
                    </option>
                  ))}
                </select>
                {onboardingCodes.length === 0 && (
                  <small style={{ color: '#dc3545', fontWeight: '500', display: 'block', marginTop: '0.5rem' }}>
                    {t('admin.pendingRegistrations.noCodesWarning')}
                  </small>
                )}
                {onboardingCodes.length > 0 && (
                  <small style={{ color: '#28a745' }}>
                    {t('admin.pendingRegistrations.codesAvailable', { count: onboardingCodes.length })}
                  </small>
                )}
              </div>

            </form>
            <div className="modal-actions">
              <button type="button" onClick={closeModal} className="btn-secondary" disabled={formLoading}>
                {t('common.cancel')}
              </button>
              <button type="submit" form="pending-registration-form" className="btn-primary" disabled={formLoading}>
                {formLoading ? t('common.loading') : (modalMode === 'create' ? t('admin.pendingRegistrations.createAndSend') : t('admin.pendingRegistrations.updateAndSend'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PendingRegistrationsList;
