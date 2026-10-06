// Exportación de la sesión a Excel (.xlsx) con ExcelJS.
//
// Hojas: Resultados · Respuestas · Análisis por reactivo · Clave.
// Las calificaciones, porcentajes, conteos y estadísticas son FÓRMULAS (con su
// valor ya calculado guardado, para que se vean igual en vistas previas y en
// Google Sheets). Aciertos, errores, en blanco y puntos son valores calculados
// por la app, porque dependen de reglas (varias correctas, dobles marcas,
// puntos por pregunta) que no conviene reproducir con fórmulas.

import type ExcelJSNS from 'exceljs';
import JSZip from 'jszip';
import { APP_NAME } from '../config';
import { VERSIONES } from '../layout/sheetLayout';
import { buscarAlumno, type Alumno } from '../session/alumnos';
import type { HojaSesion, Sesion } from '../session/sessionStore';

type ExcelJS = typeof ExcelJSNS;
type Worksheet = ExcelJSNS.Worksheet;

export interface OpcionesExcel {
  /** Lista opcional de alumnos de la sesión. */
  nombres?: Alumno[];
  fecha?: Date;
}

const AZUL = 'FF1D4ED8';
const VERDE = { fill: 'FFC6EFCE', font: 'FF006100' };
const ROJO = { fill: 'FFFFC7CE', font: 'FF9C0006' };
const GRIS = { fill: 'FFE7E6E6', font: 'FF595959' };

const dos = (n: number) => String(n).padStart(2, '0');

export function nombreArchivo(examen: string, fecha = new Date()): string {
  const limpio = examen.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'Examen';
  const f = `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}_${dos(fecha.getHours())}${dos(fecha.getMinutes())}`;
  return `${limpio}_${f}.xlsx`;
}

/** Letra de columna de Excel (1 → A, 27 → AA). */
export function col(n: number): string {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

const redondear = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const promedio = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
function mediana(v: number[]) {
  const s = [...v].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const desvP = (v: number[]) => { const m = promedio(v); return Math.sqrt(promedio(v.map((x) => (x - m) ** 2))); };

function encabezado(ws: Worksheet, titulos: string[]) {
  const fila = ws.addRow(titulos);
  fila.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = { bottom: { style: 'thin', color: { argb: 'FF1E3A8A' } } };
  });
  fila.height = 30;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function ajustarColumnas(ws: Worksheet, min = 6, max = 40) {
  ws.columns.forEach((c) => {
    let w = min;
    c.eachCell?.({ includeEmpty: false }, (cell) => {
      const v = cell.value as unknown;
      const t = v && typeof v === 'object' && 'result' in (v as object) ? String((v as { result: unknown }).result ?? '') : String(v ?? '');
      w = Math.max(w, Math.min(max, t.length + 2));
    });
    c.width = w;
  });
}

function pintar(cell: ExcelJSNS.Cell, c: { fill: string; font: string }) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.fill } };
  cell.font = { color: { argb: c.font } };
}

/** Datos a mostrar: si lo escrito en la hoja coincide con un alumno de la lista, se usan los de la lista. */
function identidad(h: HojaSesion, nombres?: Alumno[]) {
  const a = buscarAlumno(h.codigo, nombres);
  if (a) return { id: a.id, lista: a.lista, codigo: a.codigo, nombre: a.completo };
  return { id: '', lista: '', codigo: h.codigo || `Hoja ${h.numero}`, nombre: '' };
}

const numLista = (l: string) => (l ? Number(l) : Infinity);

function ordenarHojas(s: Sesion, nombres?: Alumno[]) {
  const porLista = !!nombres?.some((a) => a.lista);
  return [...s.hojas].sort((a, b) => {
    if (nombres?.length) {
      const ia = identidad(a, nombres), ib = identidad(b, nombres);
      if (porLista && numLista(ia.lista) !== numLista(ib.lista)) return numLista(ia.lista) - numLista(ib.lista);
      const na = ia.nombre || '\uffff', nb = ib.nombre || '\uffff';
      if (na !== nb) return na.localeCompare(nb, 'es');
    }
    if (!a.codigo !== !b.codigo) return a.codigo ? -1 : 1;
    return a.codigo.localeCompare(b.codigo, 'es', { numeric: true }) || a.numero - b.numero;
  });
}

