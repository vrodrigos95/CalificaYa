import { useState } from 'react';
import { leerListaAlumnos } from '../session/alumnos';
import { btn } from './Screen';

interface Props {
  alumnos: Map<string, string> | null;
  onCambio: (alumnos: Map<string, string> | null) => void;
}

/** Selector de la lista opcional de alumnos (Excel o CSV con código y nombre). */
export default function CargarAlumnos({ alumnos, onCambio }: Props) {
  const [avisos, setAvisos] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);

  async function onArchivo(f: File | undefined) {
    if (!f) return;
    setCargando(true);
    try {
      const r = await leerListaAlumnos(f);
      setAvisos(r.advertencias);
      onCambio(r.alumnos.size ? r.alumnos : null);
    } catch (e) {
      setAvisos([`No se pudo leer el archivo: ${e}`]);
    } finally {
      setCargando(false);
    }
  }

  const ejemplo = alumnos ? [...alumnos].slice(0, 2) : [];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-800">Lista de alumnos <span className="font-normal text-slate-500">(opcional)</span></div>
          <div className="text-sm text-slate-500">
            {alumnos ? `${alumnos.size} alumnos cargados` : 'Excel o CSV con código y nombre, para que el Excel final incluya nombres'}
          </div>
        </div>
        {alumnos && <button onClick={() => { onCambio(null); setAvisos([]); }} className={btn.small}>Quitar</button>}
      </div>
      {ejemplo.length > 0 && (
        <ul className="mt-2 text-xs text-slate-500">
          {ejemplo.map(([c, n]) => <li key={c}><span className="font-mono">{c}</span> · {n || '(sin nombre)'}</li>)}
          {alumnos!.size > 2 && <li>…</li>}
        </ul>
      )}
      <label className={`${btn.secondary} mt-3 block cursor-pointer text-center text-sm ${cargando ? 'opacity-50' : ''}`}>
        {cargando ? 'Leyendo…' : alumnos ? 'Cambiar lista' : '📄 Cargar lista'}
        <input type="file" accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
          onChange={(e) => { onArchivo(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {avisos.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-amber-800">{avisos.map((a) => <li key={a}>⚠️ {a}</li>)}</ul>}
      <p className="mt-2 text-xs text-slate-400">La lista solo se usa durante esta sesión y se borra al cerrarla.</p>
    </div>
  );
}
