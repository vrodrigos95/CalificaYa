// Copia Tesseract.js (worker, núcleo WASM y el idioma español) a public/tesseract/
// para leer lo escrito a mano sin internet ni CDN.
import { copyFileSync, mkdirSync } from 'node:fs';
const dst = 'public/tesseract';
mkdirSync(dst, { recursive: true });
copyFileSync('node_modules/tesseract.js/dist/worker.min.js', `${dst}/worker.min.js`);
// Solo LSTM (el motor que se usa); el worker elige la variante según el celular.
for (const v of ['lstm', 'simd-lstm', 'relaxedsimd-lstm'])
  copyFileSync(`node_modules/tesseract.js-core/tesseract-core-${v}.wasm.js`, `${dst}/tesseract-core-${v}.wasm.js`);
copyFileSync('node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz', `${dst}/spa.traineddata.gz`);
