import { db } from './db';
import { duplicarClave, type ClaveExamen } from '../keys/model';

export async function listarClaves(): Promise<ClaveExamen[]> {
  return db.claves.orderBy('modificada').reverse().toArray();
}

export function obtenerClave(id: string): Promise<ClaveExamen | undefined> {
  return db.claves.get(id);
}

export async function guardarClave(c: ClaveExamen): Promise<void> {
  await db.claves.put({ ...c, modificada: new Date().toISOString() });
}

export async function duplicar(id: string): Promise<ClaveExamen | undefined> {
  const c = await db.claves.get(id);
  if (!c) return undefined;
  const copia = duplicarClave(c);
  await db.claves.put(copia);
  return copia;
}

export function borrarClave(id: string): Promise<void> {
  return db.claves.delete(id);
}
