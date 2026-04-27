import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.voicemap.app',
  appName: 'VoiceMap',
  webDir: 'dist',
  // Загружаем приложение с Railway — авторизация работает, обновления без пересборки APK
  server: {
    url: 'https://voicemap1-production.up.railway.app',
    cleartext: false,
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '749077608006-9v747vu3klr3i3j494bj2v8sn4jutphb.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0f0e17',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0f0e17',
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
