import { Link } from 'react-router-dom';

function AdminDashboard() {
  const adminSections = [
    { title: 'Users', path: '/admin/users', description: 'Manage user accounts' },
    { title: 'Roles', path: '/admin/roles', description: 'Manage user roles' },
    { title: 'Onboarding Codes', path: '/admin/onboarding-codes', description: 'Manage onboarding codes' },
    { title: 'TAK Profiles', path: '/admin/tak-profiles', description: 'Manage TAK profiles' },
    { title: 'Meshtastic', path: '/admin/meshtastic', description: 'Manage Meshtastic configurations' },
    { title: 'Radios', path: '/admin/radios', description: 'Manage radio devices' },
    { title: 'Packages', path: '/admin/packages', description: 'Manage ATAK packages' },
  ];

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p>Welcome to the administration panel. Select a section below to manage.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
        {adminSections.map((section) => (
          <Link
            key={section.path}
            to={section.path}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              background: 'white',
              padding: '2rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            }}
          >
            <h2 style={{ marginTop: 0 }}>{section.title}</h2>
            <p style={{ color: '#666', marginBottom: 0 }}>{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default AdminDashboard;
