// Lista opcional de alumnos para una sesión, leída de un Excel o CSV (por
// ejemplo, la plantilla de la app: No. de lista, Nombre, Apellidos, Código).
// Vive solo en memoria junto con la sesión; nunca se guarda.
import type ExcelJSNS from 'exceljs';

export interface Alumno {
  /** Identificador único en la lista: el código, o «#n» con el número de lista, o el nombre. */
  id: string;
  /** Número de lista ("" si no hay). */
  lista: string;
  codigo: string;
  nombre: string;
  apellidos: string;
  /** Nombre a mostrar, con las columnas en el orden del archivo. */
  completo: string;
}

export interface ListaAlumnos {
  alumnos: Alumno[];
  advertencias: string[];
}

const quitarAcentos = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const ES_CODIGO = /^(c[oó]digo|codigo|clave|id|matr[ií]cula|matricula|no\.? ?de ?(alumno|control)|cuenta|registro)/;
const ES_LISTA = /^((n[uú]m(ero)?|no|n[°º])\.?\s*(de\s*)?lista|lista|no\.?|n[°º]\.?|#|num\.?|numero|n\.?\s*l\.?)$/;
const ES_APELLIDO = /^(apellido|ap\.|paterno|materno|primer apellido|segundo apellido)/;
const ES_NOMBRE = /^(nombre|alumno|estudiante)/;

/** Parser de CSV: comillas, comas o punto y coma, BOM y saltos de línea Windows. */
export function parsearCSV(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '');
  const primera = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ';' : primera.includes('\t') && !primera.includes(',') ? '\t' : ',';
  const filas: string[][] = [];
  let fila: string[] = [], campo = '', comillas = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (comillas) {
      if (ch === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') comillas = false;
      else campo += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) { fila.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += ch;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.map((f) => f.map((c) => c.trim())).filter((f) => f.some((c) => c));
}

function textoCelda(v: ExcelJSNS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('result' in v) return String(v.result ?? '');
    if ('text' in v) return String(v.text);
    if (v instanceof Date) return v.toISOString();
  }
  return String(v);
}

export async function filasDeExcel(datos: ArrayBuffer, excel?: typeof ExcelJSNS): Promise<string[][]> {
  const ExcelJS = excel ?? ((await import('exceljs')) as unknown as { default: typeof ExcelJSNS }).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(datos);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const filas: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const f: string[] = [];
    for (let c = 1; c <= row.cellCount; c++) f.push(textoCelda(row.getCell(c).value).trim());
    if (f.some((x) => x)) filas.push(f);
  });
  return filas;
}

/** Normaliza un código: solo dígitos y letras, sin espacios ni guiones; "219000001.0" → "219000001". */
export function normalizarCodigo(c: string): string {
  return c.replace(/\.0+$/, '').replace(/[\s-]/g, '').toUpperCase();
}

const normalizarLista = (n: string) => normalizarCodigo(n).replace(/^0+(?=\d)/, '');
/** Palabras de un nombre sin acentos, mayúsculas ni signos. */
const palabras = (s: string) => quitarAcentos(s).replace(/[^a-z0-9ñ\s]/g, ' ').split(/\s+/).filter(Boolean);

/**
 * Interpreta las filas. Con encabezado reconoce las columnas de número de lista,
 * código, nombre(s) y apellidos (como en la plantilla). Sin encabezado reconocible,
 * toma la primera columna con números como código y junta las de texto como nombre.
 */
