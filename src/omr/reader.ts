// Motor OMR: localiza la hoja en una foto, corrige perspectiva y lee las burbujas.
//
// Pipeline: escala de grises → umbral adaptativo → búsqueda de los marcadores
// cuadrados → hipótesis (formato × rotación) verificadas con los marcadores
// laterales y la tira de identificación → homografía con los 6 marcadores →
// hoja enderezada a resolución fija → normalización de iluminación → % de
// relleno de cada burbuja → clasificación por fila.
//
// Toda la memoria de OpenCV se libera antes de regresar.

import { FORMATOS, getLayout, markerCenters, PAGE_H, PAGE_W, type Bubble, type Formato, type SheetLayout } from '../layout/sheetLayout';
import { armarId, calibrar, clasificarFila, type Calibracion, type IdRead, type MarkRead } from './classify';
import type { CV } from './cv';

export interface RawImage {
  /** RGBA, como ImageData. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export type Rotacion = 0 | 90 | 180 | 270;

export interface GrayImage {
  data: Uint8Array;
  width: number;
  height: number;
  /** Píxeles por milímetro. */
  ppm: number;
}

export interface ReadResult {
  ok: true;
  formato: Formato;
  rotacion: Rotacion;
  preguntas: MarkRead[];
  version: MarkRead;
  id: IdRead;
  calibracion: Calibracion;
  /** Confianza de la detección de la hoja (0–1). */
  confianza: number;
  /** Error medio de ajuste de los marcadores, en mm. */
  errorMarcadores: number;
  /** Hoja enderezada en escala de grises (si se pidió). */
  hoja?: GrayImage;
  /** Marcadores encontrados en la imagen de entrada (coordenadas de la imagen). */
  marcadores: { x: number; y: number }[];
}

export interface ReadFailure {
  ok: false;
  motivo: 'sin-marcadores' | 'formato-desconocido';
  marcadores: { x: number; y: number }[];
}

export interface ReadOptions {
  formatos?: Formato[];
  /** Resolución de la hoja enderezada (px/mm). */
  ppm?: number;
  incluirHoja?: boolean;
  /** Lado máximo de la imagen reducida que se usa para buscar marcadores. */
  ladoBusqueda?: number;
}

interface Candidato { x: number; y: number; lado: number }

// ---------------------------------------------------------------------------
// Álgebra de homografías (3×3, fila mayor)
// ---------------------------------------------------------------------------
type H = number[];
function aplicar(h: H, x: number, y: number) {
  const w = h[6] * x + h[7] * y + h[8];
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
}
function mult(a: H, b: H): H {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}

function homografia(cv: CV, src: { x: number; y: number }[], dst: { x: number; y: number }[]): H | null {
  const a = cv.matFromArray(src.length, 1, cv.CV_32FC2, src.flatMap((p) => [p.x, p.y]));
  const b = cv.matFromArray(dst.length, 1, cv.CV_32FC2, dst.flatMap((p) => [p.x, p.y]));
  const m = src.length === 4 ? cv.getPerspectiveTransform(a, b) : cv.findHomography(a, b, 0);
  const out: H | null = m.rows === 3 ? Array.from(m.data64F as Float64Array) : null;
  a.delete();
  b.delete();
  m.delete();
  return out;
}

