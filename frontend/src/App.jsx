import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import RegistrationSuccess from './pages/RegistrationSuccess';
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
import RadiosList from './pages/admin/RadiosList';
import PackagesList from './pages/admin/PackagesList';
import Profile from './pages/Profile';

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

// Protected Route component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
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
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
            <Route path="/registration-success" element={<RegistrationSuccess />} />

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
                path="admin/radios"
                element={
                  <ProtectedRoute adminOnly>
                    <RadiosList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/packages"
                element={
                  <ProtectedRoute adminOnly>
                    <PackagesList />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
