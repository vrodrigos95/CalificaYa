import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `--mode celular` activa HTTPS con un certificado local: en el celular la cámara
// solo funciona en páginas seguras (HTTPS).
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'celular' ? [basicSsl()] : [])],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
