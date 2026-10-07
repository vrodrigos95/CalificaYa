import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { iniciarActualizaciones } from './lib/actualizacion';

// Service worker: guarda la app para usarla sin internet; las versiones nuevas
// se ofrecen con un aviso (ver AvisoActualizacion).
iniciarActualizaciones();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
