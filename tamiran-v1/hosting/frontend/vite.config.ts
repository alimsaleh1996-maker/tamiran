import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    __TAMIRAN_VERSION__: JSON.stringify(readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim()),
  },
  build: {
    // Keep API/installer files owned by the PHP packaging workflow untouched.
    outDir: '.build',
    emptyOutDir: true,
    sourcemap: false,
  },
});