// ---------------------------------------------------------------------------
// 1. Candidatos a marcador
// ---------------------------------------------------------------------------
export function buscarCandidatos(cv: CV, small: CV): Candidato[] {
  const minDim = Math.min(small.cols, small.rows);
  const bin = new cv.Mat();
  let block = Math.round(minDim / 8) | 1;
  if (block < 15) block = 15;
  cv.adaptiveThreshold(small, bin, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, block, 18);
  const contours = new cv.MatVector();
  const hier = new cv.Mat();
  cv.findContours(bin, contours, hier, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
  const minA = (minDim * 0.007) ** 2;
  const maxA = (minDim * 0.1) ** 2;
  const out: Candidato[] = [];
  for (let i = 0; i < contours.size(); i++) {
    const c = contours.get(i);
    const area = cv.contourArea(c);
    if (area >= minA && area <= maxA) {
      const rr = cv.minAreaRect(c);
      const w = rr.size.width, h = rr.size.height;
      const aspecto = Math.min(w, h) / Math.max(w, h);
      const extension = area / (w * h);
      // En cuadros chicos (foto lejana o de baja resolución) el contorno pixelado
      // se parece al de un círculo: se acepta con más holgura y la verificación
      // de hipótesis (marcadores laterales + tira) descarta los falsos.
      let ok = aspecto > 0.65 && extension > (Math.sqrt(area) < 13 ? 0.72 : 0.84);
      if (!ok && aspecto > 0.5) {
        // Con perspectiva el cuadro se ve como trapecio: aceptar polígonos convexos de 4 lados.
        const approx = new cv.Mat();
        cv.approxPolyDP(c, approx, 0.06 * cv.arcLength(c, true), true);
        ok = approx.rows === 4 && cv.isContourConvex(approx);
        approx.delete();
      }
      if (ok) {
        // Debe ser sólido (no un cuadro hueco): % de píxeles oscuros dentro del contorno.
        const br = cv.boundingRect(c);
        const roi = bin.roi(br);
        const mask = cv.Mat.zeros(br.height, br.width, cv.CV_8UC1);
        const one = new cv.MatVector();
        one.push_back(c);
        cv.drawContours(mask, one, 0, new cv.Scalar(255), -1, cv.LINE_8, new cv.Mat(), 0, new cv.Point(-br.x, -br.y));
        const relleno = cv.mean(roi, mask)[0] / 255;
        one.delete();
        mask.delete();
        roi.delete();
        if (relleno > 0.8) out.push({ x: rr.center.x, y: rr.center.y, lado: Math.sqrt(area) });
      }
    }
    c.delete();
  }
  contours.delete();
  hier.delete();
  bin.delete();
  // Quitar duplicados (contornos interior/exterior del mismo cuadro)
  out.sort((a, b) => b.lado - a.lado);
  const unicos: Candidato[] = [];
  for (const c of out) if (!unicos.some((u) => Math.hypot(u.x - c.x, u.y - c.y) < u.lado * 0.5)) unicos.push(c);
  return unicos;
}

// ---------------------------------------------------------------------------
// 2. Hipótesis de formato y orientación
// ---------------------------------------------------------------------------
interface Hipotesis {
  formato: Formato;
  rotacion: Rotacion;
  h: H; // mm → px (imagen reducida)
  puntaje: number;
  checker: number;
  marcadores: { x: number; y: number }[];
}

function envolvente(pts: Candidato[]): Candidato[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Candidato, a: Candidato, b: Candidato) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Candidato[] = [], upper: Candidato[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Las 4 esquinas del marco: el cuadrilátero de mayor área sobre la envolvente convexa. */
function esquinas(grupo: Candidato[]) {
  const h = envolvente(grupo);
  if (h.length < 4) return null;
  let best: Candidato[] | null = null, bestA = 0;
  const n = h.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++)
        for (let l = k + 1; l < n; l++) {
          const q = [h[i], h[j], h[k], h[l]];
          const a = areaQuad(q);
          if (a > bestA) { bestA = a; best = q; }
        }
  if (!best) return null;
  // Orden horario empezando por el más cercano a la esquina superior izquierda de la imagen.
  const cx = best.reduce((s, c) => s + c.x, 0) / 4, cy = best.reduce((s, c) => s + c.y, 0) / 4;
  best.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  const start = best.reduce((bi, c, i) => (c.x + c.y < best![bi].x + best![bi].y ? i : bi), 0);
  return [0, 1, 2, 3].map((i) => best![(start + i) % 4]);
}

function areaQuad(q: { x: number; y: number }[]) {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const p = q[i], n = q[(i + 1) % 4];
    a += p.x * n.y - n.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** Oscuridad media (0–1) en un cuadrado de lado 2·rad alrededor de (x, y). */
function oscuridad(img: Uint8Array, w: number, h: number, x: number, y: number, rad: number): number {
  const x0 = Math.max(0, Math.round(x - rad)), x1 = Math.min(w - 1, Math.round(x + rad));
  const y0 = Math.max(0, Math.round(y - rad)), y1 = Math.min(h - 1, Math.round(y + rad));
  if (x1 < x0 || y1 < y0) return 0;
  let s = 0, n = 0;
  for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { s += img[yy * w + xx]; n++; }
  return 1 - s / n / 255;
}

function evaluar(
  layout: SheetLayout,
  rot: Rotacion,
  quad: Candidato[],
  cands: Candidato[],
  gray: Uint8Array,
  w: number,
  hgt: number,
  cv: CV,
): Hipotesis | null {
  const mc = markerCenters(layout);
  const tpl = [mc[0], mc[1], mc[5], mc[4]]; // TL, TR, BR, BL de la hoja
  const k = rot / 90;
  const img = tpl.map((_, j) => quad[(j + k) % 4]);
  const h = homografia(cv, tpl, img);
  if (!h) return null;

  // Escala aproximada: px por mm
  const ppm = Math.hypot(img[1].x - img[0].x, img[1].y - img[0].y) / Math.hypot(tpl[1].x - tpl[0].x, tpl[1].y - tpl[0].y);
  const marcadorPx = layout.markers[0].size * ppm;

  // Marcadores laterales
  const marcadores = [img[0], img[1], null, null, img[3], img[2]] as ({ x: number; y: number } | null)[];
  let medios = 0;
  for (const idx of [2, 3]) {
    const p = aplicar(h, mc[idx].x, mc[idx].y);
    const c = cands.find((c) => Math.hypot(c.x - p.x, c.y - p.y) < marcadorPx * 0.6 && c.lado > marcadorPx * 0.6);
    if (c) { medios++; marcadores[idx] = c; }
    else marcadores[idx] = null;
  }

  // Tira de identificación: se compara cada celda contra el punto medio entre la
  // celda más clara y la más oscura (inmune a sombras que oscurecen todo el papel).
  const ck = layout.checker;
  const radio = Math.max(1, ck.size * ppm * 0.3);
  const muestras: { bit: number; o: number }[] = [];
  ck.bits.forEach((fila, r) =>
    fila.forEach((bit, c) => {
      const p = aplicar(h, ck.x + c * ck.pitchX + ck.size / 2, ck.y + r * ck.pitchY + ck.size / 2);
      muestras.push({ bit, o: oscuridad(gray, w, hgt, p.x, p.y, radio) });
    }),
  );
  const os = muestras.map((m) => m.o);
  const lo = Math.min(...os), hi = Math.max(...os);
  const corte = (lo + hi) / 2;
  const aciertos = hi - lo < 0.2 ? 0 : muestras.filter((m) => (m.bit === 1) === m.o > corte).length;
  const total = muestras.length;
  const checker = aciertos / total;
  const puntaje = checker * 2 + medios * 0.5;
  return {
    formato: layout.formato,
    rotacion: rot,
    h,
    puntaje,
    checker,
    marcadores: marcadores.map((m, i) => m ?? aplicar(h, mc[i].x, mc[i].y)),
  };
}

// ---------------------------------------------------------------------------
// 3. Muestreo de burbujas
// ---------------------------------------------------------------------------
function rellenoBurbuja(dark: Uint8Array, w: number, hgt: number, b: Bubble, ppm: number): number {
  const cx = b.cx * ppm, cy = b.cy * ppm;
  const r = b.r * ppm * 0.68; // interior, lejos del contorno impreso
  const r2 = r * r;
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(hgt - 1, Math.ceil(cy + r));
  let s = 0, n = 0;
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy <= r2) { s += dark[y * w + x]; n++; }
    }
  }
  return n ? s / n / 255 : 0;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
