import { describe, expect, it } from 'vitest';
import { allBubbles, FORMATOS, getLayout, PAGE_H, PAGE_W, type SheetOptions } from '../src/layout/sheetLayout';
import { decodeFormatCode, encodeFormatCode } from '../src/layout/formatCode';

const variantes: SheetOptions[] = [];
for (const formato of FORMATOS)
  for (const opciones of [4, 5] as const)
    for (const idDigitos of formato === 20 ? [0] : [1, 6, 9, 10, 12, 15]) variantes.push({ formato, opciones, idDigitos });

describe('geometría de la hoja', () => {
  it.each(variantes)('%o: número de burbujas correcto', (o) => {
    const l = getLayout(o);
    expect(l.preguntas).toHaveLength(o.formato);
    l.preguntas.forEach((f) => expect(f).toHaveLength(o.opciones));
    expect(l.version).toHaveLength(4);
    expect(l.id).toHaveLength(o.formato === 20 ? 0 : o.idDigitos);
    l.id.forEach((c) => expect(c).toHaveLength(10));
    expect(l.markers).toHaveLength(6);
  });

  it.each(variantes)('%o: burbujas dentro del marco y sin encimarse', (o) => {
    const l = getLayout(o);
    const b = allBubbles(l);
    const [tl, , , , , br] = l.markers;
    for (const x of b) {
      expect(x.cx - x.r).toBeGreaterThan(tl.cx + tl.size / 2);
      expect(x.cx + x.r).toBeLessThan(br.cx - br.size / 2);
      expect(x.cy - x.r).toBeGreaterThan(tl.cy - tl.size / 2);
      expect(x.cy + x.r).toBeLessThan(br.cy - br.size / 2);
      expect(x.cx + x.r).toBeLessThan(PAGE_W);
      expect(x.cy + x.r).toBeLessThan(PAGE_H);
    }
    for (let i = 0; i < b.length; i++)
      for (let j = i + 1; j < b.length; j++) {
        const d = Math.hypot(b[i].cx - b[j].cx, b[i].cy - b[j].cy);
        expect(d).toBeGreaterThan(b[i].r + b[j].r + 0.3);
      }
  });

  it('los marcadores laterales no están centrados (permite detectar 180°)', () => {
    const m = getLayout({ formato: 50, opciones: 5, idDigitos: 9 }).markers;
    const top = m[0].cy, mid = m[2].cy, bot = m[4].cy;
    expect(Math.abs((mid - top) / (bot - top) - 0.5)).toBeGreaterThan(0.04);
  });
});

describe('tira de formato', () => {
  it.each(variantes)('%o: codifica y decodifica', (o) => {
    const l = getLayout(o);
    const info = decodeFormatCode(l.formatCode.map((c) => (c.on ? 1 : 0)));
    expect(info).toMatchObject({ formato: o.formato, opciones: o.opciones, idDigitos: o.formato === 20 ? 0 : o.idDigitos });
  });

  it('rechaza la tira leída al revés o con un bit cambiado', () => {
    const bits = encodeFormatCode({ formato: 100, opciones: 5, idDigitos: 9 });
    expect(decodeFormatCode([...bits].reverse())).toBeNull();
    for (let i = 0; i < bits.length; i++) {
      const b = [...bits];
      b[i] ^= 1;
      expect(decodeFormatCode(b)).toBeNull();
    }
  });
});
