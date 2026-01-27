import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { settingsAPI } from '../services/api';
import { useState, useEffect } from 'react';
import AnnouncementsBadge from './AnnouncementsBadge';
import './Layout.css';

function Layout() {
  const { user, logout, hasAnyAdminRole, hasModuleAccess, approverStatus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [version, setVersion] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await settingsAPI.get();
      return response.data;
    },
  });

  const brandName = settings?.brand_name || 'OpenTAK Portal';

  useEffect(() => {
    // Fetch version info
    fetch('/version.json')
      .then(res => res.json())
      .then(data => setVersion(data))
      .catch(() => setVersion({ commit: 'dev', date: 'unknown' }));
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setAdminDropdownOpen(false);
    setUserDropdownOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
    if (mobileMenuOpen) {
      setAdminDropdownOpen(false);
      setUserDropdownOpen(false);
    }
  };

  const toggleAdminDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setAdminDropdownOpen(!adminDropdownOpen);
    setUserDropdownOpen(false);
  };

  const toggleUserDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setUserDropdownOpen(!userDropdownOpen);
    setAdminDropdownOpen(false);
  };

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="navbar-brand">
          <Link to="/dashboard">{brandName}</Link>
        </div>

        <button
          className={`hamburger ${mobileMenuOpen ? 'active' : ''}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle navigation menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div className={`navbar-menu ${mobileMenuOpen ? 'open' : ''}`}>
          <Link to="/dashboard" className="nav-link">
            Dashboard
          </Link>

          {approverStatus?.isApprover && (
            <Link to="/approvals" className="nav-link approvals-link">
              Approvals
              {approverStatus.pendingCount > 0 && (
                <span className="approvals-badge">{approverStatus.pendingCount}</span>
              )}
            </Link>
          )}

          {hasAnyAdminRole() && (
            <div className={`nav-dropdown ${adminDropdownOpen ? 'open' : ''}`}>
              <span className="nav-link" onClick={toggleAdminDropdown}>
                Admin
                <svg className="dropdown-arrow" viewBox="0 0 24 24" width="16" height="16">
                  <path fill="currentColor" d="M7 10l5 5 5-5z"/>
                </svg>
              </span>
              <div className="dropdown-content">
                <Link to="/admin">Admin Overview</Link>
                {hasModuleAccess('users') && <Link to="/admin/users">Users</Link>}
                {hasModuleAccess('roles') && <Link to="/admin/roles">Roles</Link>}
                {hasModuleAccess('onboarding_codes') && <Link to="/admin/onboarding-codes">Onboarding Codes</Link>}
                {hasModuleAccess('pending_registrations') && <Link to="/admin/pending-registrations">Registrations</Link>}
                {hasModuleAccess('tak_profiles') && <Link to="/admin/tak-profiles">TAK Profiles</Link>}
                {hasModuleAccess('meshtastic') && <Link to="/admin/meshtastic">Meshtastic</Link>}
                {hasModuleAccess('radios') && <Link to="/admin/radios">Radios</Link>}
                {hasModuleAccess('announcements') && <Link to="/admin/announcements">Announcements</Link>}
                {hasModuleAccess('settings') && <Link to="/admin/settings">Settings</Link>}
                {hasModuleAccess('api_keys') && <Link to="/admin/api-keys">API Keys</Link>}
                {hasModuleAccess('api_docs') && <Link to="/admin/api-docs">API Docs</Link>}
              </div>
            </div>
          )}

          <AnnouncementsBadge />

          <div className={`nav-dropdown nav-user ${userDropdownOpen ? 'open' : ''}`}>
            <span className="nav-link" onClick={toggleUserDropdown}>
              {user?.callsign || user?.username}
              <svg className="dropdown-arrow" viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M7 10l5 5 5-5z"/>
              </svg>
            </span>
            <div className="dropdown-content">
              <Link to="/profile">Profile</Link>
              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>

      <footer className="footer">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span style={{ fontSize: '0.85rem', color: '#999' }}>
            {version && `v${version.commit}`}
          </span>
          <p style={{ margin: 0 }}>&copy; 2024 {brandName}. All rights reserved.</p>
          <span style={{ fontSize: '0.85rem', color: 'transparent' }}>spacer</span>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
