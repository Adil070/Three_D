import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build can be hosted from any sub-path (e.g. a CDN folder per client).
// Code splitting is driven by dynamic imports: the splat library and the debug tools
// (leva) are separate chunks fetched only when needed. Avoid `manualChunks` here — under
// Vite 8 / Rolldown it pulled shared deps (three, react) into those lazy chunks and made
// the entry import them eagerly.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
});
