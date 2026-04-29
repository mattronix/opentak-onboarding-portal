import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { settingsAPI, usersAPI } from '../services/api';
import { useState, useEffect } from 'react';
import AnnouncementsBadge from './AnnouncementsBadge';
import './Layout.css';

function Layout() {
  const { t } = useTranslation();
  const { user, logout, hasAnyAdminRole, hasModuleAccess, approverStatus, impersonating, stopImpersonation } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
  const logoEnabled = settings?.custom_logo_enabled === true || settings?.custom_logo_enabled === 'true';
  const logoPath = logoEnabled && settings?.custom_logo_path
    ? settings.custom_logo_path
    : settings?.default_logo_path;
  const displayMode = settings?.logo_display_mode || 'logo_and_text';
  const showLogo = logoPath && (displayMode === 'logo_only' || displayMode === 'logo_and_text');
  const showText = displayMode === 'text_only' || displayMode === 'logo_and_text';

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
          <Link to="/dashboard">
            {showLogo && (
              <img src={logoPath} alt={brandName} className="navbar-logo" />
            )}
            {showText && <span className="navbar-brand-text">{brandName}</span>}
          </Link>
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
            {t('layout.homepage')}
          </Link>

          {approverStatus?.isApprover && (
            <Link to="/approvals" className="nav-link approvals-link">
              {t('layout.approvals')}
              {approverStatus.pendingCount > 0 && (
                <span className="approvals-badge">{approverStatus.pendingCount}</span>
              )}
            </Link>
          )}

          {hasAnyAdminRole() && (
            <div className={`nav-dropdown ${adminDropdownOpen ? 'open' : ''}`}>
              <span className="nav-link" onClick={toggleAdminDropdown}>
                {t('layout.admin')}
                <svg className="dropdown-arrow" viewBox="0 0 24 24" width="16" height="16">
                  <path fill="currentColor" d="M7 10l5 5 5-5z"/>
                </svg>
              </span>
              <div className="dropdown-content">
                <Link to="/admin">{t('layout.adminOverview')}</Link>
                {hasModuleAccess('users') && <Link to="/admin/users">{t('layout.users')}</Link>}
                {hasModuleAccess('roles') && <Link to="/admin/roles">{t('layout.roles')}</Link>}
                {hasModuleAccess('groups') && <Link to="/admin/groups">{t('layout.otsGroups')}</Link>}
                {hasModuleAccess('onboarding_codes') && <Link to="/admin/onboarding-codes">{t('layout.onboardingCodes')}</Link>}
                {hasModuleAccess('pending_registrations') && <Link to="/admin/pending-registrations">{t('layout.pendingRegistrations')}</Link>}
                {hasModuleAccess('tak_profiles') && <Link to="/admin/tak-profiles">{t('layout.takProfiles')}</Link>}
                {hasModuleAccess('meshtastic') && <Link to="/admin/meshtastic">{t('layout.meshtasticChannels')}</Link>}
                {hasModuleAccess('meshtastic') && <Link to="/admin/meshtastic/groups">{t('layout.meshtasticChannelGroups')}</Link>}
                {hasModuleAccess('radios') && <Link to="/admin/radios">{t('layout.radios')}</Link>}
                {hasModuleAccess('announcements') && <Link to="/admin/announcements">{t('layout.announcements')}</Link>}
                {hasModuleAccess('settings') && <Link to="/admin/settings">{t('layout.settings')}</Link>}
                {hasModuleAccess('api_keys') && <Link to="/admin/api-keys">{t('layout.apiKeys')}</Link>}
                {hasModuleAccess('api_docs') && <Link to="/admin/api-docs">{t('layout.apiDocs')}</Link>}
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
              <Link to="/profile">{t('layout.profile')}</Link>
              <button onClick={toggleTheme} className="theme-toggle-btn">
                {theme === 'dark' ? t('layout.lightMode') : t('layout.darkMode')}
              </button>
              <div className="language-switcher">
                <select
                  value={i18n.language}
                  onChange={(e) => {
                    const lang = e.target.value;
                    i18n.changeLanguage(lang);
                    if (user?.id) {
                      usersAPI.update(user.id, { language: lang }).catch(() => {});
                    }
                  }}
                  className="lang-select"
                >
                  <option value="en">English</option>
                  <option value="nl">Nederlands</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>
              <button onClick={handleLogout} className="logout-btn">
                {t('auth.logout')}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {impersonating && (
        <div className="impersonation-banner">
          <span>
            {t('layout.viewingAs')} <strong>{user?.callsign || user?.username}</strong>
            {' '}&mdash; {t('layout.loggedInAs')} {impersonating.username}
          </span>
          <button className="impersonation-stop-btn" onClick={stopImpersonation}>
            {t('layout.stopImpersonating')}
          </button>
        </div>
      )}

      <main className={`main-content ${impersonating ? 'main-content-impersonating' : ''}`}>
        <Outlet />
      </main>

      <footer className="footer">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span style={{ fontSize: '0.85rem', color: '#999' }}>
            {version && `v${version.version || version.commit}`}
          </span>
          <p style={{ margin: 0 }}>&copy; {new Date().getFullYear()} {brandName}. {t('common.allRightsReserved')}</p>
          <span style={{ fontSize: '0.85rem', color: 'transparent' }}>spacer</span>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
