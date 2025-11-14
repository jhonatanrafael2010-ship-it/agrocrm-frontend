import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agrocrm.app',
  appName: 'NutriCRM',
  webDir: 'dist',
  bundledWebRuntime: false,
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
