// Actualizaciones de la app (service worker). La versión nueva se descarga sola
// en segundo plano y queda esperando; el docente decide cuándo aplicarla con el
// aviso «Hay una versión nueva» (así nunca se recarga a media sesión).
import { create } from 'zustand';
import { registerSW } from 'virtual:pwa-register';

interface Estado {
  hayNueva: boolean;
  aplicar: () => void;
}

export const useActualizacion = create<Estado>(() => ({ hayNueva: false, aplicar: () => location.reload() }));

const CADA_MS = 30 * 60 * 1000;

export function iniciarActualizaciones() {
  const actualizarSW = registerSW({
    immediate: true,
    onNeedRefresh: () => useActualizacion.setState({ hayNueva: true }),
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      // iPhone casi nunca busca versiones nuevas por su cuenta: se revisa al
      // abrir la app, al volver a ella y cada 30 minutos.
      const revisar = () => { if (navigator.onLine) reg.update().catch(() => undefined); };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revisar(); });
      setInterval(revisar, CADA_MS);
    },
  });
  useActualizacion.setState({ aplicar: () => { actualizarSW(true); } });
}
