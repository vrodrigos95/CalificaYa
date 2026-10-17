// ÚNICO módulo que habla con el servidor de licencias (trucosdeaula.com/api/licencia.php).
// Lo único que sale del dispositivo es la clave y el identificador aleatorio del dispositivo.
//
//   POST { accion: 'verificar', app: 'calificaya', licenseKey, deviceId }
//     → { valida, tipo: 'app' | 'pase' | null, vigenteHasta, dispositivosUsados, motivo }
//   POST { accion: 'liberar', licenseKey, deviceId } → { liberado, motivo }

/** El servidor dijo que la clave no da acceso: no cambia aunque se reintente. */
export type MotivoRechazo =
  | 'clave_invalida'
  | 'reembolsada'
  | 'contracargo'
  | 'disputa'
  | 'pago_fallido'
  | 'pase_vencido'
  | 'limite_dispositivos';

/** No se pudo saber: sin internet, Gumroad caído, demasiados intentos o error del servidor. */
export type MotivoTemporal = 'sin_conexion' | 'gumroad_no_disponible' | 'demasiados_intentos' | 'error_servidor';

export type Verificacion =
  | { tipo: 'valida'; licencia: 'app' | 'pase'; vigenteHasta: string | null; dispositivosUsados: number }
  | { tipo: 'rechazada'; motivo: MotivoRechazo }
  | { tipo: 'temporal'; motivo: MotivoTemporal };

export type Liberacion = { ok: true } | { ok: false; motivo: MotivoTemporal };

export interface OpcionesServidor {
  url: string;
  fetch?: typeof fetch;
  /** Milisegundos antes de rendirse (cuenta como sin conexión). */
  timeout?: number;
}

const RECHAZOS: readonly string[] = ['clave_invalida', 'reembolsada', 'contracargo', 'disputa', 'pago_fallido', 'pase_vencido', 'limite_dispositivos'];
const TEMPORALES: readonly string[] = ['gumroad_no_disponible', 'demasiados_intentos', 'error_servidor'];

async function pedir(cuerpo: Record<string, string>, o: OpcionesServidor): Promise<Record<string, unknown> | MotivoTemporal> {
  const f = o.fetch ?? fetch;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), o.timeout ?? 15_000);
  let res: Response;
  try {
    res = await f(o.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: ctrl.signal,
    });
  } catch {
    return 'sin_conexion';
  } finally {
    clearTimeout(t);
  }
  try {
    const datos = await res.json();
    return datos && typeof datos === 'object' ? datos : 'error_servidor';
  } catch {
    return 'error_servidor';
  }
}

export async function verificarLicencia(codigo: string, dispositivo: string, o: OpcionesServidor): Promise<Verificacion> {
  const d = await pedir({ accion: 'verificar', app: 'calificaya', licenseKey: codigo.trim(), deviceId: dispositivo }, o);
  if (typeof d === 'string') return { tipo: 'temporal', motivo: d };
  if (d.valida === true) {
    return {
      tipo: 'valida',
      licencia: d.tipo === 'pase' ? 'pase' : 'app',
      vigenteHasta: typeof d.vigenteHasta === 'string' ? d.vigenteHasta : null,
      dispositivosUsados: Number(d.dispositivosUsados ?? 0),
    };
  }
  const motivo = String(d.motivo ?? '');
  if (RECHAZOS.includes(motivo)) return { tipo: 'rechazada', motivo: motivo as MotivoRechazo };
  // Una clave mal escrita llega como datos_invalidos: para quien la escribió es una clave inválida.
  if (motivo === 'datos_invalidos') return { tipo: 'rechazada', motivo: 'clave_invalida' };
  return { tipo: 'temporal', motivo: TEMPORALES.includes(motivo) ? (motivo as MotivoTemporal) : 'error_servidor' };
}

/** Quita este dispositivo de la clave para liberar su lugar. */
export async function liberarDispositivo(codigo: string, dispositivo: string, o: OpcionesServidor): Promise<Liberacion> {
  const d = await pedir({ accion: 'liberar', licenseKey: codigo.trim(), deviceId: dispositivo }, o);
  if (typeof d === 'string') return { ok: false, motivo: d };
  // liberado: false = ya no estaba registrado; para este dispositivo el resultado es el mismo.
  if (typeof d.liberado === 'boolean') return { ok: true };
  const motivo = String(d.motivo ?? '');
  return { ok: false, motivo: TEMPORALES.includes(motivo) ? (motivo as MotivoTemporal) : 'error_servidor' };
}
