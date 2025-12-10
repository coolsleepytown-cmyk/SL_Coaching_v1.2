
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    define: {
      // Polyfill process.env to ensure it exists
      'process.env': {},
      // Explicitly expose API_KEY to process.env.API_KEY
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY || env.VITE_API_KEY || '')
    },
    build: {
      outDir: 'dist',
    }
  };
});
