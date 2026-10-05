// Función OPCIONAL de Netlify: reenvía la verificación de licencia a Gumroad.
// Solo hace falta si el navegador bloquea la llamada directa (CORS). No guarda
// nada: recibe product_id, license_key e increment_uses_count y devuelve la
// respuesta de Gumroad tal cual.
// Para usarla: VITE_LICENCIA_URL=/.netlify/functions/verificar-licencia

const GUMROAD = 'https://api.gumroad.com/v2/licenses/verify';
const PERMITIDOS = ['product_id', 'license_key', 'increment_uses_count'];

export default async (req) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 });
  const entrada = new URLSearchParams(await req.text());
  const salida = new URLSearchParams();
  for (const k of PERMITIDOS) if (entrada.has(k)) salida.set(k, entrada.get(k).slice(0, 200));
  try {
    const r = await fetch(GUMROAD, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: salida.toString(),
    });
    return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'gumroad-no-disponible' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
};
