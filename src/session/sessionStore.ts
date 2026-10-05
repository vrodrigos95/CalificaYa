// Sesión de calificación. Vive SOLO en memoria (zustand sin persistencia):
// códigos, respuestas, calificaciones y miniaturas desaparecen al cerrar la
// sesión o la pestaña. Nada de esto se escribe en IndexedDB ni localStorage.
import { create } from 'zustand';
import { calificar, type Respuestas, type ResultadoHoja } from '../grading/grade';
import type { MarkRead } from '../omr/classify';
import type { ClaveExamen } from '../keys/model';
import type { ReadResult } from '../omr/reader';

/** Lectura sin la imagen completa (solo se conserva la miniatura). */
export type LecturaSesion = Omit<ReadResult, 'hoja'>;

export interface HojaSesion {
  id: string;
  /** Orden de captura (1, 2, 3…). */
  numero: number;
  lectura: LecturaSesion;
  /** URL de objeto (blob:) de la miniatura JPEG de la hoja enderezada. */
  miniatura: string | null;
  codigo: string;
  /** Respuestas con las que se califica: las leídas, más las correcciones manuales. */
  respuestas: Respuestas;
  /** Preguntas corregidas a mano (índices), y si se corrigió código o versión. */
  editadas: { preguntas: number[]; codigo: boolean; version: boolean };
  resultado: ResultadoHoja;
}

export type Fila = Pick<MarkRead, 'marcadas' | 'estado'>;

/** Estado de una fila corregida a mano según cuántas opciones quedaron marcadas. */
export function filaManual(marcadas: number[]): Fila {
  const m = [...new Set(marcadas)].sort((a, b) => a - b);
  return { marcadas: m, estado: m.length === 0 ? 'blanco' : m.length === 1 ? 'ok' : 'doble' };
}

export interface Sesion {
  clave: ClaveExamen;
  hojas: HojaSesion[];
  iniciada: Date;
  /** true si no hay cambios desde la última exportación. */
  exportada: boolean;
  /** Lista opcional de alumnos (código → nombre). Solo para esta sesión. */
  alumnos: Map<string, string> | null;
  siguiente: number;
}

interface Estado {
  sesion: Sesion | null;
  iniciar: (clave: ClaveExamen) => void;
  agregarHoja: (lectura: LecturaSesion, miniatura: Blob | null) => { hoja: HojaSesion; duplicada: HojaSesion | null };
  borrarHoja: (id: string) => void;
  /** Corrige a mano una pregunta, la versión o el código de una hoja y la recalifica. */
  corregir: (id: string, c: { pregunta?: number; marcadas?: number[]; version?: number | null; codigo?: string }) => void;
  /** Cambia la clave de la sesión (p. ej. tras corregirla) y recalifica todas las hojas. */
  actualizarClave: (clave: ClaveExamen) => void;
  marcarExportada: () => void;
  cerrar: () => void;
}

let n = 0;
const nuevoId = () => `h${Date.now().toString(36)}${(n++).toString(36)}`;

