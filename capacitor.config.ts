import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.voicemap.app',
  appName: 'VoiceMap',
  webDir: 'dist',
  plugins: {
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
    // Разрешаем запросы к Railway backend (HTTPS)
    webContentsDebuggingEnabled: false,
  },
  // Для live-reload при разработке — раскомментируй и укажи свой IP:
  // server: {
  //   url: 'http://192.168.1.X:3000',
  //   cleartext: true,
  // },
};

export default config;
