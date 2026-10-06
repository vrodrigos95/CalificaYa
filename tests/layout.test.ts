import { describe, expect, it } from 'vitest';
import { allBubbles, FORMATOS, getLayout, ID_DIGITOS, PAGE_H, PAGE_W } from '../src/layout/sheetLayout';

describe('geometría de la hoja', () => {
  it.each(FORMATOS)('hoja de %i: número de burbujas correcto', (f) => {
    const l = getLayout(f);
    expect(l.preguntas).toHaveLength(f);
    l.preguntas.forEach((fila) => expect(fila).toHaveLength(5));
    expect(l.version).toHaveLength(f === 20 ? 4 : 5);
    expect(l.id).toHaveLength(ID_DIGITOS[f]);
    l.id.forEach((c) => expect(c).toHaveLength(10));
    expect(l.markers).toHaveLength(6);
  });

  it.each(FORMATOS)('hoja de %i: burbujas dentro del marco y sin encimarse', (f) => {
    const l = getLayout(f);
    const b = allBubbles(l);
    const [tl, , , , , br] = l.markers;
    for (const x of b) {
      expect(x.cx - x.r).toBeGreaterThan(tl.x);
      expect(x.cx + x.r).toBeLessThan(br.x + br.size);
      expect(x.cy - x.r).toBeGreaterThan(tl.y);
      expect(x.cy + x.r).toBeLessThan(br.y + br.size);
      expect(x.cx + x.r).toBeLessThan(PAGE_W);
      expect(x.cy + x.r).toBeLessThan(PAGE_H);
    }
    for (let i = 0; i < b.length; i++)
      for (let j = i + 1; j < b.length; j++)
        expect(Math.hypot(b[i].cx - b[j].cx, b[i].cy - b[j].cy)).toBeGreaterThan(b[i].r + b[j].r + 0.2);
  });

  it('preguntas en orden de lectura: cada bloque de 10 baja de una en una', () => {
    for (const f of FORMATOS) {
      const p = getLayout(f).preguntas;
      for (let q = 1; q < p.length; q++) if (q % 10) expect(p[q][0].cy).toBeGreaterThan(p[q - 1][0].cy);
    }
  });

  it('cada formato tiene una tira de identificación distinta', () => {
    const firmas = FORMATOS.map((f) => JSON.stringify(getLayout(f).checker.bits));
    expect(new Set(firmas).size).toBe(3);
    for (const f of FORMATOS) {
      const bits = getLayout(f).checker.bits;
      // Girada 180° la tira no debe coincidir consigo misma (permite detectar orientación)
      const rot = [...bits].reverse().map((r) => [...r].reverse());
      expect(JSON.stringify(rot)).not.toBe(JSON.stringify(bits));
    }
  });
});
