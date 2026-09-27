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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('maplibre-gl')) return 'vendor-maplibre';
            if (id.includes('@turf')) return 'vendor-turf';
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-recharts';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1200,
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
