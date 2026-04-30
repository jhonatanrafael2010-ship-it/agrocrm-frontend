import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agrocrm.app',
  appName: 'NutriCRM',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    // APK carrega diretamente da versão deployada — sempre atualizado sem rebuild
    url: 'https://agrocrm-frontend.onrender.com',
    cleartext: false,
  },
  plugins: {
    Camera: {
      allowEditing: false,
      saveToGallery: true,
      resultType: 'base64'
    },
    Geolocation: {
      enabled: true
    }
  }
};

export default config;
