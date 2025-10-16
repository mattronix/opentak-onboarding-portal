import axios from 'axios';

// API base URL - configurable via environment variable
// Default to same origin (current hostname) for production, or localhost:5000 for local dev
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin);

// Create axios instance with default config
const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
    api.post('/tak-profiles', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  update: (id, formData) =>
    api.put(`/tak-profiles/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

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
    api.get('/settings'),
};

export default api;
