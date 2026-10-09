// Actualizaciones de la app (service worker). La versión nueva se descarga sola
// en segundo plano y queda esperando; el docente decide cuándo aplicarla con el
// aviso «Hay una versión nueva» (así nunca se recarga a media sesión).
//
// En iPhone el service worker a veces no se actualiza (o registration.update()
// falla aunque haya internet). Por eso además se consulta version.json, que el
// servidor nunca guarda en caché: si la versión publicada es otra y el service
// worker no trae la nueva, se ofrece una actualización forzada.
import { create } from 'zustand';
import { registerSW } from 'virtual:pwa-register';

interface Estado {
  hayNueva: boolean;
  aplicar: () => void;
}

export const useActualizacion = create<Estado>(() => ({ hayNueva: false, aplicar: () => location.reload() }));

const CADA_MS = 30 * 60 * 1000;
/** Tiempo que se le da al service worker para descargar la versión nueva antes de forzarla. */
const ESPERA_SW_MS = 20 * 1000;

/** Versión publicada en el servidor, o null si no se pudo consultar (sin internet). */
export async function versionPublicada(): Promise<string | null> {
  if (import.meta.env.DEV) return __APP_VERSION__;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    return String((await r.json()).version ?? '') || null;
  } catch {
    return null;
  }
}

/**
 * Actualización forzada: quita el service worker y los archivos guardados de la
 * app (no las claves ni la licencia, que están en otra parte) y recarga, así el
 * navegador descarga la versión publicada.
 */
export async function forzarActualizacion() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    const nombres = (await globalThis.caches?.keys()) ?? [];
    await Promise.all(nombres.map((n) => caches.delete(n)));
  } finally {
    location.reload();
  }
}

/** Revisa si hay versión nueva; si el service worker no la trae a tiempo, ofrece forzarla. */
export async function revisarActualizacion(): Promise<'al-dia' | 'nueva' | 'sin-conexion'> {
  const publicada = await versionPublicada();
  if (!publicada) return 'sin-conexion';
  if (publicada === __APP_VERSION__) return 'al-dia';
  try { await (await navigator.serviceWorker?.getRegistration())?.update(); } catch { /* se fuerza abajo */ }
  setTimeout(() => {
    if (!useActualizacion.getState().hayNueva) useActualizacion.setState({ hayNueva: true, aplicar: () => { forzarActualizacion(); } });
  }, ESPERA_SW_MS);
  return 'nueva';
}

export function iniciarActualizaciones() {
  const actualizarSW = registerSW({
    immediate: true,
    onNeedRefresh: () => useActualizacion.setState({ hayNueva: true, aplicar: () => { actualizarSW(true); } }),
  });
  // iPhone casi nunca busca versiones nuevas por su cuenta: se revisa al abrir
  // la app, al volver a ella y cada 30 minutos.
  const revisar = () => { if (navigator.onLine) revisarActualizacion().catch(() => undefined); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revisar(); });
  setInterval(revisar, CADA_MS);
  setTimeout(revisar, 3000);
}
