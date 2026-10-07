import { useState } from 'react';
import Screen, { btn } from '../components/Screen';
import { useActualizacion } from '../lib/actualizacion';
import { config } from '../config';
import { enmascarar } from '../license/licenseService';
import { useLicencia } from '../license/licenseStore';
import { useSesion } from '../session/sessionStore';

const fecha = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

export default function Ajustes() {
  const { licencia, omitida, desactivar } = useLicencia();
  const sesion = useSesion((s) => s.sesion);
  const hayNueva = useActualizacion((s) => s.hayNueva);
  const [buscando, setBuscando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  async function buscarActualizacion() {
    setBuscando(true);
    setMensaje('');
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
      // Si hay versión nueva, el aviso de abajo aparece en unos segundos al terminar de descargarla.
      await new Promise((r) => setTimeout(r, 1500));
      if (!useActualizacion.getState().hayNueva && !reg?.installing && !reg?.waiting) setMensaje('Ya tienes la versión más reciente.');
      else if (!useActualizacion.getState().hayNueva) setMensaje('Descargando la versión nueva… en un momento aparece el aviso para actualizar.');
    } catch {
      setMensaje('No se pudo buscar: revisa tu conexión a internet.');
    } finally {
      setBuscando(false);
    }
  }

  async function onDesactivar() {
    const aviso = sesion?.hojas.length ? `\n\nTienes una sesión abierta con ${sesion.hojas.length} hoja(s); se perderá si no la exportas.` : '';
    if (!confirm(`¿Desactivar CalificaYa en este dispositivo?\n\nPara volver a usarla tendrás que activarla de nuevo, y eso cuenta como un uso nuevo de tu licencia (máximo ${config.maxActivaciones} dispositivos).${aviso}`)) return;
    useSesion.getState().cerrar();
    await desactivar();
  }

  return (
    <Screen title="Ajustes" back="/">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-800">Licencia</h2>
        {omitida ? (
          <p className="text-sm text-slate-600">Modo desarrollo en este equipo: la licencia no se solicita.</p>
        ) : licencia ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-500">Código</dt>
            <dd className="font-mono text-slate-900" data-testid="licencia">{enmascarar(licencia.codigo)}</dd>
            <dt className="text-slate-500">Activada</dt>
            <dd>{fecha(licencia.activadaEn)}</dd>
            <dt className="text-slate-500">Última verificación</dt>
            <dd>{fecha(licencia.ultimaVerificacion)}</dd>
          </dl>
        ) : (
          <p className="text-sm text-slate-600">Sin licencia.</p>
        )}
        {!omitida && licencia && (
          <button onClick={onDesactivar} className={`${btn.danger} mt-4 w-full`}>Desactivar en este dispositivo</button>
        )}
        <p className="mt-3 text-xs text-slate-500">
          La licencia se verifica con Gumroad cada {config.diasRevalidacion} días cuando hay internet. Sin conexión la app sigue funcionando.
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
        <button onClick={buscarActualizacion} disabled={buscando} className={`${btn.secondary} mt-3 w-full text-sm`}>
          {buscando ? 'Buscando…' : hayNueva ? 'Hay una versión nueva: toca «Actualizar» abajo' : 'Buscar actualización'}
        </button>
        {mensaje && <p className="mt-2 text-xs text-slate-500">{mensaje}</p>}
      </section>
    </Screen>
  );
}
