import { useState } from 'react';
import { Link } from 'react-router';
import Screen, { btn } from '../components/Screen';
import { forzarActualizacion, revisarActualizacion, useActualizacion } from '../lib/actualizacion';
import { config } from '../config';
import { enmascarar } from '../license/licenseService';
import { useLicencia } from '../license/licenseStore';
import { MENSAJES, type MensajeLicencia } from '../license/mensajes';
import { useSesion } from '../session/sessionStore';
import { Aviso } from './Activacion';

const fecha = (iso?: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

export default function Ajustes() {
  const { licencia, omitida, desactivar, aviso } = useLicencia();
  const sesion = useSesion((s) => s.sesion);
  const [error, setError] = useState<MensajeLicencia | null>(null);
  const [liberando, setLiberando] = useState(false);
  const hayNueva = useActualizacion((s) => s.hayNueva);
  const [buscando, setBuscando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [nueva, setNueva] = useState(false);

  function actualizarAhora() {
    if (sesion?.hojas.length && !confirm('Al actualizar se cierra la sesión de calificación abierta (exporta antes el Excel si lo necesitas). ¿Actualizar ahora?')) return;
    if (hayNueva) useActualizacion.getState().aplicar();
    else forzarActualizacion();
  }

  async function buscarActualizacion() {
    setBuscando(true);
    setMensaje('');
    try {
      const r = await revisarActualizacion();
      if (r === 'sin-conexion') setMensaje('No se pudo consultar la versión publicada. Revisa tu conexión a internet.');
      else if (r === 'al-dia') setMensaje('Ya tienes la versión más reciente.');
      else setNueva(true);
    } finally {
      setBuscando(false);
    }
  }

  async function onDesactivar() {
    // Solo si la licencia es obligatoria la app se cierra al desactivar.
    const pierdeSesion = config.licencia.obligatoria && sesion?.hojas.length;
    const extra = pierdeSesion ? `\n\nTienes una sesión abierta con ${sesion.hojas.length} hoja(s); se perderá si no la exportas.` : '';
    if (!confirm(`¿Desactivar la licencia en este dispositivo?\n\nEsto libera su lugar (máximo ${config.maxDispositivos} dispositivos por clave) para que puedas activarla en otro.${extra}`)) return;
    setLiberando(true);
    setError(null);
    try {
      const r = await desactivar();
      if (!r.ok) setError(MENSAJES[r.motivo]);
      else if (config.licencia.obligatoria) useSesion.getState().cerrar();
    } finally {
      setLiberando(false);
    }
  }

  return (
    <Screen title="Ajustes" back="/">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-800">Licencia</h2>
        {aviso && !licencia && <div className="mb-3"><Aviso mensaje={MENSAJES[aviso]} tono="red" /></div>}
        {omitida ? (
          <p className="text-sm text-slate-600">Modo desarrollo en este equipo: la licencia no se solicita.</p>
        ) : licencia ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-500">Clave</dt>
            <dd className="font-mono text-slate-900" data-testid="licencia">{enmascarar(licencia.codigo)}</dd>
            <dt className="text-slate-500">Tipo</dt>
            <dd>{licencia.tipo === 'pase' ? 'Pase Maestro' : 'CalificaYa'}</dd>
            {licencia.vigenteHasta && (
              <>
                <dt className="text-slate-500">Vigente hasta</dt>
                <dd>{fecha(licencia.vigenteHasta)}</dd>
              </>
            )}
            <dt className="text-slate-500">Activada</dt>
            <dd>{fecha(licencia.activadaEn)}</dd>
            <dt className="text-slate-500">Última verificación</dt>
            <dd>{fecha(licencia.ultimaVerificacion)}</dd>
            {licencia.dispositivosUsados !== undefined && (
              <>
                <dt className="text-slate-500">Dispositivos</dt>
                <dd>{licencia.dispositivosUsados} de {config.maxDispositivos}</dd>
              </>
            )}
          </dl>
        ) : (
          <div className="space-y-3 text-sm text-slate-600">
            <p>{config.licencia.obligatoria ? 'Sin licencia.' : 'CalificaYa es gratis por ahora. Si ya tienes la clave de CalificaYa o del Pase Maestro, puedes activarla desde ya.'}</p>
            <Link to="/activar" className={`${btn.primary} block text-center`}>Activar licencia</Link>
          </div>
        )}
        {!omitida && licencia && (
          <button onClick={onDesactivar} disabled={liberando} className={`${btn.danger} mt-4 w-full`}>
            {liberando ? 'Liberando…' : 'Desactivar en este dispositivo'}
          </button>
        )}
        {error && <div className="mt-3"><Aviso mensaje={error} /></div>}
        <p className="mt-3 text-xs text-slate-500">
          Con internet, la licencia se verifica al abrir la app una vez al día. Sin conexión la app sigue funcionando hasta {config.diasSinConexion} días.
          Soporte: <a href={`mailto:${config.supportEmail}`} className="underline">{config.supportEmail}</a>
        </p>
      </section>
      <section className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm">
        <h2 className="mb-2 font-semibold text-slate-800">Privacidad</h2>
        <p>En este dispositivo solo se guardan tus claves de examen y el estado de la licencia. Los códigos, nombres, respuestas, calificaciones e imágenes de una sesión existen solo en memoria y se borran al cerrarla.</p>
      </section>
      <section className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm">
        <h2 className="mb-2 font-semibold text-slate-800">Versión</h2>
        <p className="font-mono" data-testid="version">{__APP_VERSION__}</p>
        {nueva || hayNueva ? (
          <button onClick={actualizarAhora} className={`${btn.primary} mt-3 w-full text-sm`}>Hay una versión nueva: actualizar ahora</button>
        ) : (
          <button onClick={buscarActualizacion} disabled={buscando} className={`${btn.secondary} mt-3 w-full text-sm`}>
            {buscando ? 'Buscando…' : 'Buscar actualización'}
          </button>
        )}
        {mensaje && <p className="mt-2 text-xs text-slate-500">{mensaje}</p>}
      </section>
    </Screen>
  );
}
