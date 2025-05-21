// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path'; // <--- AÑADIR ESTA LÍNEA

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  resolve: { // <--- AÑADIR ESTA SECCIÓN COMPLETA
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});