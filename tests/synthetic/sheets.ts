// Generador de hojas sintéticas para probar el motor OMR: dibuja la hoja con la
// misma geometría que el PDF, la llena "a mano" con distintos trazos y le aplica
// rotación, perspectiva, sombras, desenfoque, ruido y baja resolución.

import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import { getLayout, PAGE_H, PAGE_W, type Bubble, type Formato } from '../../src/layout/sheetLayout';
import type { CV } from '../../src/omr/cv';
import type { RawImage } from '../../src/omr/reader';
import { zonasManuscritas, type TextoManuscrito } from '../../src/ocr/manuscrito';

/** Tipo de trazo con el que el "alumno" marca una burbuja. */
export type Trazo = 'pluma' | 'lapiz' | 'tenue' | 'medio' | 'borrado' | 'tache';
/** Trazos que deben leerse como marca. */
export const CUENTA_COMO_MARCA: Trazo[] = ['pluma', 'lapiz', 'tenue', 'medio'];

export interface Marca { burbuja: Bubble; trazo: Trazo }

export interface HojaLlena {
  formato: Formato;
  /** Opciones que deben leerse como marcadas, por pregunta. */
  respuestas: number[][];
  version: number | null;
  /** Dígito marcado en cada posición del ID (null = en blanco). */
  id: (number | null)[];
  /** Posiciones del ID con doble marca. */
  idDoble: number[];
  marcas: Marca[];
  /** Preguntas con trazos ambiguos (tache) que no cuentan para la exactitud. */
  ambiguas: Set<number>;
}

// Generador pseudoaleatorio reproducible
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LlenadoOpts {
  /** Mezcla de trazos para marcas válidas. */
  trazos?: Trazo[];
  pBlanco?: number;
  pDoble?: number;
  pBorrado?: number;
  pTache?: number;
  idDigitos?: number;
  version?: number | null;
}

export function llenarAlAzar(formato: Formato, rand: () => number, o: LlenadoOpts = {}): HojaLlena {
  const l = getLayout(formato);
  const trazos = o.trazos ?? ['pluma', 'lapiz', 'lapiz', 'pluma', 'tenue', 'medio'];
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const marcas: Marca[] = [];
  const respuestas: number[][] = [];
  const ambiguas = new Set<number>();
  l.preguntas.forEach((fila, q) => {
    const r = rand();
    const pB = o.pBlanco ?? 0.06, pD = o.pDoble ?? 0.04, pE = o.pBorrado ?? 0.05, pT = o.pTache ?? 0;
    if (r < pB) { respuestas.push([]); return; }
    const a = Math.floor(rand() * 5);
    if (r < pB + pD) {
      let b = Math.floor(rand() * 4); if (b >= a) b++;
      marcas.push({ burbuja: fila[a], trazo: 'pluma' }, { burbuja: fila[b], trazo: pick(['pluma', 'lapiz'] as Trazo[]) });
      respuestas.push([a, b].sort());
      return;
    }
    marcas.push({ burbuja: fila[a], trazo: pick(trazos) });
    respuestas.push([a]);
    if (r < pB + pD + pE) {
      // Cambió de opinión: borró otra burbuja
      let b = Math.floor(rand() * 4); if (b >= a) b++;
      marcas.push({ burbuja: fila[b], trazo: 'borrado' });
    } else if (r < pB + pD + pE + pT) {
      let b = Math.floor(rand() * 4); if (b >= a) b++;
      marcas.push({ burbuja: fila[b], trazo: 'tache' });
      ambiguas.add(q);
    }
  });

  const id: (number | null)[] = [];
  const n = Math.min(o.idDigitos ?? l.id.length, l.id.length);
  l.id.forEach((col, d) => {
    if (d >= n) { id.push(null); return; }
    const v = Math.floor(rand() * 10);
    id.push(v);
    marcas.push({ burbuja: col[v], trazo: pick(['pluma', 'lapiz'] as Trazo[]) });
  });

  const version = o.version === undefined ? Math.floor(rand() * Math.min(4, l.version.length)) : o.version;
  if (version !== null) marcas.push({ burbuja: l.version[version], trazo: 'pluma' });
  return { formato, respuestas, version, id, idDoble: [], marcas, ambiguas };
}

