// Lista opcional de alumnos para una sesión (código → nombre), leída de un Excel
// o CSV. Vive solo en memoria junto con la sesión; nunca se guarda.
import type ExcelJSNS from 'exceljs';

export interface ListaAlumnos {
  alumnos: Map<string, string>;
  advertencias: string[];
}

const quitarAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const ES_CODIGO = /^(c[oó]digo|codigo|clave|id|matr[ií]cula|matricula|no\.? ?de ?(alumno|control)|cuenta|registro)/;
const ES_NOMBRE = /^(nombre|alumno|estudiante|apellido|ap\.?|primer|segundo|paterno|materno)/;

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

/**
 * Interpreta las filas: busca un encabezado con "código" y "nombre" (o apellidos).
 * Sin encabezado reconocible, toma la primera columna con números como código y
 * junta las demás columnas de texto como nombre.
 */
export function interpretarFilas(filas: string[][]): ListaAlumnos {
  const advertencias: string[] = [];
  const alumnos = new Map<string, string>();
  if (!filas.length) return { alumnos, advertencias: ['El archivo está vacío.'] };

  let inicio = 0;
  let colCodigo = -1;
  let colsNombre: number[] = [];
  const idxEnc = filas.slice(0, 10).findIndex((f) => f.some((c) => ES_CODIGO.test(quitarAcentos(c))));
  if (idxEnc >= 0) {
    const enc = filas[idxEnc].map(quitarAcentos);
    colCodigo = enc.findIndex((c) => ES_CODIGO.test(c));
    colsNombre = enc.map((c, i) => (i !== colCodigo && ES_NOMBRE.test(c) ? i : -1)).filter((i) => i >= 0);
    inicio = idxEnc + 1;
  }
  if (colCodigo < 0 || colsNombre.length === 0) {
    const muestra = filas.slice(inicio, inicio + 20);
    const ncols = Math.max(...muestra.map((f) => f.length));
    const numerica = (i: number) => muestra.filter((f) => /^\d[\d\s-]*(\.0+)?$/.test(f[i] ?? '')).length >= muestra.length * 0.6;
    if (colCodigo < 0) colCodigo = Array.from({ length: ncols }, (_, i) => i).find(numerica) ?? 0;
    if (!colsNombre.length)
      colsNombre = Array.from({ length: ncols }, (_, i) => i).filter((i) => i !== colCodigo && muestra.some((f) => /[a-záéíóúñ]/i.test(f[i] ?? '')));
    if (idxEnc < 0 && filas[0] && !/\d/.test(filas[0][colCodigo] ?? '')) inicio = 1; // encabezado no reconocido
  }

  let sinCodigo = 0, repetidos = 0;
  for (const f of filas.slice(inicio)) {
    const codigo = normalizarCodigo(f[colCodigo] ?? '');
    const nombre = colsNombre.map((i) => f[i] ?? '').filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (!codigo) { if (nombre) sinCodigo++; continue; }
    if (alumnos.has(codigo)) repetidos++;
    alumnos.set(codigo, nombre);
  }
  if (!alumnos.size) advertencias.push('No se encontraron alumnos. La primera columna debe tener el código y la segunda el nombre.');
  if (sinCodigo) advertencias.push(`${sinCodigo} fila(s) sin código se ignoraron.`);
  if (repetidos) advertencias.push(`${repetidos} código(s) repetido(s) en la lista: se usó el último.`);
  if (colsNombre.length === 0 && alumnos.size) advertencias.push('No se encontró la columna de nombres.');
  return { alumnos, advertencias };
}

export async function leerListaAlumnos(archivo: { name: string; arrayBuffer: () => Promise<ArrayBuffer> }): Promise<ListaAlumnos> {
  const nombre = archivo.name.toLowerCase();
  const datos = await archivo.arrayBuffer();
  if (nombre.endsWith('.xls')) return { alumnos: new Map(), advertencias: ['El formato .xls antiguo no es compatible. Guarda el archivo como .xlsx o .csv.'] };
  if (nombre.endsWith('.xlsx')) return interpretarFilas(await filasDeExcel(datos));
  let texto = new TextDecoder('utf-8').decode(datos);
  if (texto.includes('�')) texto = new TextDecoder('windows-1252').decode(datos); // CSV de Excel en Windows
  return interpretarFilas(parsearCSV(texto));
}

/**
 * Busca al alumno de un código leído. Si no hay coincidencia exacta, acepta un
 * código más corto que coincida con el final de un único código de la lista
 * (p. ej. la hoja de 50 solo trae 5 dígitos).
 */
export function buscarAlumno(codigo: string, alumnos: Map<string, string> | null | undefined): { codigo: string; nombre: string } | null {
  if (!alumnos?.size || !codigo || codigo.includes('?')) return null;
  const c = normalizarCodigo(codigo);
  if (alumnos.has(c)) return { codigo: c, nombre: alumnos.get(c)! };
  const sinCeros = c.replace(/^0+/, '');
  for (const [k, v] of alumnos) if (k.replace(/^0+/, '') === sinCeros) return { codigo: k, nombre: v };
  if (c.length >= 4) {
    const coinciden = [...alumnos.keys()].filter((k) => k.length > c.length && k.endsWith(c));
    if (coinciden.length === 1) return { codigo: coinciden[0], nombre: alumnos.get(coinciden[0])! };
  }
  return null;
}
