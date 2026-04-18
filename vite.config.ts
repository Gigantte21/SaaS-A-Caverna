import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/SaaS-A-Caverna/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'robots.txt', 'icon-192.png', 'icon-512.png'],
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      },
      manifest: {
        name: 'SaaS A Caverna',
        short_name: 'A Caverna',
        description: 'Sistema profissional de precificação e orçamentos.',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/precificaatelieprodu-o/',
        scope: '/precificaatelieprodu-o/',
        icons: [
          {
            src: '/precificaatelieprodu-o/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/precificaatelieprodu-o/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})