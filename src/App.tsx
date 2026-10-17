import { createHashRouter, RouterProvider, useNavigate } from 'react-router';
import AvisoActualizacion from './components/AvisoActualizacion';
import PuertaLicencia from './components/PuertaLicencia';
import Inicio from './screens/Inicio';
import Claves from './screens/Claves';
import EditorClave from './screens/EditorClave';
import Hojas from './screens/Hojas';
import Ajustes from './screens/Ajustes';
import Activacion from './screens/Activacion';
import ProbarLector from './screens/ProbarLector';
import NuevaSesion from './screens/NuevaSesion';
import Escaneo from './screens/Escaneo';
import Revision from './screens/Revision';
import HojaDetalle from './screens/HojaDetalle';

// Activar desde Ajustes mientras la licencia es opcional.
function ActivarDesdeAjustes() {
  const navigate = useNavigate();
  return <Activacion alActivar={() => navigate('/ajustes')} />;
}

// Hash router: funciona en cualquier hosting estático (Netlify, Hostinger) y sin internet.
const router = createHashRouter([
  { path: '/', element: <Inicio /> },
  { path: '/claves', element: <Claves /> },
  { path: '/claves/nueva', element: <EditorClave /> },
  { path: '/claves/:id', element: <EditorClave /> },
  { path: '/hojas', element: <Hojas /> },
  { path: '/ajustes', element: <Ajustes /> },
  { path: '/activar', element: <ActivarDesdeAjustes /> },
  { path: '/probar', element: <ProbarLector /> },
  { path: '/sesion/nueva', element: <NuevaSesion /> },
  { path: '/sesion/escanear', element: <Escaneo /> },
  { path: '/sesion/revisar', element: <Revision /> },
  { path: '/sesion/revisar/:id', element: <HojaDetalle /> },
]);

export default function App() {
  return (
    <>
      <PuertaLicencia>
        <RouterProvider router={router} />
      </PuertaLicencia>
      <AvisoActualizacion />
    </>
  );
}
