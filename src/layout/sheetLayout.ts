// Geometría de las hojas de respuesta CalificaYa (fuente única de verdad).
// El generador de PDF dibuja con estas coordenadas y el motor OMR las usa para
// saber dónde muestrear. Medidas en milímetros sobre hoja carta (215.9 × 279.4 mm),
// origen en la esquina superior izquierda.
//
// Las hojas reproducen la distribución de las hojas de ZipGrade (licencia
// CC BY-SA 3.0), así que la app puede leer tanto hojas CalificaYa como hojas
// originales de ZipGrade:
//  - 20 preguntas: medida sobre una imagen de referencia (sin código de alumno).
//  - 50 y 100 preguntas: coordenadas exactas extraídas de los PDF originales
//    (ver scripts/extract-form-geometry.py → formGeometry.ts).
// Cada hoja tiene 6 marcadores en el marco y una "tira" de cuadritos con un
// patrón distinto por formato, que identifica la hoja y su orientación.

import { FORM_100, FORM_50, type FormGeometry } from './formGeometry';

export const PAGE_W = 215.9;
export const PAGE_H = 279.4;

export type Formato = 20 | 50 | 100;
export const FORMATOS: Formato[] = [20, 50, 100];
export const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;
/** Versiones de examen que maneja la app (las hojas de 50/100 también traen E). */
export const VERSIONES = ['A', 'B', 'C', 'D'] as const;

