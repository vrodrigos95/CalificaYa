// OpenCV.js. En la app se carga como script clásico dentro del Web Worker
// (public/opencv/opencv.js, cacheado por el service worker para uso sin internet);
// en las pruebas se carga con require (tests/helpers/cvNode.ts).
//
// Ojo: el módulo de OpenCV.js trae un método `then` propio. Nunca debe regresarse
// tal cual desde una promesa o función async (JavaScript intentaría "resolverlo"),
// por eso siempre viaja envuelto en { cv }.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type CV = any;

export const OPENCV_URL = 'opencv/opencv.js';

export function esperarCV(mod: any): Promise<{ cv: CV }> {
  return new Promise((resolve) => {
    if (mod instanceof Promise) mod.then((cv: CV) => resolve({ cv }));
    else if (mod.Mat) resolve({ cv: mod });
    else mod.onRuntimeInitialized = () => resolve({ cv: mod });
  });
}
