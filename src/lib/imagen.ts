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
