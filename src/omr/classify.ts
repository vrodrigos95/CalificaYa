// Clasificación de burbujas a partir de su nivel de relleno (0 = vacía, 1 = negra).
// Funciones puras: no dependen de OpenCV.

export type EstadoLectura = 'ok' | 'blanco' | 'doble' | 'dudosa';

export interface MarkRead {
  /** Índices de las opciones marcadas (0 = A). */
  marcadas: number[];
  estado: EstadoLectura;
  scores: number[];
}

export interface Calibracion {
  /** Nivel típico de una burbuja vacía. */
  vacia: number;
  /** Nivel típico de una burbuja rellena en esta hoja. */
  llena: number;
  /** A partir de aquí una burbuja cuenta como marcada. */
  umbral: number;
  /** Entre `tenue` y `umbral` la marca es dudosa (lápiz muy tenue, borrón). */
  tenue: number;
}

function mediana(v: number[]): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Calibra con todas las filas de la hoja: la mayoría de las burbujas están vacías
 * (dan el nivel de fondo) y el máximo de cada fila marcada da el nivel de relleno.
 * Así se adapta a lápiz tenue, pluma, iluminación y calidad de impresión.
 */
export function calibrar(filas: number[][]): Calibracion {
  const todas = filas.flat();
  const vacia = mediana(todas);
  const maximos = filas.map((f) => Math.max(...f)).filter((m) => m > vacia + 0.16);
  const llena = maximos.length ? Math.max(mediana(maximos), vacia + 0.2) : vacia + 0.5;
  const umbral = vacia + Math.max(0.11, 0.42 * (llena - vacia));
  const tenue = vacia + Math.max(0.06, 0.2 * (llena - vacia));
  return { vacia, llena, umbral, tenue };
}

/** Clasifica una fila de burbujas (una pregunta, un dígito del ID o la versión). */
export function clasificarFila(scores: number[], c: Calibracion): MarkRead {
  const orden = scores.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0]);
  const [s1, i1] = orden[0];
  const s2 = orden[1]?.[0] ?? 0;
  const arriba = orden.filter(([s]) => s >= c.umbral);

  if (arriba.length === 0) {
    // Nada claro. Si la más oscura destaca sobre las demás, es una marca tenue.
    if (s1 >= c.tenue && s1 - s2 >= 0.5 * (s1 - c.vacia)) return { marcadas: [i1], estado: 'dudosa', scores };
    return { marcadas: [], estado: 'blanco', scores };
  }
  if (arriba.length === 1) {
    const dudosa = s2 >= c.tenue; // otra burbuja con marca parcial (tachón, borrón mal hecho)
    return { marcadas: [i1], estado: dudosa ? 'dudosa' : 'ok', scores };
  }
  // Dos o más sobre el umbral. Si la segunda es mucho más clara, es un borrón mal hecho.
  if (s2 < 0.55 * s1 && orden.slice(2).every(([s]) => s < c.umbral))
    return { marcadas: [i1], estado: 'dudosa', scores };
  return { marcadas: arriba.map(([, i]) => i).sort((a, b) => a - b), estado: 'doble', scores };
}

export interface IdRead {
  digitos: MarkRead[];
  /** Código leído; '?' en dígitos con doble marca o en blanco entre dígitos. */
  texto: string;
  completo: boolean;
}

/** Arma el código de alumno. Los dígitos en blanco al final se ignoran (códigos más cortos). */
export function armarId(digitos: MarkRead[]): IdRead {
  const chars = digitos.map((d) => (d.estado === 'blanco' ? ' ' : d.estado === 'doble' ? '?' : String(d.marcadas[0])));
  const texto = chars.join('').replace(/\s+$/, '').replace(/^\s+/, '').replace(/ /g, '?');
  const completo = texto.length > 0 && !texto.includes('?');
  return { digitos, texto, completo };
}
