import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  // Configuração para SPA - todas as rotas devem retornar index.html
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
});

