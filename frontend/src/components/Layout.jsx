import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Show header/footer when scrolling up, hide when scrolling down
      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsVisible(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollY]);

  return (
    <div className="layout">
      <nav className={`navbar ${isVisible ? 'navbar-visible' : 'navbar-hidden'}`}>
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
                <Link to="/admin/tak-profiles">TAK Profiles</Link>
                <Link to="/admin/meshtastic">Meshtastic</Link>
                <Link to="/admin/radios">Radios</Link>
                <Link to="/admin/packages">Packages</Link>
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

      <footer className={`footer ${isVisible ? 'footer-visible' : 'footer-hidden'}`}>
        <p>&copy; 2024 OpenTAK Onboarding Portal. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default Layout;
