import { useLocation, Link } from 'react-router-dom';
import './VerifyEmail.css';

function VerifyEmailSent() {
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

        <h1>Check Your Email</h1>

        <p className="verify-message">
          {message || `We've sent a verification email to:`}
        </p>

        <p className="verify-email-address">
          <strong>{email}</strong>
        </p>

        <div className="verify-instructions">
          <p>Please click the link in the email to verify your account and complete your registration.</p>
          <p className="verify-note">
            The verification link will expire in 24 hours.
          </p>
        </div>

        <div className="verify-tips">
          <h3>Didn't receive the email?</h3>
          <ul>
            <li>Check your spam or junk folder</li>
            <li>Make sure you entered the correct email address</li>
            <li>Wait a few minutes and check again</li>
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

export default VerifyEmailSent;
