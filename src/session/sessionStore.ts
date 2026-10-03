// Sesión de calificación. Vive SOLO en memoria (zustand sin persistencia):
// códigos, respuestas, calificaciones y miniaturas desaparecen al cerrar la
// sesión o la pestaña. Nada de esto se escribe en IndexedDB ni localStorage.
import { create } from 'zustand';
import { calificar, type ResultadoHoja } from '../grading/grade';
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
  resultado: ResultadoHoja;
}

export interface Sesion {
  clave: ClaveExamen;
  hojas: HojaSesion[];
  iniciada: Date;
  /** true si no hay cambios desde la última exportación. */
  exportada: boolean;
  siguiente: number;
}

interface Estado {
  sesion: Sesion | null;
  iniciar: (clave: ClaveExamen) => void;
  agregarHoja: (lectura: LecturaSesion, miniatura: Blob | null) => { hoja: HojaSesion; duplicada: HojaSesion | null };
  borrarHoja: (id: string) => void;
  marcarExportada: () => void;
  cerrar: () => void;
}

let n = 0;
const nuevoId = () => `h${Date.now().toString(36)}${(n++).toString(36)}`;

export const useSesion = create<Estado>((set, get) => ({
  sesion: null,

  iniciar: (clave) => {
    get().cerrar();
    set({ sesion: { clave, hojas: [], iniciada: new Date(), exportada: true, siguiente: 1 } });
  },

  agregarHoja: (lectura, miniatura) => {
    const s = get().sesion;
    if (!s) throw new Error('No hay sesión activa');
    const codigo = lectura.id.texto;
    const duplicada = codigo && lectura.id.completo ? s.hojas.find((h) => h.codigo === codigo) ?? null : null;
    const hoja: HojaSesion = {
      id: nuevoId(),
      numero: s.siguiente,
      lectura,
      miniatura: miniatura ? URL.createObjectURL(miniatura) : null,
      codigo,
      resultado: calificar(lectura, s.clave),
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
