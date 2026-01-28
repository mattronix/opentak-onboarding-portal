import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { radiosAPI, settingsAPI } from '../services/api';
import './ClaimRadio.css';

function ClaimRadio() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Check if claim radio is enabled
  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await settingsAPI.public.getAll();
      return response.data;
    },
  });

  // Fetch radio info using claim token
  const { data: radioData, isLoading: loadingRadio, error: radioError } = useQuery({
    queryKey: ['radio-claim', token],
    queryFn: async () => {
      const response = await radiosAPI.getByClaimToken(token);
      return response.data;
    },
    enabled: !!token,
  });

  const claimMutation = useMutation({
    mutationFn: () => radiosAPI.claimByToken(token),
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 3000);
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to claim radio');
    },
  });

  const handleClaim = () => {
    setError('');
    claimMutation.mutate();
  };

  if (loadingSettings || loadingRadio) {
    return (
      <div className="claim-radio-page">
        <div className="claim-radio-container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  // Check if feature is enabled
  if (!settingsData?.claim_radio_enabled) {
    return (
      <div className="claim-radio-page">
        <div className="claim-radio-container">
          <div className="claim-radio-error">
            <h2>Feature Disabled</h2>
            <p>Radio claiming is not enabled on this portal.</p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle radio not found
  if (radioError) {
    return (
      <div className="claim-radio-page">
        <div className="claim-radio-container">
          <div className="claim-radio-error">
            <h2>Radio Not Found</h2>
            <p>The radio you're trying to claim doesn't exist or you don't have access to it.</p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if radio already has someone assigned
  if (radioData?.assignedTo) {
    return (
      <div className="claim-radio-page">
        <div className="claim-radio-container">
          <div className="claim-radio-error">
            <h2>Already Assigned</h2>
            <p>This radio is already assigned to someone.</p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="claim-radio-page">
        <div className="claim-radio-container">
          <div className="claim-radio-success">
            <div className="success-icon">&#10004;</div>
            <h2>Radio Claimed!</h2>
            <p>You are now the owner of <strong>{radioData?.name}</strong></p>
            <p className="redirect-text">Redirecting to dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="claim-radio-page">
      <div className="claim-radio-container">
        <h1>Claim Radio</h1>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="radio-info">
          <h2>{radioData?.name}</h2>
          <div className="radio-details">
            {radioData?.platform && (
              <span className="badge badge-primary">{radioData.platform}</span>
            )}
            {radioData?.model && <span className="detail">Model: {radioData.model}</span>}
            {radioData?.shortName && <span className="detail">Short Name: {radioData.shortName}</span>}
            {radioData?.longName && <span className="detail">Long Name: {radioData.longName}</span>}
          </div>
        </div>

        <p className="claim-description">
          By claiming this radio, it will be assigned to you. This allows you to view and manage this radio from your dashboard.
        </p>

        <div className="claim-actions">
          <button
            className="btn btn-primary btn-lg"
            onClick={handleClaim}
            disabled={claimMutation.isPending}
          >
            {claimMutation.isPending ? 'Claiming...' : 'Claim This Radio'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/dashboard')}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClaimRadio;
