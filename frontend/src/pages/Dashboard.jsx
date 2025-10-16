import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { takProfilesAPI, meshtasticAPI, radiosAPI } from '../services/api';

function Dashboard() {
  const { user } = useAuth();

  const { data: takProfiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ['takProfiles'],
    queryFn: async () => {
      const response = await takProfilesAPI.getAll();
      return response.data.profiles;
    },
  });

  const { data: meshtasticConfigs, isLoading: loadingMeshtastic } = useQuery({
    queryKey: ['meshtastic'],
    queryFn: async () => {
      const response = await meshtasticAPI.getAll();
      return response.data.configs;
    },
  });

  const { data: radios, isLoading: loadingRadios } = useQuery({
    queryKey: ['radios'],
    queryFn: async () => {
      const response = await radiosAPI.getAll();
      return response.data.radios;
    },
  });

  const handleDownloadProfile = (profileId) => {
    takProfilesAPI.download(profileId);
  };

  return (
    <div>
      <h1>Welcome, {user?.callsign || user?.username}!</h1>

      <div style={{ marginTop: '2rem' }}>
        <h2>Your TAK Profiles</h2>
        {loadingProfiles ? (
          <p>Loading...</p>
        ) : takProfiles && takProfiles.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {takProfiles.map((profile) => (
              <div key={profile.id} style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
                <h3>{profile.name}</h3>
                <p>{profile.description}</p>
                <button
                  onClick={() => handleDownloadProfile(profile.id)}
                  style={{ padding: '0.5rem 1rem', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p>No TAK profiles available.</p>
        )}
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2>Meshtastic Configurations</h2>
        {loadingMeshtastic ? (
          <p>Loading...</p>
        ) : meshtasticConfigs && meshtasticConfigs.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {meshtasticConfigs.map((config) => (
              <div key={config.id} style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
                <h3>{config.name}</h3>
                <p>{config.description}</p>
                {config.url && (
                  <a href={config.url} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff' }}>
                    View Configuration
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p>No Meshtastic configurations available.</p>
        )}
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2>Your Radios</h2>
        {loadingRadios ? (
          <p>Loading...</p>
        ) : radios && radios.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Platform</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {radios.map((radio) => (
                <tr key={radio.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '1rem' }}>{radio.name}</td>
                  <td style={{ padding: '1rem' }}>{radio.platform}</td>
                  <td style={{ padding: '1rem' }}>{radio.radioType}</td>
                  <td style={{ padding: '1rem' }}>
                    {radio.assignedTo ? 'Assigned' : 'Available'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No radios assigned to you.</p>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
