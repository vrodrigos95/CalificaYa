import { identificador } from '../session/alumnos';
import { useSesion, type Sesion } from '../session/sessionStore';
import { sugerenciasHoja } from '../session/sugerencias';

/**
 * Barra en la pantalla de escaneo: mientras se coloca la siguiente hoja, deja
 * confirmar con un toque al alumno que el OCR reconoció en las anteriores
 * («#3 ¿Es Mariana Hernández? ✓ ✗»), sin ir a Revisar.
 */
export default function BandejaConfirmar({ sesion }: { sesion: Sesion }) {
  const corregir = useSesion((s) => s.corregir);
  const descartar = useSesion((s) => s.descartarSugerencia);
  if (!sesion.alumnos) return null;

  const recientes = sesion.hojas.slice(-6).reverse();
  const leyendo = recientes.find((h) => h.manuscrito?.estado === 'leyendo');
  const error = recientes.find((h) => h.manuscrito?.estado === 'error');
  const pendientes = recientes
    .map((h) => ({ h, s: sugerenciasHoja(h, sesion, 1)[0] }))
    .filter((x) => x.s)
    .slice(0, 2);
  if (!leyendo && !error && !pendientes.length) return null;

  return (
    <div className="space-y-1 bg-slate-900 px-2 py-1.5 text-sm text-white" data-testid="bandeja">
      {pendientes.map(({ h, s }) => (
        <div key={h.id} className="flex items-center gap-2">
          {h.manuscrito?.recorte && <img src={h.manuscrito.recorte} alt="" className="h-8 w-16 shrink-0 rounded bg-white object-cover object-left" />}
          <span className="min-w-0 flex-1 leading-tight">
            <span className="text-slate-400">#{h.numero}</span> ¿Es <b>{s.alumno.completo || s.alumno.codigo}</b>?
          </span>
          <button onClick={() => corregir(h.id, { codigo: identificador(s.alumno) })} className="rounded-lg bg-green-600 px-3 py-1 font-bold" aria-label={`Sí, la hoja ${h.numero} es de ${s.alumno.completo}`}>✓</button>
          <button onClick={() => descartar(h.id, s.alumno.id)} className="rounded-lg bg-slate-600 px-3 py-1 font-bold" aria-label="No es este alumno">✗</button>
        </div>
      ))}
      {leyendo && <p className="text-xs text-slate-300">📝 Leyendo el nombre de la hoja #{leyendo.numero}…</p>}
      {!leyendo && error && !pendientes.length && (
        <p className="text-xs text-amber-300">No se pudo leer lo escrito a mano. La primera vez se necesita internet para descargar el lector.</p>
      )}
    </div>
  );
}
