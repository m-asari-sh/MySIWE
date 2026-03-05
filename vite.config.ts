import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4200,
    host: true, // listen on 0.0.0.0 so reachable at http://192.168.1.42:4200
    open: true,
  },
  // Proxy API to avoid CORS when needed (optional; Passwiser may allow your origin)
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
