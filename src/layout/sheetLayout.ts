// Geometría de las hojas de respuesta CalificaYa (fuente única de verdad).
// El generador de PDF dibuja con estas coordenadas y el motor OMR las usa para
// saber dónde muestrear. Todas las medidas están en milímetros sobre una hoja
// tamaño carta (215.9 × 279.4 mm), con origen en la esquina superior izquierda.
//
// Las tres hojas comparten el mismo marco de 6 marcadores (4 esquinas + 2 a los
// lados, por debajo de la mitad), con la misma distribución que la hoja de 20
// preguntas de ZipGrade. Como los marcadores laterales no están centrados, la
// orientación (incluida la rotación de 180°) se deduce de los propios marcadores.

import { encodeFormatCode, FORMAT_CODE_COLS, FORMAT_CODE_ROWS } from './formatCode';

export const PAGE_W = 215.9;
export const PAGE_H = 279.4;

export type Formato = 20 | 50 | 100;
export const FORMATOS: Formato[] = [20, 50, 100];
export const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;
export const VERSIONES = ['A', 'B', 'C', 'D'] as const;

export interface Point { x: number; y: number }
export interface Bubble { cx: number; cy: number; r: number }
export interface Marker { cx: number; cy: number; size: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface TextItem { text: string; x: number; y: number; size: number; bold?: boolean; align?: 'left' | 'center' | 'right'; color?: number }
export interface Cell { x: number; y: number; size: number; on: boolean }

export interface SheetOptions {
  formato: Formato;
  opciones: 4 | 5;
  /** Dígitos del código de alumno. La hoja de 20 no lleva bloque de ID. */
  idDigitos: number;
}

export interface SheetLayout {
  options: SheetOptions;
  markers: Marker[];
  /** preguntas[q][o] → burbuja de la pregunta q (0-based), opción o (0 = A). */
  preguntas: Bubble[][];
  /** version[v] → burbuja de la versión v (0 = A). */
  version: Bubble[];
  /** id[d][n] → burbuja del dígito en la posición d con valor n (0–9). */
  id: Bubble[][];
  formatCode: Cell[];
  // --- Solo para dibujar ---
  headerBox: { rect: Rect; rows: { y: number; h: number; cells: { label: string; x: number; labelW: number; w: number }[] }[] };
  textos: TextItem[];
  /** Casillas para escribir a mano cada dígito del ID. */
  idBoxes: Rect[];
}

// ---------------------------------------------------------------------------
// Marco común. Medido sobre la hoja de 20 preguntas de referencia y convertido
// a mm (1 px de la referencia = 0.515 mm; la referencia se centra en la hoja).
// ---------------------------------------------------------------------------
const S = 0.515;
const OX = 19.9 - 27 * S;
const OY = 26.65 - 47 * S;
const px = (x: number) => OX + x * S;
const py = (y: number) => OY + y * S;

const MARKER_SIZE = 16 * S;
export const MARKER_X = [px(34.5), px(360.5)] as const;
export const MARKER_Y = [py(54.5), py(288), py(477.5)] as const;

function markers(): Marker[] {
  const out: Marker[] = [];
  for (const cy of MARKER_Y) for (const cx of MARKER_X) out.push({ cx, cy, size: MARKER_SIZE });
  return out; // orden: sup-izq, sup-der, med-izq, med-der, inf-izq, inf-der
}

const FOOTER_Y = py(477.5);
const CODE_CELL = 3.1;

function formatCodeCells(o: SheetOptions, x0: number): Cell[] {
  const bits = encodeFormatCode(o);
  const cells: Cell[] = [];
  const y0 = FOOTER_Y - (FORMAT_CODE_ROWS * CODE_CELL) / 2;
  for (let r = 0; r < FORMAT_CODE_ROWS; r++)
    for (let c = 0; c < FORMAT_CODE_COLS; c++)
      cells.push({ x: x0 + c * CODE_CELL, y: y0 + r * CODE_CELL, size: CODE_CELL, on: bits[r * FORMAT_CODE_COLS + c] === 1 });
  return cells;
}

export const FORMAT_CODE_X = px(224);
export const FORMAT_CODE_CELL = CODE_CELL;

function footerTexts(o: SheetOptions): TextItem[] {
  const opc = o.opciones === 5 ? 'A–E' : 'A–D';
  const detalle = o.formato === 20 ? `${o.formato} preguntas · ${opc}` : `${o.formato} preguntas · ${opc} · ID ${o.idDigitos}`;
  return [
    { text: 'Hoja de respuestas', x: px(56), y: FOOTER_Y - 1.6, size: 7 },
    { text: 'CalificaYa', x: px(56), y: FOOTER_Y + 3.4, size: 15, bold: true },
    { text: detalle, x: FORMAT_CODE_X + FORMAT_CODE_COLS * CODE_CELL + 3, y: FOOTER_Y - 0.6, size: 6.5 },
    { text: 'Usa lápiz o pluma oscura', x: FORMAT_CODE_X + FORMAT_CODE_COLS * CODE_CELL + 3, y: FOOTER_Y + 2.4, size: 6.5 },
  ];
}

// ---------------------------------------------------------------------------
// Hoja de 20 preguntas: misma distribución que la referencia (2 columnas de 10,
// versión abajo, encabezado Nombre / Fecha / Grupo). No lleva bloque de ID.
// ---------------------------------------------------------------------------
function layout20(o: SheetOptions): SheetLayout {
  const r = 9.2 * S;
  const colX = [129.6, 288.5];
  const pitchX = 21.62;
  const rowY0 = 172.6;
  const pitchY = 28.97;
  const preguntas: Bubble[][] = [];
  const textos: TextItem[] = [];
  for (let q = 0; q < 20; q++) {
    const col = Math.floor(q / 10);
    const row = q % 10;
    const cy = py(rowY0 + row * pitchY);
    const fila: Bubble[] = [];
    for (let k = 0; k < o.opciones; k++) fila.push({ cx: px(colX[col] + (k - 2) * pitchX), cy, r });
    preguntas.push(fila);
    textos.push({ text: String(q + 1), x: px(col === 0 ? 67 : 225), y: cy + 3.4, size: 26, bold: true, align: 'right' });
  }
  for (let col = 0; col < 2; col++)
    for (let k = 0; k < o.opciones; k++)
      textos.push({ text: LETRAS[k], x: px(colX[col] + (k - 2) * pitchX), y: py(157), size: 28, align: 'center', color: 60 });

  const version: Bubble[] = [181.4, 213.6, 245.8, 278.3].map((x) => ({ cx: px(x), cy: py(457.6), r: 8.6 * S }));
  textos.push({ text: 'Versión', x: px(160), y: py(456) , size: 8, align: 'right' });
  textos.push({ text: 'del examen:', x: px(160), y: py(463), size: 8, align: 'right' });
  version.forEach((b, i) => textos.push({ text: VERSIONES[i], x: b.cx - b.r - 0.8, y: b.cy + 2.2, size: 15, align: 'right', color: 110 }));

  const top = py(49);
  const mid = py(84.5);
  const bottom = py(118.5);
  return {
    options: o,
    markers: markers(),
    preguntas,
    version,
    id: [],
    formatCode: formatCodeCells(o, FORMAT_CODE_X),
    headerBox: {
      rect: { x: px(56), y: top, w: px(340.5) - px(56), h: bottom - top },
      rows: [
        { y: top, h: mid - top, cells: [{ label: 'Nombre', x: px(56), labelW: (116 - 56) * S, w: px(340.5) - px(56) }] },
        {
          y: mid,
          h: bottom - mid,
          cells: [
            { label: 'Fecha', x: px(56), labelW: (116 - 56) * S, w: (214 - 56) * S },
            { label: 'Grupo', x: px(214), labelW: (274 - 214) * S, w: px(340.5) - px(214) },
          ],
        },
      ],
    },
    textos: [...textos, ...footerTexts(o)],
    idBoxes: [],
  };
}

// ---------------------------------------------------------------------------
// Hojas de 50 y 100 preguntas: mismo marco y estilo, con encabezado a la
// izquierda, bloque de código de alumno a la derecha y 25 filas de preguntas.
// ---------------------------------------------------------------------------
const CONTENT_L = px(56);
const CONTENT_R = px(340.5);

function idBlock(o: SheetOptions, textos: TextItem[]) {
  const n = o.idDigitos;
  const pitchX = n <= 9 ? 5.2 : n <= 11 ? 4.4 : 3.6;
  const pitchY = 4.75;
  const r = Math.min(1.95, pitchX / 2 - 0.35);
  const lastX = CONTENT_R - 2.2;
  const firstX = lastX - (n - 1) * pitchX;
  const boxY = 31.5;
  const rowY0 = boxY + 9.6;
  const id: Bubble[][] = [];
  const idBoxes: Rect[] = [];
  for (let d = 0; d < n; d++) {
    const cx = firstX + d * pitchX;
    idBoxes.push({ x: cx - pitchX / 2 + 0.3, y: boxY, w: pitchX - 0.6, h: 5.6 });
    const col: Bubble[] = [];
    for (let v = 0; v < 10; v++) col.push({ cx, cy: rowY0 + v * pitchY, r });
    id.push(col);
  }
  for (let v = 0; v < 10; v++)
    textos.push({ text: String(v), x: firstX - pitchX / 2 - 1, y: rowY0 + v * pitchY + 1.1, size: 8, align: 'right', color: 90 });
  textos.push({ text: 'CÓDIGO DE ALUMNO', x: (firstX + lastX) / 2, y: boxY - 1.6, size: 8, bold: true, align: 'center' });
  return { id, idBoxes, left: firstX - pitchX / 2 - 4 };
}

function layoutLarge(o: SheetOptions): SheetLayout {
  const textos: TextItem[] = [];
  const { id, idBoxes, left: idLeft } = idBlock(o, textos);

  // Encabezado (Nombre / Fecha + Grupo)
  const hx = CONTENT_L;
  const hw = idLeft - 3 - hx;
  const top = py(49);
  const rowH = 11.5;
  const labelW = 17;
  const headerBox = {
    rect: { x: hx, y: top, w: hw, h: rowH * 2 },
    rows: [
      { y: top, h: rowH, cells: [{ label: 'Nombre', x: hx, labelW, w: hw }] },
      {
        y: top + rowH,
        h: rowH,
        cells: [
          { label: 'Fecha', x: hx, labelW, w: hw * 0.55 },
          { label: 'Grupo', x: hx + hw * 0.55, labelW: 15, w: hw * 0.45 },
        ],
      },
    ],
  };

  // Versión
  const vy = top + rowH * 2 + 9;
  const version: Bubble[] = VERSIONES.map((_, i) => ({ cx: hx + 42 + i * 11, cy: vy, r: 2.4 }));
  textos.push({ text: 'Versión del examen:', x: hx, y: vy + 1.2, size: 8.5, bold: true });
  version.forEach((b, i) => textos.push({ text: VERSIONES[i], x: b.cx - b.r - 0.8, y: b.cy + 1.6, size: 10, align: 'right', color: 110 }));

  // Instrucciones
  textos.push({ text: 'Rellena por completo una sola burbuja por pregunta.', x: hx, y: vy + 9, size: 7.5 });
  textos.push({ text: 'Escribe tu código y rellena el dígito debajo de cada casilla.', x: hx, y: vy + 13, size: 7.5 });
  textos.push({ text: 'No uses palomitas ni cruces; si te equivocas, borra bien.', x: hx, y: vy + 17, size: 7.5 });

  // Preguntas: 25 filas, 2 columnas (50) o 4 columnas (100)
  const cols = o.formato === 50 ? 2 : 4;
  const rows = 25;
  const rowY0 = 98;
  const pitchY = 5.85;
  const pitchX = o.formato === 50 ? 7.6 : 5.6;
  const r = o.formato === 50 ? 2.45 : 2.15;
  const numW = o.formato === 50 ? 9 : 7.5;
  const colW = numW + (o.opciones - 1) * pitchX + 2 * r;
  const span = CONTENT_R - CONTENT_L;
  const gap = Math.min(22, (span - cols * colW) / (cols - 1 || 1));
  const startX = CONTENT_L + (span - cols * colW - (cols - 1) * gap) / 2;
  const preguntas: Bubble[][] = [];
  for (let q = 0; q < o.formato; q++) {
    const col = Math.floor(q / rows);
    const row = q % rows;
    const x0 = startX + col * (colW + gap) + numW + r;
    const cy = rowY0 + row * pitchY;
    const fila: Bubble[] = [];
    for (let k = 0; k < o.opciones; k++) fila.push({ cx: x0 + k * pitchX, cy, r });
    preguntas.push(fila);
    textos.push({ text: String(q + 1), x: x0 - r - 1.3, y: cy + 1.5, size: o.formato === 50 ? 10.5 : 9, bold: true, align: 'right' });
  }
  for (let col = 0; col < cols; col++) {
    const x0 = startX + col * (colW + gap) + numW + r;
    for (let k = 0; k < o.opciones; k++)
      textos.push({ text: LETRAS[k], x: x0 + k * pitchX, y: rowY0 - 4.6, size: 9, align: 'center', color: 60 });
  }

  return {
    options: o,
    markers: markers(),
    preguntas,
    version,
    id,
    formatCode: formatCodeCells(o, FORMAT_CODE_X),
    headerBox,
    textos: [...textos, ...footerTexts(o)],
    idBoxes,
  };
}

export function normalizeOptions(o: SheetOptions): SheetOptions {
  return {
    formato: o.formato,
    opciones: o.opciones,
    idDigitos: o.formato === 20 ? 0 : Math.max(1, Math.min(15, Math.round(o.idDigitos))),
  };
}

export function getLayout(options: SheetOptions): SheetLayout {
  const o = normalizeOptions(options);
  return o.formato === 20 ? layout20(o) : layoutLarge(o);
}

/** Todas las burbujas de una hoja, útil para validar que no se encimen. */
export function allBubbles(l: SheetLayout): Bubble[] {
  return [...l.preguntas.flat(), ...l.version, ...l.id.flat()];
}
