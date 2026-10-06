import { describe, expect, it, vi } from 'vitest';
import type { EstadoLicencia } from '../src/db/db';
import { verificarLicencia, type Verificacion } from '../src/license/gumroad';
import { activar, enmascarar, evaluar, revalidar, usarGracia, type Dependencias } from '../src/license/licenseService';

// ---------------------------------------------------------------- Gumroad simulado
function respuesta(status: number, cuerpo: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;
}
const compra = (extra: Record<string, unknown> = {}) => ({ refunded: false, chargebacked: false, disputed: false, email: 'docente@ejemplo.com', ...extra });
const ok = (uses: number, extra?: Record<string, unknown>) => respuesta(200, { success: true, uses, purchase: compra(extra) });
const sinInternet = (vi.fn(async () => { throw new TypeError('Failed to fetch'); }) as unknown) as typeof fetch;

describe('gumroad.ts: interpretación de respuestas', () => {
  const v = (f: typeof fetch) => verificarLicencia('ABCD-1234', { productId: 'prod', incrementar: false, fetch: f });

  it('envía product_id, license_key e increment_uses_count por POST', async () => {
    const f = ok(1);
    await verificarLicencia(' ABCD-1234 ', { productId: 'prod', incrementar: true, fetch: f });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.gumroad.com/v2/licenses/verify');
    expect(init.method).toBe('POST');
    expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual({ product_id: 'prod', license_key: 'ABCD-1234', increment_uses_count: 'true' });
  });
  it('licencia válida', async () => expect(await v(ok(2))).toEqual({ tipo: 'valida', usos: 2 }));
  it('licencia inválida (404, success: false)', async () =>
    expect(await v(respuesta(404, { success: false, message: 'That license does not exist for the provided product.' }))).toMatchObject({ tipo: 'invalida' }));
  it('compra reembolsada', async () => expect(await v(ok(1, { refunded: true }))).toEqual({ tipo: 'reembolsada' }));
  it('compra con contracargo', async () => expect(await v(ok(1, { chargebacked: true }))).toEqual({ tipo: 'contracargo' }));
  it('compra en disputa', async () => expect(await v(ok(1, { disputed: true }))).toEqual({ tipo: 'disputa' }));
  it('sin internet', async () => expect(await v(sinInternet)).toEqual({ tipo: 'error-red' }));
  it('error 500 de Gumroad', async () => expect(await v(respuesta(500, { error: 'boom' }))).toEqual({ tipo: 'error-servidor', status: 500 }));
  it('respuesta que no es JSON', async () => {
    const f = (vi.fn(async () => new Response('<html>', { status: 200 })) as unknown) as typeof fetch;
    expect(await v(f)).toMatchObject({ tipo: 'error-servidor' });
  });
});

// ---------------------------------------------------------------- Reglas de la licencia
function entorno(respuestas: Verificacion[] | ((inc: boolean) => Verificacion), ahora = new Date('2026-10-05T12:00:00Z')) {
  let guardada: EstadoLicencia | undefined;
  const llamadas: boolean[] = [];
  const d: Dependencias = {
    verificar: async (_c, inc) => {
      llamadas.push(inc);
      return typeof respuestas === 'function' ? respuestas(inc) : respuestas.shift()!;
    },
    repo: { leer: async () => guardada, guardar: async (l) => { guardada = l; }, borrar: async () => { guardada = undefined; } },
    config: { maxActivaciones: 3, diasRevalidacion: 30, diasGracia: 45 },
    ahora: () => ahora,
  };
  return { d, llamadas, guardada: () => guardada, poner: (l: EstadoLicencia) => { guardada = l; } };
}
const valida = (usos: number): Verificacion => ({ tipo: 'valida', usos });

