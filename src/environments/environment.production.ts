/**
 * Production environment configuration
 */
export const environment = {
  production: true,
  apiUrl: '/api',  // Relative URL for same-origin deployment
  veilcloudUrl: 'https://api.veilcloud.io',
  features: {
    sync: true,
    teams: true,
    integrations: true,
  },
};
