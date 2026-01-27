import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { approvalsAPI } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import './Approvals.css';

function Approvals() {
  const queryClient = useQueryClient();
  const { showSuccess, showError, confirm } = useNotification();
  const { refreshApproverStatus } = useAuth();
  const [actionLoading, setActionLoading] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['myApprovals'],
    queryFn: async () => {
      const response = await approvalsAPI.getMyApprovals();
      return response.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id) => approvalsAPI.approve(id),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['myApprovals'] });
      refreshApproverStatus(); // Update navbar badge
      showSuccess(response.data.message);
    },
    onError: (err) => {
      showError(err.response?.data?.error || 'Failed to approve registration');
    },
    onSettled: () => {
      setActionLoading(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => approvalsAPI.reject(id),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['myApprovals'] });
      refreshApproverStatus(); // Update navbar badge
      showSuccess(response.data.message);
    },
    onError: (err) => {
      showError(err.response?.data?.error || 'Failed to reject registration');
    },
    onSettled: () => {
      setActionLoading(null);
    },
  });

  const handleApprove = async (pending) => {
    const confirmed = await confirm(
      `Approve registration for ${pending.username}?\n\nTheir account will be created immediately and they can log in right away.`,
      'Approve Registration'
    );
    if (!confirmed) return;
    setActionLoading(pending.id);
    approveMutation.mutate(pending.id);
  };

  const handleReject = async (pending) => {
    const confirmed = await confirm(
      `Reject registration for ${pending.username}?\n\nThis action cannot be undone. The user will be notified.`,
      'Reject Registration'
    );
    if (!confirmed) return;
    setActionLoading(pending.id);
    rejectMutation.mutate(pending.id);
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

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    return `${hours}h`;
  };

  if (isLoading) {
    return (
      <div className="approvals-container">
        <div className="loading">Loading pending approvals...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="approvals-container">
        <div className="error-message">
          {error.response?.data?.error || 'Failed to load approvals'}
        </div>
      </div>
    );
  }

  if (!data?.is_approver) {
    return (
      <div className="approvals-container">
        <div className="approvals-header">
          <h1>Approvals</h1>
        </div>
        <div className="not-approver-message">
          <h2>No Approver Access</h2>
          <p>You are not configured as an approver for any onboarding codes.</p>
          <p>Contact an administrator if you believe you should have approver access.</p>
        </div>
      </div>
    );
  }

  const pendingApprovals = data?.pending_approvals || [];
  const approverForCodes = data?.approver_for_codes || [];

  return (
    <div className="approvals-container">
      <div className="approvals-header">
        <h1>Pending Approvals</h1>
        <div className="approver-info">
          <span className="approver-badge">
            Approver for: {approverForCodes.map(c => c.name).join(', ')}
          </span>
        </div>
      </div>

      {pendingApprovals.length === 0 ? (
        <div className="no-approvals">
          <div className="no-approvals-icon">
            <svg viewBox="0 0 24 24" width="64" height="64">
              <path fill="#28a745" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <h2>All Caught Up!</h2>
          <p>There are no pending registrations waiting for your approval.</p>
        </div>
      ) : (
        <>
          <div className="approvals-count">
            <span className="count-badge">{pendingApprovals.length}</span> registration{pendingApprovals.length !== 1 ? 's' : ''} pending your approval
          </div>

          <div className="approvals-list">
            {pendingApprovals.map((pending) => (
              <div key={pending.id} className={`approval-card ${pending.is_expired ? 'expired' : ''}`}>
                <div className="approval-card-header">
                  <div className="user-info">
                    <h3>{pending.firstName} {pending.lastName}</h3>
                    <span className="username">@{pending.username}</span>
                  </div>
                  <div className="expiry-info">
                    <span className={`expiry-badge ${pending.is_expired ? 'expired' : ''}`}>
                      {pending.is_expired ? 'Expired' : `Expires in ${getTimeRemaining(pending.expires_at)}`}
                    </span>
                  </div>
                </div>

                <div className="approval-card-body">
                  <div className="detail-row">
                    <span className="label">Email:</span>
                    <span className="value">{pending.email}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Callsign:</span>
                    <span className="value">{pending.callsign}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Onboarding Code:</span>
                    <span className="value">{pending.onboarding_code?.name || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Requested:</span>
                    <span className="value">{formatDate(pending.created_at)}</span>
                  </div>
                  {pending.approver_role && (
                    <div className="detail-row">
                      <span className="label">Your Role:</span>
                      <span className="value role-badge">{pending.approver_role.displayName || pending.approver_role.name}</span>
                    </div>
                  )}
                </div>

                <div className="approval-card-actions">
                  <button
                    className="btn btn-success"
                    onClick={() => handleApprove(pending)}
                    disabled={actionLoading === pending.id || pending.is_expired}
                  >
                    {actionLoading === pending.id ? 'Processing...' : 'Approve'}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleReject(pending)}
                    disabled={actionLoading === pending.id}
                  >
                    {actionLoading === pending.id ? 'Processing...' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default Approvals;
