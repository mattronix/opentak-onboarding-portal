import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './PendingRegistrationsList.css';

function PendingRegistrationsList() {
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const API_URL = window.location.origin;

  useEffect(() => {
    fetchPendingRegistrations();
  }, []);

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

  const handleDelete = async (id, username) => {
    if (!window.confirm(`Are you sure you want to delete the pending registration for ${username}?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(`${API_URL}/api/v1/pending-registrations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPendingRegistrations(); // Refresh list
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete pending registration');
    }
  };

  const handleResendEmail = async (id, email) => {
    if (!window.confirm(`Resend verification email to ${email}?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.post(`${API_URL}/api/v1/pending-registrations/${id}/resend`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(response.data.message);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to resend email');
    }
  };

  const handleCleanupExpired = async () => {
    if (!window.confirm('Clean up all expired pending registrations?')) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.post(`${API_URL}/api/v1/pending-registrations/cleanup-expired`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(response.data.message);
      fetchPendingRegistrations(); // Refresh list
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cleanup expired registrations');
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

  if (loading) {
    return <div className="loading">Loading pending registrations...</div>;
  }

  return (
    <div className="pending-registrations-container">
      <div className="pending-registrations-header">
        <h1>Pending Registrations</h1>
        <div className="header-actions">
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
                    <span className={`status-badge ${pending.is_expired ? 'expired' : 'pending'}`}>
                      {pending.is_expired ? 'Expired' : getTimeRemaining(pending.expires_at)}
                    </span>
                  </td>
                  <td className="actions">
                    {!pending.is_expired && (
                      <button
                        onClick={() => handleResendEmail(pending.id, pending.email)}
                        className="btn-small btn-info"
                        title="Resend verification email"
                      >
                        Resend Email
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
    </div>
  );
}

export default PendingRegistrationsList;
