import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { target: ['safari16', 'chrome110'], outDir: 'dist', sourcemap: false },
  server: { host: true, port: 5173 },
});
