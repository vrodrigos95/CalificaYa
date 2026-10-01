import { LETRAS, VERSIONES, type Formato } from '../layout/sheetLayout';

export type Opcion = (typeof LETRAS)[number];
export type Version = (typeof VERSIONES)[number];

export interface Reactivo {
  /** Una o más opciones aceptadas como correctas. Vacío = aún sin capturar. */
  correctas: Opcion[];
  puntos: number;
}

export interface ClaveExamen {
  id: string;
  esquema: 1;
  nombre: string;
  numPreguntas: number;
  numOpciones: 4 | 5;
  escala: 10 | 100;
  versiones: Partial<Record<Version, Reactivo[]>>;
  creada: string;
  modificada: string;
}

export const MAX_PREGUNTAS = 100;

export function opcionesDe(numOpciones: 4 | 5): Opcion[] {
  return LETRAS.slice(0, numOpciones) as Opcion[];
}

/** La hoja más pequeña donde cabe el examen. */
export function formatoParaClave(numPreguntas: number): Formato {
  return numPreguntas <= 20 ? 20 : numPreguntas <= 50 ? 50 : 100;
}

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function reactivosVacios(n: number): Reactivo[] {
  return Array.from({ length: n }, () => ({ correctas: [], puntos: 1 }));
}

export function nuevaClave(nombre = '', numPreguntas = 20, numOpciones: 4 | 5 = 5): ClaveExamen {
  const ahora = new Date().toISOString();
  return {
    id: uuid(),
    esquema: 1,
    nombre,
    numPreguntas,
    numOpciones,
    escala: 100,
    versiones: { A: reactivosVacios(numPreguntas) },
    creada: ahora,
    modificada: ahora,
  };
}

/** Ajusta todas las versiones a un nuevo número de preguntas u opciones. */
export function redimensionar(c: ClaveExamen, numPreguntas: number, numOpciones: 4 | 5): ClaveExamen {
  const validas = opcionesDe(numOpciones);
  const versiones: ClaveExamen['versiones'] = {};
  for (const v of VERSIONES) {
    const rs = c.versiones[v];
    if (!rs) continue;
    versiones[v] = Array.from({ length: numPreguntas }, (_, i) => {
      const r = rs[i] ?? { correctas: [], puntos: 1 };
      return { puntos: r.puntos, correctas: r.correctas.filter((o) => validas.includes(o)) };
    });
  }
  return { ...c, numPreguntas, numOpciones, versiones };
}

export function duplicarClave(c: ClaveExamen): ClaveExamen {
  const ahora = new Date().toISOString();
  return { ...structuredClone(c), id: uuid(), nombre: `${c.nombre} (copia)`, creada: ahora, modificada: ahora };
}

export function puntosMaximos(rs: Reactivo[]): number {
  return rs.reduce((s, r) => s + r.puntos, 0);
}

/** Lista de problemas que impiden usar la clave para calificar. */
export function validarClave(c: ClaveExamen): string[] {
  const errores: string[] = [];
  if (!c.nombre.trim()) errores.push('Ponle nombre al examen.');
  if (!Number.isInteger(c.numPreguntas) || c.numPreguntas < 1 || c.numPreguntas > MAX_PREGUNTAS)
    errores.push(`El número de preguntas debe estar entre 1 y ${MAX_PREGUNTAS}.`);
  const versiones = VERSIONES.filter((v) => c.versiones[v]);
  if (versiones.length === 0) errores.push('La clave necesita al menos una versión.');
  for (const v of versiones) {
    const rs = c.versiones[v]!;
    const sinRespuesta = rs.map((r, i) => (r.correctas.length === 0 ? i + 1 : 0)).filter(Boolean);
    if (sinRespuesta.length)
      errores.push(`Versión ${v}: faltan respuestas en ${sinRespuesta.length > 8 ? `${sinRespuesta.length} preguntas` : `pregunta(s) ${sinRespuesta.join(', ')}`}.`);
    if (rs.some((r) => !(r.puntos >= 0))) errores.push(`Versión ${v}: hay puntos inválidos.`);
    if (puntosMaximos(rs) <= 0) errores.push(`Versión ${v}: el total de puntos debe ser mayor que 0.`);
  }
  return errores;
}
