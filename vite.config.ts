import { defineConfig } from 'vite'

// Production static host at domain root (Hetzner / any static SPA).
// Root-relative public assets: /races/, /fixtures/, /EGM96_1deg.bin
// Dev: proxy /api → projects API stub (npm run server) for projectsApiBase: "/api".
export default defineConfig({
  base: '/',
  server: {
    // Bind IPv4 so Electron (http://127.0.0.1:5173) can connect.
    // On some Windows hosts Vite defaults to ::1 only → ERR_CONNECTION_REFUSED.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
