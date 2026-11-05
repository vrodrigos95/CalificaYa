# CalificaYa — plan de mudanza a Hostinger e identidad visual

PWA para calificar hojas de burbujas con la cámara y exportar a Excel. Hoy está en Netlify (calificaya.netlify.app) con estilo azul/gris de Tailwind y íconos provisionales. Este plan hace dos cosas: la mueve a **calificaya.rsrapps.com** (Hostinger, con PHP) y le da **ícono, logo y el estilo de rsrapps.com**, sin cambiar lo que hace la app.

- **Autor:** Rodrigo Sedano.
- **Repo:** `vrodrigos95/CalificaYa` (público hoy; pasa a privado en la Fase 3).
- **Repo de referencia de estilo:** `vrodrigos95/rsrapps` (privado). Solo se lee, no se modifica.
- **Stack actual:** React 19 + TypeScript + Vite 8, Tailwind 4, vite-plugin-pwa, OpenCV.js (~13 MB), Dexie (IndexedDB), ExcelJS, jsPDF, Vitest. Rutas con `#` (no necesita redirecciones del servidor).
- **Dispositivo de prueba:** iPhone SE. La cámara exige HTTPS.
- **Idioma:** español de México.

## Decisiones

- Subdominio final: `calificaya.rsrapps.com`.
- Se deja Netlify. La función `netlify/functions/verificar-licencia.mjs` se reemplaza por un script PHP en el mismo dominio.
- La licencia sigue siendo Gumroad (máximo 3 dispositivos por clave). La app no guarda datos de alumnos; solo claves de examen y estado de licencia, en el dispositivo.
- Publicación automática: al hacer merge a `main`, GitHub Actions prueba, compila y sube `dist/` a Hostinger. No hay sitio de pruebas aparte; se prueba en producción.
- Ningún secreto va en el JavaScript ni en el repo. Los secretos de despliegue viven en GitHub Secrets.
- No se toca la lógica de lectura (OMR), calificación, Excel ni PDF.

## Estilo (de rsrapps.com, dirección "Fresco — lima y pasteles")

Fuente de verdad: `src/estilos/tokens.css` del repo `rsrapps`. Resumen:

- **Colores claros:** fondo `#fbfbf8`, superficie `#ffffff`, texto `#151515`, texto 2 `#4a4a45`, apagado `#64645d`, borde `#e3e3dc`, suave `#f2f2ec`.
- **Acento:** lima `#c4ef4a` (hover `#b3e02f`), texto sobre lima `#151515`. El lima solo va como relleno (botón principal, seleccionado), nunca como texto sobre fondo claro.
- **Modo oscuro:** sigue al sistema; fondo `#121211`, superficie `#1a1a18`, texto `#f2f2ec`, borde `#2e2e2a`, suave `#24241f`, hover de lima `#d3f76e`. Botón de tema opcional, igual que en rsrapps (`data-theme` en `<html>`, preferencia en `localStorage`).
- **Tipografía:** títulos Bricolage Grotesque 700 (interlineado 1.05, tracking −0.03em); cuerpo Figtree 400/500/600. Se instalan con `@fontsource` (latin) para que funcionen sin conexión.
- **Forma:** radios 12 / 18 / 22 / 28 px y píldora 999 px; zonas táctiles de mínimo 44 px; movimiento de 160 a 280 ms, apagado con `prefers-reduced-motion`.
- **Marca de rsrapps:** cuadrado `#151515` con esquinas redondeadas y un círculo lima en el centro; el nombre va en minúsculas ("rsr apps").
- **Tono:** frases cortas, español de México, sin relleno.

## Riesgo conocido

IndexedDB es por origen. Al cambiar de `calificaya.netlify.app` a `calificaya.rsrapps.com`, las claves de examen y la licencia guardadas en el celular **no se pasan solas**. Antes del cambio: exportar las claves a JSON (pantalla Claves → "Exportar todas") y, en el sitio nuevo, importarlas y activar la licencia otra vez. Como todavía no hay clientes, solo afecta a Rodrigo.

## Fases

