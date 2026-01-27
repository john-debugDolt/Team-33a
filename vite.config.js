import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  logLevel: 'info',  // Options: 'info' | 'warn' | 'error' | 'silent'
  clearScreen: true,  // Clear terminal on start
  build: {
    sourcemap: false,  // No source maps in production (hides code structure)
    minify: 'terser',  // Better minification
    terserOptions: {
      compress: {
        drop_console: true,  // Remove console.log in production
        drop_debugger: true,  // Remove debugger statements
      },
    },
  },
  server: {
    host: 'localhost',  // Only show localhost, hide network IP
    strictPort: true,
    proxy: {
      // Proxy chat API to external chat server
      '/api/chat': {
        target: 'https://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com',
        changeOrigin: true,
        secure: true,
      },
      // Proxy OTP API to external server
      '/api/otp': {
        target: 'https://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com',
        changeOrigin: true,
        secure: true,
      },
      // Proxy Accounts API to external server
      '/api/accounts': {
        target: 'https://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com',
        changeOrigin: true,
        secure: true,
      },
      // Proxy Deposits API to external server
      '/api/deposits': {
        target: 'https://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com',
        changeOrigin: true,
        secure: true,
      },
      // Proxy Withdrawals API to external server
      '/api/withdrawals': {
        target: 'https://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com',
        changeOrigin: true,
        secure: true,
      },
      // Proxy all Admin APIs to external server (accounts, deposits, withdrawals, etc.)
      '/api/admin': {
        target: 'https://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com',
        changeOrigin: true,
        secure: true,
      },
      // Proxy Wallet API through accounts microservice (NOT wallet service directly)
      '/api/wallets': {
        target: 'https://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com',
        changeOrigin: true,
        secure: true,
      },
      // Proxy Banks API to external server
      '/api/banks': {
        target: 'https://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com',
        changeOrigin: true,
        secure: true,
      },
      // Proxy Games API to Team33 game server
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
      // Proxy all other API calls to local Express server
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
