import { defineConfig } from 'vitest/config';

/**
 * Kept separate from vite.config.ts on purpose: the app build needs the PWA and
 * React plugins, and the test run does not. Vitest transforms TSX through
 * esbuild using the `jsx` setting in tsconfig.app.json, so no plugin is needed
 * here — and keeping the two configs apart avoids a Vite type clash between the
 * app's Vite and the one Vitest bundles.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{ts,tsx}'],
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
});
