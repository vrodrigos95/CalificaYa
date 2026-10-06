import { useEffect, useMemo, useState } from 'react';
import HojaOverlay from '../components/HojaOverlay';
import Screen, { btn } from '../components/Screen';
import { listarClaves } from '../db/keysRepo';
import { calificar, textoAlerta } from '../grading/grade';
import type { ClaveExamen } from '../keys/model';
import { LETRAS } from '../layout/sheetLayout';
import { archivoAImagen } from '../lib/imagen';
import { leerHoja, precargarOMR } from '../omr/omrClient';
import type { ReadFailure, ReadResult } from '../omr/reader';

const MOTIVOS: Record<ReadFailure['motivo'], string> = {
  'sin-marcadores': 'No se encontraron los 4 cuadros negros de las esquinas. Asegúrate de que la hoja completa salga en la foto.',
  'formato-desconocido': 'Se encontraron cuadros, pero no se reconoció el tipo de hoja. Revisa que la tira de cuadritos no esté tapada.',
};

export default function ProbarLector() {
  const [claves, setClaves] = useState<ClaveExamen[]>([]);
  const [claveId, setClaveId] = useState('');
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'leyendo'>('cargando');
  const [lectura, setLectura] = useState<ReadResult | null>(null);
  const [error, setError] = useState('');
  const [ms, setMs] = useState(0);

  useEffect(() => {
    listarClaves().then(setClaves);
    precargarOMR().then(() => setEstado('listo')).catch((e) => setError(String(e)));
  }, []);

  const clave = claves.find((c) => c.id === claveId) ?? null;
  const resultado = useMemo(() => (lectura && clave ? calificar(lectura, clave) : null), [lectura, clave]);
  const correctas = useMemo(() => {
    if (!resultado?.version || !clave) return undefined;
    return clave.versiones[resultado.version]!.map((r) => r.correctas.map((o) => LETRAS.indexOf(o)));
  }, [resultado, clave]);

  async function onArchivo(file: File | undefined) {
    if (!file) return;
    setEstado('leyendo');
    setError('');
    setLectura(null);
    try {
      const img = await archivoAImagen(file);
      const r = await leerHoja(img, { incluirHoja: true });
      setMs(r.ms);
      if (r.resultado.ok) setLectura(r.resultado);
      else setError(MOTIVOS[r.resultado.motivo]);
    } catch (e) {
      setError(String(e));
    } finally {
      setEstado('listo');
    }
  }

  const resumen = lectura && {
    'Hoja': `${lectura.formato} preguntas${lectura.rotacion ? ` (girada ${lectura.rotacion}°)` : ''}`,
    'Código': lectura.id.texto || (lectura.formato === 20 ? '— (la hoja de 20 no lleva)' : 'sin marcar'),
    'Versión': lectura.version.marcadas.map((v) => LETRAS[v]).join(', ') || 'sin marcar',
    'Dudosas': String(lectura.preguntas.filter((p) => p.estado === 'dudosa').length),
    'Dobles': String(lectura.preguntas.filter((p) => p.estado === 'doble').length),
    'Tiempo': `${Math.round(ms)} ms`,
  };

  return (
    <Screen title="Probar lector" back="/">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Toma o elige una foto de una hoja llenada (CalificaYa o ZipGrade). La imagen se procesa en el dispositivo y no se guarda.
        </p>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700" htmlFor="clave">Clave para calificar (opcional)</label>
          <select id="clave" value={claveId} onChange={(e) => setClaveId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5">
            <option value="">Sin clave (solo leer)</option>
            {claves.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.numPreguntas})</option>)}
          </select>
        </div>
        <label className={`${btn.primary} block w-full cursor-pointer text-center ${estado !== 'listo' ? 'pointer-events-none opacity-50' : ''}`}>
          {estado === 'cargando' ? 'Preparando lector…' : estado === 'leyendo' ? 'Leyendo…' : '📷 Elegir o tomar foto'}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onArchivo(e.target.files?.[0]); e.target.value = ''; }} />
        </label>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}

        {lectura && resumen && (
          <>
            {resultado && (
              <div className="rounded-2xl bg-blue-700 p-4 text-center text-white">
                <div className="text-4xl font-bold">{resultado.calificacion100 ?? '—'}</div>
                <div className="text-sm text-blue-100">
                  {resultado.aciertos} aciertos · {resultado.errores} errores · {resultado.blancos} en blanco
                </div>
              </div>
            )}
            {resultado && resultado.alertas.length > 0 && (
              <ul className="space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                {resultado.alertas.map((a, i) => <li key={i}>⚠️ {textoAlerta(a)}</li>)}
              </ul>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-white p-3 text-sm shadow-sm">
              {Object.entries(resumen).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-medium text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
            {lectura.hoja && <HojaOverlay hoja={lectura.hoja} lectura={lectura} resultado={resultado} correctas={correctas} />}
            <p className="text-xs text-slate-500">
              Azul: marca leída · Verde: correcta · Rojo: incorrecta · Naranja: doble marca · “?”: lectura dudosa
            </p>
          </>
        )}
      </div>
    </Screen>
  );
}
