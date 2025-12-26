/**
 * Development environment configuration
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api',
  veilcloudUrl: 'https://api.veilcloud.io',
  features: {
    sync: true,
    teams: true,
    integrations: true,
  },
};
