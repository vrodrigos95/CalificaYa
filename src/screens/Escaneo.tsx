import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router';
import Scanner from '../components/Scanner';
import { textoAlerta } from '../grading/grade';
import { useGuardSesion } from '../hooks/useGuardSesion';
import { useExportar } from '../hooks/useExportar';
import { miniaturaJpeg } from '../lib/imagen';
import { getLayout, marcoHoja, type Formato } from '../layout/sheetLayout';
import type { GrayImage, ReadResult } from '../omr/reader';
import { useSesion, type HojaSesion } from '../session/sessionStore';
import { buscarAlumno } from '../session/alumnos';

interface Aviso { hoja: HojaSesion; duplicada: HojaSesion | null }

/** Lee en segundo plano lo escrito en Nombre/Fecha/Grupo (no frena el escaneo). */
function leerEscrito(id: string, img: GrayImage, formato: Formato) {
  const { guardarManuscrito } = useSesion.getState();
  guardarManuscrito(id, { estado: 'leyendo' });
  import('../ocr/ocrClient')
    .then((m) => m.leerManuscrito(img, formato))
    .then(({ texto, recorte }) => guardarManuscrito(id, { estado: 'listo', texto, recorte }))
    .catch(() => guardarManuscrito(id, { estado: 'error' }));
}

const DURACION_AVISO = 1700;

export default function Escaneo() {
  useGuardSesion();
  const sesion = useSesion((s) => s.sesion);
  const agregarHoja = useSesion((s) => s.agregarHoja);
  const borrarHoja = useSesion((s) => s.borrarHoja);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const { exportar, exportando } = useExportar();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cerrarAviso = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setAviso(null);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // El lector de letra manuscrita tarda en cargar: se prepara mientras se encuadra la primera hoja.
  useEffect(() => { import('../ocr/ocrClient').then((m) => m.precargarOCR()).catch(() => undefined); }, []);

  const onCaptura = useCallback(async (r: ReadResult) => {
    const { hoja: img, ...lectura } = r;
    const m = marcoHoja(getLayout(r.formato));
    const k = img?.ppm ?? 1;
    const mini = img ? await miniaturaJpeg(img, { x: m.x * k, y: m.y * k, w: m.w * k, h: m.h * k }) : null;
    const res = agregarHoja(lectura, mini);
    if (img) leerEscrito(res.hoja.id, img, r.formato);
    setAviso(res);
    if (timer.current) clearTimeout(timer.current);
    // Con avisos importantes la tarjeta se queda hasta que el docente la cierre.
    const importante = res.duplicada || res.hoja.resultado.version === null;
    timer.current = importante ? null : setTimeout(() => setAviso(null), DURACION_AVISO);
  }, [agregarHoja]);

  if (!sesion) return <Navigate to="/sesion/nueva" replace />;

  const { clave, hojas } = sesion;
  const r = aviso?.hoja.resultado;
  const escala = clave.escala;
  const cal = r ? (escala === 10 ? r.calificacion10 : r.calificacion100) : null;
  const alertas = r?.alertas ?? [];

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      <header className="flex items-center gap-2 bg-blue-700 px-3 py-2.5 text-white">
        <Link to="/" className="rounded-lg px-2 py-1 text-xl leading-none" aria-label="Inicio">←</Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{clave.nombre}</div>
          <div className="text-xs text-blue-100" data-testid="contador">{hojas.length} hoja{hojas.length === 1 ? '' : 's'} escaneada{hojas.length === 1 ? '' : 's'}</div>
        </div>
        <Link to="/sesion/revisar" className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold">Revisar</Link>
        <button onClick={exportar} disabled={exportando || hojas.length === 0} className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-blue-800 disabled:opacity-60">
          {exportando ? 'Generando…' : 'Exportar Excel'}
        </button>
      </header>

      <div className="relative flex-1">
        <Scanner onCaptura={onCaptura} pausado={!!aviso}>
          {aviso && r && (
            <button onClick={cerrarAviso} className="absolute inset-0 flex items-center justify-center bg-black/40 p-6 text-left" data-testid="aviso">
              <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-slate-500">Hoja #{aviso.hoja.numero}</span>
                  <span className="text-right text-sm text-slate-500">
                    {aviso.hoja.codigo || 'sin código'}
                    {buscarAlumno(aviso.hoja.codigo, sesion.alumnos) && <span className="block text-xs">{buscarAlumno(aviso.hoja.codigo, sesion.alumnos)!.completo}</span>}
                  </span>
                </div>
                <div className={`my-2 text-center text-6xl font-bold ${cal === null ? 'text-slate-400' : 'text-blue-700'}`} data-testid="calificacion">
                  {cal ?? '—'}
                </div>
                <div className="text-center text-sm text-slate-600">
                  {r.aciertos} de {clave.numPreguntas} correctas · {r.blancos} en blanco
                  {r.version && Object.keys(clave.versiones).length > 1 ? ` · Versión ${r.version}` : ''}
                </div>
                {aviso.duplicada && (
                  <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                    ⚠️ El código {aviso.hoja.codigo} ya se escaneó (hoja #{aviso.duplicada.numero}).
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); borrarHoja(aviso.hoja.id); cerrarAviso(); }}
                      className="mt-2 block rounded-lg bg-red-600 px-3 py-1.5 text-center font-semibold text-white"
                    >
                      Descartar esta hoja
                    </span>
                  </div>
                )}
                {alertas.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-amber-800">
                    {alertas.map((a, i) => <li key={i}>⚠️ {textoAlerta(a)}</li>)}
                  </ul>
                )}
                {!aviso.hoja.lectura.id.completo && aviso.hoja.lectura.formato !== 20 && (
                  <p className="mt-2 text-sm text-amber-800">⚠️ Código incompleto o con doble marca: corrígelo al revisar.</p>
                )}
                <p className="mt-4 text-center text-xs text-slate-400">Toca para continuar</p>
              </div>
            </button>
          )}
        </Scanner>
      </div>
    </div>
  );
}