// ---------------------------------------------------------------------------
// Dibujo
// ---------------------------------------------------------------------------
function dibujarTrazo(g: SKRSContext2D, b: Bubble, t: Trazo, ppm: number, rand: () => number) {
  const cx = b.cx * ppm + (rand() - 0.5) * b.r * ppm * 0.25;
  const cy = b.cy * ppm + (rand() - 0.5) * b.r * ppm * 0.25;
  const r = b.r * ppm;
  const blob = (color: string, escala: number, pasos = 3) => {
    g.fillStyle = color;
    for (let i = 0; i < pasos; i++) {
      g.beginPath();
      g.ellipse(cx + (rand() - 0.5) * r * 0.2, cy + (rand() - 0.5) * r * 0.2, r * escala * (0.9 + rand() * 0.15), r * escala * (0.85 + rand() * 0.15), rand() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  };
  switch (t) {
    case 'pluma': blob('rgba(15,15,35,0.9)', 0.95); break;
    case 'lapiz': {
      blob('rgba(70,70,75,0.55)', 0.95, 2);
      // textura de grafito
      g.strokeStyle = 'rgba(60,60,60,0.5)';
      g.lineWidth = Math.max(1, r * 0.15);
      for (let i = 0; i < 8; i++) {
        const y = cy - r * 0.8 + (i / 7) * r * 1.6;
        g.beginPath(); g.moveTo(cx - r * 0.85, y + (rand() - 0.5) * r * 0.2); g.lineTo(cx + r * 0.85, y + (rand() - 0.5) * r * 0.2); g.stroke();
      }
      break;
    }
    case 'tenue': blob('rgba(110,110,115,0.38)', 0.92, 2); break;
    case 'medio': {
      // Medio relleno: solo la mitad (o un poco más) de la burbuja
      g.save();
      g.beginPath();
      const ang = rand() * Math.PI * 2;
      g.arc(cx, cy, r * 0.95, ang, ang + Math.PI * (1.05 + rand() * 0.25));
      g.closePath();
      g.fillStyle = 'rgba(25,25,40,0.85)';
      g.fill();
      g.restore();
      break;
    }
    case 'borrado': blob('rgba(140,140,140,0.13)', 0.95, 2); break;
    case 'tache': {
      g.strokeStyle = 'rgba(20,20,30,0.9)';
      g.lineWidth = r * 0.22;
      g.beginPath();
      g.moveTo(cx - r * 0.8, cy - r * 0.8); g.lineTo(cx + r * 0.8, cy + r * 0.8);
      g.moveTo(cx + r * 0.8, cy - r * 0.8); g.lineTo(cx - r * 0.8, cy + r * 0.8);
      g.stroke();
      break;
    }
  }
}

/** Dibuja la hoja impresa y llena, vista de frente, a `ppm` píxeles por mm. */
export function dibujarHoja(h: HojaLlena, ppm: number, seed = 1, escrito?: TextoManuscrito) {
  const rand = rng(seed);
  const l = getLayout(h.formato);
  const W = Math.round(PAGE_W * ppm), H = Math.round(PAGE_H * ppm);
  const c = createCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#fbfbf7';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#000';
  for (const m of [...l.markers, ...l.blockMarkers]) g.fillRect(m.x * ppm, m.y * ppm, m.size * ppm, m.size * ppm);
  const ck = l.checker;
  ck.bits.forEach((fila, r) => fila.forEach((on, k) => on && g.fillRect((ck.x + k * ck.pitchX) * ppm, (ck.y + r * ck.pitchY) * ppm, ck.size * ppm, ck.size * ppm)));
  g.strokeStyle = '#000';
  g.lineWidth = 0.3 * ppm;
  for (const hb of l.headers) g.strokeRect(hb.rect.x * ppm, hb.rect.y * ppm, hb.rect.w * ppm, hb.rect.h * ppm);
  for (const b of l.boxes) g.strokeRect(b.x * ppm, b.y * ppm, b.w * ppm, b.h * ppm);
  g.strokeStyle = 'rgb(160,160,160)';
  for (const b of [...l.preguntas.flat(), ...l.version, ...l.id.flat()]) {
    g.lineWidth = (b.r > 3 ? 0.5 : 0.35) * ppm;
    g.beginPath(); g.arc(b.cx * ppm, b.cy * ppm, b.r * ppm, 0, Math.PI * 2); g.stroke();
  }
  for (const t of l.textos) {
    g.save();
    g.fillStyle = `rgb(${t.color ?? 0},${t.color ?? 0},${t.color ?? 0})`;
    g.font = `${t.bold ? 'bold ' : ''}${t.size * 0.3528 * ppm}px sans-serif`;
    g.textAlign = t.align ?? 'left';
    g.translate(t.x * ppm, t.y * ppm);
    if (t.angle) g.rotate((-t.angle * Math.PI) / 180);
    g.fillText(t.text, 0, 0);
    g.restore();
  }
  // Nombre escrito a mano
  g.fillStyle = 'rgba(20,20,60,0.9)';
  g.font = `${4 * ppm}px serif`;
  if (escrito) {
    for (const z of zonasManuscritas(l)) {
      const t = escrito[z.campo];
      if (t) g.fillText(t, (z.rect.x + 2) * ppm, (z.rect.y + z.rect.h * 0.72) * ppm);
    }
  } else {
    const hb = l.headers[0]?.rect ?? l.boxes[0];
    if (hb) g.fillText('Juan Pérez López', (hb.x + 35) * ppm, (hb.y + 7) * ppm);
  }
  for (const m of h.marcas) dibujarTrazo(g, m.burbuja, m.trazo, ppm, rand);
  return c;
}

// ---------------------------------------------------------------------------
// Distorsiones (OpenCV)
// ---------------------------------------------------------------------------
export interface Distorsion {
  /** Tamaño de la foto final. */
  ancho: number;
  alto: number;
  /** Rotación en grados (incluye 180). */
  rotacion: number;
  /** Desplazamiento aleatorio de las esquinas (fracción del tamaño) → perspectiva. */
  perspectiva: number;
  /** Fracción de la foto que ocupa la hoja (0–1). */
  ocupacion: number;
  /** Intensidad de la sombra (0 = sin sombra, 0.6 = muy oscura). */
  sombra: number;
  /** Iluminación general (1 = normal). */
  brillo: number;
  desenfoque: number;
  ruido: number;
  seed: number;
}

export const SIN_DISTORSION: Distorsion = {
  ancho: 1200, alto: 1600, rotacion: 0, perspectiva: 0, ocupacion: 0.88, sombra: 0, brillo: 1, desenfoque: 0, ruido: 0, seed: 1,
};

export function fotografiar(cv: CV, hoja: ReturnType<typeof dibujarHoja>, d: Distorsion): RawImage {
  const rand = rng(d.seed * 7919 + 13);
  const W = hoja.width, H = hoja.height;
  const src = cv.matFromImageData(hoja.getContext('2d').getImageData(0, 0, W, H));

  // Esquinas destino: hoja centrada, rotada, con perspectiva aleatoria.
  // La hoja rotada debe caber completa (con su perspectiva) dentro de la foto.
  const a = (d.rotacion * Math.PI) / 180;
  const bw = Math.abs(W * Math.cos(a)) + Math.abs(H * Math.sin(a));
  const bh = Math.abs(W * Math.sin(a)) + Math.abs(H * Math.cos(a));
  const escala = Math.min(d.ancho / bw, d.alto / bh) * d.ocupacion / (1 + 2 * d.perspectiva);
  const cx = d.ancho / 2, cy = d.alto / 2;
  const esquinas = [[0, 0], [W, 0], [W, H], [0, H]].map(([x, y]) => {
    const dx = (x - W / 2) * escala, dy = (y - H / 2) * escala;
    const jx = (rand() - 0.5) * 2 * d.perspectiva * W * escala;
    const jy = (rand() - 0.5) * 2 * d.perspectiva * H * escala;
    return [cx + dx * Math.cos(a) - dy * Math.sin(a) + jx, cy + dx * Math.sin(a) + dy * Math.cos(a) + jy];
  });
  const s = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, W, 0, W, H, 0, H]);
  const t = cv.matFromArray(4, 1, cv.CV_32FC2, esquinas.flat());
  const M = cv.getPerspectiveTransform(s, t);
  const dst = new cv.Mat();
  // Fondo: mesa café oscura
  cv.warpPerspective(src, dst, M, new cv.Size(d.ancho, d.alto), cv.INTER_AREA, cv.BORDER_CONSTANT, new cv.Scalar(92, 70, 52, 255));
  src.delete(); s.delete(); t.delete(); M.delete();

  if (d.desenfoque > 0) {
    const k = Math.max(3, Math.round(d.desenfoque * 3) * 2 + 1);
    cv.GaussianBlur(dst, dst, new cv.Size(k, k), d.desenfoque);
  }

  // Sombra (p. ej., la del celular) + iluminación dispareja + ruido
  const data: Uint8ClampedArray = dst.data;
  const sx = rand() * d.ancho, sy = rand() * d.alto;
  const sr = (0.25 + rand() * 0.25) * Math.min(d.ancho, d.alto);
  const gradAng = rand() * Math.PI * 2;
  for (let y = 0; y < d.alto; y++)
    for (let x = 0; x < d.ancho; x++) {
      const i = (y * d.ancho + x) * 4;
      const dist = Math.hypot(x - sx, y - sy) / sr;
      const sombra = d.sombra * Math.max(0, Math.min(1, 1.6 - dist)); // borde suave
      const grad = 1 - 0.25 * d.sombra * (0.5 + 0.5 * Math.cos(gradAng) * (x / d.ancho - 0.5) * 2);
      const f = d.brillo * (1 - sombra) * grad;
      for (let c = 0; c < 3; c++) {
        const n = d.ruido ? (rand() + rand() + rand() - 1.5) * 2 * d.ruido : 0;
        data[i + c] = Math.max(0, Math.min(255, data[i + c] * f + n));
      }
    }
  const out: RawImage = { data: new Uint8ClampedArray(data), width: d.ancho, height: d.alto };
  dst.delete();
  return out;
}

