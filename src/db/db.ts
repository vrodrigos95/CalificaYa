// IndexedDB: SOLO claves de examen y estado de la licencia.
// Nada de alumnos, respuestas, calificaciones ni imágenes se guarda aquí.
import Dexie, { type EntityTable } from 'dexie';
import type { ClaveExamen } from '../keys/model';

export interface EstadoLicencia {
  id: 'actual';
  codigo: string;
  activadaEn: string;
  /** Última verificación VÁLIDA con el servidor (ISO). */
  ultimaVerificacion: string;
  /** 'app' = CalificaYa suelta, 'pase' = Pase Maestro. */
  tipo?: 'app' | 'pase';
  /** Pase cancelado: último día pagado (AAAA-MM-DD). */
  vigenteHasta?: string | null;
  dispositivosUsados?: number;
}

export class CalificaYaDB extends Dexie {
  claves!: EntityTable<ClaveExamen, 'id'>;
  licencia!: EntityTable<EstadoLicencia, 'id'>;

  constructor() {
    super('calificaya');
    this.version(1).stores({
      claves: 'id, nombre, modificada',
      licencia: 'id',
    });
  }
}

export const db = new CalificaYaDB();
