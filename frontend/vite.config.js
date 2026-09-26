import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    exclude: ['maplibre-gl']
  },
  server: {
    proxy: {
      '/tiles': {
        target: 'http://localhost:8085',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/tiles/, ''),
        headers: {
          'X-Forwarded-Path': '/tiles'
        }
      }
    }
  }
})
