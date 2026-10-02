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
