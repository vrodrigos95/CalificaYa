import { useEffect } from 'react';

/** Muestra la advertencia del navegador al cerrar o recargar la pestaña mientras `activo` sea true. */
export function useBeforeUnload(activo: boolean) {
  useEffect(() => {
    if (!activo) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [activo]);
}
