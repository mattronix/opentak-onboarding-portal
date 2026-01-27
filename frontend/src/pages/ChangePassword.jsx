import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import './ChangePassword.css';

// Import the centralized API helper
import api from '../services/api';

const API_BASE_URL = window.location.origin;

export default function ChangePassword() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Change password mutation
  const changeMutation = useMutation({
    mutationFn: async (data) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to change password');
      }
      return response.json();
    },
    onSuccess: () => {
      setSuccess('Password changed successfully!');
      setError('');
      setFormData({
        newPassword: '',
        confirmPassword: ''
      });
      setTimeout(() => {
        navigate('/');
      }, 1500);
    },
    onError: (error) => {
      setError(error.message);
      setSuccess('');
    }
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!formData.newPassword || !formData.confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (formData.newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    // Check for disallowed characters
    const disallowedChars = /[&^$]/;
    if (disallowedChars.test(formData.newPassword)) {
      setError('Password cannot contain &, ^, or $ characters');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    changeMutation.mutate({
      newPassword: formData.newPassword
    });
  };

  const handleCancel = () => {
    navigate('/');
  };

  return (
    <div className="change-password-container">
      <div className="change-password-card">
        <h1>Change Password</h1>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit} className="change-password-form">
          <div className="form-group">
            <label htmlFor="newPassword">New Password *</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
              minLength={8}
            />
            <small className="field-hint">Must be at least 8 characters. Cannot contain &amp;, ^, or $ characters.</small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
              minLength={8}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={handleCancel}
              disabled={changeMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={changeMutation.isPending}
            >
              {changeMutation.isPending ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
