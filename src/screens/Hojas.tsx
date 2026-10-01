import { useState } from 'react';
import { useSearchParams } from 'react-router';
import Screen, { btn } from '../components/Screen';
import { config } from '../config';
import { FORMATOS, type Formato } from '../layout/sheetLayout';
import { downloadBlob } from '../lib/download';

export default function Hojas() {
  const [params] = useSearchParams();
  const fParam = Number(params.get('formato'));
  const [formato, setFormato] = useState<Formato>(FORMATOS.includes(fParam as Formato) ? (fParam as Formato) : 50);
  const [opciones, setOpciones] = useState<4 | 5>(params.get('opciones') === '4' ? 4 : 5);
  const [idDigitos, setIdDigitos] = useState(config.idDigitosDefault);
  const [copias, setCopias] = useState(1);
  const [generando, setGenerando] = useState(false);

  async function generar() {
    setGenerando(true);
    try {
      // Carga diferida: jsPDF solo se descarga cuando se necesita.
      const { generateSheetPdf, sheetFileName } = await import('../pdf/generateSheet');
      const o = { formato, opciones, idDigitos };
      const doc = generateSheetPdf({ ...o, copias });
      downloadBlob(doc.output('blob'), sheetFileName(o));
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Screen title="Hojas de respuesta" back="/">
      <div className="space-y-6">
        <section>
          <h2 className="mb-2 font-semibold text-slate-800">Número de preguntas</h2>
          <div className="grid grid-cols-3 gap-2">
            {FORMATOS.map((f) => (
              <button
                key={f}
                onClick={() => setFormato(f)}
                className={`rounded-xl border py-4 text-xl font-bold ${formato === f ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-800'}`}
              >
                {f}
              </button>
            ))}
          </div>
          {formato === 20 && (
            <p className="mt-2 text-sm text-amber-700">
              La hoja de 20 no lleva código de alumno: los alumnos se identifican por nombre al revisar.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-slate-800">Opciones por pregunta</h2>
          <div className="grid grid-cols-2 gap-2">
            {([5, 4] as const).map((n) => (
              <button
                key={n}
                onClick={() => setOpciones(n)}
                className={`rounded-xl border py-3 font-semibold ${opciones === n ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-800'}`}
              >
                {n === 5 ? 'A – E' : 'A – D'}
              </button>
            ))}
          </div>
        </section>

        {formato !== 20 && (
          <section>
            <label className="mb-2 block font-semibold text-slate-800" htmlFor="digitos">
              Dígitos del código de alumno
            </label>
            <input
              id="digitos"
              type="number"
              min={1}
              max={15}
              value={idDigitos}
              onChange={(e) => setIdDigitos(Math.max(1, Math.min(15, Number(e.target.value) || 1)))}
              className="w-28 rounded-xl border border-slate-300 px-3 py-2 text-lg"
            />
            <p className="mt-1 text-sm text-slate-500">El código UdeG tiene 9 dígitos.</p>
          </section>
        )}

        <section>
          <label className="mb-2 block font-semibold text-slate-800" htmlFor="copias">
            Páginas en el PDF
          </label>
          <input
            id="copias"
            type="number"
            min={1}
            max={200}
            value={copias}
            onChange={(e) => setCopias(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
            className="w-28 rounded-xl border border-slate-300 px-3 py-2 text-lg"
          />
          <p className="mt-1 text-sm text-slate-500">Puedes generar una sola y sacar copias, o una página por alumno.</p>
        </section>

        <button onClick={generar} disabled={generando} className={`${btn.primary} w-full`}>
          {generando ? 'Generando…' : 'Descargar PDF (tamaño carta)'}
        </button>
        <p className="text-sm text-slate-500">
          Imprime al 100 % (sin "ajustar a la página") y sin escalar para que la lectura sea precisa.
        </p>
      </div>
    </Screen>
  );
}
