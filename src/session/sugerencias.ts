import { sugerirAlumnos, type Sugerencia } from '../ocr/manuscrito';
import { buscarAlumno } from './alumnos';
import type { HojaSesion, Sesion } from './sessionStore';

/**
 * Alumnos que el OCR propone para una hoja que aún no tiene alumno: sin los
 * que el docente ya descartó para esa hoja ni los que ya están en otra hoja.
 */
export function sugerenciasHoja(h: HojaSesion, s: Sesion, max = 3): Sugerencia[] {
  if (!s.alumnos || h.manuscrito?.estado !== 'listo' || buscarAlumno(h.codigo, s.alumnos)) return [];
  const ocupados = new Set(s.hojas.filter((x) => x.id !== h.id).map((x) => buscarAlumno(x.codigo, s.alumnos)?.id).filter(Boolean));
  return sugerirAlumnos(h.manuscrito.texto, s.alumnos, s.alumnos.length)
    .filter((x) => !h.descartados.includes(x.alumno.id) && !ocupados.has(x.alumno.id))
    .slice(0, max);
}
