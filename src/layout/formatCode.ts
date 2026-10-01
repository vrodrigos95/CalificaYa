// "Tira de formato": 2 × 8 cuadritos al pie de la hoja que le dicen al lector
// OMR qué hoja está viendo (20/50/100, A–D o A–E, dígitos del ID).
//
//   fila 0:  ■ b0 b1 b2 b3 b4 b5 ■
//   fila 1:  □ b6 b7 b8 b9 b10 b11 □
//
// b0–b1 formato (1=20, 2=50, 3=100) · b2 opciones (1 = A–E) · b3–b6 dígitos ID
// b7–b8 versión del diseño · b9–b11 suma de verificación (bits en 1 mod 8).

export const FORMAT_CODE_ROWS = 2;
export const FORMAT_CODE_COLS = 8;
export const LAYOUT_VERSION = 1;

export interface FormatInfo {
  formato: 20 | 50 | 100;
  opciones: 4 | 5;
  idDigitos: number;
  layoutVersion: number;
}

const FORMATO_CODE: Record<number, number> = { 20: 1, 50: 2, 100: 3 };
const CODE_FORMATO: Record<number, 20 | 50 | 100> = { 1: 20, 2: 50, 3: 100 };

function toBits(value: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => (value >> (n - 1 - i)) & 1);
}
function fromBits(bits: number[]): number {
  return bits.reduce((acc, b) => (acc << 1) | b, 0);
}

export function encodeFormatCode(o: { formato: 20 | 50 | 100; opciones: 4 | 5; idDigitos: number }): number[] {
  const data = [
    ...toBits(FORMATO_CODE[o.formato], 2),
    o.opciones === 5 ? 1 : 0,
    ...toBits(o.idDigitos & 15, 4),
    ...toBits(LAYOUT_VERSION & 3, 2),
  ];
  const check = toBits(data.reduce((a, b) => a + b, 0) % 8, 3);
  const d = [...data, ...check];
  return [1, ...d.slice(0, 6), 1, 0, ...d.slice(6, 12), 0];
}

/** Devuelve null si la tira no es válida (fijos o suma de verificación incorrectos). */
export function decodeFormatCode(cells: number[]): FormatInfo | null {
  if (cells.length !== FORMAT_CODE_ROWS * FORMAT_CODE_COLS) return null;
  if (cells[0] !== 1 || cells[7] !== 1 || cells[8] !== 0 || cells[15] !== 0) return null;
  const d = [...cells.slice(1, 7), ...cells.slice(9, 15)];
  const data = d.slice(0, 9);
  if (fromBits(d.slice(9, 12)) !== data.reduce((a, b) => a + b, 0) % 8) return null;
  const formato = CODE_FORMATO[fromBits(data.slice(0, 2))];
  if (!formato) return null;
  return {
    formato,
    opciones: data[2] ? 5 : 4,
    idDigitos: fromBits(data.slice(3, 7)),
    layoutVersion: fromBits(data.slice(7, 9)),
  };
}
