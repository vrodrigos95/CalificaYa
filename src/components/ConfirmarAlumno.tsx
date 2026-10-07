import { identificador } from '../session/alumnos';
import { useSesion, type HojaSesion, type Sesion } from '../session/sessionStore';
import { sugerenciasHoja } from '../session/sugerencias';

interface Props {
  hoja: HojaSesion;
  sesion: Sesion;
  /** En la lista de Revisar: solo aparece si hay a quién proponer. */
  compacto?: boolean;
}

/**
 * Muestra lo que el alumno escribió (recorte de Nombre/Fecha/Grupo) y, si se
 * parece a alguien de la lista, pregunta «¿Es …?» para confirmarlo con un toque.
 */
export default function ConfirmarAlumno({ hoja, sesion, compacto = false }: Props) {
  const corregir = useSesion((s) => s.corregir);
  const descartar = useSesion((s) => s.descartarSugerencia);
  const m = hoja.manuscrito;
  const sugerencias = sugerenciasHoja(hoja, sesion);
  const [principal, ...otras] = sugerencias;
  if (compacto && !principal) return null;
  if (!m) return null;

  const elegir = (codigo: string) => corregir(hoja.id, { codigo });
  return (
    <div className={`rounded-xl ${principal ? 'bg-blue-50' : 'bg-slate-50'} p-2`}>
      {m.recorte && <img src={m.recorte} alt="Lo que escribió el alumno" className="w-full rounded-lg border border-slate-200 bg-white" />}
      {m.estado === 'leyendo' && <p className="mt-1 text-xs text-slate-500">Leyendo lo escrito…</p>}
      {principal ? (
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-sm text-slate-800">
              ¿Es <span className="font-bold">{principal.alumno.completo || principal.alumno.codigo}</span>
              {principal.alumno.lista && <span className="text-slate-500"> (No. {principal.alumno.lista})</span>}?
            </p>
            <button onClick={() => elegir(identificador(principal.alumno))} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-bold text-white" aria-label="Sí, es este alumno">✓ Sí</button>
            <button onClick={() => descartar(hoja.id, principal.alumno.id)} className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-bold text-slate-700" aria-label="No es este alumno">✗ No</button>
          </div>
          {otras.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-600">
              ¿O es…?
              {otras.map((o) => (
                <button key={o.alumno.id} onClick={() => elegir(identificador(o.alumno))} className="rounded-full border border-slate-300 bg-white px-2 py-0.5">
                  {o.alumno.completo || o.alumno.codigo}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : m.estado === 'listo' && sesion.alumnos && !compacto && !hoja.codigo ? (
        <p className="mt-1 text-xs text-slate-500">No se reconoció a nadie de la lista: escribe abajo su número de lista o su nombre.</p>
      ) : m.estado === 'error' && !compacto ? (
        <p className="mt-1 text-xs text-slate-500">No se pudo leer lo escrito (la primera vez se necesita internet para descargar el lector).</p>
      ) : null}
    </div>
  );
}
