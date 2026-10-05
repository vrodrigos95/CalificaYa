import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

// Service worker: guarda la app para usarla sin internet y se actualiza solo.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
