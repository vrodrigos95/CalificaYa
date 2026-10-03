import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { nuevaClave } from '../src/keys/model';
import type { MarkRead } from '../src/omr/classify';
import { haySinExportar, useSesion, type LecturaSesion } from '../src/session/sessionStore';

const fila = (o: number | null): MarkRead => ({ marcadas: o === null ? [] : [o], estado: o === null ? 'blanco' : 'ok', scores: [] });

function lectura(codigo: string, respuestas: (number | null)[]): LecturaSesion {
  return {
    ok: true, formato: 50, rotacion: 0, confianza: 1, errorMarcadores: 0, marcadores: [],
    calibracion: { vacia: 0, llena: 1, umbral: 0.4, tenue: 0.2 },
    preguntas: respuestas.map(fila),
    version: fila(0),
    id: { digitos: [], texto: codigo, completo: codigo.length > 0 },
  };
}

const clave = nuevaClave('Parcial', 3, 5);
clave.versiones.A = [{ correctas: ['A'], puntos: 1 }, { correctas: ['B'], puntos: 1 }, { correctas: ['C'], puntos: 2 }];

beforeEach(() => useSesion.getState().cerrar());

describe('sesión en memoria', () => {
  it('califica cada hoja al agregarla y lleva el contador', () => {
    const s = useSesion.getState();
    s.iniciar(clave);
    const { hoja } = useSesion.getState().agregarHoja(lectura('111', [0, 1, 2]), null);
    expect(hoja.numero).toBe(1);
    expect(hoja.resultado).toMatchObject({ aciertos: 3, puntos: 4, calificacion100: 100 });
    const { hoja: h2 } = useSesion.getState().agregarHoja(lectura('222', [0, null, 3]), null);
    expect(h2).toMatchObject({ numero: 2, resultado: { aciertos: 1, blancos: 1, errores: 1, calificacion100: 25 } });
    expect(useSesion.getState().sesion!.hojas).toHaveLength(2);
  });

  it('avisa si el código ya se escaneó', () => {
    useSesion.getState().iniciar(clave);
    useSesion.getState().agregarHoja(lectura('123', [0, 1, 2]), null);
    const { duplicada } = useSesion.getState().agregarHoja(lectura('123', [1, 1, 2]), null);
    expect(duplicada?.numero).toBe(1);
    // Un código incompleto ("?") no cuenta como repetido
    const { duplicada: d2 } = useSesion.getState().agregarHoja(lectura('', [1, 1, 2]), null);
    expect(d2).toBeNull();
  });

  it('marca pendientes de exportar y los limpia al exportar o cerrar', () => {
    useSesion.getState().iniciar(clave);
    expect(haySinExportar(useSesion.getState().sesion)).toBe(false);
    useSesion.getState().agregarHoja(lectura('1', [0, 1, 2]), null);
    expect(haySinExportar(useSesion.getState().sesion)).toBe(true);
    useSesion.getState().marcarExportada();
    expect(haySinExportar(useSesion.getState().sesion)).toBe(false);
  });

  it('al cerrar libera las miniaturas y no deja nada en el dispositivo', async () => {
    useSesion.getState().iniciar(clave);
    const { hoja } = useSesion.getState().agregarHoja(lectura('1', [0, 1, 2]), new Blob([new Uint8Array(10)], { type: 'image/jpeg' }));
    expect(hoja.miniatura).toMatch(/^blob:/);
    useSesion.getState().cerrar();
    expect(useSesion.getState().sesion).toBeNull();
    // La URL ya no resuelve (fue revocada)
    await expect(fetch(hoja.miniatura!)).rejects.toThrow();
    // IndexedDB solo tiene claves y licencia; la sesión nunca se escribe ahí
    expect(db.tables.map((t) => t.name).sort()).toEqual(['claves', 'licencia']);
    expect(await db.claves.count()).toBe(0);
  });
});
