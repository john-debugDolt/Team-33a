import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { keycloakService } from './services/keycloakService'

// Initialize Keycloak BEFORE rendering app to ensure JWT token is available
const initAndRender = async () => {
  console.log('[App] Initializing Keycloak...');
  const success = await keycloakService.init();
  console.log('[App] Keycloak init:', success ? 'success' : 'failed');

  // Render app after Keycloak init (even if failed, app will still work with localStorage fallback)
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

initAndRender();
