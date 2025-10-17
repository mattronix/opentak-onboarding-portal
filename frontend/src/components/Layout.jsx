import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import './Layout.css';

function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [version, setVersion] = useState(null);

  useEffect(() => {
    // Fetch version info
    fetch('/version.json')
      .then(res => res.json())
      .then(data => setVersion(data))
      .catch(() => setVersion({ commit: 'dev', date: 'unknown' }));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="navbar-brand">
          <Link to="/dashboard">OpenTAK Onboarding Portal</Link>
        </div>

        <div className="navbar-menu">
          <Link to="/dashboard" className="nav-link">
            Dashboard
          </Link>

          {isAdmin() && (
            <div className="nav-dropdown">
              <span className="nav-link">Admin</span>
              <div className="dropdown-content">
                <Link to="/admin">Admin Dashboard</Link>
                <Link to="/admin/users">Users</Link>
                <Link to="/admin/roles">Roles</Link>
                <Link to="/admin/onboarding-codes">Onboarding Codes</Link>
                <Link to="/admin/pending-registrations">Registrations</Link>
                <Link to="/admin/tak-profiles">TAK Profiles</Link>
                <Link to="/admin/meshtastic">Meshtastic</Link>
                <Link to="/admin/radios">Radios</Link>
                <Link to="/admin/settings">Settings</Link>
              </div>
            </div>
          )}

          <div className="nav-dropdown nav-user">
            <span className="nav-link">
              {user?.callsign || user?.username}
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
          <p style={{ margin: 0 }}>&copy; 2024 OpenTAK Onboarding Portal. All rights reserved.</p>
          <span style={{ fontSize: '0.85rem', color: 'transparent' }}>spacer</span>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
