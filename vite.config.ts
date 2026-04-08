import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1500,
  },
  plugins: [
    react(),
    VitePWA({
      disable: true,
    }),
  ],
  server: {
    allowedHosts: ["dde34dbd3abc.ngrok-free.app"],
  },
  optimizeDeps: {
    force: true,
  },
  cacheDir: ".vite-cache",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});