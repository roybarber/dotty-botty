import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Served at roybarber.com/dotty/ (proxied from the dotty-botty Vercel project),
  // so output under dist/dotty to make paths line up on both hosts.
  base: '/dotty/',
  build: { outDir: 'dist/dotty', emptyOutDir: true },
  resolve: {
    // Build the site against the package source so the demo always matches it.
    alias: { 'dotty-botty': fileURLToPath(new URL('../packages/dotty-botty/src/index.ts', import.meta.url)) },
  },
});
