// Importar / exportar claves como archivo JSON (cambiar de dispositivo o
// compartirlas con otro docente). Solo contiene claves: nada de alumnos.
import { APP_NAME } from '../config';
import { LETRAS, VERSIONES } from '../layout/sheetLayout';
import { MAX_PREGUNTAS, nuevaClave, type ClaveExamen, type Opcion, type Reactivo } from './model';

export interface ArchivoClaves {
  app: typeof APP_NAME;
  tipo: 'claves';
  version: 1;
  exportado: string;
  claves: ClaveExamen[];
}

export function exportarClaves(claves: ClaveExamen[], fecha = new Date()): string {
  const datos: ArchivoClaves = { app: APP_NAME, tipo: 'claves', version: 1, exportado: fecha.toISOString(), claves };
  return JSON.stringify(datos, null, 2);
}

export function nombreArchivoClaves(claves: ClaveExamen[], fecha = new Date()): string {
  const base = claves.length === 1 ? claves[0].nombre : `${claves.length}_claves`;
  const limpio = base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'claves';
  return `CalificaYa_${limpio}_${fecha.toISOString().slice(0, 10)}.json`;
}

/** Valida y limpia una clave de origen desconocido. Lanza un Error con un mensaje en español. */
function validarClaveImportada(x: unknown, i: number): ClaveExamen {
  const err = (m: string) => new Error(`Clave ${i + 1}: ${m}`);
  if (!x || typeof x !== 'object') throw err('formato inválido.');
  const o = x as Record<string, unknown>;
  const nombre = typeof o.nombre === 'string' ? o.nombre.trim().slice(0, 120) : '';
  const numPreguntas = Number(o.numPreguntas);
  const numOpciones = Number(o.numOpciones);
  if (!Number.isInteger(numPreguntas) || numPreguntas < 1 || numPreguntas > MAX_PREGUNTAS) throw err('número de preguntas inválido.');
  if (numOpciones !== 4 && numOpciones !== 5) throw err('el número de opciones debe ser 4 o 5.');
  const validas = LETRAS.slice(0, numOpciones) as readonly string[];
  const c = nuevaClave(nombre || `Clave importada ${i + 1}`, numPreguntas, numOpciones);
  c.escala = Number(o.escala) === 10 ? 10 : 100;
  if (typeof o.id === 'string' && /^[\w-]{1,64}$/.test(o.id)) c.id = o.id;
  if (typeof o.creada === 'string' && !Number.isNaN(Date.parse(o.creada))) c.creada = o.creada;
  const vs = o.versiones && typeof o.versiones === 'object' ? (o.versiones as Record<string, unknown>) : {};
  c.versiones = {};
  for (const v of VERSIONES) {
    const rs = vs[v];
    if (rs === undefined) continue;
    if (!Array.isArray(rs)) throw err(`la versión ${v} no es una lista.`);
    c.versiones[v] = Array.from({ length: numPreguntas }, (_, q): Reactivo => {
      const r = (rs[q] ?? {}) as Record<string, unknown>;
      const correctas = Array.isArray(r.correctas) ? [...new Set(r.correctas.filter((l): l is Opcion => typeof l === 'string' && validas.includes(l)))].sort() : [];
      const puntos = Number(r.puntos);
      return { correctas, puntos: Number.isFinite(puntos) && puntos >= 0 && puntos <= 1000 ? puntos : 1 };
    });
  }
  if (!Object.keys(c.versiones).length) throw err('no tiene ninguna versión (A–D).');
  return c;
}

/** Lee un archivo de claves. Acepta el archivo completo, una lista o una sola clave. */
export function leerArchivoClaves(texto: string): ClaveExamen[] {
  let datos: unknown;
  try {
    datos = JSON.parse(texto.replace(/^﻿/, ''));
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const lista = Array.isArray(datos) ? datos
    : datos && typeof datos === 'object' && Array.isArray((datos as ArchivoClaves).claves) ? (datos as ArchivoClaves).claves
    : datos && typeof datos === 'object' && 'versiones' in (datos as object) ? [datos]
    : null;
  if (!lista) throw new Error('El archivo no contiene claves de CalificaYa.');
  if (lista.length > 500) throw new Error('El archivo tiene demasiadas claves.');
  return lista.map(validarClaveImportada);
}

const firma = (c: ClaveExamen) => JSON.stringify([c.nombre, c.numPreguntas, c.numOpciones, c.escala, c.versiones]);

export interface PlanImportacion {
  nuevas: ClaveExamen[];
  /** Ya existen idénticas: se omiten. */
  omitidas: ClaveExamen[];
  /** Mismo id pero contenido distinto: se importan como copia con id nuevo. */
  copias: ClaveExamen[];
}

/** Decide qué hacer con cada clave importada sin sobrescribir nunca una existente. */
export function planearImportacion(importadas: ClaveExamen[], existentes: ClaveExamen[]): PlanImportacion {
  const porId = new Map(existentes.map((c) => [c.id, c]));
  const firmas = new Set(existentes.map(firma));
  const plan: PlanImportacion = { nuevas: [], omitidas: [], copias: [] };
  for (const c of importadas) {
    if (firmas.has(firma(c))) plan.omitidas.push(c);
    else if (porId.has(c.id)) {
      const copia = { ...nuevaClave(), ...c, id: nuevaClave().id, nombre: `${c.nombre} (importada)` };
      plan.copias.push(copia);
    } else plan.nuevas.push(c);
    firmas.add(firma(c));
  }
  return plan;
}
