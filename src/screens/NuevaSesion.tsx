import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import Screen, { btn } from '../components/Screen';
import { listarClaves } from '../db/keysRepo';
import { validarClave, type ClaveExamen } from '../keys/model';
import { VERSIONES } from '../layout/sheetLayout';
import { useSesion } from '../session/sessionStore';

export default function NuevaSesion() {
  const [claves, setClaves] = useState<ClaveExamen[] | null>(null);
  const { sesion, iniciar } = useSesion();
  const navigate = useNavigate();

  useEffect(() => { listarClaves().then(setClaves); }, []);

  function empezar(c: ClaveExamen) {
    if (sesion && sesion.hojas.length > 0 &&
      !confirm(`Hay una sesión abierta con ${sesion.hojas.length} hoja(s)${sesion.exportada ? '' : ' sin exportar'}. ¿Cerrarla y empezar otra? Sus datos se borrarán.`)) return;
    iniciar(c);
    navigate('/sesion/escanear');
  }

  const listas = claves?.filter((c) => validarClave(c).length === 0) ?? [];
  const incompletas = (claves?.length ?? 0) - listas.length;

  return (
    <Screen title="Calificar" back="/">
      {sesion && (
        <Link to="/sesion/escanear" className={`${btn.primary} mb-5 block text-center`}>
          Continuar sesión “{sesion.clave.nombre}” ({sesion.hojas.length} hojas)
        </Link>
      )}
      <h2 className="mb-2 font-semibold text-slate-800">Elige la clave del examen</h2>
      {claves === null ? (
        <p className="text-slate-500">Cargando…</p>
      ) : listas.length === 0 ? (
        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          No tienes claves completas. <Link to="/claves/nueva" className="font-semibold underline">Crea una clave</Link> primero.
        </div>
      ) : (
        <ul className="space-y-2">
          {listas.map((c) => (
            <li key={c.id}>
              <button onClick={() => empezar(c)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:bg-slate-50">
                <div className="font-semibold text-slate-900">{c.nombre}</div>
                <div className="text-sm text-slate-500">
                  {c.numPreguntas} preguntas · Versión {VERSIONES.filter((v) => c.versiones[v]).join(', ')}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {incompletas > 0 && <p className="mt-3 text-sm text-slate-500">{incompletas} clave(s) incompleta(s) no aparecen aquí.</p>}
      <p className="mt-6 text-xs text-slate-500">
        Los códigos, respuestas e imágenes de la sesión solo existen en la memoria del dispositivo y se borran al cerrarla.
      </p>
    </Screen>
  );
}
