// Prueba rápida del lector: npx tsx scripts/omr-try.ts [formato] [seed]
import { writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { loadOpenCV } from '../tests/helpers/cvNode';
import { readSheet } from '../src/omr/reader';
import { dibujarHoja, fotografiar, llenarAlAzar, rng, SIN_DISTORSION } from '../tests/synthetic/sheets';

const formato = Number(process.argv[2] ?? 50) as 20 | 50 | 100;
const seed = Number(process.argv[3] ?? 1);
const extra = JSON.parse(process.argv[4] ?? '{}');
const { cv } = await loadOpenCV();
const hoja = llenarAlAzar(formato, rng(seed));
const img = fotografiar(cv, dibujarHoja(hoja, 8, seed), { ...SIN_DISTORSION, seed, ...extra });
const c = createCanvas(img.width, img.height);
const id = c.getContext('2d').createImageData(img.width, img.height);
id.data.set(img.data);
c.getContext('2d').putImageData(id, 0, 0);
writeFileSync('test-output/foto.png', c.toBuffer('image/png'));
const t = performance.now();
const r = readSheet(cv, img, { incluirHoja: true });
console.log('ms', Math.round(performance.now() - t));
if (!r.ok) { console.log(r); process.exit(1); }
console.log(r.formato, r.rotacion, 'conf', r.confianza.toFixed(2), 'err', r.errorMarcadores.toFixed(2), r.calibracion);
let mal = 0;
r.preguntas.forEach((p, q) => {
  const esp = hoja.respuestas[q].join(',');
  const got = p.marcadas.join(',');
  if (esp !== got) { mal++; console.log('q', q + 1, 'esperado', esp, 'leido', got, p.estado, p.scores.map((s) => s.toFixed(2)).join(' ')); }
});
console.log('mal', mal, 'de', r.preguntas.length, 'id', r.id.texto, 'esperado', hoja.id.join(''), 'version', r.version.marcadas, hoja.version);
const h = r.hoja!;
const hc = createCanvas(h.width, h.height);
const hd = hc.getContext('2d').createImageData(h.width, h.height);
for (let i = 0; i < h.data.length; i++) { hd.data[i * 4] = hd.data[i * 4 + 1] = hd.data[i * 4 + 2] = h.data[i]; hd.data[i * 4 + 3] = 255; }
hc.getContext('2d').putImageData(hd, 0, 0);
writeFileSync('test-output/hoja.png', hc.toBuffer('image/png'));
