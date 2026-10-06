import { jsPDF } from 'jspdf';
import { APP_NAME } from '../config';
import { getLayout, type Formato, type HeaderBox, type SheetLayout } from '../layout/sheetLayout';

const BUBBLE_GRAY = 160;

function drawHeader(doc: jsPDF, hb: HeaderBox) {
  doc.setFont('helvetica', 'normal');
  // Un solo tamaño de letra para todas las etiquetas, el mayor que quepa en todas.
  let size = Math.min(15, ...hb.rows.map((r) => r.h * 1.3));
  doc.setFontSize(size);
  const cabe = () => hb.rows.every((r) => r.cells.every((c) => doc.getTextWidth(c.label) <= c.labelW - 3));
  while (size > 6 && !cabe()) doc.setFontSize((size -= 0.5));
  doc.setDrawColor(0);
  for (const row of hb.rows) {
    for (const cell of row.cells) {
      doc.setFillColor(200, 200, 200);
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
  doc.setLineWidth(0.8);
  if (hb.rounded) doc.roundedRect(hb.rect.x, hb.rect.y, hb.rect.w, hb.rect.h, 3, 3, 'S');
  else doc.rect(hb.rect.x, hb.rect.y, hb.rect.w, hb.rect.h, 'S');
}

function drawPage(doc: jsPDF, l: SheetLayout) {
  doc.setFillColor(0, 0, 0);
  for (const m of [...l.markers, ...l.blockMarkers]) doc.rect(m.x, m.y, m.size, m.size, 'F');

  const ck = l.checker;
  ck.bits.forEach((fila, r) =>
    fila.forEach((on, c) => on && doc.rect(ck.x + c * ck.pitchX, ck.y + r * ck.pitchY, ck.size, ck.size, 'F')),
  );

  for (const hb of l.headers) drawHeader(doc, hb);

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  for (const b of l.boxes) doc.rect(b.x, b.y, b.w, b.h, 'S');

  doc.setDrawColor(215);
  doc.setLineWidth(0.5);
  for (const b of l.grayRects) doc.rect(b.x, b.y, b.w, b.h, 'S');
  for (const ln of l.lines) {
    doc.setDrawColor(ln.gray);
    doc.setLineWidth(ln.width);
    doc.line(ln.x1, ln.y1, ln.x2, ln.y2);
  }

  doc.setDrawColor(BUBBLE_GRAY);
  for (const b of [...l.preguntas.flat(), ...l.version, ...l.id.flat()]) {
    doc.setLineWidth(b.r > 3 ? 0.5 : 0.35);
    doc.circle(b.cx, b.cy, b.r, 'S');
  }

  for (const t of l.textos) {
    doc.setFont('helvetica', t.bold ? 'bold' : 'normal');
    doc.setFontSize(t.size);
    doc.setTextColor(t.color ?? 0);
    doc.text(t.text, t.x, t.y, { align: t.align ?? 'left', angle: t.angle ?? 0 });
  }
  doc.setTextColor(0);
}

export interface GenerateOptions {
  formato: Formato;
  copias?: number;
}

export function generateSheetPdf(opts: GenerateOptions): jsPDF {
  const layout = getLayout(opts.formato);
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  doc.setProperties({
    title: `${APP_NAME} – Hoja de respuestas de ${opts.formato} preguntas`,
    author: APP_NAME,
    creator: APP_NAME,
    subject: 'Hoja de respuestas de opción múltiple (CC BY-SA 3.0, basada en ZipGrade)',
  });
  const copias = Math.max(1, Math.min(200, Math.round(opts.copias ?? 1)));
  for (let i = 0; i < copias; i++) {
    if (i > 0) doc.addPage('letter', 'portrait');
    drawPage(doc, layout);
  }
  return doc;
}

export function sheetFileName(formato: Formato): string {
  return `${APP_NAME}_Hoja_${formato}_preguntas.pdf`;
}