export function interpretarFilas(filas: string[][]): ListaAlumnos {
  const advertencias: string[] = [];
  const alumnos: Alumno[] = [];
  if (!filas.length) return { alumnos, advertencias: ['El archivo está vacío.'] };

  let inicio = 0;
  let colCodigo = -1, colLista = -1;
  let colsNombre: number[] = [], colsApellido: number[] = [];
  const tipo = (c: string) => (ES_CODIGO.test(c) ? 'codigo' : ES_LISTA.test(c) ? 'lista' : ES_APELLIDO.test(c) ? 'apellido' : ES_NOMBRE.test(c) ? 'nombre' : null);
  const idxEnc = filas.slice(0, 10).findIndex((f) => {
    const t = f.map((c) => tipo(quitarAcentos(c)));
    return t.includes('codigo') || ((t.includes('nombre') || t.includes('apellido')) && t.filter(Boolean).length >= 2);
  });
  if (idxEnc >= 0) {
    const enc = filas[idxEnc].map((c) => tipo(quitarAcentos(c)));
    colCodigo = enc.indexOf('codigo');
    colLista = enc.indexOf('lista');
    colsNombre = enc.map((t, i) => (t === 'nombre' ? i : -1)).filter((i) => i >= 0);
    colsApellido = enc.map((t, i) => (t === 'apellido' ? i : -1)).filter((i) => i >= 0);
    inicio = idxEnc + 1;
  }
  if (idxEnc < 0 || (colCodigo < 0 && colLista < 0) || colsNombre.length + colsApellido.length === 0) {
    const muestra = filas.slice(inicio, inicio + 20);
    const ncols = Math.max(...muestra.map((f) => f.length));
    const cols = Array.from({ length: ncols }, (_, i) => i);
    const numerica = (i: number) => muestra.filter((f) => /^\d[\d\s-]*(\.0+)?$/.test(f[i] ?? '')).length >= muestra.length * 0.6;
    if (colCodigo < 0 && colLista < 0) {
      // Solo columnas con números: una lista sin código ni número de lista se
      // identifica por el nombre (nunca se usa un apellido como código).
      const numericas = cols.filter((i) => !colsNombre.includes(i) && !colsApellido.includes(i) && numerica(i));
      // Números cortos (1, 2, 3…) = número de lista; largos = código.
      const corta = (i: number) => muestra.every((f) => (f[i] ?? '').replace(/\.0+$/, '').length <= 3);
      if (numericas.length >= 2 && corta(numericas[0])) [colLista, colCodigo] = numericas;
      else if (numericas.length && corta(numericas[0])) colLista = numericas[0];
      else if (numericas.length) colCodigo = numericas[0];
    }
    if (colsNombre.length + colsApellido.length === 0)
      colsNombre = cols.filter((i) => i !== colCodigo && i !== colLista && muestra.some((f) => /[a-záéíóúñ]/i.test(f[i] ?? '')));
    const colNum = colCodigo >= 0 ? colCodigo : colLista;
    if (idxEnc < 0 && filas[0] && (colNum < 0 || !/\d/.test(filas[0][colNum] ?? ''))) inicio = 1; // encabezado no reconocido
  }

  const unir = (f: string[], cols: number[]) => cols.map((i) => f[i] ?? '').filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const colsTodas = [...colsNombre, ...colsApellido].sort((a, b) => a - b);
  const ids = new Set<string>();
  let repetidos = 0;
  for (const f of filas.slice(inicio)) {
    const codigo = colCodigo >= 0 ? normalizarCodigo(f[colCodigo] ?? '') : '';
    const lista = colLista >= 0 ? normalizarLista(f[colLista] ?? '') : '';
    const completo = unir(f, colsTodas);
    if (!codigo && !completo) continue; // fila vacía o solo con número de lista
    const id = codigo || (lista ? `#${lista}` : `@${palabras(completo).join(' ')}`);
    if (ids.has(id)) { repetidos++; continue; }
    ids.add(id);
    alumnos.push({ id, lista, codigo, nombre: unir(f, colsNombre), apellidos: unir(f, colsApellido), completo });
  }
  if (!alumnos.length) advertencias.push('No se encontraron alumnos. Usa la plantilla o pon el código en la primera columna y el nombre en la segunda.');
  if (repetidos) advertencias.push(`${repetidos} alumno(s) repetido(s) en la lista: se usó el primero.`);
  if (colsTodas.length === 0 && alumnos.length) advertencias.push('No se encontró la columna de nombres.');
  return { alumnos, advertencias };
}

export async function leerListaAlumnos(archivo: { name: string; arrayBuffer: () => Promise<ArrayBuffer> }): Promise<ListaAlumnos> {
  const nombre = archivo.name.toLowerCase();
  const datos = await archivo.arrayBuffer();
  if (nombre.endsWith('.xls')) return { alumnos: [], advertencias: ['El formato .xls antiguo no es compatible. Guarda el archivo como .xlsx o .csv.'] };
  if (nombre.endsWith('.xlsx')) return interpretarFilas(await filasDeExcel(datos));
  let texto = new TextDecoder('utf-8').decode(datos);
  if (texto.includes('\uFFFD')) texto = new TextDecoder('windows-1252').decode(datos); // CSV de Excel en Windows
  return interpretarFilas(parsearCSV(texto));
}

