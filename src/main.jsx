import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { keycloakService } from './services/keycloakService'

// Initialize Keycloak to get JWT token for API calls
keycloakService.init().then(success => {
  console.log('[App] Keycloak init:', success ? 'success' : 'failed');
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
