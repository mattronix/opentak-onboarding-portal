import { useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './VerifyEmail.css';

function RegistrationPending() {
  const { t } = useTranslation();
  const location = useLocation();
  const email = location.state?.email || 'your email';
  const message = location.state?.message;

  return (
    <div className="verify-email-container">
      <div className="verify-email-card">
        <div className="email-icon" style={{ color: '#ffc107' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>

        <h1>{t('auth.pendingApprovalTitle')}</h1>

        <p className="verify-message">
          {message || t('auth.pendingApprovalDesc')}
        </p>

        <p className="verify-email-address">
          <strong>{email}</strong>
        </p>

        <div className="verify-instructions">
          <p>{t('auth.pendingApprovalInfo')}</p>
          <p className="verify-note">
            {t('auth.pendingApprovalTime')}
          </p>
        </div>

        <div className="verify-tips">
          <h3>{t('auth.whatHappensNext')}</h3>
          <ul>
            <li>{t('auth.pendingStep1')}</li>
            <li>{t('auth.pendingStep2')}</li>
            <li>{t('auth.pendingStep3')}</li>
            <li>{t('auth.pendingStep4')}</li>
          </ul>
        </div>

        <div className="verify-actions">
          <Link to="/login" className="btn btn-secondary">
            {t('auth.backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default RegistrationPending;
