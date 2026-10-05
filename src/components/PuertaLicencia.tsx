import { useEffect, type ReactNode } from 'react';
import { useLicencia } from '../license/licenseStore';
import Activacion from '../screens/Activacion';
import RequiereConexion from '../screens/RequiereConexion';

/** Muestra la app solo con licencia activa; si no, la pantalla de activación. */
export default function PuertaLicencia({ children }: { children: ReactNode }) {
  const { fase, iniciar, revalidarSiToca } = useLicencia();

  useEffect(() => {
    iniciar();
    // Al recuperar internet, revalidar en segundo plano si ya tocaba.
    const enLinea = () => revalidarSiToca();
    window.addEventListener('online', enLinea);
    return () => window.removeEventListener('online', enLinea);
  }, [iniciar, revalidarSiToca]);

  if (fase === 'cargando') return <div className="flex min-h-dvh items-center justify-center text-slate-400">Cargando…</div>;
  if (fase === 'activacion') return <Activacion />;
  if (fase === 'requiere-conexion' || fase === 'verificando') return <RequiereConexion />;
  return <>{children}</>;
}
