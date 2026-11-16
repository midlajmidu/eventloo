import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tanstack/react-router': path.resolve(__dirname, './src/components/Public/themes/TanstackRouterAdapter.tsx'),
    },
  },
  server: {
    port: 3003,
    proxy: {
      '/api': 'http://localhost:8002',
      '/media': 'http://localhost:8002',
    },
  },
  build: {
    outDir: 'build',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
});
