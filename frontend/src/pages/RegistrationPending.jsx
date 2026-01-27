import { useLocation, Link } from 'react-router-dom';
import './VerifyEmail.css';

function RegistrationPending() {
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

        <h1>Registration Pending Approval</h1>

        <p className="verify-message">
          {message || 'Your registration request has been submitted and is awaiting approval.'}
        </p>

        <p className="verify-email-address">
          <strong>{email}</strong>
        </p>

        <div className="verify-instructions">
          <p>An administrator will review your registration request. You will receive an email at the address above once your request has been approved or declined.</p>
          <p className="verify-note">
            This process may take up to 7 days.
          </p>
        </div>

        <div className="verify-tips">
          <h3>What happens next?</h3>
          <ul>
            <li>Your registration details are being reviewed by an administrator</li>
            <li>You will receive an email notification when your request is processed</li>
            <li>If approved, you can log in using your credentials</li>
            <li>If declined, you will be notified via email with further instructions</li>
          </ul>
        </div>

        <div className="verify-actions">
          <Link to="/login" className="btn btn-secondary">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default RegistrationPending;
