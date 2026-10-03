import { Link, Navigate, useNavigate } from 'react-router';
import Screen, { btn } from '../components/Screen';
import { useGuardSesion } from '../hooks/useGuardSesion';
import { useSesion } from '../session/sessionStore';

// Revisión básica (Fase 3). La revisión completa con corrección manual y la
// exportación a Excel llegan en la Fase 4.
export default function Revision() {
  useGuardSesion();
  const sesion = useSesion((s) => s.sesion);
  const borrarHoja = useSesion((s) => s.borrarHoja);
  const cerrar = useSesion((s) => s.cerrar);
  const navigate = useNavigate();
  if (!sesion) return <Navigate to="/sesion/nueva" replace />;
  const { clave, hojas } = sesion;
  const repeticiones = new Map<string, number>();
  for (const h of hojas) if (h.codigo) repeticiones.set(h.codigo, (repeticiones.get(h.codigo) ?? 0) + 1);

  function cerrarSesion() {
    if (!confirm('¿Cerrar sesión y borrar los datos? Se borrarán todas las hojas escaneadas.')) return;
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
          <button disabled className={`${btn.primary} flex-1`} title="Disponible en la Fase 4">Exportar Excel</button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-slate-600">{hojas.length} hoja(s). La exportación a Excel y la corrección manual llegan en la Fase 4.</p>
      <ul className="space-y-2">
        {hojas.map((h) => {
          const cal = clave.escala === 10 ? h.resultado.calificacion10 : h.resultado.calificacion100;
          const avisos = h.resultado.alertas.length + (h.lectura.id.completo || h.lectura.formato === 20 ? 0 : 1);
          return (
            <li key={h.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              {h.miniatura ? <img src={h.miniatura} alt="" className="h-20 w-16 rounded object-cover object-top" /> : <div className="h-20 w-16 rounded bg-slate-100" />}
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-500">Hoja #{h.numero}</div>
                <div className="truncate font-semibold text-slate-900">
                  {h.codigo || 'Sin código'}
                  {(repeticiones.get(h.codigo) ?? 0) > 1 && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Repetido</span>}
                </div>
                <div className="text-sm text-slate-600">{h.resultado.aciertos}/{clave.numPreguntas} correctas{avisos ? ` · ⚠️ ${avisos}` : ''}</div>
              </div>
              <div className="w-14 text-right text-2xl font-bold text-blue-700">{cal ?? '—'}</div>
              <button onClick={() => confirm(`¿Borrar la hoja #${h.numero}?`) && borrarHoja(h.id)} className="px-2 text-xl text-red-600" aria-label="Borrar hoja">🗑</button>
            </li>
          );
        })}
      </ul>
      <button onClick={cerrarSesion} className={`${btn.danger} mt-6 w-full`}>Cerrar sesión y borrar los datos</button>
    </Screen>
  );
}
