import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import Screen, { btn } from '../components/Screen';
import ConfirmarAlumno from '../components/ConfirmarAlumno';
import CargarAlumnos from '../components/CargarAlumnos';
import { buscarAlumno } from '../session/alumnos';
import { useExportar } from '../hooks/useExportar';
import { useGuardSesion } from '../hooks/useGuardSesion';
import { avisosHoja, codigosRepetidos, useSesion } from '../session/sessionStore';

export default function Revision() {
  useGuardSesion();
  const sesion = useSesion((s) => s.sesion);
  const borrarHoja = useSesion((s) => s.borrarHoja);
  const cerrar = useSesion((s) => s.cerrar);
  const cargarAlumnos = useSesion((s) => s.cargarAlumnos);
  const [params] = useSearchParams();
  const [verLista, setVerLista] = useState(params.get('lista') === '1');
  const navigate = useNavigate();
  const { exportar, exportando } = useExportar();
  const [soloAvisos, setSoloAvisos] = useState(false);
  if (!sesion) return <Navigate to="/sesion/nueva" replace />;
  const { clave, hojas } = sesion;
  const repetidos = codigosRepetidos(hojas, sesion.alumnos);
  const conAvisos = hojas.map((h) => ({ h, avisos: avisosHoja(h, repetidos) }));
  const visibles = soloAvisos ? conAvisos.filter((x) => x.avisos.length) : conAvisos;
  const totalAvisos = conAvisos.filter((x) => x.avisos.length).length;
  const cals = hojas.map((h) => (clave.escala === 10 ? h.resultado.calificacion10 : h.resultado.calificacion100)).filter((c): c is number => c !== null);
  const presentes = new Set(hojas.map((h) => buscarAlumno(h.codigo, sesion.alumnos)?.id).filter(Boolean));
  const faltantes = sesion.alumnos ? sesion.alumnos.filter((a) => !presentes.has(a.id)) : [];
  const promedio = cals.length ? Math.round((cals.reduce((a, b) => a + b, 0) / cals.length) * 10) / 10 : null;

  function cerrarSesion() {
    const msg = sesion!.exportada ? '¿Cerrar sesión y borrar los datos?' : 'No has exportado los últimos cambios. ¿Cerrar sesión y borrar los datos de todas formas?';
    if (!confirm(msg)) return;
    cerrar();
    navigate('/', { replace: true });
  }

  return (
    <Screen
      title={`Revisar · ${clave.nombre}`}
      back="/sesion/escanear"
      footer={
        <div className="flex gap-2">
          <Link to="/sesion/escanear" className={`${btn.secondary} flex-1 text-center`}>Seguir escaneando</Link>
          <button onClick={exportar} disabled={exportando || hojas.length === 0} className={`${btn.primary} flex-1`}>
            {exportando ? 'Generando…' : 'Exportar Excel'}
          </button>
        </div>
      }
    >
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white p-2 shadow-sm"><div className="text-xl font-bold">{hojas.length}</div><div className="text-xs text-slate-500">hojas</div></div>
        <div className="rounded-xl bg-white p-2 shadow-sm"><div className="text-xl font-bold">{promedio ?? '—'}</div><div className="text-xs text-slate-500">promedio</div></div>
        <div className={`rounded-xl p-2 shadow-sm ${totalAvisos ? 'bg-amber-50' : 'bg-white'}`}><div className="text-xl font-bold">{totalAvisos}</div><div className="text-xs text-slate-500">con avisos</div></div>
      </div>
      {sesion.alumnos && faltantes.length > 0 && (
        <details className="mb-3 rounded-xl bg-slate-100 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-slate-700">{faltantes.length} alumno(s) de la lista sin hoja escaneada</summary>
          <ul className="mt-2 max-h-40 overflow-auto text-slate-600">{faltantes.map((a) => <li key={a.id}>{a.lista && <span className="font-mono">{a.lista}. </span>}{a.completo || a.codigo}{a.codigo && a.completo && <span className="font-mono text-slate-400"> · {a.codigo}</span>}</li>)}</ul>
        </details>
      )}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={soloAvisos} onChange={(e) => setSoloAvisos(e.target.checked)} className="h-4 w-4" />
          Solo hojas con avisos
        </label>
        <div className="flex gap-2">
          <button onClick={() => setVerLista((v) => !v)} className={btn.small}>Lista de alumnos</button>
          <Link to={`/claves/${clave.id}?volver=/sesion/revisar`} className={btn.small}>Corregir la clave</Link>
        </div>
      </div>

      {verLista && <div className="mb-3"><CargarAlumnos alumnos={sesion.alumnos} onCambio={cargarAlumnos} /></div>}
      {hojas.length === 0 && <p className="mt-8 text-center text-slate-500">Aún no hay hojas. Regresa a escanear.</p>}
      <ul className="space-y-2">
        {visibles.map(({ h, avisos }) => {
          const cal = clave.escala === 10 ? h.resultado.calificacion10 : h.resultado.calificacion100;
          const alumno = buscarAlumno(h.codigo, sesion.alumnos);
          const nombre = alumno?.completo;
          return (
            <li key={h.id} className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <div className="flex items-center gap-3">
              <Link to={`/sesion/revisar/${h.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                {h.miniatura ? <img src={h.miniatura} alt="" className="h-20 w-16 shrink-0 rounded object-cover object-top" /> : <div className="h-20 w-16 shrink-0 rounded bg-slate-100" />}
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-500">Hoja #{h.numero}{h.editadas.preguntas.length || h.editadas.codigo || h.editadas.version ? ' · ✏️ corregida' : ''}</div>
                  <div className="truncate font-semibold text-slate-900">{h.codigo || (h.lectura.formato === 20 ? 'Sin alumno' : 'Sin código')}</div>
                  {nombre && <div className="truncate text-sm text-slate-600">{nombre}</div>}
                  <div className="text-sm text-slate-600">{h.resultado.aciertos}/{clave.numPreguntas} correctas</div>
                  {avisos.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {avisos.map((a) => <span key={a} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{a}</span>)}
                    </div>
                  )}
                </div>
                <div className="w-14 shrink-0 text-right text-2xl font-bold text-blue-700">{cal ?? '—'}</div>
              </Link>
              <button onClick={() => confirm(`¿Borrar la hoja #${h.numero}?`) && borrarHoja(h.id)} className="px-2 text-xl text-red-600" aria-label="Borrar hoja">🗑</button>
              </div>
              <div className="mt-2 empty:hidden"><ConfirmarAlumno hoja={h} sesion={sesion} compacto /></div>
            </li>
          );
        })}
      </ul>
      <button onClick={cerrarSesion} className={`${btn.danger} mt-6 w-full`}>Cerrar sesión y borrar los datos</button>
    </Screen>
  );
}
