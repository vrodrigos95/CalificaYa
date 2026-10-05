import { useEffect } from 'react';
import { useBlocker } from 'react-router';
import { haySinExportar, useSesion } from '../session/sessionStore';
import { useBeforeUnload } from './useBeforeUnload';

/**
 * Protección contra pérdida de datos durante una sesión: advertencia del navegador
 * al cerrar/recargar y confirmación al salir de las pantallas de la sesión.
 */
export function useGuardSesion() {
  const pendiente = useSesion((s) => haySinExportar(s.sesion));
  useBeforeUnload(pendiente);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      pendiente && currentLocation.pathname !== nextLocation.pathname &&
      !nextLocation.pathname.startsWith('/sesion') && !nextLocation.pathname.startsWith('/claves/'),
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (confirm('Hay hojas calificadas que aún no exportas a Excel. Si sales, la sesión sigue abierta, pero se perderá si cierras la app. ¿Salir de todos modos?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
}
