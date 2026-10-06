// Calificación de una hoja leída contra una clave. Funciones puras.
import { opcionesDe, puntosMaximos, type ClaveExamen, type Opcion, type Version } from '../keys/model';
import { LETRAS, VERSIONES } from '../layout/sheetLayout';
import type { MarkRead } from '../omr/classify';

export type EstadoPregunta = 'correcta' | 'incorrecta' | 'blanco' | 'doble';

export interface ResultadoPregunta {
  marcadas: Opcion[];
  estado: EstadoPregunta;
  /** Lectura poco clara: conviene revisarla a mano. */
  dudosa: boolean;
  puntos: number;
}

export type Alerta =
  | { tipo: 'version-sin-marcar' }
  | { tipo: 'version-doble' }
  | { tipo: 'version-inexistente'; version: string }
  | { tipo: 'marcas-extra'; desde: number }
  | { tipo: 'hoja-chica'; preguntasHoja: number }
  | { tipo: 'lecturas-dudosas'; preguntas: number[] };

export interface ResultadoHoja {
  /** Versión usada para calificar (null = no se pudo determinar). */
  version: Version | null;
  preguntas: ResultadoPregunta[];
  aciertos: number;
  errores: number;
  blancos: number;
  dobles: number;
  puntos: number;
  puntosMax: number;
  /** null si no se pudo calificar (versión desconocida). */
  calificacion100: number | null;
  calificacion10: number | null;
  alertas: Alerta[];
}

/** Respuestas tal como se calificarán (lectura del OMR o corrección manual). */
export interface Respuestas {
  /** Una entrada por pregunta de la hoja. */
  preguntas: Pick<MarkRead, 'marcadas' | 'estado'>[];
  version: Pick<MarkRead, 'marcadas' | 'estado'>;
}

export function determinarVersion(clave: ClaveExamen, v: Respuestas['version'], alertas: Alerta[]): Version | null {
  const disponibles = VERSIONES.filter((x) => clave.versiones[x]);
  if (disponibles.length === 1) return disponibles[0]; // Con una sola versión no importa la burbuja
  if (v.estado === 'doble') { alertas.push({ tipo: 'version-doble' }); return null; }
  if (!v.marcadas.length) { alertas.push({ tipo: 'version-sin-marcar' }); return null; }
  const letra = LETRAS[v.marcadas[0]];
  if (!disponibles.includes(letra as Version)) { alertas.push({ tipo: 'version-inexistente', version: letra }); return null; }
  return letra as Version;
}

export function calificar(r: Respuestas, clave: ClaveExamen): ResultadoHoja {
  const alertas: Alerta[] = [];
  const version = determinarVersion(clave, r.version, alertas);
  const n = clave.numPreguntas;
  if (r.preguntas.length < n) alertas.push({ tipo: 'hoja-chica', preguntasHoja: r.preguntas.length });

  // Marcas después de la última pregunta del examen (p. ej. examen de 20 en hoja de 50)
  const extra = r.preguntas.findIndex((p, i) => i >= n && p.marcadas.length > 0);
  if (extra >= 0) alertas.push({ tipo: 'marcas-extra', desde: extra + 1 });

  const reactivos = version ? clave.versiones[version]! : null;
  const validas = opcionesDe(clave.numOpciones);
  const preguntas: ResultadoPregunta[] = [];
  const dudosas: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = r.preguntas[i] ?? { marcadas: [], estado: 'blanco' as const };
    const marcadas = p.marcadas.map((o) => LETRAS[o] as Opcion);
    if (p.estado === 'dudosa') dudosas.push(i + 1);
    let estado: EstadoPregunta;
    let puntos = 0;
    if (marcadas.length === 0) estado = 'blanco';
    else if (marcadas.length > 1 || p.estado === 'doble') estado = 'doble';
    else if (reactivos && validas.includes(marcadas[0]) && reactivos[i].correctas.includes(marcadas[0])) {
      estado = 'correcta';
      puntos = reactivos[i].puntos;
    } else estado = 'incorrecta';
    preguntas.push({ marcadas, estado, dudosa: p.estado === 'dudosa', puntos });
  }
  if (dudosas.length) alertas.push({ tipo: 'lecturas-dudosas', preguntas: dudosas });

  const cuenta = (e: EstadoPregunta) => preguntas.filter((p) => p.estado === e).length;
  const puntos = preguntas.reduce((s, p) => s + p.puntos, 0);
  const puntosMax = reactivos ? puntosMaximos(reactivos) : 0;
  const cal100 = reactivos && puntosMax > 0 ? Math.round((puntos / puntosMax) * 10000) / 100 : null;
  return {
    version,
    preguntas,
    aciertos: cuenta('correcta'),
    errores: cuenta('incorrecta') + cuenta('doble'),
    blancos: cuenta('blanco'),
    dobles: cuenta('doble'),
    puntos,
    puntosMax,
    calificacion100: cal100,
    calificacion10: cal100 === null ? null : Math.round(cal100 * 10) / 100,
    alertas,
  };
}

export function textoAlerta(a: Alerta): string {
  switch (a.tipo) {
    case 'version-sin-marcar': return 'No se marcó la versión del examen.';
    case 'version-doble': return 'Hay más de una versión marcada.';
    case 'version-inexistente': return `Se marcó la versión ${a.version}, que no existe en la clave.`;
    case 'marcas-extra': return `Hay respuestas marcadas a partir de la pregunta ${a.desde}, que el examen no tiene.`;
    case 'hoja-chica': return `La hoja solo tiene ${a.preguntasHoja} preguntas y el examen tiene más.`;
    case 'lecturas-dudosas': return `Revisa las preguntas ${a.preguntas.join(', ')} (marca poco clara).`;
  }
}