const TAMANOS = [[600, 800], [720, 960], [720, 1280], [900, 1200], [1080, 1440], [1200, 1600]];

/** Combinación aleatoria (reproducible) de todas las distorsiones. */
export function distorsionAlAzar(seed: number): Distorsion {
  const r = rng(seed * 31 + 7);
  const [w, h] = TAMANOS[Math.floor(r() * TAMANOS.length)];
  const base = [0, 180, 0, 180, 90, 270][Math.floor(r() * 6)];
  // Con la hoja de lado, la foto también va de lado (el celular se gira con la hoja).
  const [ancho, alto] = base % 180 ? [h, w] : [w, h];
  return {
    ancho, alto,
    rotacion: base + (r() - 0.5) * 30,
    perspectiva: r() * 0.08,
    ocupacion: 0.75 + r() * 0.17,
    sombra: r() * 0.6,
    brillo: 0.65 + r() * 0.4,
    desenfoque: r() * 1.2,
    ruido: r() * 12,
    seed,
  };
}

/** Hoja llenada a mano para un caso concreto. */
export function llenarManual(
  formato: Formato,
  o: {
    respuestas: number[][];
    trazo?: Trazo;
    id?: (number | null)[];
    idDoble?: number[];
    version?: number | null;
    extra?: { pregunta: number; opcion: number; trazo: Trazo }[];
  },
): HojaLlena {
  const l = getLayout(formato);
  const marcas: Marca[] = [];
  const respuestas = l.preguntas.map((_, q) => o.respuestas[q] ?? []);
  respuestas.forEach((ops, q) => ops.forEach((op) => marcas.push({ burbuja: l.preguntas[q][op], trazo: o.trazo ?? 'pluma' })));
  for (const e of o.extra ?? []) marcas.push({ burbuja: l.preguntas[e.pregunta][e.opcion], trazo: e.trazo });
  const id = l.id.map((_, d) => o.id?.[d] ?? null);
  id.forEach((v, d) => v !== null && marcas.push({ burbuja: l.id[d][v], trazo: 'pluma' }));
  for (const d of o.idDoble ?? []) marcas.push({ burbuja: l.id[d][(id[d] ?? 0) + 1], trazo: 'pluma' });
  const version = o.version === undefined ? 0 : o.version;
  if (version !== null) marcas.push({ burbuja: l.version[version], trazo: 'pluma' });
  return { formato, respuestas, version, id, idDoble: o.idDoble ?? [], marcas, ambiguas: new Set() };
}
