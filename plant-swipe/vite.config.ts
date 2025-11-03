// @ts-nocheck
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
// Use regular path/url imports (Vite provides Node polytypes via tsconfig.node.json)
import path from 'path'
import { fileURLToPath } from 'url'

// Frontend-only config

// ESM __dirname shim
// Derive __dirname for ESM context
// @ts-ignore augment import.meta at runtime
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: '/',
  plugins: [react()],
  envPrefix: ['VITE_'],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'recharts': ['recharts'],
          'supabase': ['@supabase/supabase-js'],
          'ui-components': ['@radix-ui/react-dialog', '@radix-ui/react-label', '@radix-ui/react-slot'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    host: process.env.VITE_DEV_HOST || '127.0.0.1',
    port: Number(process.env.VITE_DEV_PORT || 5173),
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Do not rewrite, keep /api so Express route matches
      },
    },
  },
})
