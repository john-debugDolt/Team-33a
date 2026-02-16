import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Keycloak configuration for JWT auth
const KEYCLOAK_URL = 'https://k8s-team33-keycloak-320152ed2f-65380cdab2265c8a.elb.ap-southeast-2.amazonaws.com'
const KEYCLOAK_REALM = 'Team33Casino'
const KEYCLOAK_CLIENT_ID = 'Team33admin'
const KEYCLOAK_CLIENT_SECRET = 'lxPLoQaJ7PCYJEJZwRuzelt0RHpKlCH0'
const BACKEND_URL = 'https://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com'

// Token cache for local development
let cachedToken = null
let tokenExpiry = null

// Get JWT token from Keycloak
async function getKeycloakToken() {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
    return cachedToken
  }

  try {
    const tokenUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: KEYCLOAK_CLIENT_ID,
        client_secret: KEYCLOAK_CLIENT_SECRET,
      }),
    })

    if (!response.ok) {
      console.error('[Vite Proxy] Keycloak token error:', response.status)
      return null
    }

    const data = await response.json()
    cachedToken = data.access_token
    tokenExpiry = Date.now() + (data.expires_in * 1000)
    console.log('[Vite Proxy] JWT token obtained')
    return cachedToken
  } catch (error) {
    console.error('[Vite Proxy] Failed to get Keycloak token:', error.message)
    return null
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  logLevel: 'info',
  clearScreen: true,
  build: {
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
      },
    },
  },
  server: {
    host: 'localhost',
    strictPort: true,
    proxy: {
      // Proxy Keycloak auth requests
      '/auth/keycloak': {
        target: KEYCLOAK_URL,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/auth\/keycloak/, ''),
      },
      // Proxy chat API (public - no auth needed)
      '/api/chat': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
      // Proxy OTP API (public - no auth needed)
      '/api/otp': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
      // Proxy Accounts API (requires JWT auth)
      '/api/accounts': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', async (proxyReq, req) => {
            const token = await getKeycloakToken()
            if (token) {
              proxyReq.setHeader('Authorization', `Bearer ${token}`)
            }
          })
        },
      },
      // Proxy Deposits API (public)
      '/api/deposits': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
      // Proxy Withdrawals API (public)
      '/api/withdrawals': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
      // Proxy Admin APIs (requires JWT auth)
      '/api/admin': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', async (proxyReq, req) => {
            const token = await getKeycloakToken()
            if (token) {
              proxyReq.setHeader('Authorization', `Bearer ${token}`)
            }
          })
        },
      },
      // Proxy Wallet API (public)
      '/api/wallets': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
      // Proxy Banks API (public)
      '/api/banks': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
      // Proxy Games API (for game launch) - must come BEFORE /api/games/clotplay
      // so vite doesn't match it first
      '/api/games/launch': {
        target: 'https://api.team33.mx',
        changeOrigin: true,
        secure: true,
      },
      // Proxy ClotPlay Games List API (for game thumbnails from accounts backend)
      '/api/games/clotplay': {
        target: 'https://accounts.team33.mx',
        changeOrigin: true,
        secure: true,
      },
      // Fallback for other /api/games requests
      '/api/games': {
        target: 'https://api.team33.mx',
        changeOrigin: true,
        secure: true,
      },
      // Proxy WebSocket for chat
      '/ws/chat': {
        target: 'wss://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com',
        ws: true,
        changeOrigin: true,
      },
    }
  }
})
