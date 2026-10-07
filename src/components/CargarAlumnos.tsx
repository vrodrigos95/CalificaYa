import { useState } from 'react';
import { leerListaAlumnos, type Alumno } from '../session/alumnos';
import { btn } from './Screen';

interface Props {
  alumnos: Alumno[] | null;
  onCambio: (alumnos: Alumno[] | null) => void;
}

/** Plantilla fija en public/ (se genera con plantillaAlumnos(); ver tests/alumnos.test.ts). */
const PLANTILLA = `${import.meta.env.BASE_URL}plantilla-alumnos.xlsx`;

/** Selector de la lista opcional de alumnos (Excel o CSV; hay una plantilla para descargar). */
export default function CargarAlumnos({ alumnos, onCambio }: Props) {
  const [avisos, setAvisos] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);

  async function onArchivo(f: File | undefined) {
    if (!f) return;
    setCargando(true);
    try {
      const r = await leerListaAlumnos(f);
      setAvisos(r.advertencias);
      onCambio(r.alumnos.length ? r.alumnos : null);
    } catch (e) {
      setAvisos([`No se pudo leer el archivo: ${e}`]);
    } finally {
      setCargando(false);
    }
  }

  const ejemplo = alumnos?.slice(0, 2) ?? [];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-800">Lista de alumnos <span className="font-normal text-slate-500">(opcional)</span></div>
          <div className="text-sm text-slate-500">
            {alumnos
              ? `${alumnos.length} alumnos cargados`
              : 'Excel o CSV con No. de lista, apellidos, nombre y código, para identificar a cada alumno y que el Excel final incluya nombres'}
          </div>
        </div>
        {alumnos && <button onClick={() => { onCambio(null); setAvisos([]); }} className={btn.small}>Quitar</button>}
      </div>
      {ejemplo.length > 0 && (
        <ul className="mt-2 text-xs text-slate-500">
          {ejemplo.map((a) => (
            <li key={a.id}>
              {a.lista && <span className="font-mono">{a.lista}. </span>}
              {a.completo || '(sin nombre)'}
              {a.codigo && <span className="font-mono"> · {a.codigo}</span>}
            </li>
          ))}
          {alumnos!.length > 2 && <li>…</li>}
        </ul>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href={PLANTILLA} download="Plantilla lista de alumnos.xlsx" className={`${btn.secondary} block text-center text-sm`}>
          ⬇️ Plantilla
        </a>
        <label className={`${btn.secondary} block cursor-pointer text-center text-sm ${cargando ? 'opacity-50' : ''}`}>
          {cargando ? 'Leyendo…' : alumnos ? 'Cambiar lista' : '📄 Cargar lista'}
          <input type="file" accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
            onChange={(e) => { onArchivo(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      {avisos.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-amber-800">{avisos.map((a) => <li key={a}>⚠️ {a}</li>)}</ul>}
      <p className="mt-2 text-xs text-slate-400">
        Descarga la plantilla, llénala (No. de lista, Apellidos, Nombre(s), Código) y cárgala. Al revisar cada hoja, escribe lo que el alumno puso en «Nombre» (código, No. de lista, apellido o nombre) y la app lo busca en la lista.
        La lista solo se usa durante esta sesión y se borra al cerrarla.
      </p>
    </div>
  );
}
