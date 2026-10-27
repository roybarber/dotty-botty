import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Build the site against the package source so the demo always matches it.
    alias: { 'dotty-botty': fileURLToPath(new URL('../packages/dotty-botty/src/index.ts', import.meta.url)) },
  },
});
