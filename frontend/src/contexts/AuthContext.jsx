import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, approvalsAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState({ roles: [], modules: [], isAdmin: false });
  const [approverStatus, setApproverStatus] = useState({ isApprover: false, pendingCount: 0 });

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');

    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        // Invalid stored user data, clear it
        localStorage.removeItem('user');
        setLoading(false);
        return;
      }

      // Set a timeout to ensure loading eventually finishes even if API hangs
      const timeoutId = setTimeout(() => {
        console.warn('Auth check timed out, using cached user data');
        setLoading(false);
      }, 10000); // 10 second timeout

      // Verify token is still valid and fetch permissions
      Promise.all([
        authAPI.getCurrentUser(),
        authAPI.getPermissions(),
        approvalsAPI.checkApproverStatus().catch(() => ({ data: { is_approver: false, pending_count: 0 } }))
      ])
        .then(([userResponse, permissionsResponse, approverResponse]) => {
          clearTimeout(timeoutId);
          setUser(userResponse.data);
          localStorage.setItem('user', JSON.stringify(userResponse.data));
          setPermissions(permissionsResponse.data);
          setApproverStatus({
            isApprover: approverResponse.data.is_approver,
            pendingCount: approverResponse.data.pending_count
          });
        })
        .catch(() => {
          clearTimeout(timeoutId);
          // Token invalid, clear storage
          logout();
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    try {
      // Convert username to lowercase for consistency
      const response = await authAPI.login(username.toLowerCase().trim(), password);
      const { access_token, refresh_token, user: userData } = response.data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('user', JSON.stringify(userData));

      setUser(userData);

      // Fetch permissions and approver status from database after login
      try {
        const [permResponse, approverResponse] = await Promise.all([
          authAPI.getPermissions(),
          approvalsAPI.checkApproverStatus().catch(() => ({ data: { is_approver: false, pending_count: 0 } }))
        ]);
        setPermissions(permResponse.data);
        setApproverStatus({
          isApprover: approverResponse.data.is_approver,
          pendingCount: approverResponse.data.pending_count
        });
      } catch (e) {
        console.error('Failed to fetch permissions:', e);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  };

  const register = async (registrationData) => {
    try {
      const response = await authAPI.register(registrationData);
      return {
        success: true,
        message: response.data.message,
        autoApproved: response.data.auto_approved || false,
        pendingApproval: response.data.pending_approval || false,
        email: response.data.email
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    setPermissions({ roles: [], modules: [], isAdmin: false });
    setApproverStatus({ isApprover: false, pendingCount: 0 });
  };

  const updateUser = async () => {
    try {
      const [userResponse, permResponse, approverResponse] = await Promise.all([
        authAPI.getCurrentUser(),
        authAPI.getPermissions(),
        approvalsAPI.checkApproverStatus().catch(() => ({ data: { is_approver: false, pending_count: 0 } }))
      ]);
      setUser(userResponse.data);
      localStorage.setItem('user', JSON.stringify(userResponse.data));
      setPermissions(permResponse.data);
      setApproverStatus({
        isApprover: approverResponse.data.is_approver,
        pendingCount: approverResponse.data.pending_count
      });
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const refreshApproverStatus = async () => {
    try {
      const response = await approvalsAPI.checkApproverStatus();
      setApproverStatus({
        isApprover: response.data.is_approver,
        pendingCount: response.data.pending_count
      });
    } catch (error) {
      console.error('Failed to refresh approver status:', error);
    }
  };

  const isAdmin = () => {
    // Check from database permissions (RBAC)
    return permissions.isAdmin || permissions.roles.includes('administrator');
  };

  const hasRole = (role) => {
    // Check from database permissions (RBAC)
    return permissions.roles.includes(role) || permissions.roles.includes('administrator');
  };

  const hasModuleAccess = (moduleName) => {
    // Check if user has access to a specific admin module (from database RBAC)
    return permissions.modules.includes(moduleName) || permissions.roles.includes('administrator');
  };

  const hasAnyAdminRole = () => {
    // Check if user has access to at least one admin module (from database RBAC)
    return permissions.isAdmin || permissions.modules.length > 0;
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAdmin,
    hasRole,
    hasModuleAccess,
    hasAnyAdminRole,
    permissions,
    approverStatus,
    refreshApproverStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
