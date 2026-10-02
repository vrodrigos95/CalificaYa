import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateSheetPdf, sheetFileName } from '../src/pdf/generateSheet';

describe('PDF de hojas de respuesta', () => {
  it.each([20, 50, 100] as const)('genera la hoja de %i preguntas', (formato) => {
    const doc = generateSheetPdf({ formato, copias: 2 });
    expect(doc.getNumberOfPages()).toBe(2);
    const buf = Buffer.from(doc.output('arraybuffer'));
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.toString('latin1')).toContain('CalificaYa');
    mkdirSync('test-output', { recursive: true });
    writeFileSync(`test-output/${sheetFileName(formato)}`, Buffer.from(generateSheetPdf({ formato }).output('arraybuffer')));
  });
});

describe('textos de la hoja', () => {
  it.each([20, 50, 100] as const)('hoja de %i: ningún texto toca marcadores ni la tira', async (formato) => {
    const { jsPDF } = await import('jspdf');
    const { getLayout } = await import('../src/layout/sheetLayout');
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const l = getLayout(formato);
    const ck = l.checker;
    const zonas = [
      ...l.markers, ...l.blockMarkers,
      { x: ck.x, y: ck.y, size: Math.max(ck.bits[0].length * ck.pitchX, ck.bits.length * ck.pitchY) },
    ].map((m) => ({ x0: m.x - 1, y0: m.y - 1, x1: m.x + m.size + 1, y1: m.y + m.size + 1 }));
    for (const t of l.textos) {
      doc.setFont('helvetica', t.bold ? 'bold' : 'normal');
      doc.setFontSize(t.size);
      const w = doc.getTextWidth(t.text);
      const h = t.size * 0.3528 * 0.75;
      const x0 = t.align === 'right' ? t.x - w : t.align === 'center' ? t.x - w / 2 : t.x;
      // Caja del texto (sin rotar) y su versión rotada ±90°
      let caja = { x0, y0: t.y - h, x1: x0 + w, y1: t.y };
      if (t.angle === 90) caja = { x0: t.x - h, y0: t.y - w, x1: t.x, y1: t.y };
      if (t.angle === -90) caja = { x0: t.x, y0: t.y, x1: t.x + h, y1: t.y + w };
      for (const z of zonas) {
        const choca = caja.x0 < z.x1 && caja.x1 > z.x0 && caja.y0 < z.y1 && caja.y1 > z.y0;
        expect(choca, `"${t.text}" toca un marcador`).toBe(false);
      }
    }
  });
});
