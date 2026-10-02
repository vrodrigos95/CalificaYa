/// <reference lib="webworker" />
// Web Worker del motor OMR: carga OpenCV.js una sola vez y lee hojas sin
// bloquear la interfaz. Las imágenes llegan y salen como buffers transferibles.
import { esperarCV, OPENCV_URL, type CV } from './cv';
import { readSheet, type ReadOptions, type RawImage } from './reader';

declare const self: DedicatedWorkerGlobalScope;

let cvPromesa: Promise<{ cv: CV }> | null = null;

function cargarCV() {
  if (!cvPromesa) {
    cvPromesa = (async () => {
      const url = new URL(import.meta.env.BASE_URL + OPENCV_URL, self.location.origin);
      const codigo = await (await fetch(url)).text();
      // opencv.js es un script UMD: evaluado en el ámbito global define `cv`.
      (0, eval)(codigo);
      return esperarCV((self as unknown as { cv: unknown }).cv);
    })();
  }
  return cvPromesa;
}

export type Peticion =
  | { tipo: 'precargar'; id: number }
  | { tipo: 'leer'; id: number; imagen: RawImage; opciones?: ReadOptions };

self.onmessage = async (e: MessageEvent<Peticion>) => {
  const p = e.data;
  try {
    const { cv } = await cargarCV();
    if (p.tipo === 'precargar') { self.postMessage({ id: p.id, ok: true }); return; }
    const t0 = performance.now();
    const resultado = readSheet(cv, p.imagen, p.opciones);
    const ms = performance.now() - t0;
    const transfer = resultado.ok && resultado.hoja ? [resultado.hoja.data.buffer] : [];
    self.postMessage({ id: p.id, ok: true, resultado, ms }, transfer);
  } catch (err) {
    self.postMessage({ id: p.id, ok: false, error: String(err) });
  }
};
