// IndexedDB: SOLO claves de examen y estado de la licencia.
// Nada de alumnos, respuestas, calificaciones ni imágenes se guarda aquí.
import Dexie, { type EntityTable } from 'dexie';
import type { ClaveExamen } from '../keys/model';

export interface EstadoLicencia {
  id: 'actual';
  codigo: string;
  activadaEn: string;
  ultimaVerificacion: string;
  /** Periodo de gracia ya usado (fecha de ultimaVerificacion para la que se usó). */
  graciaUsadaPara?: string;
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
