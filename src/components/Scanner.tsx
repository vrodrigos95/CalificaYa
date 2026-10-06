import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Formato } from '../layout/sheetLayout';
import { archivoAImagen } from '../lib/imagen';
import { leerHoja, precargarOMR } from '../omr/omrClient';
import type { RawImage, ReadFailure, ReadResult } from '../omr/reader';

// Cámara en vivo con captura automática.
//
// Cada cuadro se manda al Web Worker (uno a la vez, así un celular lento solo
// lee menos cuadros por segundo pero nunca se congela). La hoja se captura sola
// cuando dos lecturas seguidas coinciden por completo (mismo formato, código,
// versión y respuestas) Y la imagen está nítida. Mientras la hoja está quieta se
// guarda el cuadro más nítido; si ninguno llega a NITIDEZ_BUENA, tras
// ESPERA_MAX_MS se usa el mejor, siempre que no esté borroso (NITIDEZ_MIN).
// Después de capturar, no se vuelve a capturar la misma hoja hasta que se retira
// (varios cuadros sin hoja) o aparece una hoja distinta.

export type EstadoScanner = 'iniciando' | 'buscando' | 'detectada' | 'enfocando' | 'borrosa' | 'retirar' | 'pausado' | 'sin-camara';

interface Props {
  onCaptura: (lectura: ReadResult) => void;
  pausado?: boolean;
  formatos?: Formato[];
  /** Contenido encima del video (tarjeta de resultado, contador…). */
  children?: ReactNode;
}

const LADO_MAX = 1920;
const CONFIANZA_MIN = 0.9;
const ERROR_MAX_MM = 2.5;
const FALLOS_PARA_RETIRO = 3;
// Nitidez (varianza del laplaciano de la hoja enderezada, ver reader.ts).
// Calibrada con hojas sintéticas: enfocada ≈ 90–190, algo suave ≈ 40–100,
// movida o desenfocada < 25.
const NITIDEZ_BUENA = 60;
const NITIDEZ_MIN = 25;
const ESPERA_MAX_MS = 2000;

export function firmaLectura(r: ReadResult): string {
  return [r.formato, r.id.texto, r.version.marcadas.join(''), r.preguntas.map((p) => p.marcadas.join('')).join(',')].join('|');
}

const MENSAJE: Record<EstadoScanner, string> = {
  iniciando: 'Preparando cámara y lector…',
  buscando: 'Encuadra la hoja completa: que se vean los cuadros negros de las esquinas',
  detectada: 'Hoja detectada — mantén el celular quieto',
  enfocando: 'Enfocando… mantén el celular quieto',
  borrosa: 'La imagen sale borrosa: mantén el celular quieto, con buena luz y a unos 30–40 cm',
  retirar: 'Listo. Coloca la siguiente hoja',
  pausado: '',
  'sin-camara': 'No se pudo abrir la cámara. Puedes usar una foto.',
};

