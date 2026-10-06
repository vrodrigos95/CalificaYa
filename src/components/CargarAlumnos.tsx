import { useState } from 'react';
import { downloadBlob } from '../lib/download';
import { leerListaAlumnos, plantillaAlumnos, type Alumno } from '../session/alumnos';
import { btn } from './Screen';

interface Props {
  alumnos: Alumno[] | null;
  onCambio: (alumnos: Alumno[] | null) => void;
}

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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

  async function descargarPlantilla() {
    try {
      downloadBlob(new Blob([(await plantillaAlumnos()) as BlobPart], { type: XLSX }), 'Plantilla lista de alumnos.xlsx');
    } catch (e) {
      alert(`No se pudo generar la plantilla: ${e}`);
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
              : 'Excel o CSV con No. de lista, nombre, apellidos y código, para identificar a cada alumno y que el Excel final incluya nombres'}
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
      <label className={`${btn.secondary} mt-3 block cursor-pointer text-center text-sm ${cargando ? 'opacity-50' : ''}`}>
        {cargando ? 'Leyendo…' : alumnos ? 'Cambiar lista' : '📄 Cargar lista'}
        <input type="file" accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
          onChange={(e) => { onArchivo(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {!alumnos && (
        <button onClick={descargarPlantilla} className="mt-2 w-full text-center text-sm text-blue-700 underline">
          ⬇️ Descargar plantilla de Excel
        </button>
      )}
      {avisos.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-amber-800">{avisos.map((a) => <li key={a}>⚠️ {a}</li>)}</ul>}
      <p className="mt-2 text-xs text-slate-400">
        Al revisar cada hoja, escribe lo que el alumno puso en «Nombre» (código, No. de lista, nombre o apellido) y la app lo busca en la lista.
        La lista solo se usa durante esta sesión y se borra al cerrarla.
      </p>
    </div>
  );
}
