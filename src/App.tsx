import { createHashRouter, RouterProvider } from 'react-router';
import Inicio from './screens/Inicio';
import Claves from './screens/Claves';
import EditorClave from './screens/EditorClave';
import Hojas from './screens/Hojas';
import Ajustes from './screens/Ajustes';

// Hash router: funciona en cualquier hosting estático (Netlify, Hostinger) y sin internet.
const router = createHashRouter([
  { path: '/', element: <Inicio /> },
  { path: '/claves', element: <Claves /> },
  { path: '/claves/nueva', element: <EditorClave /> },
  { path: '/claves/:id', element: <EditorClave /> },
  { path: '/hojas', element: <Hojas /> },
  { path: '/ajustes', element: <Ajustes /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
