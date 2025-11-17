// @ts-nocheck
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
// Use regular path/url imports (Vite provides Node polytypes via tsconfig.node.json)
import path from 'path'
import { fileURLToPath } from 'url'

// Frontend-only config

// ESM __dirname shim
// Derive __dirname for ESM context
// @ts-ignore augment import.meta at runtime
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const normalizeBasePath = (value?: string) => {
  if (!value || value.trim() === '' || value === '/') return '/'
  let next = value.trim()
  if (!next.startsWith('/')) next = `/${next}`
  if (!next.endsWith('/')) next = `${next}/`
  return next.replace(/\/{2,}/g, '/')
}

const appBase = normalizeBasePath(process.env.VITE_APP_BASE_PATH)
const scope = appBase === '/' ? '/' : appBase
const disablePwaFlag = String(process.env.VITE_DISABLE_PWA || process.env.DISABLE_PWA || process.env.PWA_DISABLED || '').trim().toLowerCase()
const isPwaDisabled = disablePwaFlag === 'true' || disablePwaFlag === '1' || disablePwaFlag === 'yes' || disablePwaFlag === 'on' || disablePwaFlag === 'disable' || disablePwaFlag === 'disabled'
const MAX_SW_CACHE_BYTES = 5 * 1024 * 1024

export default defineConfig({
  base: appBase,
  plugins: [
    react(),
    VitePWA({
        disable: isPwaDisabled,
        base: appBase,
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        strategies: 'generateSW',
        includeAssets: [
          'env-loader.js',
          'env.js',
          'icons/plant-swipe-icon.svg',
          'icons/icon-192x192.png',
          'icons/icon-512x512.png',
          'icons/icon-maskable-512.png',
          'locales/en/common.json',
          'locales/fr/common.json',
          'PLANT-INFO-SCHEMA.json',
        ],
        manifest: {
          id: 'aphylia',
          name: 'Aphylia',
          short_name: 'Aphylia',
          description: 'Discover, swipe and manage the perfect plants for every garden.',
          lang: 'en',
          theme_color: '#052e16',
          background_color: '#03120c',
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone'],
          scope,
          start_url: scope,
          orientation: 'portrait-primary',
          categories: ['productivity', 'lifestyle', 'utilities'],
          icons: [
            { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' },
            { src: 'icons/plant-swipe-icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          ],
          shortcuts: [
            { name: 'Swipe plants', url: scope === '/' ? '/swipe' : `${scope}swipe`, description: 'Jump directly into swipe mode' },
            { name: 'My gardens', url: scope === '/' ? '/gardens' : `${scope}gardens`, description: 'Open your garden dashboard' },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,json,txt,woff,woff2,ttf}'],
          maximumFileSizeToCacheInBytes: MAX_SW_CACHE_BYTES,
          navigateFallback: 'index.html',
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: ({ url }) => /\/api\/.+\/stream/.test(url.pathname),
              handler: 'NetworkOnly',
              options: {
                cacheName: 'api-stream-bypass',
              },
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/') && !/\/stream/.test(url.pathname),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 10,
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /\/locales\/.*\.json$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'i18n-cache',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'image-cache',
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 14 },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === 'font',
              handler: 'CacheFirst',
              options: {
                cacheName: 'font-cache',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: {
          enabled: process.env.VITE_ENABLE_PWA === 'true',
          navigateFallback: 'index.html',
          suppressWarnings: true,
        },
      }),
  ],
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
