// Reglas de la licencia: activación, revalidación periódica y periodo de gracia.
// No habla con la red directamente: recibe `verificar` (ver gumroad.ts) para que
// las pruebas usen respuestas simuladas.
//
// Esto es una barrera contra el uso compartido casual, no una protección
// absoluta: el código de una PWA se puede inspeccionar.

import type { EstadoLicencia } from '../db/db';
import type { Verificacion } from './gumroad';

export interface ConfigLicencia {
  maxActivaciones: number;
  diasRevalidacion: number;
  diasGracia: number;
}

export interface RepoLicencia {
  leer: () => Promise<EstadoLicencia | undefined>;
  guardar: (l: EstadoLicencia) => Promise<void>;
  borrar: () => Promise<void>;
}

export interface Dependencias {
  verificar: (codigo: string, incrementar: boolean) => Promise<Verificacion>;
  repo: RepoLicencia;
  config: ConfigLicencia;
  ahora?: () => Date;
  /** Código aceptado sin red (solo se pasa en modo desarrollo). */
  codigoPrueba?: string;
}

export type MotivoRechazo = 'vacia' | 'invalida' | 'reembolsada' | 'contracargo' | 'disputa' | 'limite' | 'error-red' | 'error-servidor';
export type ResultadoActivacion = { ok: true; licencia: EstadoLicencia } | { ok: false; motivo: MotivoRechazo };

const DIA = 24 * 60 * 60 * 1000;
const hoy = (d: Dependencias) => (d.ahora ? d.ahora() : new Date());

/**
 * Activa la licencia en este dispositivo.
 * 1) Consulta SIN gastar un uso: si ya está en el máximo, se rechaza sin gastar otro.
 * 2) Consulta gastando un uso (increment_uses_count=true) y vuelve a revisar el límite.
 */
export async function activar(codigoBruto: string, d: Dependencias): Promise<ResultadoActivacion> {
  const codigo = codigoBruto.trim();
  if (!codigo) return { ok: false, motivo: 'vacia' };
  const ahora = hoy(d).toISOString();

  if (d.codigoPrueba && codigo.toUpperCase() === d.codigoPrueba) {
    const licencia: EstadoLicencia = { id: 'actual', codigo: d.codigoPrueba, activadaEn: ahora, ultimaVerificacion: ahora };
    await d.repo.guardar(licencia);
    return { ok: true, licencia };
  }

  const previa = await d.verificar(codigo, false);
  if (previa.tipo !== 'valida') return { ok: false, motivo: previa.tipo };
  if (previa.usos >= d.config.maxActivaciones) return { ok: false, motivo: 'limite' };

  const v = await d.verificar(codigo, true);
  if (v.tipo !== 'valida') return { ok: false, motivo: v.tipo };
  if (v.usos > d.config.maxActivaciones) return { ok: false, motivo: 'limite' };

  const licencia: EstadoLicencia = { id: 'actual', codigo, activadaEn: ahora, ultimaVerificacion: ahora };
  await d.repo.guardar(licencia);
  return { ok: true, licencia };
}

export type EstadoApp =
  | { estado: 'sin-licencia' }
  /** `revalidar`: ya pasaron los días de revalidación; se intenta en segundo plano sin bloquear. */
  | { estado: 'activa'; licencia: EstadoLicencia; revalidar: boolean }
  /** Pasaron los días de gracia sin poder revalidar: pedir conexión antes de seguir. */
  | { estado: 'requiere-conexion'; licencia: EstadoLicencia; puedeContinuar: boolean };

export function diasDesde(fechaIso: string, ahora: Date): number {
  return (ahora.getTime() - new Date(fechaIso).getTime()) / DIA;
}

/** Estado al abrir la app (sin red). */
export function evaluar(l: EstadoLicencia | undefined, ahora: Date, c: ConfigLicencia, codigoPrueba?: string): EstadoApp {
  if (!l) return { estado: 'sin-licencia' };
  if (codigoPrueba && l.codigo === codigoPrueba) return { estado: 'activa', licencia: l, revalidar: false };
  const dias = diasDesde(l.ultimaVerificacion, ahora);
  if (dias < c.diasRevalidacion) return { estado: 'activa', licencia: l, revalidar: false };
  if (dias < c.diasGracia) return { estado: 'activa', licencia: l, revalidar: true };
  return { estado: 'requiere-conexion', licencia: l, puedeContinuar: l.graciaUsadaPara !== l.ultimaVerificacion };
}

export type ResultadoRevalidacion =
  | 'activa'
  /** Reembolsada, con contracargo o desactivada en Gumroad: se borra la licencia local. */
  | 'desactivada'
  | 'sin-conexion'
  /** Gumroad falló: no se bloquea a quien ya estaba activado. */
  | 'error-servidor';

/** Revalida SIN gastar un uso (increment_uses_count=false). */
export async function revalidar(l: EstadoLicencia, d: Dependencias): Promise<ResultadoRevalidacion> {
  const v = await d.verificar(l.codigo, false);
  switch (v.tipo) {
    case 'valida':
      await d.repo.guardar({ ...l, ultimaVerificacion: hoy(d).toISOString(), graciaUsadaPara: undefined });
      return 'activa';
    case 'reembolsada':
    case 'contracargo':
    case 'invalida':
      await d.repo.borrar();
      return 'desactivada';
    case 'disputa':
      // Una disputa puede resolverse a favor del vendedor: no se desactiva, se vuelve a revisar luego.
      return 'activa';
    case 'error-red':
      return 'sin-conexion';
    case 'error-servidor':
      return 'error-servidor';
  }
}

/** Usar el "Continuar esta vez" del periodo de gracia vencido (una sola vez por periodo). */
export async function usarGracia(l: EstadoLicencia, d: Dependencias): Promise<EstadoLicencia> {
  const nueva = { ...l, graciaUsadaPara: l.ultimaVerificacion };
  await d.repo.guardar(nueva);
  return nueva;
}

export async function desactivar(d: Dependencias): Promise<void> {
  await d.repo.borrar();
}

export function enmascarar(codigo: string): string {
  const limpio = codigo.trim();
  return limpio.length <= 4 ? limpio : `${'•'.repeat(Math.min(12, limpio.length - 4))}${limpio.slice(-4)}`;
}
