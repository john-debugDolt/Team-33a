import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
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
      // Proxy Wallet API to wallet service (different server!)
      '/api/wallets': {
        target: 'http://k8s-team33-walletse-2b6bcd93c2-52fa21111cb7a7e7.elb.ap-southeast-2.amazonaws.com',
        changeOrigin: true,
        secure: false,
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
