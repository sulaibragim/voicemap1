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
    build: {
      rollupOptions: {
        output: {
          // Разбиваем тяжёлые вендоры в отдельные чанки: быстрее старт (параллельная загрузка)
          // и лучше кэширование — обновление кода приложения не инвалидирует firebase/charts
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('firebase') || id.includes('@firebase')) return 'firebase';
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) return 'charts';
            if (
              id.includes('react-markdown') || id.includes('remark') || id.includes('micromark') ||
              id.includes('mdast') || id.includes('unist') || id.includes('hast') ||
              id.includes('property-information') || id.includes('vfile')
            ) return 'markdown';
            if (id.includes('/motion/') || id.includes('framer')) return 'motion';
            if (
              id.includes('react-dom') || id.includes('/react/') ||
              id.includes('/scheduler/') || id.includes('react-is')
            ) return 'react-vendor';
            return 'vendor';
          },
        },
      },
    },
  };
});
