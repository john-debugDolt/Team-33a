import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { keycloakService } from './services/keycloakService'

// Render the app
const renderApp = () => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

// Initialize Keycloak with timeout fallback
const initAndRender = async () => {
  console.log('[App] Initializing Keycloak...');

  // Set a maximum wait time of 12 seconds for Keycloak
  const timeout = new Promise((resolve) => {
    setTimeout(() => {
      console.warn('[App] Keycloak init timeout - rendering app anyway');
      resolve(false);
    }, 12000);
  });

  try {
    // Race between Keycloak init and timeout
    const success = await Promise.race([
      keycloakService.init(),
      timeout
    ]);
    console.log('[App] Keycloak init:', success ? 'success' : 'failed/timeout');
  } catch (error) {
    console.error('[App] Keycloak init error:', error);
  }

  // Always render app (works with or without token)
  renderApp();
};

initAndRender();
