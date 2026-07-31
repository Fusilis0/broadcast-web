import { defineConfig } from 'vite'

// Production static host at domain root (Hetzner / any static SPA).
// Root-relative public assets: /races/, /fixtures/, /EGM96_1deg.bin
export default defineConfig({
  base: '/',
})
