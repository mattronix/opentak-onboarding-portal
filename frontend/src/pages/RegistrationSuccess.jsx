import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './RegistrationSuccess.css';

function RegistrationSuccess() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [countdown, setCountdown] = useState(10);

  // Get user data from navigation state
  const user = location.state?.user;
  const message = location.state?.message || 'Your account has been successfully created!';

  useEffect(() => {
    // Redirect to login after 10 seconds
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          navigate('/login');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="registration-success-container">
      <div className="registration-success-card">
        <div className="success-animation">
          <div className="checkmark-circle">
            <div className="checkmark"></div>
          </div>
        </div>

        <h1>{t('auth.welcomeTitle')}</h1>
        <p className="success-message">{message}</p>

        {user && (
          <div className="user-info-card">
            <h2>{t('auth.yourAccountDetails')}</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">{t('common.username')}:</span>
                <span className="info-value">{user.username}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('common.email')}:</span>
                <span className="info-value">{user.email}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Callsign:</span>
                <span className="info-value">{user.callsign}</span>
              </div>
            </div>
          </div>
        )}

        <div className="welcome-section">
          <h3>{t('auth.whatsNext')}</h3>
          <div className="next-steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h4>{t('auth.checkYourEmailStep')}</h4>
                <p>{t('auth.welcomeEmailSent')}</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h4>{t('auth.loginToAccount')}</h4>
                <p>{t('auth.loginToAccountDesc')}</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h4>{t('auth.downloadCerts')}</h4>
                <p>{t('auth.downloadCertsDesc')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="redirect-info">
          <p>{t('auth.redirectingIn')}<strong>{countdown}</strong> {t('auth.seconds')}</p>
          <button onClick={() => navigate('/login')} className="btn-login">
            {t('auth.goToLoginNow')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RegistrationSuccess;
