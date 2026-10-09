import { createCanvas } from '@napi-rs/canvas';
import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getLayout } from '../src/layout/sheetLayout';
import { binarizar, prepararParaOCR, recortar, sugerirAlumnos, tieneEscritura, zonasManuscritas, type TextoManuscrito } from '../src/ocr/manuscrito';
import type { CV } from '../src/omr/cv';
import { readSheet, type GrayImage } from '../src/omr/reader';
import { interpretarFilas } from '../src/session/alumnos';
import { loadOpenCV } from './helpers/cvNode';
import { dibujarHoja, fotografiar, llenarManual, SIN_DISTORSION } from './synthetic/sheets';

const lista = interpretarFilas([
  ['No. de lista', 'Apellidos', 'Nombre(s)', 'Código'],
  ['1', 'López García', 'Ana María', '219000001'],
  ['2', 'Ruiz Pérez', 'Alberto', '219000002'],
  ['3', 'López Soto', 'Carla', ''],
  ['4', 'Núñez Ortega', 'José Luis', '219000004'],
  ['5', 'Hernández Ruiz', 'Mariana', ''],
]).alumnos;
const primero = (t: TextoManuscrito) => sugerirAlumnos(t, lista)[0]?.alumno.completo;

describe('recuadros escritos a mano', () => {
  it('Nombre, Fecha y Grupo en las hojas de 20 y 50; Nombre y Grupo en la de 100', () => {
    expect(zonasManuscritas(getLayout(20)).map((z) => z.campo)).toEqual(['nombre', 'fecha', 'grupo']);
    expect(zonasManuscritas(getLayout(50)).map((z) => z.campo)).toEqual(['nombre', 'fecha', 'grupo']);
    expect(zonasManuscritas(getLayout(100)).map((z) => z.campo)).toEqual(['nombre', 'grupo']);
  });
});

describe('sugerencias a partir del texto leído (con errores de OCR)', () => {
  it('nombre bien leído, en desorden o con letras mal leídas', () => {
    expect(primero({ nombre: 'Ana Maria Lopez' })).toBe('López García Ana María');
    expect(primero({ nombre: 'lopez garcia ana' })).toBe('López García Ana María');
    expect(primero({ nombre: 'Jose Luls Nunez' })).toBe('Núñez Ortega José Luis'); // i → l
    expect(primero({ nombre: 'Mariaua Hernandcz' })).toBe('Hernández Ruiz Mariana'); // n → u, e → c
    expect(primero({ nombre: 'Name: Alberto R.' })).toBe('Ruiz Pérez Alberto'); // etiqueta impresa de ZipGrade
  });

  it('el apellido solo propone a todos los que lo tienen, el mejor primero', () => {
    const s = sugerirAlumnos({ nombre: 'Carla Lopez' }, lista);
    expect(s[0].alumno.completo).toBe('López Soto Carla');
    expect(s.map((x) => x.alumno.lista)).toContain('1'); // Ana también se apellida López, pero después
  });

  it('número de lista escrito en el nombre; los números de la fecha y el grupo no cuentan como lista', () => {
    expect(primero({ nombre: '5' })).toBe('Hernández Ruiz Mariana');
    expect(primero({ nombre: 'No. 03' })).toBe('López Soto Carla');
    expect(sugerirAlumnos({ fecha: '4/10/26', grupo: '3' }, lista)).toEqual([]);
  });

  it('código en cualquier recuadro', () => {
    expect(primero({ grupo: '219000004' })).toBe('Núñez Ortega José Luis');
  });

  it('palabras pegadas o partidas por el OCR', () => {
    expect(primero({ nombre: 'MarianaHernandez' })).toBe('Hernández Ruiz Mariana');
    expect(primero({ nombre: 'Mariana Her nandez' })).toBe('Hernández Ruiz Mariana');
    expect(primero({ nombre: 'JoseLuisNunez' })).toBe('Núñez Ortega José Luis');
  });

  it('«Ana» no se confunde con «Mariana» por estar dentro de la palabra', () => {
    const s = sugerirAlumnos({ nombre: 'Mariana Hernandez' }, lista);
    expect(s[0].alumno.completo).toBe('Hernández Ruiz Mariana');
    const ana = s.find((x) => x.alumno.lista === '1');
    expect(!ana || ana.puntaje < s[0].puntaje - 0.5).toBe(true);
  });

  it('usa las dos lecturas del nombre (contraste normal / blanco y negro)', () => {
    expect(primero({ nombre: 'Mar1a11a Hcrn / Mariaua Hernandez' })).toBe('Hernández Ruiz Mariana');
  });

  it('sin parecido no propone a nadie', () => {
    expect(sugerirAlumnos({ nombre: 'xqzt wvk' }, lista)).toEqual([]);
    expect(sugerirAlumnos({ nombre: '' }, lista)).toEqual([]);
  });
});

describe('de la foto al alumno (OCR real con Tesseract)', () => {
  let cv: CV;
  let worker: Worker;
  beforeAll(async () => {
    ({ cv } = await loadOpenCV());
    worker = await createWorker('spa', OEM.LSTM_ONLY, { langPath: 'node_modules/@tesseract.js-data/spa/4.0.0_best_int', gzip: true, cacheMethod: 'none' });
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, user_defined_dpi: '300' });
  }, 60_000);
  afterAll(async () => { await worker?.terminate(); });

  function png(img: GrayImage): Buffer {
    const c = createCanvas(img.width, img.height);
    const g = c.getContext('2d');
    const d = g.createImageData(img.width, img.height);
    img.data.forEach((v, i) => { d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; });
    g.putImageData(d, 0, 0);
    return c.toBuffer('image/png');
  }

  it.each([20, 50] as const)('hoja de %i fotografiada: lee el nombre y propone al alumno correcto', async (f) => {
    const h = llenarManual(f, { respuestas: Array.from({ length: f }, () => [0]) });
    const foto = fotografiar(cv, dibujarHoja(h, 8, 3, { nombre: 'Mariana Hernández', fecha: '7/10/26', grupo: '3B' }), { ...SIN_DISTORSION, perspectiva: 0.04, ruido: 6, desenfoque: 0.6 });
    const r = readSheet(cv, foto, { incluirHoja: true });
    if (!r.ok || !r.hoja) throw new Error('no se leyó la hoja');
    const texto: TextoManuscrito = {};
    for (const z of zonasManuscritas(getLayout(f))) {
      const img = recortar(r.hoja, z.rect);
      if (!tieneEscritura(img)) continue;
      const prep = prepararParaOCR(img);
      const leidos = [(await worker.recognize(png(prep))).data.text.trim(), (await worker.recognize(png(binarizar(prep)))).data.text.trim()];
      texto[z.campo] = leidos.join(' / ');
    }
    expect(texto.nombre?.toLowerCase()).toContain('mariana');
    expect(primero(texto)).toBe('Hernández Ruiz Mariana');
  }, 60_000);

  it('recuadro vacío: no hay nada que leer', () => {
    const h = llenarManual(20, { respuestas: [] });
    const r = readSheet(cv, fotografiar(cv, dibujarHoja(h, 8, 3, {}), SIN_DISTORSION), { incluirHoja: true });
    if (!r.ok || !r.hoja) throw new Error('no se leyó la hoja');
    expect(zonasManuscritas(getLayout(20)).map((z) => tieneEscritura(recortar(r.hoja!, z.rect)))).toEqual([false, false, false]);
  });
});
