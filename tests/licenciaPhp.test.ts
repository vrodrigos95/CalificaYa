import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// Contrato de public/api/verificar-licencia.php: mismos campos y recorte que
// netlify/functions/verificar-licencia.mjs. Se omite si no hay php instalado.
const PHP = resolve(__dirname, '../public/api/verificar-licencia.php');
const hayPhp = (() => { try { execFileSync('php', ['-v'], { stdio: 'ignore' }); return true; } catch { return false; } })();
const temporal = mkdtempSync(join(tmpdir(), 'cy-php-'));
afterAll(() => rmSync(temporal, { recursive: true, force: true }));

function php(codigo: string): unknown {
  const salida = execFileSync('php', ['-r', `require ${JSON.stringify(PHP)}; echo json_encode(${codigo});`], {
    env: { ...process.env, TMPDIR: temporal },
  });
  return JSON.parse(salida.toString());
}
const filtrar = (cuerpo: string) => php(`cy_filtrar(${JSON.stringify(cuerpo)})`);

describe.skipIf(!hayPhp)('verificar-licencia.php', () => {
  it('deja pasar solo product_id, license_key e increment_uses_count', () => {
    expect(filtrar('product_id=p&license_key=ABCD&increment_uses_count=true&access_token=x&otro=y')).toEqual({
      product_id: 'p', license_key: 'ABCD', increment_uses_count: 'true',
    });
  });
  it('recorta cada campo a 200 caracteres (también con acentos)', () => {
    const r = filtrar(`license_key=${'a'.repeat(250)}&product_id=${encodeURIComponent('ñ'.repeat(250))}`) as Record<string, string>;
    expect(r.license_key).toBe('a'.repeat(200));
    expect(r.product_id).toBe('ñ'.repeat(200));
  });
  it('ignora campos enviados como arreglo y omite los ausentes', () => {
    expect(filtrar('license_key[]=a&product_id=p')).toEqual({ product_id: 'p' });
  });
  it('límite por IP: 30 intentos y el 31.º se rechaza', () => {
    const r = php(`array_map(fn ($i) => cy_permitir_intento('203.0.113.9', 1000 + $i), range(1, 31))`) as boolean[];
    expect(r.filter(Boolean)).toHaveLength(30);
    expect(r[30]).toBe(false);
    // Pasados 10 minutos se vuelve a permitir.
    expect(php(`cy_permitir_intento('203.0.113.9', 1000 + 31 + 600)`)).toBe(true);
  });
});
