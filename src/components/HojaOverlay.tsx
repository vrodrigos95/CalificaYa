import { useEffect, useRef } from 'react';
import type { ResultadoHoja } from '../grading/grade';
import { getLayout, type Bubble } from '../layout/sheetLayout';
import type { GrayImage, ReadResult } from '../omr/reader';

interface Props {
  hoja: GrayImage;
  lectura: ReadResult;
  resultado?: ResultadoHoja | null;
  /** Respuestas correctas por pregunta (índices de opción) para mostrarlas en las incorrectas. */
  correctas?: number[][];
}

const COLOR = {
  correcta: '#16a34a',
  incorrecta: '#dc2626',
  doble: '#ea580c',
  dudosa: '#d97706',
  marcada: '#2563eb',
  clave: '#16a34a',
};

/** Hoja enderezada con las respuestas detectadas encima (solo en memoria). */
export default function HojaOverlay({ hoja, lectura, resultado, correctas }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = hoja.width;
    canvas.height = hoja.height;
    const g = canvas.getContext('2d')!;
    const img = g.createImageData(hoja.width, hoja.height);
    for (let i = 0; i < hoja.data.length; i++) {
      const v = hoja.data[i];
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);

    const l = getLayout(lectura.formato);
    const k = hoja.ppm;
    const circulo = (b: Bubble, color: string, ancho = 3, relleno = false) => {
      g.beginPath();
      g.arc(b.cx * k, b.cy * k, b.r * k + 2, 0, Math.PI * 2);
      if (relleno) {
        g.fillStyle = color + '55';
        g.fill();
      }
      g.lineWidth = ancho;
      g.strokeStyle = color;
      g.stroke();
    };

    lectura.preguntas.forEach((p, q) => {
      const fila = l.preguntas[q];
      const r = resultado?.preguntas[q];
      const color = !r
        ? p.estado === 'doble' ? COLOR.doble : p.estado === 'dudosa' ? COLOR.dudosa : COLOR.marcada
        : r.estado === 'correcta' ? COLOR.correcta : r.estado === 'doble' ? COLOR.doble : COLOR.incorrecta;
      for (const o of p.marcadas) circulo(fila[o], color, 3, true);
      if (r && r.estado !== 'correcta' && correctas?.[q]) for (const o of correctas[q]) circulo(fila[o], COLOR.clave, 2);
      if (p.estado === 'dudosa') {
        g.fillStyle = COLOR.dudosa;
        g.font = `bold ${Math.round(4 * k)}px sans-serif`;
        g.fillText('?', fila[4].cx * k + fila[4].r * k + 3, fila[4].cy * k + 1.5 * k);
      }
    });
    lectura.id.digitos.forEach((d, i) => d.marcadas.forEach((v) => circulo(l.id[i][v], d.estado === 'doble' ? COLOR.doble : COLOR.marcada, 2, true)));
    lectura.version.marcadas.forEach((v) => l.version[v] && circulo(l.version[v], COLOR.marcada, 2, true));
  }, [hoja, lectura, resultado, correctas]);

  return <canvas ref={ref} className="h-auto w-full rounded-lg border border-slate-200 bg-white" />;
}
