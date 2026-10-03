import { Link } from 'react-router';
import { APP_NAME } from '../config';
import { useSesion } from '../session/sessionStore';

const items = [
  { to: '/claves', title: 'Claves de examen', desc: 'Crea, edita y duplica las respuestas correctas', icon: '🔑' },
  { to: '/hojas', title: 'Hojas de respuesta', desc: 'Genera el PDF para imprimir (20, 50 o 100 preguntas)', icon: '🖨️' },
  { to: '/probar', title: 'Probar lector', desc: 'Lee una foto de una hoja y muestra lo detectado', icon: '🔍' },
  { to: '/ajustes', title: 'Ajustes', desc: 'Licencia y preferencias', icon: '⚙️' },
];

export default function Inicio() {
  const sesion = useSesion((s) => s.sesion);
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col p-5">
      <div className="mb-6 flex items-center gap-3 pt-4">
        <img src="icons/icon-192.png" alt="" className="h-12 w-12" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{APP_NAME}</h1>
          <p className="text-sm text-slate-500">Califica exámenes con la cámara</p>
        </div>
      </div>
      <Link to={sesion ? '/sesion/escanear' : '/sesion/nueva'} className="mb-4 block w-full rounded-2xl bg-blue-700 p-5 text-left text-white shadow active:bg-blue-800">
        <div className="text-lg font-semibold">📷 {sesion ? 'Continuar calificando' : 'Calificar'}</div>
        <div className="text-sm text-blue-100">
          {sesion ? `${sesion.clave.nombre} · ${sesion.hojas.length} hoja(s)` : 'Elige una clave y escanea las hojas con la cámara'}
        </div>
      </Link>
      <nav className="grid gap-3">
        {items.map((it) => (
          <Link key={it.to} to={it.to} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50">
            <span className="text-2xl">{it.icon}</span>
            <span>
              <span className="block font-semibold text-slate-900">{it.title}</span>
              <span className="block text-sm text-slate-500">{it.desc}</span>
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
