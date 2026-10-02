// Exactitud del motor OMR sobre hojas sintéticas con distorsiones aleatorias.
// Meta: ≥ 99 % de burbujas leídas correctamente y 100 % de hojas detectadas.
import { beforeAll, describe, expect, it } from 'vitest';
import { getLayout, type Formato } from '../src/layout/sheetLayout';
import type { CV } from '../src/omr/cv';
import { loadOpenCV } from './helpers/cvNode';
import { readSheet } from '../src/omr/reader';
import { dibujarHoja, distorsionAlAzar, fotografiar, llenarAlAzar, rng } from './synthetic/sheets';

let cv: CV;
beforeAll(async () => { ({ cv } = await loadOpenCV()); });

const HOJAS_POR_FORMATO = 15;

describe.each([20, 50, 100] as Formato[])('hoja de %i preguntas', (formato) => {
  it(`lee ≥ 99 % de las burbujas en ${HOJAS_POR_FORMATO} fotos sintéticas`, () => {
    const l = getLayout(formato);
    let total = 0, bien = 0, detectadas = 0, ids = 0, versiones = 0;
    const fallos: string[] = [];
    for (let s = 1; s <= HOJAS_POR_FORMATO; s++) {
      const seed = formato * 1000 + s;
      const hoja = llenarAlAzar(formato, rng(seed), { pTache: 0.02 });
      const d = distorsionAlAzar(seed);
      const r = readSheet(cv, fotografiar(cv, dibujarHoja(hoja, 8, seed), d));
      if (!r.ok || r.formato !== formato) { fallos.push(`seed ${seed}: ${r.ok ? r.formato : r.motivo}`); continue; }
      detectadas++;
      r.preguntas.forEach((p, q) => {
        if (hoja.ambiguas.has(q)) return;
        for (let o = 0; o < 5; o++) {
          total++;
          if (p.marcadas.includes(o) === hoja.respuestas[q].includes(o)) bien++;
          else fallos.push(`seed ${seed} q${q + 1}${'ABCDE'[o]} ${p.estado} ${p.scores.map((x) => x.toFixed(2))}`);
        }
      });
      // ID y versión
      r.id.digitos.forEach((dg, i) => {
        for (let v = 0; v < 10; v++) { total++; if (dg.marcadas.includes(v) === (hoja.id[i] === v)) bien++; }
      });
      for (let v = 0; v < l.version.length; v++) { total++; if (r.version.marcadas.includes(v) === (hoja.version === v)) bien++; }
      if (r.id.texto === hoja.id.join('')) ids++;
      if (r.version.marcadas[0] === hoja.version) versiones++;
    }
    const exactitud = bien / total;
    console.log(`[${formato}] hojas detectadas ${detectadas}/${HOJAS_POR_FORMATO} · burbujas ${bien}/${total} = ${(exactitud * 100).toFixed(2)} % · ID ${ids} · versión ${versiones}`);
    if (fallos.length) console.log(fallos.slice(0, 15).join('\n'));
    expect(detectadas).toBe(HOJAS_POR_FORMATO);
    expect(exactitud).toBeGreaterThanOrEqual(0.99);
  }, 180_000);
});
