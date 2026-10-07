// Lo que el alumno escribe a mano en los recuadros de la hoja (Nombre/Name,
// Fecha/Date, Grupo/Period): dónde están, cómo recortarlos y cómo comparar el
// texto leído (OCR, con errores) contra la lista de alumnos.
//
// El OCR de letra manuscrita se equivoca seguido, así que nada se asigna solo:
// la app propone al alumno más parecido y el docente lo confirma.

import type { SheetLayout, Rect } from '../layout/sheetLayout';
import type { GrayImage } from '../omr/reader';
import type { Alumno } from '../session/alumnos';

export type Campo = 'nombre' | 'fecha' | 'grupo';
export interface Zona { campo: Campo; rect: Rect }
export type TextoManuscrito = Partial<Record<Campo, string>>;

const CAMPOS: Record<string, Campo> = { nombre: 'nombre', fecha: 'fecha', grupo: 'grupo' };

/** Recuadros donde el alumno escribe (sin la etiqueta impresa), en mm. */
export function zonasManuscritas(l: SheetLayout): Zona[] {
  const zonas: Zona[] = [];
  for (const hb of l.headers)
    for (const row of hb.rows)
      for (const cell of row.cells) {
        const campo = CAMPOS[cell.label.toLowerCase()];
        if (campo) zonas.push({ campo, rect: { x: cell.x + cell.labelW, y: row.y, w: cell.w - cell.labelW, h: row.h } });
      }
  // Hoja de 100: recuadros sueltos Nombre, Grupo, Examen.
  if (!l.headers.length) {
    const [nombre, grupo] = l.boxes;
    if (nombre) zonas.push({ campo: 'nombre', rect: nombre });
    if (grupo) zonas.push({ campo: 'grupo', rect: grupo });
  }
  return zonas;
}

/** Recorta una zona (mm) de la hoja enderezada, dejando fuera `margen` mm de borde (las líneas del recuadro). */
export function recortar(hoja: GrayImage, rect: Rect, margen = 0.8): GrayImage {
  const k = hoja.ppm;
  const x0 = Math.max(0, Math.round((rect.x + margen) * k)), y0 = Math.max(0, Math.round((rect.y + margen) * k));
  const x1 = Math.min(hoja.width, Math.round((rect.x + rect.w - margen) * k)), y1 = Math.min(hoja.height, Math.round((rect.y + rect.h - margen) * k));
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) data.set(hoja.data.subarray((y0 + y) * hoja.width + x0, (y0 + y) * hoja.width + x0 + w), y * w);
  return { data, width: w, height: h, ppm: k };
}

/**
 * Prepara un recorte para el OCR: lo agranda (Tesseract lee mejor letras de
 * ~30 px) y estira el contraste para que el papel quede blanco y el trazo negro.
 */
export function prepararParaOCR(img: GrayImage, escala = 2): GrayImage {
  const hist = new Array(256).fill(0);
  for (const v of img.data) hist[v]++;
  const pct = (p: number) => { let n = 0; for (let v = 0; v < 256; v++) { n += hist[v]; if (n >= p * img.data.length) return v; } return 255; };
  const negro = pct(0.02), papel = pct(0.6);
  const rango = Math.max(1, papel - negro);
  const W = img.width * escala, H = img.height * escala;
  const data = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = img.data[Math.floor(y / escala) * img.width + Math.floor(x / escala)];
      data[y * W + x] = Math.max(0, Math.min(255, Math.round(((v - negro) / rango) * 255)));
    }
  return { data, width: W, height: H, ppm: img.ppm * escala };
}

/** ¿El recuadro tiene algo escrito? (evita correr el OCR sobre recuadros vacíos). */
export function tieneEscritura(img: GrayImage): boolean {
  let papel = 0;
  for (const v of img.data) papel += v;
  papel /= img.data.length;
  let tinta = 0;
  for (const v of img.data) if (v < papel * 0.6) tinta++;
  return tinta / img.data.length > 0.004;
}

// ---------------------------------------------------------------------------
// Comparación con la lista
// ---------------------------------------------------------------------------
const quitarAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Palabras impresas en las hojas (CalificaYa y ZipGrade) que el OCR puede leer junto con lo escrito. */
const IMPRESAS = new Set(['nombre', 'name', 'fecha', 'date', 'grupo', 'period', 'periodo', 'examen', 'quiz', 'class', 'clase']);

function palabras(s: string): string[] {
  return quitarAcentos(s).replace(/[^a-z0-9ñ]+/g, ' ').split(' ').filter((p) => p && !IMPRESAS.has(p));
}

function distancia(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = t;
    }
  }
  return prev[b.length];
}

/** Parecido entre una palabra leída y una del nombre (0–1). Acepta abreviaturas ("Glz" no, "Gonz" sí). */
function parecido(leida: string, nombre: string): number {
  if (leida === nombre) return 1;
  if (leida.length >= 3 && nombre.startsWith(leida)) return 0.85;
  return 1 - distancia(leida, nombre) / Math.max(leida.length, nombre.length);
}

export interface Sugerencia { alumno: Alumno; puntaje: number; motivo: 'numero' | 'codigo' | 'nombre' }

/**
 * Alumnos de la lista que se parecen a lo escrito, del más al menos probable.
 * - Número de lista: solo un número escrito en el recuadro del nombre (en la
 *   fecha o el grupo los números son otra cosa).
 * - Código: un número de 4+ cifras en cualquier recuadro.
 * - Nombre: cada palabra del alumno (nombre y apellidos) se compara con las
 *   palabras leídas, tolerando letras mal leídas.
 */
export function sugerirAlumnos(texto: TextoManuscrito, alumnos: Alumno[] | null | undefined, max = 3): Sugerencia[] {
  if (!alumnos?.length) return [];
  const delNombre = palabras(texto.nombre ?? '');
  const todas = [...delNombre, ...palabras(texto.grupo ?? ''), ...palabras(texto.fecha ?? '')];
  const numerosNombre = delNombre.filter((p) => /^\d+$/.test(p)).map((p) => p.replace(/^0+(?=\d)/, ''));
  const codigos = todas.filter((p) => /^\d{4,}$/.test(p));
  const letras = todas.filter((p) => /^[a-zñ]{2,}$/.test(p));

  const out: Sugerencia[] = [];
  for (const a of alumnos) {
    if (a.codigo && codigos.some((c) => a.codigo === c || (c.length >= 4 && a.codigo.endsWith(c)))) { out.push({ alumno: a, puntaje: 3, motivo: 'codigo' }); continue; }
    if (a.lista && numerosNombre.includes(a.lista)) { out.push({ alumno: a, puntaje: 2.5, motivo: 'numero' }); continue; }
    let puntaje = 0;
    for (const n of palabras(a.completo).filter((p) => p.length >= 2 && !/\d/.test(p))) {
      const mejor = Math.max(0, ...letras.map((l) => parecido(l, n)));
      if (mejor >= (n.length >= 6 ? 0.6 : 0.7)) puntaje += mejor;
    }
    if (puntaje >= 0.7) out.push({ alumno: a, puntaje, motivo: 'nombre' });
  }
  return out.sort((x, y) => y.puntaje - x.puntaje).slice(0, max);
}
