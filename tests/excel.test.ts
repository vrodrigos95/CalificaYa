import 'fake-indexeddb/auto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { beforeAll, describe, expect, it } from 'vitest';
import { construirExcel, nombreArchivo } from '../src/export/excel';
import { nuevaClave } from '../src/keys/model';
import type { MarkRead } from '../src/omr/classify';
import { useSesion, type LecturaSesion, type Sesion } from '../src/session/sessionStore';

const fila = (o: number[]): MarkRead => ({ marcadas: o, estado: o.length === 0 ? 'blanco' : o.length === 1 ? 'ok' : 'doble', scores: [] });
function lectura(codigo: string, resp: number[][], version = 0): LecturaSesion {
  return {
    ok: true, formato: 50, rotacion: 0, confianza: 1, errorMarcadores: 0, marcadores: [],
    calibracion: { vacia: 0, llena: 1, umbral: 0.4, tenue: 0.2 },
    preguntas: resp.map(fila), version: fila([version]),
    id: { digitos: [], texto: codigo, completo: !!codigo && !codigo.includes('?') },
  };
}

// Clave de 5 preguntas con 2 versiones, puntos distintos y una pregunta con 2 correctas.
const clave = nuevaClave('Parcial 1 – Funciones', 5, 4);
clave.versiones = {
  A: [{ correctas: ['A'], puntos: 1 }, { correctas: ['B'], puntos: 1 }, { correctas: ['C', 'D'], puntos: 2 }, { correctas: ['D'], puntos: 1 }, { correctas: ['A'], puntos: 1 }],
  B: [{ correctas: ['D'], puntos: 1 }, { correctas: ['C'], puntos: 1 }, { correctas: ['B'], puntos: 1 }, { correctas: ['A'], puntos: 1 }, { correctas: ['B'], puntos: 1 }],
};

function hayLibreOffice() {
  try { execFileSync('soffice', ['--version'], { stdio: 'ignore', timeout: 20_000 }); return true; } catch { return false; }
}

let sesion: Sesion;
let archivo: string;
beforeAll(async () => {
  const s = useSesion.getState();
  s.iniciar(clave);
  s.agregarHoja(lectura('219000001', [[0], [1], [3], [3], [0]]), null); // A: 6/6 = 100
  s.agregarHoja(lectura('219000002', [[0], [], [2, 3], [3], [1]]), null); // A: 2/6 → doble en 3, blanco en 2
  s.agregarHoja(lectura('219000003', [[3], [2], [1], [0], [0]], 1), null); // B: 4/5 = 80
  s.agregarHoja(lectura('21900?004', [[1], [1], [1], [1], [1]]), null); // A: 1/6, código incompleto
  s.agregarHoja(lectura('219000005', [[0], [0], [0], [0], [0]], 3), null); // versión D inexistente → sin calificar
  sesion = useSesion.getState().sesion!;
  mkdirSync('test-output', { recursive: true });
  archivo = `test-output/${nombreArchivo(clave.nombre, new Date(2026, 9, 5, 9, 7))}`;
  writeFileSync(archivo, await construirExcel(sesion, { nombres: new Map([['219000001', 'Ana López'], ['219000003', 'Beto Ruiz'], ['219000099', 'Zoe Pérez']]) }, ExcelJS));
});

describe('nombre del archivo', () => {
  it('[Examen]_[AAAA-MM-DD_HHmm].xlsx sin caracteres raros', () => {
    expect(nombreArchivo('Parcial 1 – Funciones', new Date(2026, 9, 5, 9, 7))).toBe('Parcial_1_Funciones_2026-10-05_0907.xlsx');
  });
});