export const PLANTILLA_COLUMNAS = ['No. de lista', 'Apellidos', 'Nombre(s)', 'Código'];

/** Plantilla en Excel para capturar la lista de alumnos. */
export async function plantillaAlumnos(excel?: typeof ExcelJSNS): Promise<Uint8Array> {
  const ExcelJS = excel ?? ((await import('exceljs')) as unknown as { default: typeof ExcelJSNS }).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CalificaYa';
  const ws = wb.addWorksheet('Alumnos', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: PLANTILLA_COLUMNAS[0], width: 14 },
    { header: PLANTILLA_COLUMNAS[1], width: 30 },
    { header: PLANTILLA_COLUMNAS[2], width: 26 },
    // Como texto, para que no se pierdan los ceros a la izquierda.
    { header: PLANTILLA_COLUMNAS[3], width: 18, style: { numFmt: '@' } },
  ];
  const enc = ws.getRow(1);
  enc.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  enc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  const wi = wb.addWorksheet('Instrucciones');
  wi.getColumn(1).width = 100;
  [
    'Cómo llenar la lista de alumnos',
    '',
    '1. En la hoja «Alumnos», escribe un alumno por fila. No cambies los títulos de la primera fila.',
    '2. Ninguna columna es obligatoria, pero cada alumno necesita al menos su nombre o su código.',
    '3. Guarda el archivo como .xlsx (o .csv) y cárgalo en CalificaYa en «Lista de alumnos».',
    '',
    'Al revisar cada hoja, escribe en el campo del alumno lo que el alumno puso en «Nombre»:',
    'su código, su número de lista, su nombre o sus apellidos. La app lo busca en esta lista.',
  ].forEach((t, i) => { const c = wi.getCell(i + 1, 1); c.value = t; if (i === 0) c.font = { bold: true, size: 14 }; });
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

/** Lo que se escribe en el campo del alumno para elegir a este alumno sin ambigüedad. */
export function identificador(a: Alumno): string {
  return a.codigo || a.lista || a.completo;
}

/**
 * Alumnos de la lista que coinciden con lo escrito o leído en la hoja: el código
 * (exacto, sin ceros a la izquierda o el final de un único código, p. ej. la hoja
 * de 50 solo trae 5 dígitos), el número de lista, o el nombre y/o los apellidos
 * (basta el inicio de cada palabra, sin importar acentos ni mayúsculas).
 */
export function coincidencias(texto: string, alumnos: Alumno[] | null | undefined): Alumno[] {
  if (!alumnos?.length || !texto?.trim() || texto.includes('?')) return [];
  const c = normalizarCodigo(texto);
  if (/^[0-9A-Z]+$/.test(c) && /\d/.test(c)) {
    const exacto = alumnos.filter((a) => a.codigo === c);
    if (exacto.length) return exacto;
    const sinCeros = c.replace(/^0+/, '');
    const sc = alumnos.filter((a) => a.codigo && a.codigo.replace(/^0+/, '') === sinCeros);
    if (sc.length) return sc;
    if (c.length >= 4) {
      const fin = alumnos.filter((a) => a.codigo.length > c.length && a.codigo.endsWith(c));
      if (fin.length === 1) return fin;
    }
    if (/^\d+$/.test(c)) return alumnos.filter((a) => a.lista && a.lista === normalizarLista(c));
    return [];
  }
  const buscadas = palabras(texto);
  if (!buscadas.length) return [];
  const clave = (ps: string[]) => [...ps].sort().join(' ');
  const exactos = alumnos.filter((a) => clave(palabras(a.completo)) === clave(buscadas));
  if (exactos.length) return exactos;
  return alumnos.filter((a) => {
    const ps = palabras(a.completo);
    return buscadas.every((b) => ps.some((p) => p.startsWith(b)));
  });
}

/** El alumno que corresponde a lo escrito o leído en la hoja, si es uno solo. */
export function buscarAlumno(texto: string, alumnos: Alumno[] | null | undefined): Alumno | null {
  const r = coincidencias(texto, alumnos);
  return r.length === 1 ? r[0] : null;
}