export default function Scanner({ onCaptura, pausado = false, formatos, children }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [estado, setEstado] = useState<EstadoScanner>('iniciando');
  const [errorCamara, setErrorCamara] = useState('');
  const [errorFoto, setErrorFoto] = useState('');

  const pausadoRef = useRef(pausado);
  pausadoRef.current = pausado;
  const onCapturaRef = useRef(onCaptura);
  onCapturaRef.current = onCaptura;
  const ultimaOk = useRef<ReadResult | null>(null);
  const formatosRef = useRef(formatos);
  formatosRef.current = formatos;

  const dibujarMarcadores = useCallback((r: ReadResult | ReadFailure | null, escala: number, color: string) => {
    const video = videoRef.current, canvas = overlayRef.current;
    if (!video || !canvas) return;
    const ew = canvas.clientWidth, eh = canvas.clientHeight;
    if (canvas.width !== ew || canvas.height !== eh) { canvas.width = ew; canvas.height = eh; }
    const g = canvas.getContext('2d')!;
    g.clearRect(0, 0, ew, eh);
    if (!r || !video.videoWidth) return;
    // Mismo cálculo que object-fit: cover
    const s = Math.max(ew / video.videoWidth, eh / video.videoHeight);
    const ox = (ew - video.videoWidth * s) / 2, oy = (eh - video.videoHeight * s) / 2;
    const pts = r.marcadores.map((p) => ({ x: ox + (p.x / escala) * s, y: oy + (p.y / escala) * s }));
    g.fillStyle = color;
    for (const p of pts) { g.beginPath(); g.arc(p.x, p.y, 7, 0, Math.PI * 2); g.fill(); }
    if (r.ok && pts.length === 6) {
      g.strokeStyle = color;
      g.lineWidth = 3;
      g.beginPath();
      [0, 1, 3, 5, 4, 2].forEach((i, k) => (k ? g.lineTo(pts[i].x, pts[i].y) : g.moveTo(pts[i].x, pts[i].y)));
      g.closePath();
      g.stroke();
    }
  }, []);

  // Cámara + ciclo de lectura
  useEffect(() => {
    let detenido = false;
    let stream: MediaStream | null = null;
    let wakeLock: { release: () => Promise<void> } | null = null;
    const canvas = document.createElement('canvas');
    let previa: string | null = null;
    let capturada: string | null = null;
    let fallos = 0;
    // Cuadro más nítido de la hoja quieta actual y desde cuándo está quieta.
    let mejor: ReadResult | null = null;
    let quietaDesde = 0;

    function tomarCuadro(video: HTMLVideoElement): { img: RawImage; escala: number } {
      const escala = Math.min(1, LADO_MAX / Math.max(video.videoWidth, video.videoHeight));
      const w = Math.round(video.videoWidth * escala), h = Math.round(video.videoHeight * escala);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const g = canvas.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(video, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h);
      return { img: { data: d.data, width: w, height: h }, escala };
    }

    async function ciclo() {
      while (!detenido) {
        const video = videoRef.current;
        if (pausadoRef.current || !video || video.readyState < 2 || !video.videoWidth) {
          if (pausadoRef.current) { previa = null; dibujarMarcadores(null, 1, ''); }
          await new Promise((r) => setTimeout(r, 150));
          continue;
        }
        const { img, escala } = tomarCuadro(video);
        let r: ReadResult | ReadFailure;
        try {
          r = (await leerHoja(img, { incluirHoja: true, formatos: formatosRef.current })).resultado;
        } catch {
          await new Promise((res) => setTimeout(res, 300));
          continue;
        }
        if (detenido) return;
        if (pausadoRef.current) continue;

        const buena = r.ok && r.confianza >= CONFIANZA_MIN && r.errorMarcadores <= ERROR_MAX_MM;
        if (!buena) {
          previa = null;
          mejor = null;
          if (++fallos >= FALLOS_PARA_RETIRO) capturada = null;
          setEstado(capturada ? 'retirar' : 'buscando');
          dibujarMarcadores(r, escala, r.ok ? '#facc15' : '#f87171');
          continue;
        }
        const ok = r as ReadResult;
        fallos = 0;
        ultimaOk.current = ok;
        const firma = firmaLectura(ok);
        if (capturada && firma === capturada) {
          setEstado('retirar');
          dibujarMarcadores(ok, escala, '#94a3b8');
        } else if (previa === firma) {
          if (!mejor || ok.nitidez > mejor.nitidez) mejor = ok;
          ultimaOk.current = mejor;
          const esperado = performance.now() - quietaDesde >= ESPERA_MAX_MS;
          if (mejor.nitidez >= NITIDEZ_BUENA || (esperado && mejor.nitidez >= NITIDEZ_MIN)) {
            dibujarMarcadores(ok, escala, '#22c55e');
            const captura = mejor;
            capturada = firma;
            previa = null;
            mejor = null;
            navigator.vibrate?.(60);
            onCapturaRef.current(captura);
          } else {
            setEstado(esperado ? 'borrosa' : 'enfocando');
            dibujarMarcadores(ok, escala, '#facc15');
          }
        } else {
          previa = firma;
          capturada = null;
          mejor = ok;
          quietaDesde = performance.now();
          setEstado('detectada');
          dibujarMarcadores(ok, escala, '#facc15');
        }
      }
    }

    (async () => {
      precargarOMR().catch(() => undefined);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      } catch (e) {
        setErrorCamara(String((e as Error)?.message ?? e));
        setEstado('sin-camara');
        return;
      }
      if (detenido) { stream.getTracks().forEach((t) => t.stop()); return; }
      // Enfoque continuo donde el navegador lo permite (Chrome en Android).
      const pista = stream.getVideoTracks()[0];
      const caps = (pista?.getCapabilities?.() ?? {}) as { focusMode?: string[] };
      if (caps.focusMode?.includes('continuous'))
        await pista.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => undefined);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      try {
        wakeLock = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') ?? null;
      } catch { /* sin bloqueo de pantalla */ }
      await precargarOMR().catch(() => undefined);
      setEstado('buscando');
      ciclo();
    })();

    return () => {
      detenido = true;
      stream?.getTracks().forEach((t) => t.stop());
      wakeLock?.release().catch(() => undefined);
      canvas.width = canvas.height = 0;
    };
  }, [dibujarMarcadores]);

  async function capturarManual() {
    if (ultimaOk.current) onCapturaRef.current(ultimaOk.current);
  }

  async function usarFoto(file: File | undefined) {
    if (!file) return;
    setErrorFoto('');
    try {
      const r = (await leerHoja(await archivoAImagen(file), { incluirHoja: true, formatos: formatosRef.current })).resultado;
      if (r.ok) onCapturaRef.current(r);
      else setErrorFoto(r.motivo === 'sin-marcadores' ? 'No se encontraron los cuadros de las esquinas en la foto.' : 'No se reconoció el tipo de hoja en la foto.');
    } catch (e) {
      setErrorFoto(String(e));
    }
  }

  const mensaje = pausado ? '' : MENSAJE[estado];
  const colorGuia = estado === 'detectada' || estado === 'enfocando' || estado === 'borrosa' ? 'border-yellow-400' : estado === 'retirar' ? 'border-green-400' : 'border-white/70';

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {/* Guía de encuadre con la proporción de una hoja carta */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-5">
        <div className={`aspect-[0.773] max-h-full w-full max-w-[min(100%,calc((100dvh-12rem)*0.773))] rounded-xl border-4 border-dashed ${colorGuia} transition-colors`} />
      </div>
      {mensaje && (
        <div className="absolute inset-x-3 bottom-24 rounded-xl bg-black/65 px-3 py-2 text-center text-sm font-medium text-white">
          {mensaje}
        </div>
      )}
      {estado === 'sin-camara' && (
        <div className="absolute inset-x-4 top-1/3 rounded-xl bg-white p-4 text-center text-sm text-slate-700">
          <p className="mb-1 font-semibold">No se pudo abrir la cámara</p>
          <p className="text-xs text-slate-500">{errorCamara}</p>
          <p className="mt-2">Revisa el permiso de cámara del navegador, o usa una foto.</p>
        </div>
      )}
      {errorFoto && <div className="absolute inset-x-3 top-3 rounded-xl bg-red-600 px-3 py-2 text-sm text-white">{errorFoto}</div>}
      <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3">
        <label className="cursor-pointer rounded-full bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow">
          🖼️ Foto
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { usarFoto(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        <button
          onClick={capturarManual}
          disabled={estado !== 'detectada' && estado !== 'enfocando' && estado !== 'borrosa' && estado !== 'retirar'}
          className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-900 shadow disabled:opacity-40"
          aria-label="Capturar ahora"
        >
          ⬤ Capturar
        </button>
      </div>
      {children}
    </div>
  );
}
