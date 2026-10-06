import { useState, type FormEvent } from 'react';
import { btn } from '../components/Screen';
import { APP_NAME, config } from '../config';
import type { MotivoRechazo } from '../license/licenseService';
import { useLicencia } from '../license/licenseStore';

const MENSAJES: Record<MotivoRechazo, string> = {
  vacia: 'Escribe tu código de licencia.',
  invalida: 'El código no es válido. Cópialo completo del correo de compra de Gumroad (incluye los guiones).',
  reembolsada: 'Esta compra fue reembolsada, así que la licencia ya no es válida.',
  contracargo: 'Esta compra tiene un contracargo, así que la licencia ya no es válida.',
  disputa: 'Esta compra está en disputa con el banco. Podrás activarla cuando se resuelva.',
  limite: `Esta licencia ya se activó en el máximo de ${config.maxActivaciones} dispositivos. Si cambiaste de celular o borraste los datos del navegador, escribe a ${config.supportEmail} para liberar un lugar.`,
  'error-red': 'Necesitas conexión a internet para activar la app (solo esta vez). Conéctate e inténtalo de nuevo.',
  'error-servidor': 'Gumroad no respondió. Intenta de nuevo en unos minutos.',
};

export default function Activacion() {
  const { activar, mensaje } = useLicencia();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const r = await activar(codigo);
      if (!r.ok) setError(MENSAJES[r.motivo]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
      <div className="mb-8 text-center">
        <img src="icons/icon-192.png" alt="" className="mx-auto h-20 w-20" />
        <h1 className="mt-3 text-3xl font-bold text-slate-900">{APP_NAME}</h1>
        <p className="text-slate-500">Califica exámenes con la cámara de tu celular</p>
      </div>
      {mensaje && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{mensaje}</p>}
      <form onSubmit={enviar} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <label htmlFor="licencia" className="block font-semibold text-slate-800">Código de licencia</label>
        <input
          id="licencia"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="w-full rounded-xl border border-slate-300 px-3 py-3 font-mono text-sm"
        />
        {error && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900" role="alert">{error}</p>}
        <button type="submit" disabled={enviando} className={`${btn.primary} w-full`}>
          {enviando ? 'Verificando…' : 'Activar'}
        </button>
        <p className="text-xs text-slate-500">
          Lo encuentras en el correo de tu compra en Gumroad. Solo se envía este código para validarlo; tus alumnos y calificaciones nunca salen del dispositivo.
        </p>
      </form>
      <div className="mt-6 space-y-2 text-center text-sm">
        <a href={config.gumroad.purchaseUrl} target="_blank" rel="noopener noreferrer" className="block font-semibold text-blue-700 underline">
          ¿Aún no tienes licencia? Cómprala en Gumroad
        </a>
        <a href={`mailto:${config.supportEmail}`} className="block text-slate-500">Soporte: {config.supportEmail}</a>
        {config.desarrollo && (
          <p className="rounded-lg bg-slate-100 p-2 text-xs text-slate-600">Modo desarrollo: usa el código <span className="font-mono">PRUEBA-0000-0000-0000</span></p>
        )}
      </div>
    </div>
  );
}
