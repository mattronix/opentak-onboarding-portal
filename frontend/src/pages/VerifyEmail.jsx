import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './VerifyEmail.css';

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('Verifying your email...');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    // Verify the email
    const verifyEmail = async () => {
      try {
        const response = await axios.post(`${window.location.origin}/api/v1/auth/verify-email`, { token });

        setStatus('success');
        setMessage(response.data.message);
        setUser(response.data.user);

        // Redirect to success page after brief delay
        setTimeout(() => {
          navigate('/registration-success', {
            state: {
              user: response.data.user,
              message: response.data.message
            }
          });
        }, 1500);
      } catch (error) {
        setStatus('error');
        setMessage(
          error.response?.data?.error || 'Email verification failed. Please try again.'
        );
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

  return (
    <div className="verify-email-container">
      <div className="verify-email-card">
        <h1>Email Verification</h1>

        {status === 'verifying' && (
          <div className="verify-status">
            <div className="spinner"></div>
            <p>{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="verify-status success">
            <div className="success-icon">✓</div>
            <h2>Success!</h2>
            <p>{message}</p>
            {user && (
              <div className="user-details">
                <p><strong>Username:</strong> {user.username}</p>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Callsign:</strong> {user.callsign}</p>
              </div>
            )}
            <p className="redirect-message">Redirecting to login page...</p>
            <button onClick={() => navigate('/login')} className="btn-primary">
              Go to Login Now
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="verify-status error">
            <div className="error-icon">✗</div>
            <h2>Verification Failed</h2>
            <p className="error-message">{message}</p>
            <div className="error-actions">
              <button onClick={() => navigate('/register')} className="btn-secondary">
                Register Again
              </button>
              <button onClick={() => navigate('/login')} className="btn-primary">
                Go to Login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;
