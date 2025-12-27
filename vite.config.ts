import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    '__API_KEY__': JSON.stringify(process.env.API_KEY || ''),
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      input: {
        main: 'index.html',
      },
    },
  },
  server: {
    port: 3000,
  }
});