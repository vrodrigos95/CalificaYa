import { describe, expect, it, vi } from 'vitest';
import type { EstadoLicencia } from '../src/db/db';
import { idDispositivo } from '../src/license/dispositivo';
import { activar, desactivar, enmascarar, evaluar, revalidar, type Dependencias } from '../src/license/licenseService';
import { liberarDispositivo, verificarLicencia, type Liberacion, type Verificacion } from '../src/license/servidor';

// ---------------------------------------------------------------- Servidor simulado
function respuesta(status: number, cuerpo: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;
}
const sinInternet = (vi.fn(async () => { throw new TypeError('Failed to fetch'); }) as unknown) as typeof fetch;
const URL_LICENCIA = 'https://trucosdeaula.com/api/licencia.php';
const rechazo = (motivo: string, status = 200) => respuesta(status, { valida: false, tipo: null, vigenteHasta: null, dispositivosUsados: null, motivo });

describe('servidor.ts: interpretación de respuestas', () => {
  const v = (f: typeof fetch) => verificarLicencia('ABCD-1234', 'disp-0001', { url: URL_LICENCIA, fetch: f });

  it('envía accion, app, licenseKey y deviceId por POST en JSON', async () => {
    const f = respuesta(200, { valida: true, tipo: 'app', vigenteHasta: null, dispositivosUsados: 1, motivo: null });
    await verificarLicencia(' ABCD-1234 ', 'disp-0001', { url: URL_LICENCIA, fetch: f });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(URL_LICENCIA);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ accion: 'verificar', app: 'calificaya', licenseKey: 'ABCD-1234', deviceId: 'disp-0001' });
  });
  it('clave de CalificaYa válida', async () =>
    expect(await v(respuesta(200, { valida: true, tipo: 'app', vigenteHasta: null, dispositivosUsados: 2, motivo: null })))
      .toEqual({ tipo: 'valida', licencia: 'app', vigenteHasta: null, dispositivosUsados: 2 }));
  it('Pase Maestro cancelado con fecha futura: válido con vigenteHasta', async () =>
    expect(await v(respuesta(200, { valida: true, tipo: 'pase', vigenteHasta: '2026-11-30', dispositivosUsados: 1, motivo: null })))
      .toEqual({ tipo: 'valida', licencia: 'pase', vigenteHasta: '2026-11-30', dispositivosUsados: 1 }));
  it.each(['clave_invalida', 'reembolsada', 'contracargo', 'disputa', 'pago_fallido', 'pase_vencido', 'limite_dispositivos'])('rechazo definitivo: %s', async (m) =>
    expect(await v(rechazo(m))).toEqual({ tipo: 'rechazada', motivo: m }));
  it('datos_invalidos (clave mal escrita) cuenta como clave inválida', async () =>
    expect(await v(rechazo('datos_invalidos', 400))).toEqual({ tipo: 'rechazada', motivo: 'clave_invalida' }));
  it('Gumroad caído (503) es temporal', async () =>
    expect(await v(rechazo('gumroad_no_disponible', 503))).toEqual({ tipo: 'temporal', motivo: 'gumroad_no_disponible' }));
  it('demasiados intentos (429) es temporal', async () =>
    expect(await v(rechazo('demasiados_intentos', 429))).toEqual({ tipo: 'temporal', motivo: 'demasiados_intentos' }));
  it('sin internet', async () => expect(await v(sinInternet)).toEqual({ tipo: 'temporal', motivo: 'sin_conexion' }));
  it('respuesta que no es JSON', async () => {
    const f = (vi.fn(async () => new Response('<html>', { status: 502 })) as unknown) as typeof fetch;
    expect(await v(f)).toEqual({ tipo: 'temporal', motivo: 'error_servidor' });
  });
  it('liberar envía accion, licenseKey y deviceId', async () => {
    const f = respuesta(200, { liberado: true, motivo: null });
    expect(await liberarDispositivo('ABCD-1234', 'disp-0001', { url: URL_LICENCIA, fetch: f })).toEqual({ ok: true });
    const [, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ accion: 'liberar', licenseKey: 'ABCD-1234', deviceId: 'disp-0001' });
  });
  it('liberar sin internet no se da por hecho', async () =>
    expect(await liberarDispositivo('ABCD-1234', 'disp-0001', { url: URL_LICENCIA, fetch: sinInternet })).toEqual({ ok: false, motivo: 'sin_conexion' }));
});

