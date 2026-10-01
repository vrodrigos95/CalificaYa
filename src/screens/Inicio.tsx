import { Link } from 'react-router';
import { APP_NAME } from '../config';

const items = [
  { to: '/claves', title: 'Claves de examen', desc: 'Crea, edita y duplica las respuestas correctas', icon: '🔑' },
  { to: '/hojas', title: 'Hojas de respuesta', desc: 'Genera el PDF para imprimir (20, 50 o 100 preguntas)', icon: '🖨️' },
  { to: '/ajustes', title: 'Ajustes', desc: 'Licencia y preferencias', icon: '⚙️' },
];

export default function Inicio() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col p-5">
      <div className="mb-6 flex items-center gap-3 pt-4">
        <img src="icons/icon-192.png" alt="" className="h-12 w-12" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{APP_NAME}</h1>
          <p className="text-sm text-slate-500">Califica exámenes con la cámara</p>
        </div>
      </div>
      <button disabled className="mb-4 w-full rounded-2xl bg-blue-700 p-5 text-left text-white opacity-50 shadow">
        <div className="text-lg font-semibold">📷 Calificar</div>
        <div className="text-sm text-blue-100">Disponible en la Fase 3 (escaneo con cámara)</div>
      </button>
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
