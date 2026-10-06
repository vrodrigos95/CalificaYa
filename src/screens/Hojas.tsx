import { useState } from 'react';
import { useSearchParams } from 'react-router';
import Screen, { btn } from '../components/Screen';
import { ID_DIGITOS } from '../layout/sheetLayout';
import { FORMATOS, type Formato } from '../layout/sheetLayout';
import { downloadBlob } from '../lib/download';

export default function Hojas() {
  const [params] = useSearchParams();
  const fParam = Number(params.get('formato'));
  const [formato, setFormato] = useState<Formato>(FORMATOS.includes(fParam as Formato) ? (fParam as Formato) : 50);
  const [copias, setCopias] = useState(1);
  const [generando, setGenerando] = useState(false);

  async function generar() {
    setGenerando(true);
    try {
      // Carga diferida: jsPDF solo se descarga cuando se necesita.
      const { generateSheetPdf, sheetFileName } = await import('../pdf/generateSheet');
      const doc = generateSheetPdf({ formato, copias });
      downloadBlob(doc.output('blob'), sheetFileName(formato));
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
          <p className="mt-2 text-sm text-slate-600">
            {formato === 20
              ? 'Sin código de alumno: los alumnos se identifican por nombre al revisar.'
              : `Código de alumno de ${ID_DIGITOS[formato]} dígitos · versiones A–E · opciones A–E.`}
          </p>
          {formato === 50 && (
            <p className="mt-1 text-sm text-amber-700">
              El código de 9 dígitos UdeG no cabe en esta hoja (5 dígitos). Si lo necesitas, usa la de 100.
            </p>
          )}
        </section>

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
          Las hojas son compatibles con las de ZipGrade: la app lee ambas. Para exámenes A–D, la opción E se ignora.
        </p>
      </div>
    </Screen>
  );
}
