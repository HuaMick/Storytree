// The spike harness's vite config (dev-only, never shipped — the package exports
// only src/; this page exists so eyes can witness the stack drawing a real World).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5184, strictPort: true },
});
