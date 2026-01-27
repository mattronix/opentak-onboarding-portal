import axios from 'axios';

// API base URL - configurable via environment variable
// In production builds, always use same origin unless explicitly overridden
// In development mode (vite dev server), use localhost:5000 unless overridden
const getApiBaseUrl = () => {
  // If explicitly set via env var, use it
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // In development mode (vite dev server on port 5173), default to localhost:5000
  if (import.meta.env.DEV && window.location.port === '5173') {
    return 'http://localhost:5000';
  }

  // For production builds or any other case, use same origin (API served from same host)
  return window.location.origin;
};

const API_BASE_URL = getApiBaseUrl();

// Log API URL in development for debugging
if (import.meta.env.DEV) {
  console.log('API Base URL:', API_BASE_URL);
}

// Create axios instance with default config
const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Request interceptor to add auth token and handle FormData
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Remove Content-Type for FormData so axios can set it with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(
            `${API_BASE_URL}/api/v1/auth/refresh`,
            {},
            {
              headers: {
                Authorization: `Bearer ${refreshToken}`,
              },
            }
          );

          const { access_token } = response.data;
          localStorage.setItem('access_token', access_token);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }),

  register: (data) =>
    api.post('/auth/register', data),

  getCurrentUser: () =>
    api.get('/auth/me'),

  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token, newPassword) =>
    api.post('/auth/reset-password', { token, newPassword }),

  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),

  getPermissions: () =>
    api.get('/auth/permissions'),

  completeProfile: (data) =>
    api.post('/auth/complete-profile', data),
};

// Users API
export const usersAPI = {
  getAll: (params) =>
    api.get('/users', { params }),

  getById: (id) =>
    api.get(`/users/${id}`),

  create: (data) =>
    api.post('/users', data),

  update: (id, data) =>
    api.put(`/users/${id}`, data),

  delete: (id) =>
    api.delete(`/users/${id}`),
};

// Roles API
export const rolesAPI = {
  getAll: () =>
    api.get('/roles'),

  getById: (id) =>
    api.get(`/roles/${id}`),

  create: (data) =>
    api.post('/roles', data),

  update: (id, data) =>
    api.put(`/roles/${id}`, data),

  delete: (id) =>
    api.delete(`/roles/${id}`),
};

// Onboarding Codes API
export const onboardingCodesAPI = {
  getAll: () =>
    api.get('/onboarding-codes'),

  getById: (id) =>
    api.get(`/onboarding-codes/${id}`),

  validate: (code) =>
    axios.get(`${API_BASE_URL}/api/v1/onboarding-codes/validate/${code}`),

  create: (data) =>
    api.post('/onboarding-codes', data),

  update: (id, data) =>
    api.put(`/onboarding-codes/${id}`, data),

  delete: (id) =>
    api.delete(`/onboarding-codes/${id}`),
};

// TAK Profiles API
export const takProfilesAPI = {
  getAll: () =>
    api.get('/tak-profiles'),

  getById: (id) =>
    api.get(`/tak-profiles/${id}`),

  getFiles: (id) =>
    api.get(`/tak-profiles/${id}/files`),

  download: (id) => {
    const token = localStorage.getItem('access_token');
    window.open(
      `${API_BASE_URL}/api/v1/tak-profiles/${id}/download?token=${token}`,
      '_blank'
    );
  },

  create: (formData) =>
    api.post('/tak-profiles', formData),

  update: (id, formData) =>
    api.put(`/tak-profiles/${id}`, formData),

  delete: (id) =>
    api.delete(`/tak-profiles/${id}`),
};

// Meshtastic API
export const meshtasticAPI = {
  getAll: () =>
    api.get('/meshtastic'),

  getById: (id) =>
    api.get(`/meshtastic/${id}`),

  create: (data) =>
    api.post('/meshtastic', data),

  update: (id, data) =>
    api.put(`/meshtastic/${id}`, data),

  delete: (id) =>
    api.delete(`/meshtastic/${id}`),
};

