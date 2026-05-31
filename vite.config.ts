import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'app-icon.svg',
        'maskable-icon.svg',
        'app-icon-192.png',
        'app-icon-512.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'Credit Card Rewards Tracker',
        short_name: 'Rewards',
        description: 'Track credit card rewards and Bilt rent progress.',
        theme_color: '#f5f6f8',
        background_color: '#f5f6f8',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'app-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'app-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'app-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'maskable-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    allowedHosts: ['detective-forget-mattress-west.trycloudflare.com'],
  },
});
