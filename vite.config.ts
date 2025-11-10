import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// ✅ Importa plugin PWA (oficial do Vite)
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),

    // 🔰 Plugin que garante build PWA funcional
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'vite.svg',
        'robots.txt',
        'apple-touch-icon.png'
      ],
      manifest: {
        name: 'AgroCRM',
        short_name: 'AgroCRM',
        description: 'CRM Inteligente para o Agronegócio',
        theme_color: '#1B5E20',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      // 🔹 Mantém cache de rotas e assets para funcionamento offline
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\/.*$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 }
            }
          },
          {
            urlPattern: /\.(?:js|css|html|png|svg|jpg|jpeg|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }
            }
          }
        ]
      }
    })
  ],

  build: { chunkSizeWarningLimit: 1500 },
  server: {
    allowedHosts: ['dde34dbd3abc.ngrok-free.app']
  },
  optimizeDeps: { force: true }, // força rebuild em cada deploy
  cacheDir: '.vite-cache',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
