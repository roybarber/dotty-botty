import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  minify: true,
  sourcemap: true,
  target: 'es2022',
  external: ['react'],
  // The component uses effects and refs, so frameworks with server components
  // (Next.js App Router) need the whole entry marked as client code.
  banner: { js: "'use client';" },
});
