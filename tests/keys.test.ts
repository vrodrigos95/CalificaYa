import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { borrarClave, duplicar, guardarClave, listarClaves, obtenerClave } from '../src/db/keysRepo';
import { formatoParaClave, nuevaClave, puntosMaximos, redimensionar, validarClave } from '../src/keys/model';

beforeEach(async () => {
  await db.claves.clear();
});

describe('modelo de clave', () => {
  it('una clave nueva no es válida hasta capturar respuestas', () => {
    const c = nuevaClave('Parcial 1', 3, 4);
    expect(validarClave(c).join(' ')).toContain('faltan respuestas');
    c.versiones.A = [
      { correctas: ['A'], puntos: 1 },
      { correctas: ['B', 'C'], puntos: 2 },
      { correctas: ['D'], puntos: 1 },
    ];
    expect(validarClave(c)).toEqual([]);
    expect(puntosMaximos(c.versiones.A)).toBe(4);
  });

  it('redimensionar conserva respuestas y quita opciones inexistentes', () => {
    const c = nuevaClave('X', 2, 5);
    c.versiones.A = [{ correctas: ['E'], puntos: 1 }, { correctas: ['A', 'E'], puntos: 3 }];
    c.versiones.B = [{ correctas: ['B'], puntos: 1 }, { correctas: ['C'], puntos: 1 }];
    const r = redimensionar(c, 4, 4);
    expect(r.versiones.A).toHaveLength(4);
    expect(r.versiones.A![0].correctas).toEqual([]);
    expect(r.versiones.A![1]).toEqual({ correctas: ['A'], puntos: 3 });
    expect(r.versiones.B![3]).toEqual({ correctas: [], puntos: 1 });
  });

  it('elige la hoja adecuada según el número de preguntas', () => {
    expect(formatoParaClave(15)).toBe(20);
    expect(formatoParaClave(20)).toBe(20);
    expect(formatoParaClave(37)).toBe(50);
    expect(formatoParaClave(51)).toBe(100);
  });
});

describe('repositorio de claves (IndexedDB)', () => {
  it('guarda, lista, duplica y borra', async () => {
    const c = nuevaClave('Parcial', 5, 5);
    await guardarClave(c);
    expect((await obtenerClave(c.id))?.nombre).toBe('Parcial');
    const copia = await duplicar(c.id);
    expect(copia?.nombre).toBe('Parcial (copia)');
    expect(copia?.id).not.toBe(c.id);
    expect(await listarClaves()).toHaveLength(2);
    await borrarClave(c.id);
    const restantes = await listarClaves();
    expect(restantes.map((x) => x.id)).toEqual([copia!.id]);
  });

  it('la base de datos solo tiene las tablas permitidas', () => {
    expect(db.tables.map((t) => t.name).sort()).toEqual(['claves', 'licencia']);
  });
});
