import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { storytreeDataApi } from './server/devApi';

// The studio foundation runs as ONE process: Vite's dev server, with a small
// middleware plugin (storytreeDataApi) serving /api/* — it reads the canonical
// docs live from <repo>/docs and persists comments + guidance assets to
// apps/studio/data/*.json. No separate backend, no database (ADR-0001: lean).
export default defineConfig({
  plugins: [react(), storytreeDataApi()],
  server: { port: 5173 },
});
