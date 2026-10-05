// ÚNICO módulo que habla con Gumroad. Lo único que sale del dispositivo es el
// código de licencia (y el product_id) para validarlo.
//
// API: POST https://api.gumroad.com/v2/licenses/verify
//   product_id, license_key, increment_uses_count=true|false
//   → 200 { success: true, uses, purchase: { refunded, chargebacked, disputed, … } }
//   → 404 { success: false, message } si la licencia no existe o está desactivada

export type Verificacion =
  | { tipo: 'valida'; usos: number }
  | { tipo: 'invalida'; mensaje?: string }
  | { tipo: 'reembolsada' }
  | { tipo: 'contracargo' }
  | { tipo: 'disputa' }
  | { tipo: 'error-red' }
  | { tipo: 'error-servidor'; status: number };

export interface OpcionesVerificacion {
  productId: string;
  incrementar: boolean;
  url?: string;
  fetch?: typeof fetch;
  /** Milisegundos antes de rendirse (cuenta como error de red). */
  timeout?: number;
}

export const GUMROAD_VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';

export async function verificarLicencia(codigo: string, o: OpcionesVerificacion): Promise<Verificacion> {
  const f = o.fetch ?? fetch;
  const cuerpo = new URLSearchParams({
    product_id: o.productId,
    license_key: codigo.trim(),
    increment_uses_count: o.incrementar ? 'true' : 'false',
  });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), o.timeout ?? 15_000);
  let res: Response;
  try {
    res = await f(o.url ?? GUMROAD_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: cuerpo.toString(),
      signal: ctrl.signal,
    });
  } catch {
    return { tipo: 'error-red' };
  } finally {
    clearTimeout(t);
  }
  if (res.status >= 500 || res.status === 429) return { tipo: 'error-servidor', status: res.status };
  let datos: { success?: boolean; uses?: number; message?: string; purchase?: Record<string, unknown> };
  try {
    datos = await res.json();
  } catch {
    return { tipo: 'error-servidor', status: res.status };
  }
  if (!datos.success) return { tipo: 'invalida', mensaje: datos.message };
  const p = datos.purchase ?? {};
  if (p.refunded) return { tipo: 'reembolsada' };
  if (p.chargebacked) return { tipo: 'contracargo' };
  if (p.disputed) return { tipo: 'disputa' };
  return { tipo: 'valida', usos: Number(datos.uses ?? 0) };
}
