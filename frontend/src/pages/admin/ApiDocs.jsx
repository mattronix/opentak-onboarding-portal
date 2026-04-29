import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './ApiDocs.css';

function ApiDocs() {
  const { t } = useTranslation();
  const [expandedSection, setExpandedSection] = useState('authentication');

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const apiEndpoints = {
    authentication: {
      title: t('admin.apiDocs.sections.authentication.title'),
      description: t('admin.apiDocs.sections.authentication.description'),
      endpoints: [
        {
          method: 'POST',
          path: '/api/v1/auth/login',
          description: 'Authenticate with username and password to get JWT tokens',
          auth: 'None',
          body: {
            username: 'string (required)',
            password: 'string (required)',
          },
          response: {
            access_token: 'string',
            refresh_token: 'string',
            user: 'object',
          },
        },
        {
          method: 'POST',
          path: '/api/v1/auth/refresh',
          description: 'Refresh an expired access token',
          auth: 'Bearer (refresh_token)',
          response: {
            access_token: 'string',
          },
        },
        {
          method: 'GET',
          path: '/api/v1/auth/me',
          description: 'Get current authenticated user information',
          auth: 'Bearer or API Key',
          response: {
            id: 'number',
            username: 'string',
            email: 'string',
            roles: 'array',
          },
        },
      ],
    },
    users: {
      title: t('admin.apiDocs.sections.users.title'),
      description: t('admin.apiDocs.sections.users.description'),
      endpoints: [
        {
          method: 'GET',
          path: '/api/v1/users',
          description: 'List all users with pagination',
          auth: 'Bearer or API Key (users:read)',
          params: {
            page: 'number (default: 1)',
            per_page: 'number (default: 50)',
            search: 'string (optional)',
          },
          response: {
            users: 'array',
            total: 'number',
            page: 'number',
            per_page: 'number',
          },
        },
        {
          method: 'GET',
          path: '/api/v1/users/:id',
          description: 'Get a specific user by ID',
          auth: 'Bearer or API Key (users:read)',
          response: {
            id: 'number',
            username: 'string',
            email: 'string',
            firstName: 'string',
            lastName: 'string',
            callsign: 'string',
            roles: 'array',
            expiryDate: 'string (ISO date)',
          },
        },
        {
          method: 'POST',
          path: '/api/v1/users',
          description: 'Create a new user',
          auth: 'Bearer or API Key (users:write)',
          body: {
            username: 'string (required)',
            email: 'string',
            firstName: 'string',
            lastName: 'string',
            callsign: 'string',
            roles: 'array of role IDs',
          },
        },
        {
          method: 'PUT',
          path: '/api/v1/users/:id',
          description: 'Update an existing user',
          auth: 'Bearer or API Key (users:write)',
          body: {
            email: 'string',
            firstName: 'string',
            lastName: 'string',
            callsign: 'string',
            roles: 'array of role IDs',
            expiryDate: 'string (ISO date)',
          },
        },
        {
          method: 'DELETE',
          path: '/api/v1/users/:id',
          description: 'Delete a user',
          auth: 'Bearer or API Key (users:write)',
        },
      ],
    },
    roles: {
      title: t('admin.apiDocs.sections.roles.title'),
      description: t('admin.apiDocs.sections.roles.description'),
      endpoints: [
        {
          method: 'GET',
          path: '/api/v1/roles',
          description: 'List all roles',
          auth: 'Bearer or API Key (roles:read)',
          response: {
            roles: 'array',
          },
        },
        {
          method: 'GET',
          path: '/api/v1/roles/:id',
          description: 'Get a specific role with members',
          auth: 'Bearer or API Key (roles:read)',
        },
        {
          method: 'POST',
          path: '/api/v1/roles',
          description: 'Create a new role',
          auth: 'Bearer or API Key (roles:write)',
          body: {
            name: 'string (required)',
            display_name: 'string',
            description: 'string',
          },
        },
        {
          method: 'PUT',
          path: '/api/v1/roles/:id',
          description: 'Update an existing role',
          auth: 'Bearer or API Key (roles:write)',
        },
        {
          method: 'DELETE',
          path: '/api/v1/roles/:id',
          description: 'Delete a role (protected roles cannot be deleted)',
          auth: 'Bearer or API Key (roles:write)',
        },
      ],
    },
    takProfiles: {
      title: t('admin.apiDocs.sections.takProfiles.title'),
      description: t('admin.apiDocs.sections.takProfiles.description'),
      endpoints: [
        {
          method: 'GET',
          path: '/api/v1/tak-profiles',
          description: 'List TAK profiles accessible to the user',
          auth: 'Bearer or API Key (tak_profiles:read)',
        },
        {
          method: 'GET',
          path: '/api/v1/tak-profiles/:id',
          description: 'Get a specific TAK profile',
          auth: 'Bearer or API Key (tak_profiles:read)',
        },
        {
          method: 'GET',
          path: '/api/v1/tak-profiles/:id/download',
          description: 'Download a TAK profile ZIP file',
          auth: 'Bearer (via query param) or API Key (tak_profiles:download)',
          params: {
            token: 'string (JWT token for browser downloads)',
          },
        },
        {
          method: 'POST',
          path: '/api/v1/tak-profiles',
          description: 'Upload a new TAK profile (multipart/form-data)',
          auth: 'Bearer or API Key (tak_profiles:write)',
          body: {
            name: 'string (required)',
            description: 'string',
            isPublic: 'boolean',
            roles: 'array of role IDs',
            file: 'file (TAK profile ZIP)',
          },
        },
        {
          method: 'PUT',
          path: '/api/v1/tak-profiles/:id',
          description: 'Update a TAK profile',
          auth: 'Bearer or API Key (tak_profiles:write)',
        },
        {
          method: 'DELETE',
          path: '/api/v1/tak-profiles/:id',
          description: 'Delete a TAK profile',
          auth: 'Bearer or API Key (tak_profiles:write)',
        },
      ],
    },
    onboardingCodes: {
      title: t('admin.apiDocs.sections.onboardingCodes.title'),
      description: t('admin.apiDocs.sections.onboardingCodes.description'),
      endpoints: [
        {
          method: 'GET',
          path: '/api/v1/onboarding-codes',
          description: 'List all onboarding codes',
          auth: 'Bearer or API Key (onboarding_codes:read)',
        },
        {
          method: 'GET',
          path: '/api/v1/onboarding-codes/:id',
          description: 'Get a specific onboarding code',
          auth: 'Bearer or API Key (onboarding_codes:read)',
        },
        {
          method: 'GET',
          path: '/api/v1/onboarding-codes/validate/:code',
          description: 'Validate an onboarding code (public)',
          auth: 'None',
        },
        {
          method: 'POST',
          path: '/api/v1/onboarding-codes',
          description: 'Create a new onboarding code',
          auth: 'Bearer or API Key (onboarding_codes:write)',
          body: {
            name: 'string',
            description: 'string',
            maxUses: 'number',
            expiryDate: 'string (ISO date)',
            userExpiryDate: 'string (ISO date)',
            roles: 'array of role IDs',
          },
        },
        {
          method: 'DELETE',
          path: '/api/v1/onboarding-codes/:id',
          description: 'Delete an onboarding code',
          auth: 'Bearer or API Key (onboarding_codes:write)',
        },
      ],
    },
    meshtastic: {
      title: t('admin.apiDocs.sections.meshtastic.title'),
      description: t('admin.apiDocs.sections.meshtastic.description'),
      endpoints: [
        {
          method: 'GET',
          path: '/api/v1/meshtastic',
          description: 'List Meshtastic configurations',
          auth: 'Bearer or API Key (meshtastic:read)',
        },
        {
          method: 'GET',
          path: '/api/v1/meshtastic/:id',
          description: 'Get a specific Meshtastic configuration',
          auth: 'Bearer or API Key (meshtastic:read)',
        },
        {
          method: 'POST',
          path: '/api/v1/meshtastic',
          description: 'Create a new Meshtastic configuration',
          auth: 'Bearer or API Key (meshtastic:write)',
          body: {
            name: 'string (required)',
            description: 'string',
            url: 'string (required)',
            yamlConfig: 'string',
            isPublic: 'boolean',
            roles: 'array of role IDs',
          },
        },
        {
          method: 'PUT',
          path: '/api/v1/meshtastic/:id',
          description: 'Update a Meshtastic configuration',
          auth: 'Bearer or API Key (meshtastic:write)',
        },
        {
          method: 'DELETE',
          path: '/api/v1/meshtastic/:id',
          description: 'Delete a Meshtastic configuration',
          auth: 'Bearer or API Key (meshtastic:write)',
        },
      ],
    },
    radios: {
      title: t('admin.apiDocs.sections.radios.title'),
      description: t('admin.apiDocs.sections.radios.description'),
      endpoints: [
        {
          method: 'GET',
          path: '/api/v1/radios',
          description: 'List all radios',
          auth: 'Bearer or API Key (radios:read)',
        },
        {
          method: 'GET',
          path: '/api/v1/radios/:id',
          description: 'Get a specific radio',
          auth: 'Bearer or API Key (radios:read)',
        },
        {
          method: 'POST',
          path: '/api/v1/radios',
          description: 'Create a new radio entry',
          auth: 'Bearer or API Key (radios:write)',
          body: {
            name: 'string (required)',
            mac: 'string (required, unique)',
            platform: 'string (required)',
            radioType: 'string (meshtastic or other)',
            description: 'string',
            model: 'string',
            vendor: 'string',
          },
        },
        {
          method: 'PUT',
          path: '/api/v1/radios/:id',
          description: 'Update a radio entry',
          auth: 'Bearer or API Key (radios:write)',
        },
        {
          method: 'DELETE',
          path: '/api/v1/radios/:id',
          description: 'Delete a radio entry',
          auth: 'Bearer or API Key (radios:write)',
        },
      ],
    },
    announcements: {
      title: t('admin.apiDocs.sections.announcements.title'),
      description: t('admin.apiDocs.sections.announcements.description'),
      endpoints: [
        {
          method: 'GET',
          path: '/api/v1/admin/announcements',
          description: 'List all announcements (admin)',
          auth: 'Bearer or API Key (announcements:read)',
        },
        {
          method: 'GET',
          path: '/api/v1/announcements',
          description: 'List announcements for current user',
          auth: 'Bearer',
        },
        {
          method: 'POST',
          path: '/api/v1/admin/announcements',
          description: 'Create a new announcement',
          auth: 'Bearer or API Key (announcements:write)',
          body: {
            title: 'string (required)',
            content: 'string (required, HTML/Markdown)',
            target_type: 'string (all, roles, users)',
            target_roles: 'array of role IDs',
            target_users: 'array of user IDs',
            send_email: 'boolean',
            scheduled_at: 'string (ISO date)',
          },
        },
        {
          method: 'POST',
          path: '/api/v1/admin/announcements/:id/send',
          description: 'Send a scheduled announcement immediately',
          auth: 'Bearer or API Key (announcements:write)',
        },
        {
          method: 'DELETE',
          path: '/api/v1/admin/announcements/:id',
          description: 'Delete an announcement',
          auth: 'Bearer or API Key (announcements:write)',
        },
      ],
    },
    settings: {
      title: t('admin.apiDocs.sections.settings.title'),
      description: t('admin.apiDocs.sections.settings.description'),
      endpoints: [
        {
          method: 'GET',
          path: '/api/v1/settings',
          description: 'Get public settings',
          auth: 'None',
        },
        {
          method: 'GET',
          path: '/api/v1/admin/settings',
          description: 'Get all settings (admin)',
          auth: 'Bearer or API Key (settings:read)',
        },
        {
          method: 'PUT',
          path: '/api/v1/admin/settings/:id',
          description: 'Update a setting',
          auth: 'Bearer or API Key (settings:write)',
          body: {
            value: 'string (required)',
          },
        },
      ],
    },
  };

  const renderEndpoint = (endpoint, index) => (
    <div key={index} className="endpoint">
      <div className="endpoint-header">
        <span className={`method method-${endpoint.method.toLowerCase()}`}>
          {endpoint.method}
        </span>
        <code className="path">{endpoint.path}</code>
      </div>
      <p className="endpoint-description">{endpoint.description}</p>
      <div className="endpoint-auth">
        <strong>{t('admin.apiDocs.authentication')}:</strong> {endpoint.auth}
      </div>
      {endpoint.params && (
        <div className="endpoint-params">
          <strong>{t('admin.apiDocs.queryParams')}:</strong>
          <pre>{JSON.stringify(endpoint.params, null, 2)}</pre>
        </div>
      )}
      {endpoint.body && (
        <div className="endpoint-body">
          <strong>{t('admin.apiDocs.requestBody')}:</strong>
          <pre>{JSON.stringify(endpoint.body, null, 2)}</pre>
        </div>
      )}
      {endpoint.response && (
        <div className="endpoint-response">
          <strong>{t('admin.apiDocs.response')}:</strong>
          <pre>{JSON.stringify(endpoint.response, null, 2)}</pre>
        </div>
      )}
    </div>
  );

  return (
    <div className="admin-page api-docs-page">
      <div className="admin-header">
        <h1>{t('admin.apiDocs.title')}</h1>
      </div>

      <div className="api-docs-intro">
        <h2>{t('admin.apiDocs.gettingStarted')}</h2>
        <p>
          {t('admin.apiDocs.introText')}
        </p>

        <h3>{t('admin.apiDocs.baseUrl')}</h3>
        <code className="base-url">{window.location.origin}/api/v1</code>

        <h3>{t('admin.apiDocs.authMethods')}</h3>
        <div className="auth-methods">
          <div className="auth-method">
            <h4>{t('admin.apiDocs.jwtToken')}</h4>
            <p>{t('admin.apiDocs.jwtDesc')}</p>
            <pre>
{`Authorization: Bearer <access_token>`}
            </pre>
          </div>
          <div className="auth-method">
            <h4>{t('admin.apiDocs.apiKey')}</h4>
            <p>{t('admin.apiDocs.apiKeyDesc')}</p>
            <pre>
{`X-API-Key: otak_your_api_key_here`}
            </pre>
          </div>
        </div>

        <h3>{t('admin.apiDocs.responseFormat')}</h3>
        <p>{t('admin.apiDocs.responseDesc')}</p>
        <pre>
{`{
  "users": [...],
  "total": 100,
  "page": 1
}`}
        </pre>
        <p>{t('admin.apiDocs.errorDesc')}</p>
        <pre>
{`{
  "error": "Error description",
  "code": "ERROR_CODE"
}`}
        </pre>

        <h3>{t('admin.apiDocs.rateLimiting')}</h3>
        <p>
          {t('admin.apiDocs.rateLimitDesc')}
        </p>
      </div>

      <div className="api-docs-sections">
        <h2>{t('admin.apiDocs.apiEndpoints')}</h2>
        {Object.entries(apiEndpoints).map(([key, section]) => (
          <div key={key} className="api-section">
            <div
              className={`section-header ${expandedSection === key ? 'expanded' : ''}`}
              onClick={() => toggleSection(key)}
            >
              <h3>{section.title}</h3>
              <span className="toggle-icon">{expandedSection === key ? '-' : '+'}</span>
            </div>
            {expandedSection === key && (
              <div className="section-content">
                <p className="section-description">{section.description}</p>
                <div className="endpoints-list">
                  {section.endpoints.map((endpoint, index) => renderEndpoint(endpoint, index))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ApiDocs;
