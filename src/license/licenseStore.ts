import { create } from 'zustand';
import { config, LICENCIA_DE_PRUEBA } from '../config';
import type { EstadoLicencia } from '../db/db';
import { repoLicencia } from '../db/licenseRepo';
import { idDispositivo } from './dispositivo';
import * as svc from './licenseService';
import { liberarDispositivo, verificarLicencia, type Liberacion } from './servidor';

const deps: svc.Dependencias = {
  verificar: (codigo) => verificarLicencia(codigo, idDispositivo(), { url: config.licencia.url }),
  liberar: (codigo) => liberarDispositivo(codigo, idDispositivo(), { url: config.licencia.url }),
  repo: repoLicencia,
  config,
  // El código de prueba solo existe en `npm run dev`; la versión publicada no lo acepta.
  // En la versión publicada solo se acepta el código maestro, si se configuró.
  codigoPrueba: (config.desarrollo ? LICENCIA_DE_PRUEBA : config.codigoMaestro)?.toUpperCase(),
};

/** En desarrollo y en localhost, la licencia se omite por completo. */
export function omitirLicencia(): boolean {
  return config.desarrollo && typeof location !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
}

type Fase = 'cargando' | 'activacion' | 'requiere-conexion' | 'verificando' | 'lista';

interface Estado {
  fase: Fase;
  licencia: EstadoLicencia | null;
  omitida: boolean;
  /** Por qué se quitó la licencia de este dispositivo (se muestra en Activación y en Ajustes). */
  aviso: svc.Motivo | null;
  iniciar: () => Promise<void>;
  activar: (codigo: string) => Promise<svc.ResultadoActivacion>;
  reintentar: () => Promise<void>;
  desactivar: () => Promise<Liberacion>;
  /** Verifica en segundo plano si toca (al abrir o al recuperar internet). */
  revalidarSiToca: () => Promise<void>;
}

// Mientras la licencia no sea obligatoria, CalificaYa nunca bloquea: la licencia solo se muestra en Ajustes.
const sinLicencia = (): Fase => (config.licencia.obligatoria ? 'activacion' : 'lista');

export const useLicencia = create<Estado>((set, get) => ({
  fase: 'cargando',
  licencia: null,
  omitida: false,
  aviso: null,

  iniciar: async () => {
    if (omitirLicencia()) { set({ fase: 'lista', omitida: true }); return; }
    const l = await deps.repo.leer();
    const e = svc.evaluar(l, new Date(), config, deps.codigoPrueba);
    if (e.estado === 'sin-licencia') set({ fase: sinLicencia(), licencia: null });
    else if (e.estado === 'activa') {
      set({ fase: 'lista', licencia: e.licencia });
      if (e.revalidar) get().revalidarSiToca();
    } else if (config.licencia.obligatoria) {
      set({ fase: 'verificando', licencia: e.licencia });
      await get().reintentar();
    } else {
      set({ fase: 'lista', licencia: e.licencia });
      get().reintentar();
    }
  },

  activar: async (codigo) => {
    const r = await svc.activar(codigo, deps);
    if (r.ok) set({ fase: 'lista', licencia: r.licencia, aviso: null });
    return r;
  },

  reintentar: async () => {
    const l = get().licencia;
    if (!l) { set({ fase: sinLicencia() }); return; }
    if (config.licencia.obligatoria) set({ fase: 'verificando' });
    const r = await svc.revalidar(l, deps);
    if (r.resultado === 'activa') set({ fase: 'lista', licencia: r.licencia });
    else if (r.resultado === 'desactivada') set({ fase: sinLicencia(), licencia: null, aviso: r.motivo });
    else if (config.licencia.obligatoria) set({ fase: 'requiere-conexion' });
  },

  desactivar: async () => {
    const l = get().licencia;
    if (!l) return { ok: true };
    const r = await svc.desactivar(l, deps);
    if (r.ok) set({ fase: sinLicencia(), licencia: null, aviso: null });
    return r;
  },

  revalidarSiToca: async () => {
    const l = get().licencia;
    if (!l || get().omitida) return;
    const e = svc.evaluar(l, new Date(), config, deps.codigoPrueba);
    if (e.estado === 'sin-licencia' || (e.estado === 'activa' && !e.revalidar)) return;
    const r = await svc.revalidar(l, deps);
    if (r.resultado === 'activa') set({ licencia: r.licencia, ...(get().fase === 'requiere-conexion' ? { fase: 'lista' as const } : {}) });
    else if (r.resultado === 'desactivada') set({ fase: sinLicencia(), licencia: null, aviso: r.motivo });
  },
}));
