import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// `--mode celular` activa HTTPS con un certificado local: en el celular la cámara
// solo funciona en páginas seguras (HTTPS).
// Versión visible en Ajustes: versión del package + commit (Netlify da COMMIT_REF) + fecha.
function versionApp(): string {
  let commit = process.env.COMMIT_REF ?? '';
  if (!commit) try { commit = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { /* sin git */ }
  const fecha = new Date().toISOString().slice(0, 10);
  return [process.env.npm_package_version ?? '', commit.trim().slice(0, 7), fecha].filter(Boolean).join(' · ');
}

export default defineConfig(({ mode }) => ({
  define: { __APP_VERSION__: JSON.stringify(versionApp()) },
  // GitHub Pages publica en /<repositorio>/ (lo define el flujo .github/workflows/pages.yml).
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === 'celular' ? [basicSsl()] : []),
    VitePWA({
      // 'prompt': la versión nueva espera hasta que el docente toque «Actualizar»
      // (ver AvisoActualizacion). Recargar solo borraría una sesión a medias.
      registerType: 'prompt',
      // El service worker solo guarda los archivos de la app (código, estilos,
      // íconos y OpenCV.js) para funcionar sin internet. Nunca datos de alumnos.
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,xlsx}'],
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
