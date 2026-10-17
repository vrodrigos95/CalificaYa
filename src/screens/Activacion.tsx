import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { btn } from '../components/Screen';
import { APP_NAME, config } from '../config';
import { useLicencia } from '../license/licenseStore';
import { COMO_LIBERAR, MENSAJES, type MensajeLicencia } from '../license/mensajes';

export function Aviso({ mensaje, tono = 'amber' }: { mensaje: MensajeLicencia; tono?: 'amber' | 'red' }) {
  const color = tono === 'red' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900';
  return (
    <div className={`space-y-1 rounded-lg p-2 text-sm ${color}`} role="alert">
      <p>{mensaje.texto}</p>
      {mensaje.comoLiberar && <p>{COMO_LIBERAR}</p>}
      {mensaje.enlace && (
        <a href={mensaje.enlace.href} target="_blank" rel="noopener noreferrer" className="block font-semibold underline">
          {mensaje.enlace.texto}
        </a>
      )}
    </div>
  );
}

/** Pantalla de activación. `alActivar` se pasa cuando se abre desde Ajustes (licencia opcional, dentro del router). */
export default function Activacion({ alActivar }: { alActivar?: () => void }) {
  const { activar, aviso } = useLicencia();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<MensajeLicencia | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await activar(codigo);
      if (!r.ok) setError(MENSAJES[r.motivo]);
      else alActivar?.();
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
      {aviso && !error && <div className="mb-4"><Aviso mensaje={MENSAJES[aviso]} tono="red" /></div>}
      <form onSubmit={enviar} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <label htmlFor="licencia" className="block font-semibold text-slate-800">Clave de licencia</label>
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
        {error && <Aviso mensaje={error} />}
        <button type="submit" disabled={enviando} className={`${btn.primary} w-full`}>
          {enviando ? 'Verificando…' : 'Activar'}
        </button>
        <p className="text-xs text-slate-500">
          Sirve la clave de CalificaYa o la del Pase Maestro; la encuentras en el correo de tu compra en Gumroad. Solo se envía esta clave para validarla; tus alumnos y calificaciones nunca salen del dispositivo.
        </p>
      </form>
      <div className="mt-6 space-y-2 text-center text-sm">
        <p className="text-slate-600">¿Aún no tienes clave?</p>
        <a href={config.licencia.compraUrl} target="_blank" rel="noopener noreferrer" className="block font-semibold text-blue-700 underline">
          Comprar CalificaYa
        </a>
        <a href={config.licencia.paseUrl} target="_blank" rel="noopener noreferrer" className="block font-semibold text-blue-700 underline">
          Pase Maestro: CalificaYa, Cuadra, juegos e infografías
        </a>
        {alActivar && <Link to="/ajustes" className="block pt-2 text-slate-500 underline">Volver a Ajustes</Link>}
        <a href={`mailto:${config.supportEmail}`} className="block text-slate-500">Soporte: {config.supportEmail}</a>
        {config.desarrollo && (
          <p className="rounded-lg bg-slate-100 p-2 text-xs text-slate-600">Modo desarrollo: usa el código <span className="font-mono">PRUEBA-0000-0000-0000</span></p>
        )}
      </div>
    </div>
  );
}
