import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
  server: { allowedHosts: ['dde34dbd3abc.ngrok-free.app'] },
  optimizeDeps: { force: true }, // 🔹 força rebuild em cada deploy
  cacheDir: '.vite-cache',       // 🔹 centraliza cache
})