describe('identificador del dispositivo', () => {
  const almacen = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };
  it('se crea la primera vez y después siempre es el mismo', () => {
    const a = almacen();
    const id = idDispositivo(a);
    expect(id).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(idDispositivo(a)).toBe(id);
  });
  it('cada dispositivo tiene uno distinto', () => expect(idDispositivo(almacen())).not.toBe(idDispositivo(almacen())));
});

// ---------------------------------------------------------------- Reglas de la licencia
const AHORA = new Date('2026-10-05T12:00:00Z');
const cfg = { horasRevalidacion: 24, diasSinConexion: 7 };
const valida = (extra: Partial<Extract<Verificacion, { tipo: 'valida' }>> = {}): Verificacion =>
  ({ tipo: 'valida', licencia: 'app', vigenteHasta: null, dispositivosUsados: 1, ...extra });

function entorno(respuestas: Verificacion[], liberaciones: Liberacion[] = [], ahora = AHORA) {
  let guardada: EstadoLicencia | undefined;
  const llamadas: string[] = [];
  const d: Dependencias = {
    verificar: async (c) => { llamadas.push('verificar ' + c); return respuestas.shift()!; },
    liberar: async (c) => { llamadas.push('liberar ' + c); return liberaciones.shift()!; },
    repo: { leer: async () => guardada, guardar: async (l) => { guardada = l; }, borrar: async () => { guardada = undefined; } },
    config: cfg,
    ahora: () => ahora,
  };
  return { d, llamadas, guardada: () => guardada, poner: (l: EstadoLicencia) => { guardada = l; } };
}

const lic = (horasAtras: number, extra: Partial<EstadoLicencia> = {}): EstadoLicencia => {
  const f = new Date(AHORA.getTime() - horasAtras * 3600_000).toISOString();
  return { id: 'actual', codigo: 'ABCD-1234', activadaEn: f, ultimaVerificacion: f, tipo: 'app', vigenteHasta: null, ...extra };
};

describe('activación', () => {
  it('válida: guarda la clave, la fecha de verificación y el tipo', async () => {
    const e = entorno([valida({ licencia: 'pase', dispositivosUsados: 2 })]);
    const r = await activar('  ABCD-1234 ', e.d);
    expect(r.ok).toBe(true);
    expect(e.llamadas).toEqual(['verificar ABCD-1234']);
    expect(e.guardada()).toEqual({
      id: 'actual', codigo: 'ABCD-1234', activadaEn: AHORA.toISOString(), ultimaVerificacion: AHORA.toISOString(),
      tipo: 'pase', vigenteHasta: null, dispositivosUsados: 2,
    });
  });
  it.each([
    'clave_invalida', 'reembolsada', 'pago_fallido', 'pase_vencido', 'limite_dispositivos',
  ] as const)('rechazada por %s: no guarda nada', async (motivo) => {
    const e = entorno([{ tipo: 'rechazada', motivo }]);
    expect(await activar('X-1234-5678', e.d)).toEqual({ ok: false, motivo });
    expect(e.guardada()).toBeUndefined();
  });
  it.each(['sin_conexion', 'gumroad_no_disponible'] as const)('%s: no da acceso nuevo', async (motivo) => {
    const e = entorno([{ tipo: 'temporal', motivo }]);
    expect(await activar('X-1234-5678', e.d)).toEqual({ ok: false, motivo });
    expect(e.guardada()).toBeUndefined();
  });
  it('código vacío', async () => expect(await activar('   ', entorno([]).d)).toEqual({ ok: false, motivo: 'vacia' }));
  it('código de prueba (solo se configura en desarrollo): no usa la red', async () => {
    const e = entorno([]);
    e.d.codigoPrueba = 'PRUEBA-0000-0000-0000';
    expect((await activar('prueba-0000-0000-0000', e.d)).ok).toBe(true);
    expect(e.llamadas).toEqual([]);
  });
});

