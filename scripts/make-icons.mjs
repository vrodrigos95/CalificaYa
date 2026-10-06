// Íconos provisionales de CalificaYa: burbuja rellena con una palomita.
// Uso: npm run icons
import { writeFileSync, mkdirSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';

const AZUL = '#1d4ed8';
mkdirSync('public/icons', { recursive: true });

function draw(size, { maskable = false, fondo = true } = {}) {
  const c = createCanvas(size, size);
  const g = c.getContext('2d');
  if (fondo) {
    g.fillStyle = maskable ? AZUL : '#ffffff';
    g.fillRect(0, 0, size, size);
  }
  const cx = size / 2, cy = size / 2;
  const r = size * (maskable ? 0.3 : 0.42);
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = maskable ? '#ffffff' : AZUL;
  g.fill();
  g.beginPath();
  g.moveTo(cx - r * 0.5, cy + r * 0.02);
  g.lineTo(cx - r * 0.12, cy + r * 0.4);
  g.lineTo(cx + r * 0.52, cy - r * 0.38);
  g.strokeStyle = maskable ? AZUL : '#ffffff';
  g.lineWidth = r * 0.2;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.stroke();
  return c.toBuffer('image/png');
}

writeFileSync('public/icons/icon-192.png', draw(192));
writeFileSync('public/icons/icon-512.png', draw(512));
writeFileSync('public/icons/maskable-512.png', draw(512, { maskable: true }));
writeFileSync('public/icons/apple-touch-icon-180.png', draw(180));
writeFileSync(
  'public/icons/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="${AZUL}"/><path d="M18 33l9 9 19-19" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>\n`,
);
console.log('Íconos generados en public/icons');
