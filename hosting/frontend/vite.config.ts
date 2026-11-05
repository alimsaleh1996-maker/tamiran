import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: { __TAMIRAN_BUILD_ID__: JSON.stringify("2.0.0-php.1") },
  build: {
    // Keep API/installer files owned by the PHP packaging workflow untouched.
    outDir: '.build',
    emptyOutDir: true,
    sourcemap: false,
  },
});
