import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { radiosAPI, settingsAPI } from '../services/api';
import './ClaimRadio.css';

function ClaimRadio() {
  const { t } = useTranslation();
  const { nodeId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Check if claim radio is enabled
  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await settingsAPI.get();
      return response.data;
    },
  });

  // Fetch radio info using node ID
  const { data: radioData, isLoading: loadingRadio, error: radioError } = useQuery({
    queryKey: ['radio-claim', nodeId],
    queryFn: async () => {
      const response = await radiosAPI.getByNodeId(nodeId);
      return response.data;
    },
    enabled: !!nodeId,
  });

  const claimMutation = useMutation({
    mutationFn: () => radiosAPI.claimByNodeId(nodeId),
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 3000);
    },
    onError: (err) => {
      setError(err.response?.data?.error || t('claimRadio.claimingDisabled'));
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
          <div className="loading">{t('common.loading')}</div>
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
            <h2>{t('claimRadio.featureDisabled')}</h2>
            <p>{t('claimRadio.claimingDisabled')}</p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              {t('claimRadio.goToDashboard')}
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
            <h2>{t('claimRadio.radioNotFound')}</h2>
            <p>{t('claimRadio.radioNotFoundDesc')}</p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              {t('claimRadio.goToDashboard')}
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
            <h2>{t('claimRadio.alreadyAssigned')}</h2>
            <p>{t('claimRadio.alreadyAssignedDesc')}</p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              {t('claimRadio.goToDashboard')}
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
            <h2>{t('claimRadio.radioClaimed')}</h2>
            <p>{t('claimRadio.nowOwner', { name: radioData?.name })}</p>
            <p className="redirect-text">{t('claimRadio.redirectingToDashboard')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="claim-radio-page">
      <div className="claim-radio-container">
        <h1>{t('claimRadio.title')}</h1>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="radio-info">
          <h2>{radioData?.name}</h2>
          <div className="radio-details">
            {radioData?.platform && (
              <span className="badge badge-primary">{radioData.platform}</span>
            )}
            {radioData?.model && <span className="detail">{t('claimRadio.model')}: {radioData.model}</span>}
            {radioData?.meshtasticId && <span className="detail">{t('claimRadio.nodeId')}: <code>{radioData.meshtasticId}</code></span>}
            {radioData?.shortName && <span className="detail">{t('claimRadio.shortName')}: {radioData.shortName}</span>}
            {radioData?.longName && <span className="detail">{t('claimRadio.longName')}: {radioData.longName}</span>}
          </div>
        </div>

        <p className="claim-description">
          {t('claimRadio.claimDesc')}
        </p>

        <div className="claim-actions">
          <button
            className="btn btn-primary btn-lg"
            onClick={handleClaim}
            disabled={claimMutation.isPending}
          >
            {claimMutation.isPending ? t('claimRadio.claiming') : t('claimRadio.claimButton')}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/dashboard')}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClaimRadio;
