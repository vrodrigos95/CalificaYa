import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import Screen, { btn } from '../components/Screen';
import { borrarClave, duplicar, listarClaves } from '../db/keysRepo';
import { formatoParaClave, validarClave, type ClaveExamen } from '../keys/model';
import { VERSIONES } from '../layout/sheetLayout';
import { guardarClave } from '../db/keysRepo';
import { exportarClaves, leerArchivoClaves, nombreArchivoClaves, planearImportacion } from '../keys/keysJson';
import { downloadBlob } from '../lib/download';

export default function Claves() {
  const [claves, setClaves] = useState<ClaveExamen[] | null>(null);
  const navigate = useNavigate();
  const [mensaje, setMensaje] = useState('');

  const cargar = () => listarClaves().then(setClaves);
  useEffect(() => {
    cargar();
  }, []);

  async function onDuplicar(id: string) {
    const copia = await duplicar(id);
    if (copia) navigate(`/claves/${copia.id}`);
  }

  function onExportar(lista: ClaveExamen[]) {
    if (!lista.length) return;
    downloadBlob(new Blob([exportarClaves(lista)], { type: 'application/json' }), nombreArchivoClaves(lista));
  }

  async function onImportar(f: File | undefined) {
    if (!f) return;
    try {
      const importadas = leerArchivoClaves(await f.text());
      const plan = planearImportacion(importadas, claves ?? []);
      for (const c of [...plan.nuevas, ...plan.copias]) await guardarClave(c);
      const partes = [`${plan.nuevas.length + plan.copias.length} clave(s) importada(s).`];
      if (plan.copias.length) partes.push(`${plan.copias.length} ya existían con cambios y se agregaron como copia.`);
      if (plan.omitidas.length) partes.push(`${plan.omitidas.length} ya estaban y se omitieron.`);
      setMensaje(partes.join(' '));
      cargar();
    } catch (e) {
      setMensaje(`No se pudo importar: ${(e as Error).message}`);
    }
  }

  async function onBorrar(c: ClaveExamen) {
    if (!confirm(`¿Borrar la clave "${c.nombre}"? Esta acción no se puede deshacer.`)) return;
    await borrarClave(c.id);
    cargar();
  }

  return (
    <Screen
      title="Claves de examen"
      back="/"
      footer={
        <Link to="/claves/nueva" className={`${btn.primary} block w-full text-center`}>
          + Nueva clave
        </Link>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <label className={`${btn.small} cursor-pointer`}>
          ⬆️ Importar JSON
          <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => { onImportar(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        <button onClick={() => onExportar(claves ?? [])} disabled={!claves?.length} className={`${btn.small} disabled:opacity-40`}>⬇️ Exportar todas</button>
      </div>
      {mensaje && <p className="mb-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{mensaje}</p>}
      {claves === null ? (
        <p className="text-slate-500">Cargando…</p>
      ) : claves.length === 0 ? (
        <div className="mt-10 text-center text-slate-500">
          <p className="text-4xl">🔑</p>
          <p className="mt-2">Aún no tienes claves. Crea la primera.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {claves.map((c) => {
            const versiones = VERSIONES.filter((v) => c.versiones[v]);
            const lista = validarClave(c).length === 0;
            return (
              <li key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <Link to={`/claves/${c.id}`} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-slate-900">{c.nombre || 'Sin nombre'}</h2>
                    {!lista && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Incompleta</span>}
                  </div>
                  <p className="text-sm text-slate-500">
                    {c.numPreguntas} preguntas · {c.numOpciones === 5 ? 'A–E' : 'A–D'} · Versión {versiones.join(', ')} · Escala 0–{c.escala}
                  </p>
                  <p className="text-xs text-slate-400">Modificada {new Date(c.modificada).toLocaleString('es-MX')}</p>
                </Link>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/claves/${c.id}`} className={btn.small}>Editar</Link>
                  <button onClick={() => onDuplicar(c.id)} className={btn.small}>Duplicar</button>
                  <Link to={`/hojas?formato=${formatoParaClave(c.numPreguntas)}`} className={btn.small}>
                    Hoja PDF
                  </Link>
                  <button onClick={() => onExportar([c])} className={btn.small}>Exportar</button>
                  <button onClick={() => onBorrar(c)} className={`${btn.small} border-red-300 text-red-700`}>Borrar</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