describe('Excel exportado', () => {
  it('tiene las 4 hojas, metadatos de CalificaYa y fórmulas en las calificaciones', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(archivo);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Resultados', 'Respuestas', 'Análisis por reactivo', 'Clave']);
    expect(wb.creator).toBe('CalificaYa');
    const app = await (await JSZip.loadAsync(readFileSync(archivo))).file('docProps/app.xml')!.async('string');
    expect(app).toContain('<Application>CalificaYa</Application>');

    const r = wb.getWorksheet('Resultados')!;
    expect((r.getRow(1).values as string[]).slice(1)).toEqual(['Código', 'Nombre', 'Versión', 'Aciertos', 'Errores', 'En blanco', 'Puntos', 'Calificación (0–10)', 'Calificación (0–100)']);
    expect(r.autoFilter).toBeTruthy();
    const c100 = r.getCell('I2').value as ExcelJS.CellFormulaValue;
    expect(c100.formula).toContain('SUMIF(Clave!');
    expect((r.getCell('H2').value as ExcelJS.CellFormulaValue).formula).toContain('I2');
    expect(r.getCell('B2').value).toBe('Ana López');
    // Alumno de la lista sin hoja → al final, "No presentó"
    expect(r.getRow(r.rowCount).values).toEqual([undefined, '219000099', 'Zoe Pérez', 'No presentó']);
  });

  it('colorea las respuestas: verde correcta, rojo incorrecta, gris en blanco', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(archivo);
    const a = wb.getWorksheet('Respuestas')!;
    // Columnas: Código, Nombre, Versión, P1 (D), P2 (E), P3 (F)…
    // 219000002: P1 correcta, P2 en blanco, P3 doble
    const f = [2, 3, 4, 5, 6].find((x) => a.getCell(`A${x}`).value === '219000002')!;
    const fill = (ref: string) => ((a.getCell(ref).fill as ExcelJS.FillPattern).fgColor?.argb);
    expect(a.getCell(`D${f}`).value).toBe('A');
    expect(fill(`D${f}`)).toBe('FFC6EFCE');
    expect(a.getCell(`E${f}`).value).toBeNull();
    expect(fill(`E${f}`)).toBe('FFE7E6E6');
    expect(a.getCell(`F${f}`).value).toBe('C,D');
    expect(fill(`F${f}`)).toBe('FFFFC7CE');
  });

  it.skipIf(!hayLibreOffice())('LibreOffice recalcula las fórmulas sin errores y con los mismos valores', async () => {
    // Quitar los valores guardados para obligar a LibreOffice a calcular todo.
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(archivo);
    const esperados = new Map<string, unknown>();
    wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((c) => {
      const v = c.value as ExcelJS.CellFormulaValue;
      if (v && typeof v === 'object' && 'formula' in v) {
        esperados.set(`${ws.name}!${c.address}`, v.result);
        c.value = { formula: v.formula } as ExcelJS.CellFormulaValue;
      }
    })));
    const dir = 'test-output/lo';
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    await wb.xlsx.writeFile(`${dir}/sin-cache.xlsx`);
    execFileSync('soffice', ['--headless', '--convert-to', 'xlsx', '--outdir', `${dir}/out`, `${dir}/sin-cache.xlsx`], { stdio: 'ignore', timeout: 90_000 });
    expect(existsSync(`${dir}/out/sin-cache.xlsx`)).toBe(true);
    const calc = new ExcelJS.Workbook();
    await calc.xlsx.readFile(`${dir}/out/sin-cache.xlsx`);
    let revisadas = 0;
    for (const [ref, esperado] of esperados) {
      const [hoja, celda] = ref.split('!');
      const v = calc.getWorksheet(hoja)!.getCell(celda).value as ExcelJS.CellFormulaValue | null;
      const obtenido = v && typeof v === 'object' && 'formula' in v ? (v.result ?? '') : v;
      expect(typeof obtenido === 'object' && obtenido && 'error' in obtenido, `${ref} da error`).toBe(false);
      if (typeof esperado === 'number') expect(Number(obtenido), ref).toBeCloseTo(esperado, 2);
      else expect(obtenido ?? '', ref).toBe(esperado ?? '');
      revisadas++;
    }
    expect(revisadas).toBeGreaterThan(40);
    expect(readdirSync(`${dir}/out`)).toContain('sin-cache.xlsx');
  }, 120_000);

  it('valores calculados correctos (incluye versión B, puntos dobles y hoja sin calificar)', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(archivo);
    const r = wb.getWorksheet('Resultados')!;
    const res = (ref: string) => (r.getCell(ref).value as ExcelJS.CellFormulaValue).result;
    // Orden por nombre: Ana, Beto, luego sin nombre por código
    expect(r.getCell('A2').value).toBe('219000001');
    expect(res('I2')).toBe(100);
    expect(r.getCell('A3').value).toBe('219000003');
    expect(res('I3')).toBe(80);
    const filaSinVersion = [4, 5, 6].find((f) => r.getCell(`A${f}`).value === '219000005')!;
    expect(res(`I${filaSinVersion}`) ?? '').toBe('');
    const n = wb.getWorksheet('Análisis por reactivo')!;
    // P1: correctas A (A) y D (B): 219000001, 219000002, 219000003 → 3 de 4 calificadas
    expect(n.getCell('C2').value).toBe(3);
    expect((n.getCell('D2').value as ExcelJS.CellFormulaValue).result).toBeCloseTo(0.75);
    expect((n as unknown as { conditionalFormattings: { ref: string }[] }).conditionalFormattings[0].ref).toBe('A2:J6');
  });
});
