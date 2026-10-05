import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// `--mode celular` activa HTTPS con un certificado local: en el celular la cámara
// solo funciona en páginas seguras (HTTPS).
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === 'celular' ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      // El service worker solo guarda los archivos de la app (código, estilos,
      // íconos y OpenCV.js) para funcionar sin internet. Nunca datos de alumnos.
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024, // opencv.js pesa ~13 MB
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'CalificaYa',
        short_name: 'CalificaYa',
        description: 'Califica exámenes de opción múltiple con la cámara de tu celular.',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f8fafc',
        theme_color: '#1d4ed8',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
