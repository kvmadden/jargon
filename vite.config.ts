import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';

const buildShaPlugin = () => {
  let sha = 'dev';
  try {
    sha = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {}
  return {
    name: 'build-sha-plugin',
    transformIndexHtml(html: string) {
      return html.replace('<html', `<html data-build-sha="${sha}"`);
    }
  };
};

export default defineConfig({
  plugins: [react(), buildShaPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: { app: path.resolve(__dirname, 'index.html'), evaluation: path.resolve(__dirname, 'evaluation.html') },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router-dom/') ||
              id.includes('/react-router/')
            ) {
              return 'react';
            }
            if (id.includes('/@supabase/')) {
              return 'supabase';
            }
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    port: 5182,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 4391,
    host: true,
  },
});
