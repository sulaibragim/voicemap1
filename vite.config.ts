import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isCapacitor = process.env.BUILD_TARGET === 'capacitor';
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // Capacitor загружает файлы локально — нужен относительный base
    base: isCapacitor ? './' : '/',
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: `http://localhost:${env.API_PORT || 3001}`,
          changeOrigin: true,
        },
      },
    },
    optimizeDeps: {
      include: ['@capacitor/core'],
    },
  };
});
