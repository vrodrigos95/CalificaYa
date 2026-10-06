// Casos límite del motor OMR y de la calificación.
import { beforeAll, describe, expect, it } from 'vitest';
import { calificar } from '../src/grading/grade';
import { nuevaClave, type ClaveExamen } from '../src/keys/model';
import type { Formato } from '../src/layout/sheetLayout';
import type { CV } from '../src/omr/cv';
import { readSheet, type ReadResult } from '../src/omr/reader';
import { loadOpenCV } from './helpers/cvNode';
import { dibujarHoja, fotografiar, llenarManual, SIN_DISTORSION, type Distorsion, type HojaLlena } from './synthetic/sheets';

let cv: CV;
beforeAll(async () => { ({ cv } = await loadOpenCV()); });

function leer(h: HojaLlena, d: Partial<Distorsion> = {}): ReadResult {
  const r = readSheet(cv, fotografiar(cv, dibujarHoja(h, 8, 3), { ...SIN_DISTORSION, ...d }));
  if (!r.ok) throw new Error(`no se leyó la hoja: ${r.motivo}`);
  return r;
}

const ciclo = (n: number) => Array.from({ length: n }, (_, q) => [q % 5]);

function claveDe(n: number, versiones: ('A' | 'B')[] = ['A']): ClaveExamen {
  const c = nuevaClave('Prueba', n, 5);
  c.versiones = {};
  for (const v of versiones) c.versiones[v] = Array.from({ length: n }, (_, q) => ({ correctas: [(['A', 'B', 'C', 'D', 'E'] as const)[q % 5]], puntos: 1 }));
  return c;
}

describe('orientación e iluminación', () => {
  it.each([20, 50, 100] as Formato[])('hoja de %i girada 180° con perspectiva', (f) => {
    const h = llenarManual(f, { respuestas: ciclo(f), id: [1, 2, 3, 4, 5, 6, 7, 8, 9], version: 2 });
    const r = leer(h, { rotacion: 180, perspectiva: 0.06 });
    expect(r.rotacion).toBe(180);
    expect(r.preguntas.map((p) => p.marcadas)).toEqual(h.respuestas);
    expect(r.version.marcadas).toEqual([2]);
    if (f !== 20) expect(r.id.texto).toBe(h.id.join(''));
  });

  it('sombra fuerte del celular e iluminación baja', () => {
    const h = llenarManual(50, { respuestas: ciclo(50), trazo: 'lapiz' });
    const r = leer(h, { sombra: 0.6, brillo: 0.65, ruido: 8 });
    expect(r.preguntas.map((p) => p.marcadas)).toEqual(h.respuestas);
  });

  it('foto de baja resolución (600 × 800)', () => {
    const h = llenarManual(100, { respuestas: ciclo(100), id: [0, 9, 8, 7, 6, 5, 4, 3, 2] });
    const r = leer(h, { ancho: 600, alto: 800, ocupacion: 0.92, desenfoque: 0.6 });
    expect(r.preguntas.map((p) => p.marcadas)).toEqual(h.respuestas);
    expect(r.id.texto).toBe('098765432');
  });
});

