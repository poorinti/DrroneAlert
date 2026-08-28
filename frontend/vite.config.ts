import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/dashboard/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          map: ['leaflet', 'react-leaflet'],
          motion: ['framer-motion'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tooltip'],
          react: ['react', 'react-dom']
        }
      }
    }
  },
  server: { proxy: { '/api': 'http://localhost:3000', '/uploads': 'http://localhost:3000', '/socket.io': { target: 'http://localhost:3000', ws: true } } }
});
