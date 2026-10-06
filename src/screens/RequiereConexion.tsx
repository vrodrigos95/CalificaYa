import { btn } from '../components/Screen';
import { config } from '../config';
import { useLicencia } from '../license/licenseStore';

/** Pasaron los días de gracia sin poder revalidar la licencia. */
export default function RequiereConexion() {
  const { fase, reintentar, continuarSinConexion, puedeContinuar } = useLicencia();
  const verificando = fase === 'verificando';
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6 text-center">
      <div className="text-5xl">📶</div>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Conéctate para verificar tu licencia</h1>
      <p className="mt-2 text-slate-600">
        Han pasado más de {config.diasGracia} días sin poder verificar tu licencia. Conéctate a internet un momento; después la app sigue funcionando sin conexión.
      </p>
      <button onClick={reintentar} disabled={verificando} className={`${btn.primary} mt-6`}>
        {verificando ? 'Verificando…' : 'Reintentar'}
      </button>
      {puedeContinuar && !verificando && (
        <button onClick={continuarSinConexion} className={`${btn.secondary} mt-3`}>Continuar esta vez sin conexión</button>
      )}
      {!puedeContinuar && <p className="mt-3 text-sm text-slate-500">Ya usaste la opción de continuar sin conexión para este periodo.</p>}
    </div>
  );
}
