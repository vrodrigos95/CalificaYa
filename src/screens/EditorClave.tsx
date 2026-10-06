import { useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams, useSearchParams } from 'react-router';
import { useSesion } from '../session/sessionStore';
import Screen, { btn } from '../components/Screen';
import { guardarClave, obtenerClave } from '../db/keysRepo';
import {
  MAX_PREGUNTAS,
  nuevaClave,
  opcionesDe,
  puntosMaximos,
  reactivosVacios,
  redimensionar,
  validarClave,
  type ClaveExamen,
  type Opcion,
  type Version,
} from '../keys/model';
import { LETRAS, VERSIONES } from '../layout/sheetLayout';
import Scanner from '../components/Scanner';
import type { ReadResult } from '../omr/reader';
import { useBeforeUnload } from '../hooks/useBeforeUnload';

export default function EditorClave() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Al corregir la clave desde la revisión: al guardar se recalifica la sesión y se regresa.
  const volver = params.get('volver');
  const [clave, setClave] = useState<ClaveExamen | null>(id ? null : nuevaClave());
  const [noExiste, setNoExiste] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [version, setVersion] = useState<Version>('A');
  const [varias, setVarias] = useState(false);
  const [verPuntos, setVerPuntos] = useState(false);
  const [puntosTodas, setPuntosTodas] = useState(1);
  const [numTexto, setNumTexto] = useState('');
  const [errores, setErrores] = useState<string[]>([]);
  const [escaneando, setEscaneando] = useState(false);
  const [avisoEscaneo, setAvisoEscaneo] = useState('');

  useEffect(() => {
    if (!id) return;
    obtenerClave(id).then((c) => (c ? setClave(c) : setNoExiste(true)));
  }, [id]);

  useEffect(() => {
    if (clave) setNumTexto(String(clave.numPreguntas));
  }, [clave?.numPreguntas]);

  useBeforeUnload(sucio);
  const sucioRef = useRef(false);
  sucioRef.current = sucio;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => sucioRef.current && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (confirm('Tienes cambios sin guardar. ¿Salir sin guardar?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  if (noExiste) return <Screen title="Clave" back="/claves"><p>Esta clave ya no existe.</p></Screen>;
  if (!clave) return <Screen title="Clave" back="/claves"><p className="text-slate-500">Cargando…</p></Screen>;

  const actualizar = (c: ClaveExamen) => {
    setClave(c);
    setSucio(true);
    setErrores([]);
  };

  const reactivos = clave.versiones[version] ?? [];
  const versionesActivas = VERSIONES.filter((v) => clave.versiones[v]);
  const opciones = opcionesDe(clave.numOpciones);

  function marcar(q: number, o: Opcion) {
    const rs = reactivos.map((r) => ({ ...r }));
    const r = rs[q];
    if (varias) r.correctas = r.correctas.includes(o) ? r.correctas.filter((x) => x !== o) : [...r.correctas, o].sort();
    else r.correctas = r.correctas.length === 1 && r.correctas[0] === o ? [] : [o];
    actualizar({ ...clave!, versiones: { ...clave!.versiones, [version]: rs } });
  }

  function cambiarPuntos(q: number, valor: number) {
    const rs = reactivos.map((r, i) => (i === q ? { ...r, puntos: valor } : r));
    actualizar({ ...clave!, versiones: { ...clave!.versiones, [version]: rs } });
  }

  function aplicarPuntosATodas() {
    const versiones = { ...clave!.versiones };
    for (const v of versionesActivas) versiones[v] = versiones[v]!.map((r) => ({ ...r, puntos: puntosTodas }));
    actualizar({ ...clave!, versiones });
  }

  function cambiarNumPreguntas(texto: string) {
    setNumTexto(texto);
    const n = Number(texto);
    if (!Number.isInteger(n) || n < 1 || n > MAX_PREGUNTAS || n === clave!.numPreguntas) return;
    if (n < clave!.numPreguntas) {
      const pierde = versionesActivas.some((v) => clave!.versiones[v]!.slice(n).some((r) => r.correctas.length > 0));
      if (pierde && !confirm(`Se borrarán las respuestas de las preguntas ${n + 1} a ${clave!.numPreguntas}. ¿Continuar?`)) {
        setNumTexto(String(clave!.numPreguntas));
        return;
      }
    }
    actualizar(redimensionar(clave!, n, clave!.numOpciones));
  }

  function cambiarOpciones(n: 4 | 5) {
    if (n === clave!.numOpciones) return;
    const pierde = n === 4 && versionesActivas.some((v) => clave!.versiones[v]!.some((r) => r.correctas.includes('E')));
    if (pierde && !confirm('Algunas respuestas usan la opción E y se quitarán. ¿Continuar?')) return;
    actualizar(redimensionar(clave!, clave!.numPreguntas, n));
  }

  function agregarVersion() {
    const v = VERSIONES.find((x) => !clave!.versiones[x]);
    if (!v) return;
    const base = clave!.versiones.A;
    // La nueva versión hereda los puntos de la A; las respuestas se capturan aparte.
    const rs = reactivosVacios(clave!.numPreguntas).map((r, i) => ({ ...r, puntos: base?.[i]?.puntos ?? 1 }));
    actualizar({ ...clave!, versiones: { ...clave!.versiones, [v]: rs } });
    setVersion(v);
  }

  function quitarVersion(v: Version) {
    if (versionesActivas.length <= 1) return;
    if (!confirm(`¿Quitar la versión ${v} de esta clave?`)) return;
    const versiones = { ...clave!.versiones };
    delete versiones[v];
    actualizar({ ...clave!, versiones });
    setVersion(VERSIONES.find((x) => versiones[x])!);
  }

  /** Llena la versión actual con las marcas de una hoja escaneada (marcas dobles = varias correctas). */
  function aplicarEscaneo(r: ReadResult) {
    setEscaneando(false);
    const ultima = r.preguntas.reduce((u, p, i) => (p.marcadas.length ? i + 1 : u), 0);
    if (ultima === 0) {
      setAvisoEscaneo('La hoja escaneada no tiene respuestas marcadas.');
      return;
    }
    let c = clave!;
    if (ultima > c.numPreguntas && confirm(`La hoja tiene respuestas hasta la pregunta ${ultima}. ¿Cambiar el examen a ${ultima} preguntas?`))
      c = redimensionar(c, ultima, c.numOpciones);
    const validas = opcionesDe(c.numOpciones);
    const rs = (c.versiones[version] ?? reactivosVacios(c.numPreguntas)).map((reac, i) => {
      const marcadas = (r.preguntas[i]?.marcadas ?? []).map((o) => LETRAS[o] as Opcion).filter((o) => validas.includes(o));
      return { ...reac, correctas: marcadas };
    });
    const varias = rs.filter((x) => x.correctas.length > 1).length;
    const vacias = rs.filter((x) => x.correctas.length === 0).length;
    actualizar({ ...c, versiones: { ...c.versiones, [version]: rs } });
    if (varias) setVarias(true);
    setAvisoEscaneo(
      `Se capturó la versión ${version} desde la hoja.` +
        (varias ? ` ${varias} pregunta(s) con varias respuestas correctas.` : '') +
        (vacias ? ` ${vacias} pregunta(s) sin respuesta: complétalas a mano.` : '') +
        ' Revisa y guarda.',
    );
  }

  async function guardar() {
    const errs = validarClave(clave!);
    if (!clave!.nombre.trim()) {
      setErrores(errs);
      return;
    }
    await guardarClave(clave!);
    sucioRef.current = false;
    setSucio(false);
    if (errs.length) {
      setErrores(['Guardada, pero aún no se puede usar para calificar:', ...errs]);
      if (!id) navigate(`/claves/${clave!.id}`, { replace: true });
      return;
    }
    const sesion = useSesion.getState().sesion;
    if (sesion && sesion.clave.id === clave!.id) useSesion.getState().actualizarClave(clave!);
    navigate(volver?.startsWith('/sesion') ? volver : '/claves');
  }

  const capturadas = reactivos.filter((r) => r.correctas.length > 0).length;

  return (
    <Screen
      title={id ? 'Editar clave' : 'Nueva clave'}
      back={volver?.startsWith('/sesion') ? volver : '/claves'}
      footer={
        <div className="space-y-2">
          {errores.length > 0 && (
            <ul className="max-h-28 overflow-auto rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
              {errores.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
          <button onClick={guardar} className={`${btn.primary} w-full`}>Guardar clave</button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="nombre" className="mb-1 block text-sm font-semibold text-slate-700">Nombre del examen</label>
          <input
            id="nombre"
            value={clave.nombre}
            onChange={(e) => actualizar({ ...clave, nombre: e.target.value })}
            placeholder="Ej. Parcial 1 – Funciones"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="num" className="mb-1 block text-sm font-semibold text-slate-700">Preguntas</label>
            <input
              id="num"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_PREGUNTAS}
              value={numTexto}
              onChange={(e) => cambiarNumPreguntas(e.target.value)}
              onBlur={() => setNumTexto(String(clave.numPreguntas))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base"
            />
          </div>
          <div>
            <span className="mb-1 block text-sm font-semibold text-slate-700">Opciones</span>
            <select
              value={clave.numOpciones}
              onChange={(e) => cambiarOpciones(Number(e.target.value) as 4 | 5)}
              className="w-full rounded-xl border border-slate-300 bg-white px-2 py-2.5 text-base"
            >
              <option value={5}>A–E</option>
              <option value={4}>A–D</option>
            </select>
          </div>
          <div>
            <span className="mb-1 block text-sm font-semibold text-slate-700">Escala</span>
            <select
              value={clave.escala}
              onChange={(e) => actualizar({ ...clave, escala: Number(e.target.value) as 10 | 100 })}
              className="w-full rounded-xl border border-slate-300 bg-white px-2 py-2.5 text-base"
            >
              <option value={100}>0–100</option>
              <option value={10}>0–10</option>
            </select>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 overflow-x-auto">
            {versionesActivas.map((v) => (
              <button
                key={v}
                onClick={() => setVersion(v)}
                className={`shrink-0 rounded-full px-4 py-1.5 font-semibold ${version === v ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}
              >
                Versión {v}
              </button>
            ))}
            {versionesActivas.length < 4 && (
              <button onClick={agregarVersion} className="shrink-0 rounded-full border border-dashed border-slate-400 px-3 py-1.5 text-sm text-slate-600">
                + Versión
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <span>
              {capturadas}/{clave.numPreguntas} capturadas · {puntosMaximos(reactivos)} pts máx.
            </span>
            {versionesActivas.length > 1 && (
              <button onClick={() => quitarVersion(version)} className="text-red-700 underline">Quitar versión {version}</button>
            )}
          </div>
        </div>

        <button onClick={() => { setAvisoEscaneo(''); setEscaneando(true); }} className={`${btn.secondary} w-full`}>
          📷 Escanear hoja con la clave (versión {version})
        </button>
        {avisoEscaneo && <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{avisoEscaneo}</p>}

        <div className="flex flex-wrap gap-4 rounded-xl bg-slate-100 p-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={varias} onChange={(e) => setVarias(e.target.checked)} className="h-4 w-4" />
            Permitir varias correctas
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={verPuntos} onChange={(e) => setVerPuntos(e.target.checked)} className="h-4 w-4" />
            Puntos por pregunta
          </label>
          {verPuntos && (
            <div className="flex w-full items-center gap-2">
              <span>Todas valen</span>
              <input
                type="number"
                min={0}
                step="0.5"
                value={puntosTodas}
                onChange={(e) => setPuntosTodas(Math.max(0, Number(e.target.value) || 0))}
                className="w-20 rounded-lg border border-slate-300 px-2 py-1"
              />
              <button onClick={aplicarPuntosATodas} className={btn.small}>Aplicar</button>
            </div>
          )}
        </div>

        <ol className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {reactivos.map((r, q) => (
            <li key={q} className="flex items-center gap-2 px-3 py-2">
              <span className="w-8 shrink-0 text-right font-bold text-slate-700">{q + 1}</span>
              <div className="flex flex-1 gap-1.5">
                {opciones.map((o) => {
                  const on = r.correctas.includes(o);
                  return (
                    <button
                      key={o}
                      onClick={() => marcar(q, o)}
                      aria-pressed={on}
                      className={`h-10 w-10 shrink-0 rounded-full border-2 text-sm font-bold transition-colors ${on ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 text-slate-500'}`}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
              {verPuntos && (
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  aria-label={`Puntos de la pregunta ${q + 1}`}
                  value={r.puntos}
                  onChange={(e) => cambiarPuntos(q, Math.max(0, Number(e.target.value) || 0))}
                  className="w-16 shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-right"
                />
              )}
            </li>
          ))}
        </ol>
        <p className="text-center text-sm text-slate-500">
          Tip: llena una hoja de respuestas con la clave y usa “Escanear hoja” para capturarla en segundos.
        </p>
      </div>
      {escaneando && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between bg-blue-700 px-3 py-2.5 text-white">
            <span className="text-sm font-semibold">Escanea la hoja con la clave · versión {version}</span>
            <button onClick={() => setEscaneando(false)} className="rounded-lg bg-blue-600 px-3 py-1 text-sm">Cancelar</button>
          </div>
          <div className="relative flex-1">
            <Scanner onCaptura={aplicarEscaneo} />
          </div>
        </div>
      )}
    </Screen>
  );
}