describe('al abrir la app', () => {
  it('sin licencia', () => expect(evaluar(undefined, AHORA, cfg)).toEqual({ estado: 'sin-licencia' }));
  it('verificada hace 23 h → activa, sin volver a verificar', () =>
    expect(evaluar(lic(23), AHORA, cfg)).toMatchObject({ estado: 'activa', revalidar: false }));
  it('verificada hace 25 h → activa y se verifica en segundo plano', () =>
    expect(evaluar(lic(25), AHORA, cfg)).toMatchObject({ estado: 'activa', revalidar: true }));
  it('sin internet dentro de 7 días (6 días y 23 h) → se puede usar', () =>
    expect(evaluar(lic(6 * 24 + 23), AHORA, cfg)).toMatchObject({ estado: 'activa' }));
  it('sin internet más de 7 días → pide conexión', () =>
    expect(evaluar(lic(7 * 24 + 1), AHORA, cfg)).toMatchObject({ estado: 'requiere-conexion' }));
  it('pase cancelado: antes de vigenteHasta se usa; desde ese día pide conexión', () => {
    expect(evaluar(lic(1, { tipo: 'pase', vigenteHasta: '2026-10-20' }), AHORA, cfg)).toMatchObject({ estado: 'activa' });
    expect(evaluar(lic(1, { tipo: 'pase', vigenteHasta: '2026-10-05' }), AHORA, cfg)).toMatchObject({ estado: 'requiere-conexion' });
  });
});

describe('verificar de nuevo', () => {
  it('válida: actualiza la fecha y los datos del pase', async () => {
    const e = entorno([valida({ licencia: 'pase', vigenteHasta: '2026-12-01', dispositivosUsados: 2 })]);
    const r = await revalidar(lic(30), e.d);
    expect(r.resultado).toBe('activa');
    expect(e.guardada()).toMatchObject({ ultimaVerificacion: AHORA.toISOString(), tipo: 'pase', vigenteHasta: '2026-12-01', dispositivosUsados: 2 });
  });
  it.each(['reembolsada', 'pase_vencido', 'pago_fallido', 'limite_dispositivos'] as const)('%s → se quita la licencia de este dispositivo', async (motivo) => {
    const e = entorno([{ tipo: 'rechazada', motivo }]);
    e.poner(lic(30));
    expect(await revalidar(lic(30), e.d)).toEqual({ resultado: 'desactivada', motivo });
    expect(e.guardada()).toBeUndefined();
  });
  it.each(['sin_conexion', 'gumroad_no_disponible', 'error_servidor'] as const)('%s → no bloquea ni borra (cuentan los 7 días)', async (motivo) => {
    const e = entorno([{ tipo: 'temporal', motivo }]);
    e.poner(lic(30));
    expect(await revalidar(lic(30), e.d)).toEqual({ resultado: 'sin-verificar', motivo });
    expect(e.guardada()).toEqual(lic(30));
  });
});

describe('desactivar en este dispositivo', () => {
  it('libera el lugar en el servidor y borra la licencia local', async () => {
    const e = entorno([], [{ ok: true }]);
    e.poner(lic(1));
    expect(await desactivar(lic(1), e.d)).toEqual({ ok: true });
    expect(e.llamadas).toEqual(['liberar ABCD-1234']);
    expect(e.guardada()).toBeUndefined();
  });
  it('sin internet: no se borra (el lugar seguiría ocupado en el servidor)', async () => {
    const e = entorno([], [{ ok: false, motivo: 'sin_conexion' }]);
    e.poner(lic(1));
    expect(await desactivar(lic(1), e.d)).toEqual({ ok: false, motivo: 'sin_conexion' });
    expect(e.guardada()).toBeDefined();
  });
});

it('enmascara la licencia (solo últimos 4)', () => expect(enmascarar('ABCD1234-EFGH5678')).toBe('••••••••••••5678'));
