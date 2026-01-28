import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useNotification } from '../../contexts/NotificationContext';
import './PendingRegistrationsList.css';

function PendingRegistrationsList() {
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
      setError(err.response?.data?.error || 'Failed to fetch pending registrations');
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
      setError('Failed to load onboarding codes. Please refresh the page.');
    }
  };

  const handleDelete = async (id, username) => {
    const confirmed = await confirm(
      `Are you sure you want to delete the pending registration for ${username}?`,
      'Delete Registration'
    );
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(`${API_URL}/api/v1/pending-registrations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showSuccess('Pending registration deleted');
      fetchPendingRegistrations(); // Refresh list
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to delete pending registration');
    }
  };

  const handleResendEmail = async (id, email) => {
    const confirmed = await confirm(
      `Resend verification email to ${email}?\n\nThis will extend the expiry date by 24 hours.`,
      'Resend Email'
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
      showError(err.response?.data?.error || 'Failed to resend email');
    }
  };

  const handleCleanupExpired = async () => {
    const confirmed = await confirm(
      'Clean up all expired pending registrations?',
      'Clean Up Expired'
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
      showError(err.response?.data?.error || 'Failed to cleanup expired registrations');
    }
  };

  const handleApprove = async (id, username) => {
    const confirmed = await confirm(
      `Manually approve registration for ${username}?\n\nThis will create the user account without requiring email verification.`,
      'Approve Registration'
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
      showError(err.response?.data?.error || 'Failed to approve registration');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return 'N/A';
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;

    if (diff <= 0) {
      return 'Expired';
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
      setFormError('Username can only contain letters and numbers (no spaces, underscores, dashes, or special characters)');
      return;
    }

    // Validate username length
    if (username && (username.length < 3 || username.length > 32)) {
      setFormError('Username must be between 3 and 32 characters');
      return;
    }

    // Validate password if provided
    if (formData.password) {
      const disallowedChars = /[&^$]/;
      if (disallowedChars.test(formData.password)) {
        setFormError('Password cannot contain &, ^, or $ characters');
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
        showSuccess('Pending registration created and verification email sent!');
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
        showSuccess('Pending registration updated and verification email sent!');
      }

      closeModal();
      fetchPendingRegistrations();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save pending registration');
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading pending registrations...</div>;
  }

  return (
    <div className="pending-registrations-container">
      <div className="pending-registrations-header">
        <h1>Pending Registrations</h1>
        <div className="header-actions">
          <button onClick={openCreateModal} className="btn-primary">
            Create New
          </button>
          <button onClick={handleCleanupExpired} className="btn-warning">
            Clean Up Expired
          </button>
          <button onClick={fetchPendingRegistrations} className="btn-secondary">
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {pendingRegistrations.length === 0 ? (
        <div className="no-data">
          <p>No pending registrations found.</p>
          <p className="hint">Pending registrations appear here when users register but haven't verified their email yet.</p>
        </div>
      ) : (
        <div className="pending-registrations-table-container">
          <table className="pending-registrations-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Name</th>
                <th>Callsign</th>
                <th>Onboarding Code</th>
                <th>Created</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Actions</th>
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
                    ) : 'N/A'}
                  </td>
                  <td>{formatDate(pending.created_at)}</td>
                  <td>{formatDate(pending.expires_at)}</td>
                  <td>
                    {pending.approval_status === 'pending_approval' ? (
                      <div>
                        <span className="status-badge approval-pending" title="Waiting for approver to approve/reject">
                          Awaiting Approval
                        </span>
                        {pending.onboarding_code?.approverRole && (
                          <div className="approval-info" title="Users with this role can approve">
                            <small>By: {pending.onboarding_code.approverRole.displayName || pending.onboarding_code.approverRole.name}</small>
                          </div>
                        )}
                      </div>
                    ) : pending.is_expired ? (
                      <span className="status-badge expired">
                        Expired
                      </span>
                    ) : (
                      <div>
                        <span className="status-badge pending" title="Waiting for email verification">
                          {getTimeRemaining(pending.expires_at)}
                        </span>
                        {pending.approved_by && (
                          <div className="approval-info" title={`Approved on ${formatDate(pending.approved_at)}`}>
                            <small>Approved by: {pending.approved_by.firstName || pending.approved_by.username}</small>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="actions">
                    {allowManualApproval && pending.approval_status !== 'pending_approval' && (
                      <button
                        onClick={() => handleApprove(pending.id, pending.username)}
                        className="btn-small btn-success"
                        title="Manually approve this registration without email verification"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      onClick={() => openEditModal(pending)}
                      className="btn-small btn-secondary"
                      title="Edit pending registration"
                    >
                      Edit
                    </button>
                    {pending.approval_status !== 'pending_approval' && (
                      <button
                        onClick={() => handleResendEmail(pending.id, pending.email)}
                        className="btn-small btn-info"
                        title="Resend verification email and extend expiry by 24 hours"
                      >
                        {pending.is_expired ? 'Restart' : 'Resend'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(pending.id, pending.username)}
                      className="btn-small btn-danger"
                      title="Delete pending registration"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pending-registrations-stats">
        <p>
          Total pending: <strong>{pendingRegistrations.length}</strong> |
          Expired: <strong>{pendingRegistrations.filter(p => p.is_expired).length}</strong> |
          Active: <strong>{pendingRegistrations.filter(p => !p.is_expired).length}</strong>
        </p>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Create Pending Registration' : 'Edit Pending Registration'}</h2>
              <button className="close-btn" onClick={closeModal}>&times;</button>
            </div>

            <form id="pending-registration-form" onSubmit={handleFormSubmit} className="modal-form">
              {formError && <div className="error-message">{formError}</div>}

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="username">Username *</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleFormChange}
                    required={modalMode === 'create'}
                    placeholder="Enter username"
                    pattern="[a-zA-Z0-9]+"
                    title="Only letters and numbers allowed"
                    minLength={3}
                    maxLength={32}
                  />
                  <small>Letters and numbers only (3-32 characters, will be lowercase)</small>
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleFormChange}
                    required={modalMode === 'create'}
                    placeholder="user@example.com"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name *</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleFormChange}
                    required={modalMode === 'create'}
                    placeholder="First name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="lastName">Last Name *</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleFormChange}
                    required={modalMode === 'create'}
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="callsign">Callsign *</label>
                  <input
                    type="text"
                    id="callsign"
                    name="callsign"
                    value={formData.callsign}
                    onChange={handleFormChange}
                    required={modalMode === 'create'}
                    placeholder="Callsign"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password *</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleFormChange}
                    required={modalMode === 'create'}
                    placeholder={modalMode === 'edit' ? 'Leave blank to keep current' : 'Enter password'}
                  />
                  <small>
                    {modalMode === 'edit' ? 'Leave blank to keep current. ' : ''}
                    Cannot contain &amp;, ^, or $ characters.
                  </small>
                </div>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="onboarding_code_id">Onboarding Code *</label>
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
                  <option value="">-- Select an onboarding code --</option>
                  {onboardingCodes.map((code) => (
                    <option key={code.id} value={code.id}>
                      {code.name} ({code.onboardingCode})
                    </option>
                  ))}
                </select>
                {onboardingCodes.length === 0 && (
                  <small style={{ color: '#dc3545', fontWeight: '500', display: 'block', marginTop: '0.5rem' }}>
                    ⚠️ No onboarding codes found. Please create an onboarding code first in the Onboarding Codes section.
                  </small>
                )}
                {onboardingCodes.length > 0 && (
                  <small style={{ color: '#28a745' }}>
                    ✓ {onboardingCodes.length} onboarding code{onboardingCodes.length !== 1 ? 's' : ''} available
                  </small>
                )}
              </div>

            </form>
            <div className="modal-actions">
              <button type="button" onClick={closeModal} className="btn-secondary" disabled={formLoading}>
                Cancel
              </button>
              <button type="submit" form="pending-registration-form" className="btn-primary" disabled={formLoading}>
                {formLoading ? 'Saving...' : (modalMode === 'create' ? 'Create & Send Email' : 'Update & Send Email')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PendingRegistrationsList;
