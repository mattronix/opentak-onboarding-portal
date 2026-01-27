import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './RegistrationSuccess.css';

function RegistrationSuccess() {
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

        <h1>Welcome to OpenTAK!</h1>
        <p className="success-message">{message}</p>

        {user && (
          <div className="user-info-card">
            <h2>Your Account Details</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Username:</span>
                <span className="info-value">{user.username}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Email:</span>
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
          <h3>What's Next?</h3>
          <div className="next-steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h4>Check Your Email</h4>
                <p>We've sent you a welcome email with important information about getting started.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h4>Login to Your Account</h4>
                <p>Use your username and password to access the portal.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h4>Download Your Certificates</h4>
                <p>Once logged in, download your TAK certificates and configure your devices.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="redirect-info">
          <p>Redirecting to login in <strong>{countdown}</strong> seconds...</p>
          <button onClick={() => navigate('/login')} className="btn-login">
            Go to Login Now
          </button>
        </div>
      </div>
    </div>
  );
}

export default RegistrationSuccess;