export async function construirExcel(s: Sesion, o: OpcionesExcel = {}, excel?: ExcelJS): Promise<Uint8Array> {
  const ExcelJS = excel ?? ((await import('exceljs')) as unknown as { default: ExcelJS }).default;
  const { clave } = s;
  const n = clave.numPreguntas;
  const conNombre = !!o.nombres?.length;
  const conLista = !!o.nombres?.some((a) => a.lista);
  const colsAlumno = [...(conLista ? ['No. lista'] : []), 'Código', ...(conNombre ? ['Nombre'] : [])];
  const datosAlumno = (i: ReturnType<typeof identidad>) => [
    ...(conLista ? [i.lista ? Number(i.lista) : ''] : []),
    i.codigo,
    ...(conNombre ? [i.nombre] : []),
  ];
  const hojas = ordenarHojas(s, o.nombres);
  const ultimaFila = hojas.length + 1;
  const fecha = o.fecha ?? new Date();

  const wb = new ExcelJS.Workbook();
  wb.creator = APP_NAME;
  wb.lastModifiedBy = APP_NAME;
  wb.company = APP_NAME;
  wb.title = clave.nombre;
  wb.subject = `Resultados de ${clave.nombre}`;
  wb.created = fecha;
  wb.modified = fecha;
  wb.calcProperties = { fullCalcOnLoad: true };

  const versiones = VERSIONES.filter((v) => clave.versiones[v]);
  const puntosMax = (v: string | null) => (v ? clave.versiones[v as 'A']!.reduce((a, r) => a + r.puntos, 0) : 0);

  // ------------------------------------------------------------------ Resultados
  const wsR = wb.addWorksheet('Resultados');
  const titulosR = [...colsAlumno, 'Versión', 'Aciertos', 'Errores', 'En blanco', 'Puntos', 'Calificación (0–10)', 'Calificación (0–100)'];
  encabezado(wsR, titulosR);
  const cR = (t: string) => col(titulosR.indexOf(t) + 1);
  const [cVer, cPts, c10, c100] = [cR('Versión'), cR('Puntos'), cR('Calificación (0–10)'), cR('Calificación (0–100)')];
  const calificaciones: number[] = [];
  hojas.forEach((h, i) => {
    const f = i + 2;
    const r = h.resultado;
    const pm = puntosMax(r.version);
    const cal100 = r.version && pm > 0 ? redondear((r.puntos / pm) * 100) : null;
    if (cal100 !== null) calificaciones.push(cal100);
    const ident = identidad(h, o.nombres);
    const fila = wsR.addRow([
      ...datosAlumno(ident),
      r.version ?? '',
      r.aciertos,
      r.errores,
      r.blancos,
      r.puntos,
      { formula: `IF(${c100}${f}="","",ROUND(${c100}${f}/10,2))`, result: cal100 === null ? '' : redondear(cal100 / 10) },
      { formula: `IFERROR(ROUND(${cPts}${f}/SUMIF(Clave!$A:$A,${cVer}${f},Clave!$D:$D)*100,2),"")`, result: cal100 ?? '' },
    ]);
    fila.getCell(c10).numFmt = '0.00';
    fila.getCell(c100).numFmt = '0.00';
    if (!ident.id && (!h.codigo || h.codigo.includes('?'))) pintar(fila.getCell(cR('Código')), ROJO);
  });
  // Alumnos de la lista sin hoja escaneada (no presentaron)
  if (conNombre) {
    const presentes = new Set(hojas.map((h) => identidad(h, o.nombres).id));
    const faltantes = o.nombres!.filter((a) => !presentes.has(a.id))
      .sort((a, b) => (conLista && numLista(a.lista) !== numLista(b.lista) ? numLista(a.lista) - numLista(b.lista) : a.completo.localeCompare(b.completo, 'es')));
    for (const a of faltantes) {
      const fila = wsR.addRow([...datosAlumno({ id: a.id, lista: a.lista, codigo: a.codigo, nombre: a.completo }), 'No presentó']);
      fila.font = { color: { argb: 'FF808080' }, italic: true };
    }
  }
  wsR.autoFilter = { from: 'A1', to: `${col(titulosR.length)}${Math.max(1, wsR.rowCount)}` };
  ajustarColumnas(wsR, 9);

  // ------------------------------------------------------------------ Respuestas
  const wsA = wb.addWorksheet('Respuestas');
  const fijas = [...colsAlumno, 'Versión'];
  encabezado(wsA, [...fijas, ...Array.from({ length: n }, (_, q) => `P${q + 1}`)]);
  hojas.forEach((h) => {
    const ident = identidad(h, o.nombres);
    const fila = wsA.addRow([
      ...datosAlumno(ident),
      h.resultado.version ?? '',
      ...h.resultado.preguntas.map((p) => (p.marcadas.length ? p.marcadas.join(',') : null)),
    ]);
    h.resultado.preguntas.forEach((p, q) => {
      const cell = fila.getCell(fijas.length + q + 1);
      cell.alignment = { horizontal: 'center' };
      pintar(cell, p.estado === 'correcta' ? VERDE : p.estado === 'blanco' ? GRIS : ROJO);
    });
  });
  wsA.autoFilter = { from: 'A1', to: `${col(fijas.length + n)}${Math.max(1, ultimaFila)}` };
  ajustarColumnas(wsA, 5, 30);

  // --------------------------------------------------------- Análisis por reactivo
  const nombreAn = 'Análisis por reactivo';
  const wsN = wb.addWorksheet(nombreAn);
  const opciones = ['A', 'B', 'C', 'D', 'E'].slice(0, clave.numOpciones);
  const titulosN = ['Pregunta', 'Respuesta correcta', 'Aciertos', '% de aciertos', ...opciones, 'En blanco', 'Doble marca'];
  encabezado(wsN, titulosN);
  const calificadas = hojas.filter((h) => h.resultado.version);
  const rangoCal = `Resultados!$${c100}$2:$${c100}$${Math.max(2, ultimaFila)}`;
  for (let q = 0; q < n; q++) {
    const f = q + 2;
    const correctaTxt = versiones.length === 1
      ? clave.versiones[versiones[0]]![q].correctas.join(', ')
      : versiones.map((v) => `${v}: ${clave.versiones[v]![q].correctas.join(', ')}`).join(' · ');
    const aciertos = calificadas.filter((h) => h.resultado.preguntas[q].estado === 'correcta').length;
    const cResp = col(fijas.length + q + 1);
    const rango = `Respuestas!$${cResp}$2:$${cResp}$${Math.max(2, ultimaFila)}`;
    const valores = hojas.map((h) => h.resultado.preguntas[q]);
    const fila = wsN.addRow([
      q + 1,
      correctaTxt,
      aciertos,
      { formula: `IFERROR(C${f}/COUNT(${rangoCal}),0)`, result: calificadas.length ? aciertos / calificadas.length : 0 },
      ...opciones.map((op) => ({ formula: `COUNTIF(${rango},"${op}")`, result: valores.filter((p) => p.marcadas.length === 1 && p.marcadas[0] === op).length })),
      { formula: `COUNTBLANK(${rango})`, result: valores.filter((p) => p.marcadas.length === 0).length },
      { formula: `COUNTIF(${rango},"*,*")`, result: valores.filter((p) => p.marcadas.length > 1).length },
    ]);
    fila.getCell(4).numFmt = '0.0%';
    fila.eachCell((c) => (c.alignment = { horizontal: 'center' }));
  }
  const finTabla = n + 1;
  // Reactivos con menos de 40 % de aciertos en rojo (formato condicional: se actualiza solo)
  wsN.addConditionalFormatting({
    ref: `A2:${col(titulosN.length)}${finTabla}`,
    rules: [{
      type: 'expression', priority: 1, formulae: ['$D2<0.4'],
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: ROJO.fill } }, font: { color: { argb: ROJO.font }, bold: true } },
    }],
  });
  wsN.autoFilter = { from: 'A1', to: `${col(titulosN.length)}${finTabla}` };

  wsN.addRow([]);
  const tit = wsN.addRow(['Estadísticas del grupo (calificación 0–100)']);
  tit.getCell(1).font = { bold: true, size: 12 };
  const hayCal = calificaciones.length > 0;
  const stats: [string, string, number | string][] = [
    ['Hojas calificadas', `COUNT(${rangoCal})`, calificaciones.length],
    ['Promedio', `IFERROR(ROUND(AVERAGE(${rangoCal}),2),"")`, hayCal ? redondear(promedio(calificaciones)) : ''],
    ['Mediana', `IFERROR(MEDIAN(${rangoCal}),"")`, hayCal ? mediana(calificaciones) : ''],
    ['Máximo', `IF(COUNT(${rangoCal})=0,"",MAX(${rangoCal}))`, hayCal ? Math.max(...calificaciones) : ''],
    ['Mínimo', `IF(COUNT(${rangoCal})=0,"",MIN(${rangoCal}))`, hayCal ? Math.min(...calificaciones) : ''],
    ['Desviación estándar', `IFERROR(ROUND(STDEVP(${rangoCal}),2),"")`, hayCal ? redondear(desvP(calificaciones)) : ''],
  ];
  for (const [etq, formula, result] of stats) {
    const r = wsN.addRow([etq, { formula, result }]);
    r.getCell(1).font = { bold: true };
    r.getCell(2).numFmt = '0.00';
    r.getCell(2).alignment = { horizontal: 'center' };
  }
  ajustarColumnas(wsN, 8, 28);
  wsN.getColumn(1).width = 26;

  // ---------------------------------------------------------------------- Clave
  const wsC = wb.addWorksheet('Clave');
  encabezado(wsC, ['Versión', 'Pregunta', 'Respuesta(s) correcta(s)', 'Puntos']);
  for (const v of versiones)
    clave.versiones[v]!.slice(0, n).forEach((r, q) => wsC.addRow([v, q + 1, r.correctas.join(', '), r.puntos]).eachCell((c) => (c.alignment = { horizontal: 'center' })));
  ajustarColumnas(wsC, 10);
  wsC.getColumn(3).width = 24;

  const buffer = await wb.xlsx.writeBuffer();
  return fijarAplicacion(new Uint8Array(buffer as ArrayBuffer));
}

/** ExcelJS escribe "Microsoft Excel" como aplicación; se cambia a CalificaYa. */
async function fijarAplicacion(xlsx: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(xlsx);
  const app = zip.file('docProps/app.xml');
  if (app) {
    const xml = (await app.async('string')).replace(/<Application>[^<]*<\/Application>/, `<Application>${APP_NAME}</Application>`);
    zip.file('docProps/app.xml', xml);
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
