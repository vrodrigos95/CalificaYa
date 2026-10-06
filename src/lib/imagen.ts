import type { RawImage } from '../omr/reader';

/** Decodifica una foto a RGBA, reducida a `maxLado` píxeles en su lado mayor. Solo en memoria. */
export async function archivoAImagen(file: Blob, maxLado = 2000): Promise<RawImage> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const d = g.getImageData(0, 0, w, h);
  canvas.width = canvas.height = 0; // liberar memoria del canvas
  return { data: d.data, width: w, height: h };
}

/** Miniatura JPEG (en memoria) de la hoja enderezada, recortada a `recorte` (px), para la revisión. */
export function miniaturaJpeg(
  hoja: { data: Uint8Array; width: number; height: number },
  recorte = { x: 0, y: 0, w: hoja.width, h: hoja.height },
  ancho = 560,
  calidad = 0.72,
): Promise<Blob | null> {
  const src = document.createElement('canvas');
  src.width = hoja.width;
  src.height = hoja.height;
  const g = src.getContext('2d')!;
  const img = g.createImageData(hoja.width, hoja.height);
  for (let i = 0; i < hoja.data.length; i++) {
    const v = hoja.data[i];
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const dst = document.createElement('canvas');
  dst.width = ancho;
  dst.height = Math.round((recorte.h * ancho) / recorte.w);
  dst.getContext('2d')!.drawImage(src, recorte.x, recorte.y, recorte.w, recorte.h, 0, 0, dst.width, dst.height);
  src.width = src.height = 0;
  return new Promise((resolve) =>
    dst.toBlob((b) => { dst.width = dst.height = 0; resolve(b); }, 'image/jpeg', calidad),
  );
}
