// @ts-nocheck
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
// Use regular path/url imports (Vite provides Node polytypes via tsconfig.node.json)
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import fs from 'fs'

// Frontend-only config

// ESM __dirname shim
// Derive __dirname for ESM context
// @ts-ignore augment import.meta at runtime
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Get git commit SHA for build info (fallback to 'dev' if git not available)
const getGitCommitSha = () => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

// Get app version from package.json or environment
const getAppVersion = () => {
  try {
    if (process.env.VITE_APP_VERSION) return process.env.VITE_APP_VERSION
    // Read package.json using fs for ESM compatibility
    const pkgPath = path.resolve(__dirname, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    return pkg.version || '1.0.0'
  } catch {
    return '1.0.0'
  }
}

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

export default defineConfig({
  base: appBase,
  define: {
    // Inject build info for runtime logging
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(getAppVersion()),
    'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(getGitCommitSha()),
  },
  plugins: [
    react(),
      VitePWA({
        disable: isPwaDisabled,
        base: appBase,
        registerType: 'autoUpdate',
        injectRegister: null,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: [
        'env-loader.js',
        'icons/plant-swipe-icon.svg',
        'icons/plant-swipe-icon-outline.svg',
        'icons/icon-192x192.png',
        'icons/icon-512x512.png',
        'icons/icon-maskable-512.png',
        'locales/en/common.json',
        'locales/fr/common.json',
          'offline.html',
      ],
      // Manifest is served dynamically from /api/manifest.webmanifest
      // This allows screenshots to be loaded from the database at runtime
      // The manifest link is in index.html pointing to the API endpoint
      manifest: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,json,txt,woff,woff2,ttf}'],
        // Never precache runtime env endpoints; they must come from the active host
        // (often dynamic) rather than a baked fallback bundled at build time.
        globIgnores: ['**/*.map', '**/node_modules/**', '**/env.js', '**/api/env.js'],
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
    // Disable sourcemaps in production to reduce memory usage
    sourcemap: false,
    // Use esbuild for minification (faster and uses less memory than terser)
    minify: 'esbuild',
    // Reduce memory by limiting concurrent operations
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'recharts': ['recharts'],
          'three': ['three'],
          'supabase': ['@supabase/supabase-js'],
          'ui-components': ['@radix-ui/react-dialog', '@radix-ui/react-label', '@radix-ui/react-slot'],
          'framer-motion': ['framer-motion'],
          'i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector', 'i18next-http-backend'],
        },
      },
      // Reduce memory pressure during build
      maxParallelFileOps: 2,
    },
    chunkSizeWarningLimit: 1000,
    // Target modern browsers to reduce output size
    target: 'es2020',
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