> Orden vigente (ver ESTADO.md): el despliegue y la salida de Netlify van antes que la identidad visual. Antes eran las Fases 4 y 5.

### Fase 1 — Backend de licencia en PHP y ajustes para Hostinger
**Objetivo:** que la app compilada funcione servida desde Apache/PHP con la verificación de licencia en el mismo dominio.
**Tareas:**
1. `public/api/verificar-licencia.php`: recibe POST con `product_id`, `license_key`, `increment_uses_count`; deja pasar solo esos tres campos (máx. 200 caracteres); reenvía a `https://api.gumroad.com/v2/licenses/verify` con cURL y devuelve la respuesta tal cual. Solo POST (405 en otro caso), `Cache-Control: no-store`, tiempo de espera de 10 s, 502 con `gumroad-no-disponible` si falla. Límite simple de intentos por IP (archivo en la carpeta temporal del sistema, no en `public_html`).
2. `public/.htaccess`: redirigir HTTP a HTTPS; compresión gzip/brotli para js, css, wasm, json y svg; `Cache-Control` `no-cache` para `sw.js` y `manifest.webmanifest`; `immutable` de 1 año para `/assets/*`; bloquear listado de directorios.
3. `src/config.ts` y `.env.example`: `VITE_LICENCIA_URL` por defecto `/api/verificar-licencia.php` en producción; llamada directa solo en desarrollo. Quitar menciones a `/.netlify/functions/`.
4. Pruebas: `php -l` y una prueba de contrato (mismos campos y códigos que la función de Netlify); `npm test` y `npm run build` en verde; `dist/` incluye `.htaccess` y `api/verificar-licencia.php`.
**Archivos que toca:** `public/api/verificar-licencia.php` (nuevo), `public/.htaccess` (nuevo), `src/config.ts`, `.env.example`, `vite.config.ts` (solo si hace falta), `tests/license.test.ts` (solo si cambia algo).
**Criterio de terminado:** build y pruebas en verde; el PHP pasa `php -l`; PR abierto sin merge.

### Fase 2 — Despliegue automático a Hostinger
**Objetivo:** que cada merge a `main` publique solo en `calificaya.rsrapps.com`.
**Tareas:**
1. `.github/workflows/deploy-hostinger.yml`: en push a `main` y a mano; `npm ci`, `npm test`, `npm run typecheck`, `npm run build` con las variables de Gumroad desde GitHub Variables y `VITE_CODIGO_MAESTRO` desde Secrets; subir `dist/` por FTPS con `SamKirkland/FTP-Deploy-Action` a la carpeta del subdominio, incluyendo archivos ocultos (`.htaccess`); al final, verificar con curl el 200 del sitio y el 405 de la API.
2. Que el despliegue no borre archivos de configuración del servidor.
3. Dejar `pages.yml` como está (solo manual).
4. Documentar en `README.md` la sección "Publicar (Hostinger)" y los secretos necesarios.
**Archivos que toca:** `.github/workflows/deploy-hostinger.yml` (nuevo), `README.md`, `.env.example`.
**Criterio de terminado:** el flujo corre y publica; `https://calificaya.rsrapps.com` abre con candado de HTTPS y `/api/verificar-licencia.php` responde 405 a un GET.
**Pasos manuales de Rodrigo:** crear el subdominio y el SSL en hPanel; crear la cuenta FTP; cargar los secretos y variables en GitHub; registrar el `product_id` real de Gumroad cuando exista.

### Fase 3 — Cambio de sitio y limpieza
**Objetivo:** dejar Hostinger como única casa de la app.
**Tareas:**
1. Prueba completa en iPhone SE desde el sitio nuevo: abrir, instalar en pantalla de inicio, cámara, calificar una hoja, exportar Excel, modo avión (sin conexión) y activar licencia.
2. Quitar `netlify.toml` y `netlify/`; actualizar `README.md`, `COMO_USAR.md` y `docs/guia` con la dirección nueva (las capturas con el estilo nuevo se rehacen al final de la Fase 5).
3. En Netlify, publicar una última versión con un aviso "La app se mudó a calificaya.rsrapps.com".
4. Pasar el repo a privado.
**Criterio de terminado:** lista de comprobación de la prueba en iPhone SE, sin referencias a Netlify en el repo.

