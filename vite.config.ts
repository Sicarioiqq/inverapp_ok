import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['base64-js', 'unicode-trie'],
    exclude: ['lucide-react', '@react-pdf/renderer', 'brotli'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'brotli': path.resolve(__dirname, './src/lib/brotli-shim.js'),
      'brotli/decompress.js': path.resolve(__dirname, './src/lib/brotli-shim.js')
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});