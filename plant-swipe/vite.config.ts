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
  base: './',
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})