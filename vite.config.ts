import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

/**
 * GitHub Pages serves the app from https://<user>.github.io/<repo>/
 * so the base path MUST match the repository name in production.
 * Set VITE_BASE_PATH in the GitHub Actions workflow / .env for CI builds.
 * Locally it defaults to "/" for `npm run dev`.
 */
const BASE_PATH = process.env.VITE_BASE_PATH ?? '/';

// https://vitejs.dev/config/
export default defineConfig({
  base: BASE_PATH,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null, // registration is handled manually in src/offline/serviceWorkerRegistration.ts
      includeAssets: [
        'favicon.ico',
        'robots.txt',
        'offline.html',
        'icons/*.png',
      ],
      manifest: false, // manifest.webmanifest is authored manually in /public
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        navigateFallback: 'offline.html',
        navigateFallbackDenylist: [/^\/supabase\//],
        runtimeCaching: [
          {
            // Built-in devotional content & static assets: cache-first
            urlPattern: ({ request }) =>
              request.destination === 'style' ||
              request.destination === 'script' ||
              request.destination === 'font' ||
              request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            // Supabase REST/Edge Function calls: network-first with fallback
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-runtime-cache',
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 6, // 6 hours
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@app': path.resolve(__dirname, './src/app'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@store': path.resolve(__dirname, './src/store'),
      '@i18n': path.resolve(__dirname, './src/i18n'),
      '@offline': path.resolve(__dirname, './src/offline'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@config': path.resolve(__dirname, './src/config'),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 900,
  },
});