describe('tipos de marca', () => {
  it('lápiz tenue en toda la hoja', () => {
    const h = llenarManual(50, { respuestas: ciclo(50), trazo: 'tenue' });
    const r = leer(h, { sombra: 0.3 });
    expect(r.preguntas.map((p) => p.marcadas)).toEqual(h.respuestas);
  });

  it('burbujas a medio rellenar', () => {
    const h = llenarManual(50, { respuestas: ciclo(50), trazo: 'medio' });
    const r = leer(h);
    expect(r.preguntas.map((p) => p.marcadas)).toEqual(h.respuestas);
  });

  it('respuesta borrada junto a la nueva: toma la nueva', () => {
    const h = llenarManual(20, {
      respuestas: ciclo(20),
      extra: Array.from({ length: 20 }, (_, q) => ({ pregunta: q, opcion: (q + 2) % 5, trazo: 'borrado' as const })),
    });
    const r = leer(h);
    expect(r.preguntas.map((p) => p.marcadas)).toEqual(h.respuestas);
  });

  it('tachón (X) sobre otra opción: se señala, no se acepta como lectura limpia', () => {
    const h = llenarManual(20, { respuestas: ciclo(20), extra: [{ pregunta: 3, opcion: 0, trazo: 'tache' }] });
    const r = leer(h);
    expect(['doble', 'dudosa']).toContain(r.preguntas[3].estado);
  });

  it('dos burbujas rellenas → doble marca; ninguna → en blanco', () => {
    const resp = ciclo(20);
    resp[4] = [1, 3];
    resp[7] = [];
    const r = leer(llenarManual(20, { respuestas: resp }));
    expect(r.preguntas[4]).toMatchObject({ estado: 'doble', marcadas: [1, 3] });
    expect(r.preguntas[7]).toMatchObject({ estado: 'blanco', marcadas: [] });
  });

  it('hoja completamente en blanco', () => {
    const r = leer(llenarManual(100, { respuestas: [], version: null }));
    expect(r.preguntas.every((p) => p.estado === 'blanco')).toBe(true);
    expect(r.version.estado).toBe('blanco');
    expect(r.id.texto).toBe('');
  });
});

describe('código de alumno', () => {
  it('dígito en blanco en medio → "?"', () => {
    const r = leer(llenarManual(100, { respuestas: ciclo(100), id: [2, 1, 0, null, 5, 5, 1, 2, 3] }));
    expect(r.id.texto).toBe('210?55123');
    expect(r.id.completo).toBe(false);
  });

  it('dígito con doble marca → "?"', () => {
    const r = leer(llenarManual(100, { respuestas: ciclo(100), id: [2, 1, 0, 4, 5, 5, 1, 2, 3], idDoble: [6] }));
    expect(r.id.texto).toBe('210455?23');
    expect(r.id.digitos[6].estado).toBe('doble');
  });

  it('código más corto que la hoja (dígitos finales en blanco)', () => {
    const r = leer(llenarManual(100, { respuestas: ciclo(100), id: [1, 2, 3, 4, 5] }));
    expect(r.id).toMatchObject({ texto: '12345', completo: true });
  });
});

describe('calificación', () => {
  it('versión marcada que no existe en la clave', () => {
    const r = leer(llenarManual(50, { respuestas: ciclo(50), version: 3 }));
    const res = calificar(r, claveDe(50, ['A', 'B']));
    expect(res.version).toBeNull();
    expect(res.calificacion100).toBeNull();
    expect(res.alertas).toContainEqual({ tipo: 'version-inexistente', version: 'D' });
  });

  it('examen de 20 preguntas calificado en hoja de 50', () => {
    const resp = ciclo(50);
    const r = leer(llenarManual(50, { respuestas: resp }));
    const res = calificar(r, claveDe(20));
    expect(res.preguntas).toHaveLength(20);
    expect(res.aciertos).toBe(20);
    expect(res.calificacion100).toBe(100);
    expect(res.alertas).toContainEqual({ tipo: 'marcas-extra', desde: 21 });
  });

  it('cuenta aciertos, errores, en blanco y dobles', () => {
    const resp = ciclo(20);
    resp[0] = [1]; // incorrecta
    resp[1] = []; // en blanco
    resp[2] = [2, 3]; // doble
    const res = calificar(leer(llenarManual(20, { respuestas: resp })), claveDe(20));
    expect(res).toMatchObject({ aciertos: 17, errores: 2, blancos: 1, dobles: 1, puntos: 17, puntosMax: 20, calificacion100: 85, calificacion10: 8.5 });
  });
});

describe('rendimiento', () => {
  it('lee una hoja de 100 preguntas en menos de 1.5 s', () => {
    const img = fotografiar(cv, dibujarHoja(llenarManual(100, { respuestas: ciclo(100) }), 8), { ...SIN_DISTORSION, ancho: 1080, alto: 1440 });
    readSheet(cv, img);
    const t = performance.now();
    readSheet(cv, img);
    expect(performance.now() - t).toBeLessThan(1500);
  });
});