describe('activación', () => {
  it('válida: consulta sin gastar uso, luego gasta uno y guarda código y fechas', async () => {
    const e = entorno([valida(0), valida(1)]);
    const r = await activar('  ABCD-1234 ', e.d);
    expect(r.ok).toBe(true);
    expect(e.llamadas).toEqual([false, true]);
    expect(e.guardada()).toEqual({ id: 'actual', codigo: 'ABCD-1234', activadaEn: '2026-10-05T12:00:00.000Z', ultimaVerificacion: '2026-10-05T12:00:00.000Z' });
  });
  it.each([
    ['invalida', { tipo: 'invalida' } as Verificacion],
    ['reembolsada', { tipo: 'reembolsada' } as Verificacion],
    ['contracargo', { tipo: 'contracargo' } as Verificacion],
    ['disputa', { tipo: 'disputa' } as Verificacion],
    ['error-red', { tipo: 'error-red' } as Verificacion],
    ['error-servidor', { tipo: 'error-servidor', status: 500 } as Verificacion],
  ])('rechaza: %s (sin gastar usos y sin guardar nada)', async (motivo, v) => {
    const e = entorno([v]);
    expect(await activar('X', e.d)).toEqual({ ok: false, motivo });
    expect(e.llamadas).toEqual([false]);
    expect(e.guardada()).toBeUndefined();
  });
  it('límite de usos superado: ya en 3 de 3 → rechaza SIN gastar otro uso', async () => {
    const e = entorno([valida(3)]);
    expect(await activar('X', e.d)).toEqual({ ok: false, motivo: 'limite' });
    expect(e.llamadas).toEqual([false]);
  });
  it('límite superado al gastar el uso (otro dispositivo se activó al mismo tiempo)', async () => {
    const e = entorno([valida(2), valida(4)]);
    expect(await activar('X', e.d)).toEqual({ ok: false, motivo: 'limite' });
    expect(e.guardada()).toBeUndefined();
  });
  it('el tercer dispositivo sí entra (usos = 3 después de gastar)', async () => {
    const e = entorno([valida(2), valida(3)]);
    expect((await activar('X', e.d)).ok).toBe(true);
  });
  it('código vacío', async () => expect(await activar('   ', entorno([]).d)).toEqual({ ok: false, motivo: 'vacia' }));
  it('código de prueba (solo se configura en desarrollo): no usa la red', async () => {
    const e = entorno([]);
    e.d.codigoPrueba = 'PRUEBA-0000-0000-0000';
    expect((await activar('prueba-0000-0000-0000', e.d)).ok).toBe(true);
    expect(e.llamadas).toEqual([]);
  });
});

describe('al abrir la app y revalidación', () => {
  const cfg = { maxActivaciones: 3, diasRevalidacion: 30, diasGracia: 45 };
  const lic = (diasAtras: number, extra: Partial<EstadoLicencia> = {}): EstadoLicencia => {
    const f = new Date(Date.parse('2026-10-05T12:00:00Z') - diasAtras * 86400000).toISOString();
    return { id: 'actual', codigo: 'ABCD-1234', activadaEn: f, ultimaVerificacion: f, ...extra };
  };
  const ahora = new Date('2026-10-05T12:00:00Z');

  it('sin licencia → pantalla de activación (p. ej. tras borrar los datos del navegador)', () =>
    expect(evaluar(undefined, ahora, cfg)).toEqual({ estado: 'sin-licencia' }));
  it('verificada hace 10 días → activa, sin revalidar', () =>
    expect(evaluar(lic(10), ahora, cfg)).toMatchObject({ estado: 'activa', revalidar: false }));
  it('hace 31 días → activa y se revalida en segundo plano', () =>
    expect(evaluar(lic(31), ahora, cfg)).toMatchObject({ estado: 'activa', revalidar: true }));
  it('hace 46 días → pide conexión (con "continuar esta vez" disponible una vez)', () => {
    expect(evaluar(lic(46), ahora, cfg)).toMatchObject({ estado: 'requiere-conexion', puedeContinuar: true });
    const l = lic(46);
    expect(evaluar({ ...l, graciaUsadaPara: l.ultimaVerificacion }, ahora, cfg)).toMatchObject({ puedeContinuar: false });
  });

  it('revalidación válida: actualiza la fecha y NO gasta usos', async () => {
    const e = entorno([valida(2)]);
    expect(await revalidar(lic(31), e.d)).toBe('activa');
    expect(e.llamadas).toEqual([false]);
    expect(e.guardada()?.ultimaVerificacion).toBe(ahora.toISOString());
  });
  it.each(['reembolsada', 'contracargo', 'invalida'] as const)('revalidación %s → desactiva la app', async (tipo) => {
    const e = entorno([{ tipo } as Verificacion]);
    e.poner(lic(31));
    expect(await revalidar(lic(31), e.d)).toBe('desactivada');
    expect(e.guardada()).toBeUndefined();
  });
  it('revalidación sin internet → no bloquea (la app sigue funcionando)', async () => {
    const e = entorno([{ tipo: 'error-red' }]);
    e.poner(lic(31));
    expect(await revalidar(lic(31), e.d)).toBe('sin-conexion');
    expect(e.guardada()).toBeDefined();
  });
  it('revalidación con error 500 → no bloquea a quien ya estaba activado', async () => {
    const e = entorno([{ tipo: 'error-servidor', status: 500 }]);
    e.poner(lic(50));
    expect(await revalidar(lic(50), e.d)).toBe('error-servidor');
    expect(e.guardada()).toBeDefined();
  });
  it('"continuar esta vez" solo una vez por periodo vencido', async () => {
    const e = entorno([]);
    const l = await usarGracia(lic(46), e.d);
    expect(evaluar(l, ahora, cfg)).toMatchObject({ estado: 'requiere-conexion', puedeContinuar: false });
    // Al revalidar con éxito se reinicia todo
    const e2 = entorno([valida(1)]);
    await revalidar(l, e2.d);
    expect(evaluar(e2.guardada(), ahora, cfg)).toMatchObject({ estado: 'activa', revalidar: false });
  });
  it('enmascara la licencia (solo últimos 4)', () => expect(enmascarar('ABCD1234-EFGH5678')).toBe('••••••••••••5678'));
});
