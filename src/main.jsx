import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { keycloakService } from './services/keycloakService'

// Render the app IMMEDIATELY - don't wait for Keycloak
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Initialize Keycloak in background (non-blocking)
keycloakService.init()
  .then(success => console.log('[App] Keycloak init:', success ? 'success' : 'failed'))
  .catch(error => console.error('[App] Keycloak init error:', error));
