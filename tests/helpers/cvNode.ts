import { createRequire } from 'node:module';
import { esperarCV, type CV } from '../../src/omr/cv';

let p: Promise<{ cv: CV }> | null = null;
export function loadOpenCV(): Promise<{ cv: CV }> {
  if (!p) p = esperarCV(createRequire(import.meta.url)('@techstark/opencv-js'));
  return p;
}
