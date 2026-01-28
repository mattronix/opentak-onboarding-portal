import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { settingsAPI } from './services/api';
import Notifications from './components/Notifications';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import VerifyEmailSent from './pages/VerifyEmailSent';
import RegistrationPending from './pages/RegistrationPending';
import RegistrationSuccess from './pages/RegistrationSuccess';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import CompleteProfile from './pages/CompleteProfile';
import Dashboard from './pages/Dashboard';
import EditProfile from './pages/EditProfile';
import ChangePassword from './pages/ChangePassword';
import AdminDashboard from './pages/admin/AdminDashboard';
import UsersList from './pages/admin/UsersList';
import RolesList from './pages/admin/RolesList';
import OnboardingCodesList from './pages/admin/OnboardingCodesList';
import PendingRegistrationsList from './pages/admin/PendingRegistrationsList';
import TakProfilesList from './pages/admin/TakProfilesList';
import MeshtasticList from './pages/admin/MeshtasticList';
import MeshtasticGroups from './pages/admin/MeshtasticGroups';
import RadiosList from './pages/admin/RadiosList';
import Settings from './pages/admin/Settings';
import AnnouncementsList from './pages/admin/AnnouncementsList';
import ApiKeysList from './pages/admin/ApiKeysList';
import ApiDocs from './pages/admin/ApiDocs';
import AnnouncementHistory from './pages/AnnouncementHistory';
import Profile from './pages/Profile';
import Approvals from './pages/Approvals';

// Layout
import Layout from './components/Layout';
import './App.css';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Document title component - sets page title from settings
const DocumentTitle = () => {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await settingsAPI.get();
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  useEffect(() => {
    if (settings?.brand_name) {
      document.title = settings.brand_name;
    }
  }, [settings?.brand_name]);

  return null;
};

// Loading spinner component
const LoadingScreen = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f5f5f5',
    gap: '1rem'
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '4px solid #eee',
      borderTop: '4px solid #333',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <div style={{ color: '#666', fontSize: '0.95rem' }}>Loading...</div>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Protected Route component
const ProtectedRoute = ({ children, adminOnly = false, allowIncomplete = false }) => {
  const { user, loading, isAdmin, needsProfileCompletion } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to complete profile if needed (unless on the complete-profile page itself)
  if (needsProfileCompletion && !allowIncomplete) {
    return <Navigate to="/complete-profile" replace />;
  }

  if (adminOnly && !isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Public Route component (redirects to dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <DocumentTitle />
        <Notifications />
        <AuthProvider>
          <Router>
          <Routes>
            {/* Public routes */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/register/:code"
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              }
            />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/verify-email-sent" element={<VerifyEmailSent />} />
            <Route path="/registration-pending" element={<RegistrationPending />} />
            <Route path="/registration-success" element={<RegistrationSuccess />} />
            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgotPassword />
                </PublicRoute>
              }
            />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Complete profile route - accessible only when logged in but profile incomplete */}
            <Route
              path="/complete-profile"
              element={
                <ProtectedRoute allowIncomplete>
                  <CompleteProfile />
                </ProtectedRoute>
              }
            />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="profile" element={<Profile />} />
              <Route path="edit-profile" element={<EditProfile />} />
              <Route path="change-password" element={<ChangePassword />} />
              <Route path="announcements" element={<AnnouncementHistory />} />
              <Route path="approvals" element={<Approvals />} />

              {/* Admin routes */}
              <Route
                path="admin"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/users"
                element={
                  <ProtectedRoute adminOnly>
                    <UsersList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/roles"
                element={
                  <ProtectedRoute adminOnly>
                    <RolesList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/onboarding-codes"
                element={
                  <ProtectedRoute adminOnly>
                    <OnboardingCodesList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/pending-registrations"
                element={
                  <ProtectedRoute adminOnly>
                    <PendingRegistrationsList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/tak-profiles"
                element={
                  <ProtectedRoute adminOnly>
                    <TakProfilesList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/meshtastic"
                element={
                  <ProtectedRoute adminOnly>
                    <MeshtasticList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/meshtastic/groups"
                element={
                  <ProtectedRoute adminOnly>
                    <MeshtasticGroups />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/radios"
                element={
                  <ProtectedRoute adminOnly>
                    <RadiosList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/settings"
                element={
                  <ProtectedRoute adminOnly>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/announcements"
                element={
                  <ProtectedRoute adminOnly>
                    <AnnouncementsList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/api-keys"
                element={
                  <ProtectedRoute adminOnly>
                    <ApiKeysList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/api-docs"
                element={
                  <ProtectedRoute adminOnly>
                    <ApiDocs />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
      </NotificationProvider>
    </QueryClientProvider>
  );
}

export default App;
