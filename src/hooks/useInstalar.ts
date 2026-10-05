import { useEffect, useState } from 'react';

interface EventoInstalar extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

// El navegador avisa (beforeinstallprompt) cuando la app se puede instalar.
let pendiente: EventoInstalar | null = null;
const oyentes = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pendiente = e as EventoInstalar; oyentes.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { pendiente = null; oyentes.forEach((f) => f()); });
}

/** Botón "Instalar app": disponible cuando el navegador lo permite (Android/Chrome). */
export function useInstalar() {
  const [, refrescar] = useState(0);
  useEffect(() => {
    const f = () => refrescar((n) => n + 1);
    oyentes.add(f);
    return () => { oyentes.delete(f); };
  }, []);
  return {
    disponible: !!pendiente,
    instalar: async () => {
      if (!pendiente) return;
      await pendiente.prompt();
      await pendiente.userChoice.catch(() => undefined);
      pendiente = null;
      refrescar((n) => n + 1);
    },
  };
}
