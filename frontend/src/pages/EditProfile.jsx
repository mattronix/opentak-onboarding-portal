import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import './EditProfile.css';

const API_BASE_URL = window.location.origin;

export default function EditProfile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    callsign: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Get current user
  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    }
  });

  // Set form data when user data is loaded
  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        callsign: user.callsign || ''
      });
    }
  }, [user]);

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update profile');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['currentUser']);
      setSuccess(t('profile.profileUpdated'));
      setError('');
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

    // Basic validation
    if (!formData.email || !formData.firstName || !formData.lastName || !formData.callsign) {
      setError(t('profile.allFieldsRequired'));
      return;
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError(t('profile.validEmail'));
      return;
    }

    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="edit-profile-container">
        <div className="loading">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="edit-profile-container">
      <div className="edit-profile-card">
        <h1>{t('profile.editTitle')}</h1>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit} className="edit-profile-form">
          <div className="form-group">
            <label htmlFor="email">{t('profile.emailLabel')} *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="firstName">{t('profile.firstNameLabel')} *</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="lastName">{t('profile.lastNameLabel')} *</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="callsign">{t('profile.callsignLabel')} *</label>
            <input
              type="text"
              id="callsign"
              name="callsign"
              value={formData.callsign}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={handleCancel}
              disabled={updateMutation.isPending}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? t('common.saving') : t('profile.saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
