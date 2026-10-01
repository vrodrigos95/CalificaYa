import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import Screen, { btn } from '../components/Screen';
import { borrarClave, duplicar, listarClaves } from '../db/keysRepo';
import { formatoParaClave, validarClave, type ClaveExamen } from '../keys/model';
import { VERSIONES } from '../layout/sheetLayout';

export default function Claves() {
  const [claves, setClaves] = useState<ClaveExamen[] | null>(null);
  const navigate = useNavigate();

  const cargar = () => listarClaves().then(setClaves);
  useEffect(() => {
    cargar();
  }, []);

  async function onDuplicar(id: string) {
    const copia = await duplicar(id);
    if (copia) navigate(`/claves/${copia.id}`);
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
                  <Link to={`/hojas?formato=${formatoParaClave(c.numPreguntas)}&opciones=${c.numOpciones}`} className={btn.small}>
                    Hoja PDF
                  </Link>
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
