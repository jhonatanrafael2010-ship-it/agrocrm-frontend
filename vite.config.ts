import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./", // ✅ necessário no Render para rotas e cache funcionarem
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1500,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "vite.svg",
        "robots.txt",
        "apple-touch-icon.png",
        "**/*.js", // 🆕 garante cache de módulos web do Capacitor (ex: web-zgTONz0O.js)
      ],
      manifest: {
        name: "AgroCRM",
        short_name: "AgroCRM",
        description: "CRM Inteligente para o Agronegócio",
        theme_color: "#1B5E20",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "/vite.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
          {
            src: "/vite.svg",
            sizes: "512x512",
            type: "image/svg+xml",
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          // 🔹 Cache para chamadas à API
          {
            urlPattern: /^https:\/\/.*\/api\/.*$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 24 * 60 * 60, // 1 dia
              },
            },
          },
          // 🔹 Cache para scripts e assets estáticos
          {
            urlPattern: /\.(?:js|css|html|png|svg|jpg|jpeg|webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "static-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 dias
              },
            },
          },
          // 🆕 Cache específico para módulos Capacitor (web-xxxxx.js)
          {
            urlPattern: /assets\/.*\.js$/,
            handler: "CacheFirst",
            options: {
              cacheName: "capacitor-modules",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 dias
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    allowedHosts: ["dde34dbd3abc.ngrok-free.app"],
  },
  optimizeDeps: {
    force: true, // força rebuild completo
  },
  cacheDir: ".vite-cache",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
