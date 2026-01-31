import Keycloak from 'keycloak-js';

// Keycloak configuration using proxy path to avoid CORS issues
const keycloak = new Keycloak({
  url: '/auth/keycloak',
  realm: 'Team33Casino',
  clientId: 'Team33admin'
});

export default keycloak;