export const useSesion = create<Estado>((set, get) => ({
  sesion: null,

  iniciar: (clave) => {
    get().cerrar();
    set({ sesion: { clave, hojas: [], iniciada: new Date(), exportada: true, siguiente: 1, alumnos: null } });
  },

  agregarHoja: (lectura, miniatura) => {
    const s = get().sesion;
    if (!s) throw new Error('No hay sesión activa');
    const codigo = lectura.id.texto;
    const duplicada = codigo && lectura.id.completo ? s.hojas.find((h) => h.codigo === codigo) ?? null : null;
    const respuestas: Respuestas = {
      preguntas: lectura.preguntas.map(({ marcadas, estado }) => ({ marcadas, estado })),
      version: { marcadas: lectura.version.marcadas, estado: lectura.version.estado },
    };
    const hoja: HojaSesion = {
      id: nuevoId(),
      numero: s.siguiente,
      lectura,
      miniatura: miniatura ? URL.createObjectURL(miniatura) : null,
      codigo,
      respuestas,
      editadas: { preguntas: [], codigo: false, version: false },
      resultado: calificar(respuestas, s.clave),
    };
    set({ sesion: { ...s, hojas: [...s.hojas, hoja], exportada: false, siguiente: s.siguiente + 1 } });
    return { hoja, duplicada };
  },

  borrarHoja: (id) => {
    const s = get().sesion;
    if (!s) return;
    const h = s.hojas.find((x) => x.id === id);
    if (h?.miniatura) URL.revokeObjectURL(h.miniatura);
    set({ sesion: { ...s, hojas: s.hojas.filter((x) => x.id !== id), exportada: false } });
  },

  corregir: (id, c) => {
    const s = get().sesion;
    if (!s) return;
    const hojas = s.hojas.map((h) => {
      if (h.id !== id) return h;
      const respuestas: Respuestas = { preguntas: [...h.respuestas.preguntas], version: h.respuestas.version };
      const editadas = { ...h.editadas, preguntas: [...h.editadas.preguntas] };
      if (c.pregunta !== undefined && c.marcadas) {
        respuestas.preguntas[c.pregunta] = filaManual(c.marcadas);
        if (!editadas.preguntas.includes(c.pregunta)) editadas.preguntas.push(c.pregunta);
      }
      if (c.version !== undefined) {
        respuestas.version = filaManual(c.version === null ? [] : [c.version]);
        editadas.version = true;
      }
      let codigo = h.codigo;
      if (c.codigo !== undefined) {
        codigo = c.codigo.trim();
        editadas.codigo = true;
      }
      return { ...h, respuestas, codigo, editadas, resultado: calificar(respuestas, s.clave) };
    });
    set({ sesion: { ...s, hojas, exportada: false } });
  },

  actualizarClave: (clave) => {
    const s = get().sesion;
    if (!s) return;
    const hojas = s.hojas.map((h) => ({ ...h, resultado: calificar(h.respuestas, clave) }));
    set({ sesion: { ...s, clave, hojas, exportada: false } });
  },

  marcarExportada: () => {
    const s = get().sesion;
    if (s) set({ sesion: { ...s, exportada: true } });
  },

  cerrar: () => {
    const s = get().sesion;
    if (s) for (const h of s.hojas) if (h.miniatura) URL.revokeObjectURL(h.miniatura);
    set({ sesion: null });
  },
}));

/** Hay hojas que se perderían si se cierra la pestaña. */
export function haySinExportar(s: Sesion | null): boolean {
  return !!s && s.hojas.length > 0 && !s.exportada;
}

/** Avisos cortos de una hoja para la revisión (vacío = todo en orden). */
export function avisosHoja(h: HojaSesion, repetidos: Set<string>): string[] {
  const a: string[] = [];
  if (h.lectura.formato !== 20 && (!h.codigo || h.codigo.includes('?'))) a.push('Código incompleto');
  if (h.codigo && repetidos.has(h.codigo)) a.push('Código repetido');
  for (const al of h.resultado.alertas) {
    if (al.tipo === 'version-sin-marcar') a.push('Sin versión');
    else if (al.tipo === 'version-doble') a.push('Versión doble');
    else if (al.tipo === 'version-inexistente') a.push(`Versión ${al.version} no existe`);
    else if (al.tipo === 'marcas-extra') a.push('Marcas extra');
    else if (al.tipo === 'hoja-chica') a.push('Hoja con menos preguntas');
  }
  const dudosas = h.respuestas.preguntas.slice(0, h.resultado.preguntas.length).filter((p) => p.estado === 'dudosa').length;
  if (dudosas) a.push(`${dudosas} dudosa${dudosas > 1 ? 's' : ''}`);
  return a;
}

/** Códigos que aparecen en más de una hoja. */
export function codigosRepetidos(hojas: HojaSesion[]): Set<string> {
  const vistos = new Set<string>(), rep = new Set<string>();
  for (const h of hojas) if (h.codigo) (vistos.has(h.codigo) ? rep : vistos).add(h.codigo);
  return rep;
}
