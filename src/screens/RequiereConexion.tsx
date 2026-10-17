import { btn } from '../components/Screen';
import { config } from '../config';
import { useLicencia } from '../license/licenseStore';

/** Pasaron los días sin conexión (o terminó un pase cancelado) y la licencia es obligatoria. */
export default function RequiereConexion() {
  const { fase, reintentar } = useLicencia();
  const verificando = fase === 'verificando';
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6 text-center">
      <div className="text-5xl">📶</div>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Conéctate para verificar tu licencia</h1>
      <p className="mt-2 text-slate-600">
        CalificaYa funciona sin internet hasta {config.diasSinConexion} días después de la última verificación. Conéctate un momento; después la app sigue funcionando sin conexión.
      </p>
      <button onClick={reintentar} disabled={verificando} className={`${btn.primary} mt-6`}>
        {verificando ? 'Verificando…' : 'Reintentar'}
      </button>
    </div>
  );
}
