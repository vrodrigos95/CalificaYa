import { getLayout, marcoHoja, type Bubble } from '../layout/sheetLayout';
import type { HojaSesion } from '../session/sessionStore';

interface Props {
  hoja: HojaSesion;
  /** Respuestas correctas por pregunta (índices de opción), para marcarlas en las incorrectas. */
  correctas?: number[][];
  onTocarBurbuja?: (pregunta: number, opcion: number) => void;
}

const COLOR = { correcta: '#16a34a', incorrecta: '#dc2626', doble: '#ea580c', blanco: '#64748b', dudosa: '#d97706', id: '#2563eb' };

/**
 * Miniatura de la hoja con las respuestas detectadas encima (SVG en mm sobre la
 * imagen recortada al marco). Tocar una burbuja corrige esa pregunta.
 */
export default function HojaRevision({ hoja, correctas, onTocarBurbuja }: Props) {
  const l = getLayout(hoja.lectura.formato);
  const m = marcoHoja(l);
  const res = hoja.resultado;
  const anillo = (b: Bubble, color: string, ancho: number, relleno: boolean, key: string) => (
    <circle key={key} cx={b.cx} cy={b.cy} r={b.r + 0.5} fill={relleno ? `${color}55` : 'none'} stroke={color} strokeWidth={ancho} />
  );

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white" style={{ aspectRatio: `${m.w} / ${m.h}` }}>
      {hoja.miniatura && <img src={hoja.miniatura} alt={`Hoja ${hoja.numero}`} className="absolute inset-0 h-full w-full" />}
      <svg viewBox={`${m.x} ${m.y} ${m.w} ${m.h}`} className="absolute inset-0 h-full w-full">
        {l.preguntas.map((fila, q) => {
          const r = res.preguntas[q];
          const marcadas = hoja.respuestas.preguntas[q]?.marcadas ?? [];
          const fueraDeExamen = !r;
          const dudosa = hoja.respuestas.preguntas[q]?.estado === 'dudosa';
          const color = fueraDeExamen ? COLOR.blanco : r.estado === 'correcta' ? COLOR.correcta : r.estado === 'doble' ? COLOR.doble : COLOR.incorrecta;
          return (
            <g key={q} opacity={fueraDeExamen ? 0.45 : 1}>
              {marcadas.map((o) => fila[o] && anillo(fila[o], color, 0.6, true, `m${o}`))}
              {r && r.estado !== 'correcta' && correctas?.[q]?.map((o) => fila[o] && anillo(fila[o], COLOR.correcta, 0.4, false, `c${o}`))}
              {dudosa && <circle cx={fila[4].cx + fila[4].r + 2.2} cy={fila[4].cy} r={1.4} fill={COLOR.dudosa} />}
              {onTocarBurbuja && !fueraDeExamen &&
                fila.map((b, o) => (
                  <circle key={`t${o}`} cx={b.cx} cy={b.cy} r={b.r + 0.6} fill="transparent" className="cursor-pointer" onClick={() => onTocarBurbuja(q, o)} />
                ))}
            </g>
          );
        })}
        {hoja.lectura.id.digitos.map((d, i) =>
          d.marcadas.map((v) => l.id[i]?.[v] && anillo(l.id[i][v], d.estado === 'doble' ? COLOR.doble : COLOR.id, 0.4, true, `id${i}-${v}`)),
        )}
        {hoja.respuestas.version.marcadas.map((v) => l.version[v] && anillo(l.version[v], COLOR.id, 0.5, true, `v${v}`))}
      </svg>
    </div>
  );
}
