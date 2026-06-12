import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Unit/integration tests for the studio (the only React/Vite workspace — vitest reuses the
// app's own Vite transform for TSX, where the pure-Node packages use node:test). Offline by
// design: no DB, no gcloud (the db tests run against a fake shim), no network. The dev-API
// plugin is deliberately NOT loaded here — server code is imported directly by its tests.
// Environment is node; the component tests opt into jsdom per-file (@vitest-environment).
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
    environment: 'node',
  },
});
