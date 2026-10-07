import { useActualizacion } from '../lib/actualizacion';
import { haySinExportar, useSesion } from '../session/sessionStore';

/** Barra fija que avisa que hay una versión nueva de la app lista para usarse. */
export default function AvisoActualizacion() {
  const { hayNueva, aplicar } = useActualizacion();
  const sesion = useSesion((s) => s.sesion);
  if (!hayNueva) return null;

  function actualizar() {
    if (sesion?.hojas.length) {
      const aviso = haySinExportar(sesion)
        ? `Tienes ${sesion.hojas.length} hoja(s) sin exportar. Al actualizar se cierra la sesión y se pierden. ¿Actualizar de todos modos?`
        : 'Al actualizar se cierra la sesión de calificación abierta. ¿Actualizar ahora?';
      if (!confirm(aviso)) return;
    }
    aplicar();
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex items-center gap-3 bg-slate-900 px-4 py-3 text-sm text-white shadow-lg" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }} role="status">
      <span className="flex-1">Hay una versión nueva de CalificaYa.</span>
      <button onClick={actualizar} className="rounded-lg bg-white px-3 py-1.5 font-semibold text-slate-900">Actualizar</button>
    </div>
  );
}
