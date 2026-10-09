// OCR de lo escrito a mano con Tesseract.js, en el propio celular y sin
// internet: los archivos (worker, núcleo WASM y el idioma español) se sirven
// desde public/tesseract/ (ver scripts/copy-tesseract.mjs) y el service worker
// los guarda la primera vez que se usan.
import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import { getLayout, marcoHoja, type Formato } from '../layout/sheetLayout';
import { miniaturaJpeg } from '../lib/imagen';
import type { GrayImage } from '../omr/reader';
import { binarizar, prepararParaOCR, recortar, tieneEscritura, zonasManuscritas, type TextoManuscrito } from './manuscrito';

let worker: Promise<Worker> | null = null;

function obtenerWorker(): Promise<Worker> {
  if (!worker) {
    const base = new URL(`${import.meta.env.BASE_URL}tesseract/`, location.href).href;
    worker = (async () => {
      const w = await createWorker('spa', OEM.LSTM_ONLY, {
        workerPath: `${base}worker.min.js`,
        corePath: base,
        langPath: base.replace(/\/$/, ''),
        gzip: true,
        cacheMethod: 'none', // ya lo guarda el service worker
        workerBlobURL: false,
      });
      await w.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZabcdefghijklmnñopqrstuvwxyzÁÉÍÓÚÜáéíóúü0123456789 .,/-',
        user_defined_dpi: '300',
      });
      return w;
    })();
    worker.catch(() => { worker = null; }); // reintentar la próxima vez (p. ej. sin internet la primera vez)
  }
  return worker;
}

/** Carga el OCR por adelantado (al empezar a calificar) para que la primera hoja no espere. */
export function precargarOCR() {
  obtenerWorker().catch(() => undefined);
}

function aCanvas(img: GrayImage): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d')!;
  const d = g.createImageData(img.width, img.height);
  for (let i = 0; i < img.data.length; i++) {
    d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = img.data[i];
    d.data[i * 4 + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return c;
}

/**
 * Lee lo escrito en Nombre, Fecha y Grupo de una hoja enderezada y devuelve
 * también una imagen de esos recuadros para que el docente la vea al confirmar.
 */
export async function leerManuscrito(hoja: GrayImage, formato: Formato): Promise<{ texto: TextoManuscrito; recorte: Blob | null }> {
  const layout = getLayout(formato);
  const zonas = zonasManuscritas(layout);
  if (!zonas.length) return { texto: {}, recorte: null };

  // Imagen de los recuadros (todo el encabezado) para mostrarla grande.
  const xs = zonas.flatMap((z) => [z.rect.x, z.rect.x + z.rect.w]), ys = zonas.flatMap((z) => [z.rect.y, z.rect.y + z.rect.h]);
  const m = marcoHoja(layout, 0);
  const x0 = Math.min(...xs, m.x + m.w) - 1, y0 = Math.min(...ys) - 1;
  const k = hoja.ppm;
  const area = { x: x0 * k, y: y0 * k, w: (Math.max(...xs) + 1 - x0) * k, h: (Math.max(...ys) + 1 - y0) * k };
  const recorte = await miniaturaJpeg(hoja, area);

  const w = await obtenerWorker();
  const texto: TextoManuscrito = {};
  for (const z of zonas) {
    const img = recortar(hoja, z.rect);
    if (!tieneEscritura(img)) continue;
    const preparada = prepararParaOCR(img);
    // El nombre se lee dos veces (contraste normal y blanco y negro): cada versión
    // acierta letras distintas y la búsqueda en la lista usa lo de ambas.
    const variantes = z.campo === 'nombre' ? [preparada, binarizar(preparada)] : [preparada];
    const leidos: string[] = [];
    for (const v of variantes) {
      const t = (await w.recognize(aCanvas(v))).data.text.replace(/\s+/g, ' ').trim();
      if (t && !leidos.includes(t)) leidos.push(t);
    }
    if (leidos.length) texto[z.campo] = leidos.join(' / ');
  }
  return { texto, recorte };
}
