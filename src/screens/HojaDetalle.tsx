import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import HojaRevision from '../components/HojaRevision';
import Screen, { btn } from '../components/Screen';
import { textoAlerta } from '../grading/grade';
import { useGuardSesion } from '../hooks/useGuardSesion';
import { opcionesDe } from '../keys/model';
import { getLayout, LETRAS } from '../layout/sheetLayout';
import { avisosHoja, codigosRepetidos, useSesion } from '../session/sessionStore';
import { buscarAlumno } from '../session/alumnos';

type Filtro = 'todas' | 'revisar';

export default function HojaDetalle() {
  useGuardSesion();
  const { id } = useParams();
  const navigate = useNavigate();
  const sesion = useSesion((s) => s.sesion);
  const corregir = useSesion((s) => s.corregir);
  const borrarHoja = useSesion((s) => s.borrarHoja);
  const [filtro, setFiltro] = useState<Filtro>('revisar');
  const hoja = sesion?.hojas.find((h) => h.id === id);
  const [codigo, setCodigo] = useState(hoja?.codigo ?? '');
  useEffect(() => setCodigo(hoja?.codigo ?? ''), [hoja?.id, hoja?.codigo]);

  const correctas = useMemo(() => {
    const v = hoja?.resultado.version;
    if (!v || !sesion) return undefined;
    return sesion.clave.versiones[v]!.map((r) => r.correctas.map((o) => LETRAS.indexOf(o)));
  }, [hoja?.resultado.version, sesion]);

  if (!sesion) return <Navigate to="/sesion/nueva" replace />;
  if (!hoja) return <Navigate to="/sesion/revisar" replace />;

  const { clave } = sesion;
  const idx = sesion.hojas.indexOf(hoja);
  const anterior = sesion.hojas[idx - 1], siguiente = sesion.hojas[idx + 1];
  const res = hoja.resultado;
  const cal = clave.escala === 10 ? res.calificacion10 : res.calificacion100;
  const avisos = avisosHoja(hoja, codigosRepetidos(sesion.hojas));
  const layout = getLayout(hoja.lectura.formato);
  const opciones = opcionesDe(clave.numOpciones).length;
  const alumno = buscarAlumno(hoja.codigo, sesion.alumnos);
  const nombre = alumno ? `${alumno.nombre}${alumno.codigo !== hoja.codigo ? ` (${alumno.codigo})` : ''}` : undefined;

  // Tocar en la imagen: una sola respuesta (tocar la misma la borra).
  function tocarImagen(q: number, o: number) {
    const actual = hoja!.respuestas.preguntas[q]?.marcadas ?? [];
    corregir(hoja!.id, { pregunta: q, marcadas: actual.length === 1 && actual[0] === o ? [] : [o] });
  }
  // En la lista: cada letra se prende o apaga (permite capturar doble marca).
  function alternar(q: number, o: number) {
    const actual = hoja!.respuestas.preguntas[q]?.marcadas ?? [];
    corregir(hoja!.id, { pregunta: q, marcadas: actual.includes(o) ? actual.filter((x) => x !== o) : [...actual, o] });
  }
  function guardarCodigo() {
    if (codigo.trim() !== hoja!.codigo) corregir(hoja!.id, { codigo: codigo.trim() });
  }

  const preguntas = res.preguntas.map((p, q) => ({ p, q, lectura: hoja.respuestas.preguntas[q] }));
  const aRevisar = preguntas.filter(({ p, q, lectura }) => lectura?.estado === 'dudosa' || p.estado === 'doble' || p.estado === 'blanco' || hoja.editadas.preguntas.includes(q));
  const lista = filtro === 'revisar' ? aRevisar : preguntas;

  return (
    <Screen
      title={`Hoja #${hoja.numero}`}
      back="/sesion/revisar"
      actions={
        <div className="flex gap-1">
          <button disabled={!anterior} onClick={() => navigate(`/sesion/revisar/${anterior.id}`, { replace: true })} className="rounded-lg px-2 py-1 text-xl disabled:opacity-30" aria-label="Hoja anterior">‹</button>
          <button disabled={!siguiente} onClick={() => navigate(`/sesion/revisar/${siguiente.id}`, { replace: true })} className="rounded-lg px-2 py-1 text-xl disabled:opacity-30" aria-label="Hoja siguiente">›</button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="w-20 text-center">
            <div className={`text-4xl font-bold ${cal === null ? 'text-slate-400' : 'text-blue-700'}`}>{cal ?? '—'}</div>
            <div className="text-xs text-slate-500">de {clave.escala}</div>
          </div>
          <div className="flex-1 text-sm text-slate-600">
            <div>{res.aciertos} correctas · {res.errores} errores · {res.blancos} en blanco</div>
            <div>{res.puntos} de {res.puntosMax || '—'} puntos</div>
          </div>
        </div>

        {(avisos.length > 0 || res.alertas.length > 0) && (
          <ul className="space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            {res.alertas.map((a, i) => <li key={i}>⚠️ {textoAlerta(a)}</li>)}
            {avisos.filter((a) => a.startsWith('Código')).map((a) => <li key={a}>⚠️ {a}</li>)}
          </ul>
        )}

        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <div>
            <label htmlFor="codigo" className="mb-1 block text-sm font-semibold text-slate-700">Código de alumno</label>
            <input
              id="codigo"
              value={codigo}
              inputMode="numeric"
              onChange={(e) => setCodigo(e.target.value)}
              onBlur={guardarCodigo}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              placeholder={layout.id.length ? 'Sin código' : 'Hoja sin código: escribe uno'}
              className={`w-full rounded-xl border px-3 py-2 font-mono text-lg ${codigo.includes('?') || (!codigo && layout.id.length) ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`}
            />
            {nombre ? <p className="mt-1 text-sm text-slate-600">{nombre}</p> : sesion.alumnos && hoja.codigo && !hoja.codigo.includes('?') ? <p className="mt-1 text-sm text-amber-700">No está en la lista de alumnos</p> : null}
          </div>
          <div>
            <span className="mb-1 block text-sm font-semibold text-slate-700">Versión</span>
            <div className="flex gap-1">
              {layout.version.map((_, v) => {
                const on = hoja.respuestas.version.marcadas.includes(v);
                return (
                  <button key={v} onClick={() => corregir(hoja.id, { version: on ? null : v })}
                    className={`h-10 w-9 rounded-lg border-2 text-sm font-bold ${on ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 text-slate-500'}`}>
                    {LETRAS[v]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <HojaRevision hoja={hoja} correctas={correctas} onTocarBurbuja={tocarImagen} />
          <p className="mt-1 text-xs text-slate-500">
            Toca una burbuja para corregir esa pregunta. Verde: correcta · Rojo: incorrecta · Naranja: doble · Contorno verde: respuesta correcta · Punto ámbar: dudosa
          </p>
        </div>

        <div>
          <div className="mb-2 flex gap-2">
            {(['revisar', 'todas'] as Filtro[]).map((f) => (
              <button key={f} onClick={() => setFiltro(f)} className={`rounded-full px-3 py-1 text-sm font-semibold ${filtro === f ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {f === 'revisar' ? `Por revisar (${aRevisar.length})` : `Todas (${preguntas.length})`}
              </button>
            ))}
          </div>
          {lista.length === 0 ? (
            <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">No hay preguntas dudosas, dobles ni en blanco.</p>
          ) : (
            <ol className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
              {lista.map(({ p, q, lectura }) => {
                const marc = hoja.respuestas.preguntas[q]?.marcadas ?? [];
                const fondo = p.estado === 'correcta' ? 'bg-green-50' : p.estado === 'blanco' ? '' : 'bg-red-50';
                return (
                  <li key={q} className={`flex items-center gap-2 px-3 py-2 ${fondo}`}>
                    <span className="w-8 shrink-0 text-right font-bold text-slate-700">{q + 1}</span>
                    <div className="flex flex-1 gap-1.5">
                      {LETRAS.slice(0, opciones).map((letra, o) => {
                        const on = marc.includes(o);
                        const esCorrecta = correctas?.[q]?.includes(o);
                        return (
                          <button key={o} onClick={() => alternar(q, o)} aria-pressed={on}
                            className={`h-9 w-9 shrink-0 rounded-full border-2 text-sm font-bold ${on ? 'border-slate-800 bg-slate-800 text-white' : esCorrecta ? 'border-green-600 text-green-700' : 'border-slate-300 text-slate-500'}`}>
                            {letra}
                          </button>
                        );
                      })}
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs text-slate-500">
                      {hoja.editadas.preguntas.includes(q) ? '✏️' : lectura?.estado === 'dudosa' ? 'dudosa' : p.estado === 'doble' ? 'doble' : p.estado === 'blanco' ? 'en blanco' : ''}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="flex gap-2">
          <Link to="/sesion/revisar" className={`${btn.secondary} flex-1 text-center`}>Volver a la lista</Link>
          <button onClick={() => { if (confirm(`¿Borrar la hoja #${hoja.numero}?`)) { borrarHoja(hoja.id); navigate('/sesion/revisar', { replace: true }); } }} className={`${btn.danger} flex-1`}>
            Borrar hoja
          </button>
        </div>
      </div>
    </Screen>
  );
}
