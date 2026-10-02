// Cliente con promesas para el Web Worker del OMR. Un solo worker para toda la app.
import type { ReadFailure, ReadOptions, ReadResult, RawImage } from './reader';
import type { Peticion } from './omr.worker';

let worker: Worker | null = null;
let siguiente = 1;
const pendientes = new Map<number, { resolve: (v: any) => void; reject: (e: unknown) => void }>(); // eslint-disable-line @typescript-eslint/no-explicit-any

function obtenerWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./omr.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const p = pendientes.get(e.data.id);
      if (!p) return;
      pendientes.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data);
      else p.reject(new Error(e.data.error));
    };
  }
  return worker;
}

type SinId<T> = T extends unknown ? Omit<T, 'id'> : never;

function enviar<T>(msg: SinId<Peticion>, transfer: Transferable[] = []): Promise<T> {
  const id = siguiente++;
  return new Promise<T>((resolve, reject) => {
    pendientes.set(id, { resolve, reject });
    obtenerWorker().postMessage({ ...msg, id }, transfer);
  });
}

/** Descarga e inicializa OpenCV.js en segundo plano (la primera vez tarda unos segundos). */
export function precargarOMR(): Promise<void> {
  return enviar<unknown>({ tipo: 'precargar' }).then(() => undefined);
}

/** Lee una hoja. La imagen se transfiere al worker (deja de ser usable aquí). */
export function leerHoja(imagen: RawImage, opciones?: ReadOptions): Promise<{ resultado: ReadResult | ReadFailure; ms: number }> {
  return enviar({ tipo: 'leer', imagen, opciones }, [imagen.data.buffer]);
}
