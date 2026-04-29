import { useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './VerifyEmail.css';

function VerifyEmailSent() {
  const { t } = useTranslation();
  const location = useLocation();
  const email = location.state?.email || 'your email';
  const message = location.state?.message;

  return (
    <div className="verify-email-container">
      <div className="verify-email-card">
        <div className="email-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"></rect>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
          </svg>
        </div>

        <h1>{t('auth.emailSentTitle')}</h1>

        <p className="verify-message">
          {message || t('auth.emailSentTo')}
        </p>

        <p className="verify-email-address">
          <strong>{email}</strong>
        </p>

        <div className="verify-instructions">
          <p>{t('auth.emailSentDesc')}</p>
          <p className="verify-note">
            {t('auth.emailSentExpiry')}
          </p>
        </div>

        <div className="verify-tips">
          <h3>{t('auth.emailNotReceived')}</h3>
          <ul>
            <li>{t('auth.checkSpam')}</li>
            <li>{t('auth.checkEmailCorrect')}</li>
            <li>{t('auth.waitAndCheck')}</li>
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

export default VerifyEmailSent;