### Fase 4 — Identidad: ícono, logo y base de estilo rsrapps
**Objetivo:** que CalificaYa tenga marca propia y la base visual de rsrapps.com, lista para aplicarla pantalla por pantalla.
**Tareas:**
1. **Ícono.** Mismo lenguaje que el de rsrapps (cuadrado `#151515` con círculo lima), con el motivo de CalificaYa: una burbuja de hoja de respuestas rellena en lima, con una palomita `#151515`. Generar con `scripts/make-icons.mjs`: `icon-192.png`, `icon-512.png`, `maskable-512.png` (motivo dentro del 60 % central), `apple-touch-icon-180.png` y `favicon.svg`.
2. **Logo.** `public/logo.svg` (símbolo + nombre "califica ya" en minúsculas, Bricolage Grotesque 700, con el texto convertido a trazos para no depender de la fuente) y `public/logo-oscuro.svg` para fondos oscuros. Un componente `Logo` en `src/components/` que elige la variante según el tema.
3. **Tokens y fuentes.** Variables de rsrapps en `src/index.css` (colores, radios, tipografía, movimiento, modo oscuro que sigue al sistema) enlazadas a Tailwind con `@theme`; `@fontsource/bricolage-grotesque` y `@fontsource/figtree` en latin.
4. **Componentes compartidos.** Rehacer `Screen.tsx` y los estilos `btn` (principal lima con texto oscuro, secundario, pequeño, peligro) con los tokens; encabezado con el logo.
5. **PWA y metadatos.** `theme_color` `#121211`, `background_color` `#fbfbf8` en `vite.config.ts` y `index.html`; `<title>` y descripción.
6. **Pantallas de entrada.** Aplicar el estilo a `Inicio`, `Activacion`, `PuertaLicencia`, `RequiereConexion` y `Ajustes`.
**Archivos que toca:** `scripts/make-icons.mjs`, `public/icons/*`, `public/logo.svg`, `public/logo-oscuro.svg`, `src/index.css`, `src/components/Screen.tsx`, `src/components/Logo.tsx` (nuevo), `src/components/PuertaLicencia.tsx`, `src/screens/{Inicio,Activacion,RequiereConexion,Ajustes}.tsx`, `index.html`, `vite.config.ts`, `package.json`.
**Criterio de terminado:** `npm test` y `npm run build` en verde; íconos y logo generados y revisados a la vista; las cinco pantallas con el estilo nuevo en claro y oscuro; contraste AA; la app sigue cabiendo y rindiendo en iPhone SE; instalada en pantalla de inicio muestra el ícono nuevo.

### Fase 5 — Estilo en el resto de las pantallas
**Objetivo:** que toda la app se vea igual que las pantallas de entrada.
**Tareas:**
1. Claves y `EditorClave`.
2. `NuevaSesion` y `CargarAlumnos`.
3. `Escaneo`, `Scanner`, `ProbarLector` (la cámara y el overlay de lectura conservan su contraste y sus colores de aciertos y errores, que son funcionales).
4. `Hojas`, `HojaDetalle`, `HojaRevision`, `Revision`.
5. Quitar los colores sueltos de Tailwind (`slate`, `blue`, `amber`) que queden sin usar.
6. Rehacer las capturas de `COMO_USAR.md` y `docs/guia` con el estilo nuevo y regenerar `docs/Guia_CalificaYa.pdf`.
**Archivos que toca:** `src/screens/*`, `src/components/*`, `src/index.css`, `COMO_USAR.md`, `docs/guia/*`, `docs/Guia_CalificaYa.pdf`.
**Criterio de terminado:** `npm test` y `npm run build` en verde; recorrido completo de la app en iPhone SE en claro y oscuro; ningún texto con contraste menor a AA.

## Archivos de control

- **PLAN.md** (este archivo): qué se hace. Solo cambia si Rodrigo decide algo nuevo.
- **ESTADO.md:** lo actualiza Claude Code al cerrar cada fase.
