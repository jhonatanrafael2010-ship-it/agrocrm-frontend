import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'dde34dbd3abc.ngrok-free.app'
    ]
  },
  build: {
    chunkSizeWarningLimit: 1500
  }
})