// Radios API
export const radiosAPI = {
  getAll: () =>
    api.get('/radios'),

  getById: (id) =>
    api.get(`/radios/${id}`),

  create: (data) =>
    api.post('/radios', data),

  update: (id, data) =>
    api.put(`/radios/${id}`, data),

  assign: (id, userId) =>
    api.put(`/radios/${id}/assign`, { userId }),

  claim: (id) =>
    api.post(`/radios/${id}/claim`),

  delete: (id) =>
    api.delete(`/radios/${id}`),
};

// Packages API
export const packagesAPI = {
  getAll: () =>
    api.get('/packages'),

  getById: (id) =>
    api.get(`/packages/${id}`),

  download: (id) => {
    const token = localStorage.getItem('access_token');
    window.open(
      `${API_BASE_URL}/api/v1/packages/${id}/download?token=${token}`,
      '_blank'
    );
  },

  create: (formData) =>
    api.post('/packages', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  update: (id, formData) =>
    api.put(`/packages/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  delete: (id) =>
    api.delete(`/packages/${id}`),
};

// Settings API
export const settingsAPI = {
  get: () =>
    axios.get(`${API_BASE_URL}/api/v1/settings`),

  // Admin settings endpoints (require authentication)
  admin: {
    getAll: () =>
      api.get('/admin/settings'),

    updateById: (settingId, value) =>
      api.put(`/admin/settings/${settingId}`, { value }),

    updateByKey: (key, value) =>
      api.put(`/admin/settings/key/${key}`, { value }),

    // Logo management
    getLogo: () =>
      api.get('/admin/logo'),

    uploadLogo: (file) => {
      const formData = new FormData();
      formData.append('logo', file);
      return api.post('/admin/logo', formData);
    },

    deleteLogo: () =>
      api.delete('/admin/logo'),
  },
};

// Announcements API
export const announcementsAPI = {
  // Admin endpoints
  admin: {
    getAll: () =>
      api.get('/admin/announcements'),

    getById: (id) =>
      api.get(`/admin/announcements/${id}`),

    create: (data) =>
      api.post('/admin/announcements', data),

    update: (id, data) =>
      api.put(`/admin/announcements/${id}`, data),

    delete: (id) =>
      api.delete(`/admin/announcements/${id}`),

    sendNow: (id) =>
      api.post(`/admin/announcements/${id}/send`),
  },

  // User endpoints
  getAll: () =>
    api.get('/announcements'),

  getHistory: () =>
    api.get('/announcements/history'),

  getUnreadCount: () =>
    api.get('/announcements/unread-count'),

  markAsRead: (id) =>
    api.post(`/announcements/${id}/read`),

  dismiss: (id) =>
    api.post(`/announcements/${id}/dismiss`),
};

// Pending Registrations API
export const pendingRegistrationsAPI = {
  getAll: () =>
    api.get('/admin/pending-registrations'),

  approve: (id) =>
    api.post(`/admin/pending-registrations/${id}/approve`),

  delete: (id) =>
    api.delete(`/admin/pending-registrations/${id}`),

  resendVerification: (id) =>
    api.post(`/admin/pending-registrations/${id}/resend`),
};

// Approvals API (for users who are in approver roles)
export const approvalsAPI = {
  getMyApprovals: () =>
    api.get('/approvals'),

  checkApproverStatus: () =>
    api.get('/approvals/check'),

  approve: (id) =>
    api.post(`/approvals/${id}/approve`),

  reject: (id) =>
    api.post(`/approvals/${id}/reject`),
};

// QR Code API
export const qrAPI = {
  getAtakQRString: (refresh = false) => api.get('/qr/atak', { params: { refresh: refresh ? 'true' : undefined } }),
  getItakQRString: (refresh = false) => api.get('/qr/itak', { params: { refresh: refresh ? 'true' : undefined } }),
};

// API Keys API

export const apiKeysAPI = {
  getAll: () =>
    api.get('/admin/api-keys'),

  getById: (id) =>
    api.get(`/admin/api-keys/${id}`),

  create: (data) =>
    api.post('/admin/api-keys', data),

  update: (id, data) =>
    api.put(`/admin/api-keys/${id}`, data),

  delete: (id) =>
    api.delete(`/admin/api-keys/${id}`),

  regenerate: (id) =>
    api.post(`/admin/api-keys/${id}/regenerate`),

  getPermissions: () =>
    api.get('/admin/api-keys/permissions'),
};

export default api;
