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
includeAssets: ['icon.svg', 'robots.txt', 'icon-192.png',
'icon-512.png'],
workbox: {
4cleanupOutdatedCaches: true,
clientsClaim: true,
skipWaiting: true
},
manifest: {
name: 'SaaS A Caverna',
short_name: 'A Caverna',
description: 'Sistema de precificação e gestão.',
theme_color: '#000000',
background_color: '#ffffff',
display: 'standalone',
start_url: '/SaaS-A-Caverna/',
scope: '/SaaS-A-Caverna/',
icons: [
{
src: '/SaaS-A-Caverna/icon-192.png',
sizes: '192x192',
type: 'image/png'
},
{
src: '/SaaS-A-Caverna/icon-512.png',
sizes: '512x512',
type: 'image/png'
}
]
}
})
]
}
