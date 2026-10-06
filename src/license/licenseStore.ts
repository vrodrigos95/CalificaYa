import { create } from 'zustand';
import { config, LICENCIA_DE_PRUEBA } from '../config';
import type { EstadoLicencia } from '../db/db';
import { repoLicencia } from '../db/licenseRepo';
import { verificarLicencia } from './gumroad';
import * as svc from './licenseService';

const deps: svc.Dependencias = {
  verificar: (codigo, incrementar) =>
    verificarLicencia(codigo, { productId: config.gumroad.productId, incrementar, url: config.gumroad.verifyUrl }),
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
  puedeContinuar: boolean;
  /** Mensaje para la pantalla de activación o de conexión. */
  mensaje: string;
  iniciar: () => Promise<void>;
  activar: (codigo: string) => Promise<svc.ResultadoActivacion>;
  reintentar: () => Promise<void>;
  continuarSinConexion: () => Promise<void>;
  desactivar: () => Promise<void>;
  /** Revalida en segundo plano si toca (al abrir o al recuperar internet). */
  revalidarSiToca: () => Promise<void>;
}

const MSJ_DESACTIVADA = 'La licencia de este dispositivo ya no es válida (la compra fue reembolsada, tuvo un contracargo o la licencia se desactivó). Si crees que es un error, escribe a soporte.';

export const useLicencia = create<Estado>((set, get) => ({
  fase: 'cargando',
  licencia: null,
  omitida: false,
  puedeContinuar: false,
  mensaje: '',

  iniciar: async () => {
    if (omitirLicencia()) { set({ fase: 'lista', omitida: true }); return; }
    const l = await deps.repo.leer();
    const e = svc.evaluar(l, new Date(), config, deps.codigoPrueba);
    if (e.estado === 'sin-licencia') set({ fase: 'activacion', licencia: null });
    else if (e.estado === 'activa') {
      set({ fase: 'lista', licencia: e.licencia });
      if (e.revalidar) get().revalidarSiToca();
    } else {
      set({ fase: 'verificando', licencia: e.licencia, puedeContinuar: e.puedeContinuar });
      await get().reintentar();
    }
  },

  activar: async (codigo) => {
    const r = await svc.activar(codigo, deps);
    if (r.ok) set({ fase: 'lista', licencia: r.licencia, mensaje: '' });
    return r;
  },

  reintentar: async () => {
    const l = get().licencia;
    if (!l) { set({ fase: 'activacion' }); return; }
    set({ fase: 'verificando' });
    const r = await svc.revalidar(l, deps);
    if (r === 'desactivada') set({ fase: 'activacion', licencia: null, mensaje: MSJ_DESACTIVADA });
    else if (r === 'sin-conexion') set({ fase: 'requiere-conexion', mensaje: '' });
    else set({ fase: 'lista', licencia: (await deps.repo.leer()) ?? l }); // activa o error del servidor de Gumroad
  },

  continuarSinConexion: async () => {
    const l = get().licencia;
    if (!l || !get().puedeContinuar) return;
    const nueva = await svc.usarGracia(l, deps);
    set({ fase: 'lista', licencia: nueva, puedeContinuar: false });
  },

  desactivar: async () => {
    await svc.desactivar(deps);
    set({ fase: 'activacion', licencia: null, mensaje: '' });
  },

  revalidarSiToca: async () => {
    const l = get().licencia;
    if (!l || get().omitida) return;
    const e = svc.evaluar(l, new Date(), config, deps.codigoPrueba);
    if (e.estado !== 'activa' || !e.revalidar) return;
    const r = await svc.revalidar(l, deps);
    if (r === 'desactivada') set({ fase: 'activacion', licencia: null, mensaje: MSJ_DESACTIVADA });
    else if (r === 'activa') set({ licencia: (await deps.repo.leer()) ?? l });
  },
}));
