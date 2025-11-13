import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'eventemitter3', 
      'bn.js', 
      'jayson',
      'jayson/lib/client/browser',
      '@solana/buffer-layout',
      'dayjs',
      'dayjs/plugin/relativeTime',
      'dayjs/plugin/updateLocale',
      'dayjs/locale/en'
    ],
    exclude: [
      'lucide-react'
    ],
    esbuildOptions: {
      mainFields: ['browser', 'module', 'main'],
      conditions: ['browser', 'module', 'import', 'default'],
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/jayson/, /buffer-layout/, /bs58/, /wallet-adapter/, /solana-mobile/, /node_modules/],
    },
  },
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      'dayjs/locale/en.js': 'dayjs/locale/en',
      'dayjs/plugin/relativeTime.js': 'dayjs/plugin/relativeTime',
      'dayjs/plugin/updateLocale.js': 'dayjs/plugin/updateLocale',
    },
  },
});