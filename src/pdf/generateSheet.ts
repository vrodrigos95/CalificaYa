import { jsPDF } from 'jspdf';
import { APP_NAME } from '../config';
import { getLayout, type SheetLayout, type SheetOptions } from '../layout/sheetLayout';

const BUBBLE_GRAY = 150;

function drawPage(doc: jsPDF, l: SheetLayout) {
  // Marcadores
  doc.setFillColor(0, 0, 0);
  for (const m of l.markers) doc.rect(m.cx - m.size / 2, m.cy - m.size / 2, m.size, m.size, 'F');

  // Tira de formato
  for (const c of l.formatCode) if (c.on) doc.rect(c.x, c.y, c.size, c.size, 'F');

  // Encabezado
  const hb = l.headerBox;
  doc.setDrawColor(0);
  doc.setLineWidth(0.7);
  doc.setFont('helvetica', 'normal');
  // Un solo tamaño de letra para todas las etiquetas, el mayor que quepa en todas.
  let size = Math.min(15, ...hb.rows.map((r) => r.h * 1.3));
  doc.setFontSize(size);
  const cabe = () => hb.rows.every((r) => r.cells.every((c) => doc.getTextWidth(c.label) <= c.labelW - 3));
  while (size > 6 && !cabe()) doc.setFontSize((size -= 0.5));
  for (const row of hb.rows) {
    for (const cell of row.cells) {
      doc.setFillColor(215, 215, 215);
      doc.rect(cell.x, row.y, cell.labelW, row.h, 'F');
      doc.setTextColor(0);
      doc.setFontSize(size);
      doc.text(cell.label, cell.x + 1.5, row.y + row.h / 2 + size * 0.125);
      doc.setLineWidth(0.35);
      doc.line(cell.x + cell.labelW, row.y, cell.x + cell.labelW, row.y + row.h);
      if (cell.x > hb.rect.x + 0.01) doc.line(cell.x, row.y, cell.x, row.y + row.h);
    }
  }
  doc.setLineWidth(0.35);
  for (const row of hb.rows.slice(1)) doc.line(hb.rect.x, row.y, hb.rect.x + hb.rect.w, row.y);
  doc.setLineWidth(0.9);
  doc.roundedRect(hb.rect.x, hb.rect.y, hb.rect.w, hb.rect.h, 3, 3, 'S');

  // Casillas del ID
  doc.setLineWidth(0.3);
  doc.setDrawColor(90);
  for (const b of l.idBoxes) doc.rect(b.x, b.y, b.w, b.h, 'S');

  // Burbujas
  doc.setDrawColor(BUBBLE_GRAY);
  for (const b of [...l.preguntas.flat(), ...l.version, ...l.id.flat()]) {
    doc.setLineWidth(b.r > 3 ? 0.55 : 0.35);
    doc.circle(b.cx, b.cy, b.r, 'S');
  }

  // Textos
  for (const t of l.textos) {
    doc.setFont('helvetica', t.bold ? 'bold' : 'normal');
    doc.setFontSize(t.size);
    doc.setTextColor(t.color ?? 0);
    doc.text(t.text, t.x, t.y, { align: t.align ?? 'left' });
  }
  doc.setTextColor(0);
}

export interface GenerateOptions extends SheetOptions {
  copias?: number;
}

export function generateSheetPdf(opts: GenerateOptions): jsPDF {
  const layout = getLayout(opts);
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  doc.setProperties({
    title: `${APP_NAME} – Hoja de respuestas de ${layout.options.formato} preguntas`,
    author: APP_NAME,
    creator: APP_NAME,
    subject: 'Hoja de respuestas de opción múltiple',
  });
  const copias = Math.max(1, Math.min(200, Math.round(opts.copias ?? 1)));
  for (let i = 0; i < copias; i++) {
    if (i > 0) doc.addPage('letter', 'portrait');
    drawPage(doc, layout);
  }
  return doc;
}

export function sheetFileName(o: SheetOptions): string {
  const opc = o.opciones === 5 ? 'AE' : 'AD';
  return `${APP_NAME}_Hoja_${o.formato}_${opc}${o.formato === 20 ? '' : `_ID${o.idDigitos}`}.pdf`;
}
