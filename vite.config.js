import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

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
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
  server: {
    host: 'localhost',  // Only show localhost, hide network IP
    strictPort: true,
    proxy: {
      // Proxy chat API to external chat server
      '/api/chat': {
        target: 'http://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com',
        changeOrigin: true,
        secure: false,
      },
      // Proxy OTP API to external server
      '/api/otp': {
        target: 'http://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com',
        changeOrigin: true,
        secure: false,
      },
      // Proxy Accounts API to external server
      '/api/accounts': {
        target: 'http://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com',
        changeOrigin: true,
        secure: false,
      },
      // Proxy Deposits API to external server
      '/api/deposits': {
        target: 'http://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com',
        changeOrigin: true,
        secure: false,
      },
      // Proxy Withdrawals API to external server
      '/api/withdrawals': {
        target: 'http://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com',
        changeOrigin: true,
        secure: false,
      },
      // Proxy all Admin APIs to external server (accounts, deposits, withdrawals, etc.)
      '/api/admin': {
        target: 'http://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com',
        changeOrigin: true,
        secure: false,
      },
      // Proxy Wallet API through accounts microservice (NOT wallet service directly)
      '/api/wallets': {
        target: 'http://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com',
        changeOrigin: true,
        secure: false,
      },
      // Proxy Banks API to external server
      '/api/banks': {
        target: 'http://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com',
        changeOrigin: true,
        secure: false,
      },
      // Proxy Games API to Team33 game server
      '/api/games': {
        target: 'https://api.team33.mx',
        changeOrigin: true,
        secure: true,
      },
      // Proxy WebSocket for chat
      '/ws/chat': {
        target: 'ws://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com',
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
