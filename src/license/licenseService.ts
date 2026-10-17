// Reglas de la licencia: activación, verificación al abrir y uso sin conexión.
// No habla con la red directamente: recibe `verificar` y `liberar` (ver servidor.ts)
// para que las pruebas usen respuestas simuladas.
//
// Esto es una barrera contra el uso compartido casual, no una protección
// absoluta: el código de una PWA se puede inspeccionar.

import type { EstadoLicencia } from '../db/db';
import type { Liberacion, MotivoRechazo, MotivoTemporal, Verificacion } from './servidor';

export interface ConfigLicencia {
  horasRevalidacion: number;
  diasSinConexion: number;
}

export interface RepoLicencia {
  leer: () => Promise<EstadoLicencia | undefined>;
  guardar: (l: EstadoLicencia) => Promise<void>;
  borrar: () => Promise<void>;
}

export interface Dependencias {
  verificar: (codigo: string) => Promise<Verificacion>;
  liberar: (codigo: string) => Promise<Liberacion>;
  repo: RepoLicencia;
  config: ConfigLicencia;
  ahora?: () => Date;
  /** Código aceptado sin red (solo se pasa en modo desarrollo o como código maestro). */
  codigoPrueba?: string;
}

export type Motivo = 'vacia' | MotivoRechazo | MotivoTemporal;
export type ResultadoActivacion = { ok: true; licencia: EstadoLicencia } | { ok: false; motivo: Motivo };

const HORA = 60 * 60 * 1000;
const hoy = (d: Dependencias) => (d.ahora ? d.ahora() : new Date());

function conVerificacion(base: Omit<EstadoLicencia, 'ultimaVerificacion'>, v: Extract<Verificacion, { tipo: 'valida' }>, ahora: Date): EstadoLicencia {
  return { ...base, ultimaVerificacion: ahora.toISOString(), tipo: v.licencia, vigenteHasta: v.vigenteHasta, dispositivosUsados: v.dispositivosUsados };
}

/** Activa la licencia en este dispositivo. Si es válida, guarda la clave y la fecha de verificación. */
export async function activar(codigoBruto: string, d: Dependencias): Promise<ResultadoActivacion> {
  const codigo = codigoBruto.trim();
  if (!codigo) return { ok: false, motivo: 'vacia' };
  const ahora = hoy(d);

  if (d.codigoPrueba && codigo.toUpperCase() === d.codigoPrueba) {
    const licencia: EstadoLicencia = { id: 'actual', codigo: d.codigoPrueba, activadaEn: ahora.toISOString(), ultimaVerificacion: ahora.toISOString() };
    await d.repo.guardar(licencia);
    return { ok: true, licencia };
  }

  const v = await d.verificar(codigo);
  if (v.tipo !== 'valida') return { ok: false, motivo: v.motivo };
  const licencia = conVerificacion({ id: 'actual', codigo, activadaEn: ahora.toISOString() }, v, ahora);
  await d.repo.guardar(licencia);
  return { ok: true, licencia };
}

export type EstadoApp =
  | { estado: 'sin-licencia' }
  /** `revalidar`: pasaron más de 24 h; se verifica en segundo plano sin bloquear. */
  | { estado: 'activa'; licencia: EstadoLicencia; revalidar: boolean }
  /** Pasaron los días sin conexión (o llegó el fin de un pase cancelado): hay que verificar antes de seguir. */
  | { estado: 'requiere-conexion'; licencia: EstadoLicencia };

export function horasDesde(fechaIso: string, ahora: Date): number {
  return (ahora.getTime() - new Date(fechaIso).getTime()) / HORA;
}

const fechaLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Estado al abrir la app (sin red). */
export function evaluar(l: EstadoLicencia | undefined, ahora: Date, c: ConfigLicencia, codigoPrueba?: string): EstadoApp {
  if (!l) return { estado: 'sin-licencia' };
  if (codigoPrueba && l.codigo === codigoPrueba) return { estado: 'activa', licencia: l, revalidar: false };
  // Pase cancelado: desde su último día pagado ya no se usa sin confirmar con el servidor.
  if (l.vigenteHasta && fechaLocal(ahora) >= l.vigenteHasta) return { estado: 'requiere-conexion', licencia: l };
  const horas = horasDesde(l.ultimaVerificacion, ahora);
  if (horas < c.horasRevalidacion) return { estado: 'activa', licencia: l, revalidar: false };
  if (horas < c.diasSinConexion * 24) return { estado: 'activa', licencia: l, revalidar: true };
  return { estado: 'requiere-conexion', licencia: l };
}

export type ResultadoRevalidacion =
  | { resultado: 'activa'; licencia: EstadoLicencia }
  /** El servidor rechazó la clave (reembolso, pase vencido, dispositivo liberado…): se borra la licencia local. */
  | { resultado: 'desactivada'; motivo: MotivoRechazo }
  /** No se pudo verificar (sin internet, Gumroad caído…): la licencia local se queda como estaba. */
  | { resultado: 'sin-verificar'; motivo: MotivoTemporal };

export async function revalidar(l: EstadoLicencia, d: Dependencias): Promise<ResultadoRevalidacion> {
  const v = await d.verificar(l.codigo);
  if (v.tipo === 'valida') {
    const licencia = conVerificacion(l, v, hoy(d));
    await d.repo.guardar(licencia);
    return { resultado: 'activa', licencia };
  }
  if (v.tipo === 'rechazada') {
    await d.repo.borrar();
    return { resultado: 'desactivada', motivo: v.motivo };
  }
  return { resultado: 'sin-verificar', motivo: v.motivo };
}

/** Libera el lugar de este dispositivo en el servidor y borra la licencia local. Necesita internet. */
export async function desactivar(l: EstadoLicencia, d: Dependencias): Promise<Liberacion> {
  if (d.codigoPrueba && l.codigo === d.codigoPrueba) {
    await d.repo.borrar();
    return { ok: true };
  }
  const r = await d.liberar(l.codigo);
  if (r.ok) await d.repo.borrar();
  return r;
}

export function enmascarar(codigo: string): string {
  const limpio = codigo.trim();
  return limpio.length <= 4 ? limpio : `${'•'.repeat(Math.min(12, limpio.length - 4))}${limpio.slice(-4)}`;
}
