// Libera un uso (dispositivo) de una licencia, para soporte: cuando un cliente
// cambia de celular o borró los datos del navegador y llegó al límite.
//
// Requiere TU token de acceso de Gumroad (Settings → Advanced → Applications →
// Generate access token). NUNCA lo pongas en la app ni en el repositorio.
//
// Uso:
//   GUMROAD_TOKEN=xxxx node scripts/liberar-uso.mjs <product_id> <licencia>
//   GUMROAD_TOKEN=xxxx node scripts/liberar-uso.mjs <product_id> <licencia> --ver   (solo consulta)

const [productId, licencia, modo] = process.argv.slice(2);
const token = process.env.GUMROAD_TOKEN;
if (!productId || !licencia) {
  console.error('Uso: GUMROAD_TOKEN=xxxx node scripts/liberar-uso.mjs <product_id> <licencia> [--ver]');
  process.exit(1);
}

async function llamar(metodo, ruta, params) {
  const r = await fetch(`https://api.gumroad.com/v2/licenses/${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  return r.json();
}

const info = await llamar('POST', 'verify', { product_id: productId, license_key: licencia, increment_uses_count: 'false' });
if (!info.success) { console.error('Licencia no encontrada:', info.message); process.exit(1); }
console.log(`Comprador: ${info.purchase?.email} · usos actuales: ${info.uses}`);
if (modo === '--ver') process.exit(0);
if (!token) { console.error('Falta GUMROAD_TOKEN'); process.exit(1); }
if (info.uses <= 0) { console.log('No hay usos que liberar.'); process.exit(0); }
const r = await llamar('PUT', 'decrement_uses_count', { access_token: token, product_id: productId, license_key: licencia });
console.log(r.success ? `Listo: usos ahora ${r.uses}` : `Error: ${r.message}`);
