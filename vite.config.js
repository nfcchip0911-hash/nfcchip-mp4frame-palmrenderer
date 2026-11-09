import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 5173,
    host: true, // Cho phép truy cập qua IP mạng LAN
    allowedHosts: true, // Cho phép các domain tunnel (Cloudflare, localtunnel) truy cập
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});