export interface Bubble { cx: number; cy: number; r: number }
export interface Square { x: number; y: number; size: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Line { x1: number; y1: number; x2: number; y2: number; gray: number; width: number }
export interface TextItem {
  text: string; x: number; y: number; size: number;
  bold?: boolean; align?: 'left' | 'center' | 'right'; color?: number;
  /** Grados en sentido antihorario (90 = se lee de abajo hacia arriba). */
  angle?: number;
}

/** Tira de identificación: rejilla de celdas, 1 = negra. */
export interface Checker {
  x: number; y: number; size: number; pitchX: number; pitchY: number;
  bits: number[][]; // [fila][columna]
}

export interface HeaderCell { label: string; x: number; labelW: number; w: number }
export interface HeaderRow { y: number; h: number; cells: HeaderCell[] }
export interface HeaderBox { rect: Rect; rounded: boolean; rows: HeaderRow[] }

export interface SheetLayout {
  formato: Formato;
  /** 6 marcadores: sup-izq, sup-der, med-izq, med-der, inf-izq, inf-der. */
  markers: Square[];
  blockMarkers: Square[];
  checker: Checker;
  /** preguntas[q][o]: pregunta q (0-based), opción o (0 = A … 4 = E). */
  preguntas: Bubble[][];
  /** version[v]: v = 0 (A) … 4 (E). La hoja de 20 solo trae A–D. */
  version: Bubble[];
  /** id[d][n]: dígito en la posición d con valor n (0–9). Vacío en la hoja de 20. */
  id: Bubble[][];
  // --- Solo para dibujar ---
  headers: HeaderBox[];
  boxes: Rect[];
  grayRects: Rect[];
  lines: Line[];
  textos: TextItem[];
}

export const ID_DIGITOS: Record<Formato, number> = { 20: 0, 50: 5, 100: 9 };

const CREDITO_1 = 'Distribución basada en las hojas de ZipGrade (zipgrade.com).';
const CREDITO_2 = 'Licencia Creative Commons Atribución-CompartirIgual 3.0.';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const PT = 25.4 / 72;
const mm = (v: number) => v * PT;

function checkerFromCells(cells: number[][], toMm: (v: number) => number, offX = 0, offY = 0): Checker {
  const cluster = (vals: number[]) => {
    const out: number[] = [];
    for (const v of [...vals].sort((a, b) => a - b)) if (!out.length || v - out[out.length - 1] > 2) out.push(v);
    return out;
  };
  const xs = cluster(cells.map((c) => c[0]));
  const ys = cluster(cells.map((c) => c[1]));
  const idx = (arr: number[], v: number) => arr.findIndex((a) => Math.abs(a - v) <= 2);
  const bits = ys.map(() => xs.map(() => 0));
  for (const c of cells) bits[idx(ys, c[1])][idx(xs, c[0])] = 1;
  const pitch = (arr: number[], size: number) => (arr.length > 1 ? (arr[arr.length - 1] - arr[0]) / (arr.length - 1) : size);
  const size = cells[0][2];
  return {
    x: offX + toMm(xs[0]),
    y: offY + toMm(ys[0]),
    size: toMm(size),
    pitchX: toMm(pitch(xs, size)),
    pitchY: toMm(pitch(ys, size)),
    bits,
  };
}

function numeroIzquierda(b: Bubble, text: string, size: number): TextItem {
  return { text, x: b.cx - b.r - 1.5, y: b.cy + size * 0.125, size, align: 'right' };
}

function letrasArriba(fila: Bubble[], dy: number, size: number): TextItem[] {
  return fila.map((b, k) => ({ text: LETRAS[k], x: b.cx, y: b.cy - dy, size, align: 'center' as const, color: 40 }));
}

// ---------------------------------------------------------------------------
// Hoja de 20 preguntas (medida sobre la imagen de referencia: 1 px = 0.515 mm)
// ---------------------------------------------------------------------------
const S = 0.515;
const OX = 19.9 - 27 * S;
const OY = 26.65 - 47 * S;
const px = (x: number) => OX + x * S;
const py = (y: number) => OY + y * S;

function layout20(): SheetLayout {
  const markers: Square[] = [];
  for (const y of [54.5, 288, 477.5]) for (const x of [34.5, 360.5]) markers.push({ x: px(x - 8), y: py(y - 8), size: 16 * S });

  const r = 9.2 * S;
  const colX = [129.6, 288.5];
  const preguntas: Bubble[][] = [];
  const textos: TextItem[] = [];
  for (let q = 0; q < 20; q++) {
    const col = Math.floor(q / 10);
    const cy = py(172.6 + (q % 10) * 28.97);
    const fila = LETRAS.map((_, k) => ({ cx: px(colX[col] + (k - 2) * 21.62), cy, r }));
    preguntas.push(fila);
    textos.push({ text: String(q + 1), x: px(col === 0 ? 67 : 225), y: cy + 3.4, size: 26, bold: true, align: 'right' });
  }
  for (const q of [0, 10]) textos.push(...letrasArriba(preguntas[q], 6.4, 28));

  const version = [181.4, 213.6, 245.8, 278.3].map((x) => ({ cx: px(x), cy: py(457.6), r: 8.6 * S }));
  textos.push({ text: 'Versión', x: px(160), y: py(456), size: 8, align: 'right' });
  textos.push({ text: 'del examen:', x: px(160), y: py(463), size: 8, align: 'right' });
  version.forEach((b, i) => textos.push({ text: LETRAS[i], x: b.cx - b.r - 0.8, y: b.cy + 2.2, size: 15, align: 'right', color: 110 }));

  // Pie: marca a la izquierda, tira al centro, crédito a la derecha.
  const fy = py(477.5);
  textos.push({ text: 'Hoja de respuestas', x: px(56), y: fy - 1.6, size: 7 });
  textos.push({ text: 'CalificaYa', x: px(56), y: fy + 3.4, size: 15, bold: true });
  textos.push({ text: 'Basada en las hojas de ZipGrade (zipgrade.com).', x: px(272), y: fy - 1.4, size: 4.6 });
  textos.push({ text: 'Licencia Creative Commons BY-SA 3.0.', x: px(272), y: fy + 0.8, size: 4.6 });
  textos.push({ text: 'Rellena por completo con lápiz o pluma oscura.', x: px(272), y: fy + 3.0, size: 4.6 });

  const cell = 7.25 * S;
  const top = py(49), mid = py(84.5), bottom = py(118.5);
  const lw = (116 - 56) * S;
  return {
    formato: 20,
    markers,
    blockMarkers: [],
    checker: { x: px(229), y: py(472), size: cell, pitchX: cell, pitchY: cell, bits: [[1, 0, 1, 0, 1], [1, 1, 0, 1, 0]] },
    preguntas,
    version,
    id: [],
    headers: [{
      rect: { x: px(56), y: top, w: px(340.5) - px(56), h: bottom - top },
      rounded: true,
      rows: [
        { y: top, h: mid - top, cells: [{ label: 'Nombre', x: px(56), labelW: lw, w: px(340.5) - px(56) }] },
        { y: mid, h: bottom - mid, cells: [
          { label: 'Fecha', x: px(56), labelW: lw, w: (214 - 56) * S },
          { label: 'Grupo', x: px(214), labelW: (274 - 214) * S, w: px(340.5) - px(214) },
        ] },
      ],
    }],
    boxes: [],
    grayRects: [],
    lines: [],
    textos,
  };
}

// ---------------------------------------------------------------------------
// Hojas de 50 y 100 preguntas (coordenadas exactas en puntos → mm)
// ---------------------------------------------------------------------------
function comunes(g: FormGeometry) {
  const sq = (s: number[]): Square => ({ x: mm(s[0]), y: mm(s[1]), size: mm(s[2]) });
  const bub = (c: number[], r: number): Bubble => ({ cx: mm(c[0]), cy: mm(c[1]), r: mm(r) });
  const preguntas = g.questions.map((fila) => fila.map((c) => bub(c, g.r)));
  const version = g.version.map((c) => bub(c, g.versionR));
  const id = g.id.map((col) => col.map((c) => bub(c, g.r)));
  const textos: TextItem[] = [];
  preguntas.forEach((fila, q) => textos.push(numeroIzquierda(fila[0], String(q + 1), 12.5)));
  for (let q = 0; q < preguntas.length; q += 10) textos.push(...letrasArriba(preguntas[q], 3.9, 13));
  // Valores 0–9 a la izquierda de cada fila del código
  id[0].forEach((b, v) => textos.push({ ...numeroIzquierda(b, String(v), 12.5), color: 0 }));
  const line = (l: number[], gray: number, width: number): Line => ({ x1: mm(l[0]), y1: mm(l[1]), x2: mm(l[2]), y2: mm(l[3]), gray, width: mm(width) });
  const rect = (r: number[]): Rect => ({ x: mm(r[0]), y: mm(r[1]), w: mm(r[2]), h: mm(r[3]) });
  return {
    markers: g.markers.map(sq),
    blockMarkers: g.blockMarkers.map(sq),
    checker: checkerFromCells(g.checker, mm),
    preguntas, version, id, textos,
    grayRects: [rect(g.idRect), rect(g.keyRect)],
    lines: g.grayLines.map((l) => line(l, 220, 0.96)),
    boxes: g.boxes.map(rect),
  };
}

function layout50(): SheetLayout {
  const c = comunes(FORM_50);
  const t = c.textos;
  const x0 = mm(168.48), x1 = mm(461.28), y0 = mm(145.92), ym = mm(169.2), y1 = mm(191.52);
  const lw = mm(33);
  const headers: HeaderBox[] = [{
    rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
    rounded: true,
    rows: [
      { y: y0, h: ym - y0, cells: [
        { label: 'Nombre', x: x0, labelW: lw, w: mm(345) - x0 },
        { label: 'Fecha', x: mm(345), labelW: lw, w: x1 - mm(345) },
      ] },
      { y: ym, h: y1 - ym, cells: [
        { label: 'Grupo', x: x0, labelW: lw, w: mm(296) - x0 },
        { label: 'Examen', x: mm(296), labelW: lw, w: x1 - mm(296) },
      ] },
    ],
  }];
  t.push({ text: 'Código de alumno', x: mm(169.4), y: mm(201.3), size: 8.2 });
  t.push({ text: 'Versión', x: mm(130.3), y: mm(215.5), size: 6.4, align: 'center' });
  c.version.forEach((b, i) => t.push({ text: LETRAS[i], x: b.cx, y: b.cy - b.r - 0.8, size: 8.2, align: 'center', color: 110 }));
  // Indicaciones verticales
  t.push({ text: 'Alumnos: rellenen por completo con tinta negra o lápiz.', x: mm(493.4), y: mm(204), size: 6.4, angle: -90 });
  t.push({ text: 'Borren bien cualquier marca de más.', x: mm(485.8), y: mm(204), size: 6.4, angle: -90 });
  t.push({ text: 'Docente: coloque la hoja sobre una superficie plana al calificar.', x: mm(133.9), y: mm(620), size: 6.7, angle: 90 });
  t.push({ text: 'Evite reflejos de luz y sombras.', x: mm(126.2), y: mm(620), size: 6.7, angle: 90 });
  // Pie
  t.push({ text: CREDITO_1, x: mm(148.8), y: mm(656), size: 5.6 });
  t.push({ text: CREDITO_2, x: mm(148.8), y: mm(662.2), size: 5.6 });
  t.push({ text: 'Imprime y copia cuantas hojas necesites.', x: mm(148.8), y: mm(668.4), size: 5.6 });
  t.push({ text: 'CalificaYa', x: mm(458.6), y: mm(668.5), size: 19.2, bold: true, align: 'right' });
  return { formato: 50, ...c, headers, boxes: [] };
}

function layout100(): SheetLayout {
  const c = comunes(FORM_100);
  const t = c.textos;
  const etiquetas = ['Nombre', 'Grupo', 'Examen'];
  c.boxes.forEach((b, i) => t.push({ text: etiquetas[i], x: b.x, y: b.y - 0.9, size: 9.5 }));
  t.push({ text: 'Código de alumno', x: mm(146.2), y: mm(116.6), size: 9.5 });
  t.push({ text: 'Versión', x: mm(312.1), y: mm(116.6), size: 8, align: 'center' });
  c.version.forEach((b, i) => t.push({ text: LETRAS[i], x: b.cx - b.r - 1.2, y: b.cy + 1.4, size: 11.2, align: 'right' }));
  // Marca vertical a la izquierda y recomendaciones
  t.push({ text: 'CalificaYa', x: mm(82), y: mm(300), size: 21.6, bold: true, angle: 90 });
  t.push({ text: '• Usa lápiz o pluma oscura', x: mm(104.4), y: mm(697.2), size: 7.8, angle: 90 });
  t.push({ text: '• Rellena la burbuja completa', x: mm(114.1), y: mm(697.2), size: 7.8, angle: 90 });
  t.push({ text: '• No dobles la hoja', x: mm(104.4), y: mm(517.3), size: 7.8, angle: 90 });
  t.push({ text: '• Borra bien los errores', x: mm(114.1), y: mm(517.3), size: 7.8, angle: 90 });
  t.push({ text: CREDITO_1, x: mm(392.2), y: mm(741), size: 5.4, align: 'center' });
  t.push({ text: CREDITO_2, x: mm(392.2), y: mm(747), size: 5.4, align: 'center' });
  return { formato: 100, ...c, headers: [] };
}

const cache = new Map<Formato, SheetLayout>();

export function getLayout(formato: Formato): SheetLayout {
  let l = cache.get(formato);
  if (!l) {
    l = formato === 20 ? layout20() : formato === 50 ? layout50() : layout100();
    cache.set(formato, l);
  }
  return l;
}

/** Todas las burbujas de una hoja, útil para validar que no se encimen. */
export function allBubbles(l: SheetLayout): Bubble[] {
  return [...l.preguntas.flat(), ...l.version, ...l.id.flat()];
}

/** Centro de cada uno de los 6 marcadores. */
export function markerCenters(l: SheetLayout) {
  return l.markers.map((m) => ({ x: m.x + m.size / 2, y: m.y + m.size / 2 }));
}

/** Rectángulo (mm) que abarca los marcadores, con un margen: lo útil de la hoja. */
export function marcoHoja(l: SheetLayout, margen = 3) {
  const xs = l.markers.flatMap((m) => [m.x, m.x + m.size]);
  const ys = l.markers.flatMap((m) => [m.y, m.y + m.size]);
  const x = Math.max(0, Math.min(...xs) - margen), y = Math.max(0, Math.min(...ys) - margen);
  return { x, y, w: Math.min(PAGE_W, Math.max(...xs) + margen) - x, h: Math.min(PAGE_H, Math.max(...ys) + margen) - y };
}
