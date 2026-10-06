import { useState } from 'react';
import { useNavigate } from 'react-router';
import { downloadBlob } from '../lib/download';
import { avisosHoja, codigosRepetidos, useSesion } from '../session/sessionStore';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Exporta la sesión a Excel y ofrece cerrarla (borrando los datos de la memoria). */
export function useExportar() {
  const navigate = useNavigate();
  const [exportando, setExportando] = useState(false);

  async function exportar() {
    const s = useSesion.getState().sesion;
    if (!s || s.hojas.length === 0) { alert('Aún no hay hojas escaneadas.'); return; }
    const rep = codigosRepetidos(s.hojas, s.alumnos);
    const conAvisos = s.hojas.filter((h) => avisosHoja(h, rep).length > 0).length;
    if (conAvisos && !confirm(`${conAvisos} hoja(s) tienen avisos sin revisar (código, versión o marcas dudosas). ¿Exportar de todos modos?`)) return;
    setExportando(true);
    try {
      const { construirExcel, nombreArchivo } = await import('../export/excel');
      const datos = await construirExcel(s, { nombres: s.alumnos ?? undefined });
      downloadBlob(new Blob([datos as BlobPart], { type: XLSX }), nombreArchivo(s.clave.nombre));
      useSesion.getState().marcarExportada();
      // Dar tiempo a que empiece la descarga antes de preguntar
      await new Promise((r) => setTimeout(r, 400));
      if (confirm('Excel exportado. ¿Cerrar sesión y borrar los datos?')) {
        useSesion.getState().cerrar();
        navigate('/', { replace: true });
      }
    } catch (e) {
      alert(`No se pudo generar el Excel: ${e}`);
    } finally {
      setExportando(false);
    }
  }

  return { exportar, exportando };
}