export function readSheet(cv: CV, image: RawImage, opts: ReadOptions = {}): ReadResult | ReadFailure {
  const formatos = opts.formatos ?? FORMATOS;
  const ppm = opts.ppm ?? 5;
  const ladoBusqueda = opts.ladoBusqueda ?? 1400;

  const rgba = cv.matFromImageData(image);
  const gray = new cv.Mat();
  cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
  rgba.delete();

  const escala = Math.min(1, ladoBusqueda / Math.max(gray.cols, gray.rows));
  const small = new cv.Mat();
  if (escala < 1) cv.resize(gray, small, new cv.Size(Math.round(gray.cols * escala), Math.round(gray.rows * escala)), 0, 0, cv.INTER_AREA);
  else gray.copyTo(small);

  try {
    const cands = buscarCandidatos(cv, small);
    const aImagen = (p: { x: number; y: number }) => ({ x: p.x / escala, y: p.y / escala });
    if (cands.length < 4) return { ok: false, motivo: 'sin-marcadores', marcadores: cands.map(aImagen) };

    // Grupos de candidatos de tamaño parecido → cuadrilátero de esquinas.
    const smallData: Uint8Array = small.data;
    const areaMin = small.cols * small.rows * 0.06;
    const quads: Candidato[][] = [];
    for (const ref of cands.slice(0, 12)) {
      const grupo = cands.filter((c) => c.lado >= ref.lado * 0.72 && c.lado <= ref.lado * 1.4);
      if (grupo.length < 4) continue;
      const q = esquinas(grupo);
      if (q && areaQuad(q) > areaMin && !quads.some((o) => o.every((c, i) => c === q[i]))) quads.push(q);
    }
    let mejor: Hipotesis | null = null;
    for (const q of quads)
      for (const f of formatos)
        for (const rot of [0, 90, 180, 270] as Rotacion[]) {
          const hip = evaluar(getLayout(f), rot, q, cands, smallData, small.cols, small.rows, cv);
          if (hip && (!mejor || hip.puntaje > mejor.puntaje)) mejor = hip;
        }
    if (!mejor) return { ok: false, motivo: 'sin-marcadores', marcadores: cands.map(aImagen) };
    if (mejor.checker < 0.8) return { ok: false, motivo: 'formato-desconocido', marcadores: cands.map(aImagen) };

    const layout = getLayout(mejor.formato);

    // Ajuste fino con los 6 marcadores, en coordenadas de la imagen completa.
    const mc = markerCenters(layout);
    const imgPts = mejor.marcadores.map(aImagen);
    const hFull = homografia(cv, mc, imgPts) ?? mult([1 / escala, 0, 0, 0, 1 / escala, 0, 0, 0, 1], mejor.h);
    let err = 0;
    mc.forEach((p, i) => {
      const q = aplicar(hFull, p.x, p.y);
      err += Math.hypot(q.x - imgPts[i].x, q.y - imgPts[i].y);
    });
    const pxPorMm = Math.hypot(imgPts[1].x - imgPts[0].x, imgPts[1].y - imgPts[0].y) / Math.hypot(mc[1].x - mc[0].x, mc[1].y - mc[0].y);
    const errorMarcadores = err / 6 / pxPorMm;

    // Hoja enderezada: píxel de salida → mm → imagen.
    const W = Math.round(PAGE_W * ppm), Hh = Math.round(PAGE_H * ppm);
    const M = mult(hFull, [1 / ppm, 0, 0, 0, 1 / ppm, 0, 0, 0, 1]);
    const Mm = cv.matFromArray(3, 3, cv.CV_64F, M);
    const hoja = new cv.Mat();
    cv.warpPerspective(gray, hoja, Mm, new cv.Size(W, Hh), cv.INTER_LINEAR | cv.WARP_INVERSE_MAP, cv.BORDER_REPLICATE);
    Mm.delete();

    // Iluminación: estimar el papel con un máximo local amplio (borra las marcas)
    // y dividir. Se calcula a 1/4 de resolución porque el fondo varía suave.
    const chico = new cv.Mat();
    cv.resize(hoja, chico, new cv.Size(Math.round(W / 4), Math.round(Hh / 4)), 0, 0, cv.INTER_AREA);
    const k = Math.round((12 * ppm) / 4) | 1;
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(k, k));
    cv.dilate(chico, chico, kernel);
    kernel.delete();
    cv.blur(chico, chico, new cv.Size(k, k));
    const fondo = new cv.Mat();
    cv.resize(chico, fondo, new cv.Size(W, Hh), 0, 0, cv.INTER_LINEAR);
    chico.delete();
    const norm = new cv.Mat();
    cv.divide(hoja, fondo, norm, 255);
    fondo.delete();
    const dark = new cv.Mat();
    cv.bitwise_not(norm, dark);
    norm.delete();
    const d: Uint8Array = dark.data;

    const leer = (b: Bubble) => rellenoBurbuja(d, W, Hh, b, ppm);
    const filasP = layout.preguntas.map((f) => f.map(leer));
    const filaV = layout.version.map(leer);
    const filasId = layout.id.map((col) => col.map(leer));
    dark.delete();

    const cal = calibrar([...filasP, filaV, ...filasId]);
    const result: ReadResult = {
      ok: true,
      formato: mejor.formato,
      rotacion: mejor.rotacion,
      preguntas: filasP.map((f) => clasificarFila(f, cal)),
      version: clasificarFila(filaV, cal),
      id: armarId(filasId.map((f) => clasificarFila(f, cal))),
      calibracion: cal,
      confianza: Math.min(1, mejor.puntaje / 3),
      errorMarcadores,
      marcadores: imgPts,
    };
    if (opts.incluirHoja) result.hoja = { data: new Uint8Array(hoja.data), width: W, height: Hh, ppm };
    hoja.delete();
    return result;
  } finally {
    gray.delete();
    small.delete();
  }
}
