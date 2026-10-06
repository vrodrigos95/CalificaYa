import { describe, expect, it } from 'vitest';
import { exportarClaves, leerArchivoClaves, nombreArchivoClaves, planearImportacion } from '../src/keys/keysJson';
import { nuevaClave } from '../src/keys/model';

function clave(nombre: string) {
  const c = nuevaClave(nombre, 3, 4);
  c.versiones = { A: [{ correctas: ['A'], puntos: 1 }, { correctas: ['B', 'C'], puntos: 2 }, { correctas: ['D'], puntos: 1 }], B: [{ correctas: ['D'], puntos: 1 }, { correctas: ['C'], puntos: 1 }, { correctas: ['B'], puntos: 1 }] };
  return c;
}

describe('importar / exportar claves', () => {
  it('ida y vuelta sin perder nada', () => {
    const cs = [clave('Parcial 1'), clave('Parcial 2')];
    const json = exportarClaves(cs);
    expect(JSON.parse(json)).toMatchObject({ app: 'CalificaYa', tipo: 'claves', version: 1 });
    const leidas = leerArchivoClaves(json);
    expect(leidas.map((c) => [c.id, c.nombre, c.versiones])).toEqual(cs.map((c) => [c.id, c.nombre, c.versiones]));
  });

  it('acepta una sola clave o una lista sin envoltura', () => {
    const c = clave('Suelta');
    expect(leerArchivoClaves(JSON.stringify(c))).toHaveLength(1);
    expect(leerArchivoClaves(JSON.stringify([c, c]))).toHaveLength(2);
  });

  it('limpia datos inválidos y rechaza archivos que no son claves', () => {
    const c = clave('Sucia') as unknown as Record<string, unknown>;
    (c.versiones as Record<string, { correctas: unknown[]; puntos: unknown }[]>).A[0] = { correctas: ['A', 'Z', 3, 'A'], puntos: -5 };
    const [l] = leerArchivoClaves(JSON.stringify(c));
    expect(l.versiones.A![0]).toEqual({ correctas: ['A'], puntos: 1 });
    expect(() => leerArchivoClaves('no es json')).toThrow('JSON válido');
    expect(() => leerArchivoClaves('{"hola": 1}')).toThrow('no contiene claves');
    expect(() => leerArchivoClaves(JSON.stringify({ ...clave('X'), numPreguntas: 500 }))).toThrow('preguntas');
    expect(() => leerArchivoClaves(JSON.stringify({ ...clave('X'), versiones: {} }))).toThrow('versión');
  });

  it('nunca sobrescribe: omite idénticas y copia las que cambiaron', () => {
    const existente = clave('Parcial');
    const igual = structuredClone(existente);
    const cambiada = structuredClone(existente);
    cambiada.versiones.A![0].correctas = ['B'];
    const nueva = clave('Otra');
    const plan = planearImportacion([igual, cambiada, nueva], [existente]);
    expect(plan.omitidas).toHaveLength(1);
    expect(plan.copias).toHaveLength(1);
    expect(plan.copias[0].id).not.toBe(existente.id);
    expect(plan.copias[0].nombre).toBe('Parcial (importada)');
    expect(plan.nuevas.map((c) => c.nombre)).toEqual(['Otra']);
  });

  it('nombre de archivo', () => {
    expect(nombreArchivoClaves([clave('Parcial 1 – Álgebra')], new Date('2026-10-05T12:00:00Z'))).toBe('CalificaYa_Parcial_1_Algebra_2026-10-05.json');
  });
});
