# CalificaYa: contexto para continuar en otra conversación

## El proyecto
- App web (PWA) para calificar exámenes de opción múltiple con la cámara del celular. Estilo ZipGrade, en español, para docentes.
- Repositorio: `vrodrigos95/CalificaYa`. Stack: React + TypeScript + Vite, OpenCV.js (lectura de burbujas), Tesseract.js (lectura de letra), ExcelJS, Zustand, Dexie (IndexedDB) y vite-plugin-pwa.
- Publicación: Netlify, desde la rama **`main`**, en https://calificaya.netlify.app. Cada PR genera una vista previa en `deploy-preview-N--calificaya.netlify.app`.
  - La rama `claude/vigilant-turing-cr98pa` aparece como principal en GitHub, pero **Netlify publica `main`**. Los cambios siempre van a `main`.
- Rama de trabajo usada: `claude/wonderful-meitner-0rxas1`. Se reinicia desde `origin/main` en cada cambio nuevo.
- Flujo: PR a `main` → el usuario pide fusionar → Netlify publica.
- Privacidad: los datos de alumnos y las calificaciones viven solo en la memoria del celular. En IndexedDB solo se guardan las claves y la licencia.
- Licencia: Gumroad. En modo desarrollo se activa con el código `PRUEBA-0000-0000-0000`.
- El usuario usa **iPhone**.

## Hojas de respuesta
- 20 preguntas: sin código de alumno en burbujas. Recuadros Nombre / Fecha / Grupo (en ZipGrade: Name / Date / Period).
- 50 preguntas: código de alumno de 5 dígitos en burbujas.
- 100 preguntas: código de 9 dígitos en burbujas.
- Se pueden usar exámenes con menos preguntas que la hoja (por ejemplo, 12 preguntas en la hoja de 20 o de 50).

## Cambios hechos en esta sesión (PR fusionados)
| PR | Cambio |
|---|---|
| #2 (a `claude/vigilant-turing-cr98pa`) y #3 (a `main`) | El campo «Preguntas» del editor de claves se aplica al salir del campo, no en cada tecla (antes no dejaba poner 12). Al escanear la clave se ofrece recortar el examen. |
| #4 | Lista de alumnos con No. de lista, nombre, apellidos y código. Búsqueda del alumno por código, No. de lista, nombre o apellidos. «Alumno repetido». Columna «No. lista» en el Excel. |
| #5 | Escaneo nítido: medida de nitidez (varianza del laplaciano) y captura solo cuando la imagen está enfocada; cámara de 1920 px; imagen de revisión de mayor resolución. Plantilla fija `public/plantilla-alumnos.xlsx` (columnas: **No. de lista, Apellidos, Nombre(s), Código**) con botón «⬇️ Plantilla» siempre visible. Corrección de listas sin código. |
| #6 | Service worker en modo `prompt`: barra «Hay una versión nueva — Actualizar» y versión visible en Ajustes. |
| #7 | Lectura de lo escrito a mano (Nombre/Fecha/Grupo) con Tesseract.js en el celular, sin internet (archivos en `public/tesseract/`). Propone al alumno con «¿Es …? ✓ Sí / ✗ No» en Revisar y en el detalle de la hoja. Nunca asigna sin confirmar. |
| #8 | Barra en la pantalla de escaneo «#3 ¿Es …? ✓ ✗» para confirmar sin ir a Revisar. «La app leyó: …» en el detalle. El nombre se lee dos veces (contraste normal y blanco y negro). Búsqueda tolerante a palabras pegadas o partidas. |
| #9 | `version.json` publicado al compilar. La app compara la versión publicada con la suya y, si el service worker no actualiza en 20 s, ofrece una actualización forzada: borra el service worker y los cachés, pero no las claves ni la licencia. |

## Situación actual
- Todo está fusionado en `main` y publicado. El usuario reinstaló la app en el iPhone y ya tiene la última versión.
- Las pruebas pasan: 117 en `npx vitest run`.

## Archivos clave
- `src/session/alumnos.ts`: lectura de la lista y búsqueda del alumno (`coincidencias`, `buscarAlumno`).
- `src/ocr/manuscrito.ts`: zonas escritas a mano, recortes y `sugerirAlumnos`.
- `src/ocr/ocrClient.ts`: Tesseract.
- `src/session/sugerencias.ts`, `src/components/ConfirmarAlumno.tsx`, `src/components/BandejaConfirmar.tsx`.
- `src/components/Scanner.tsx`: captura y nitidez.
- `src/omr/reader.ts`: lectura de burbujas y `nitidez`.
- `src/lib/actualizacion.ts`, `src/components/AvisoActualizacion.tsx`, `src/screens/Ajustes.tsx`: actualizaciones.
- `src/screens/EditorClave.tsx`, `src/screens/HojaDetalle.tsx`, `src/screens/Revision.tsx`, `src/screens/Escaneo.tsx`.

## Pendientes y cosas por vigilar
- Los umbrales de nitidez (`NITIDEZ_BUENA` 60 y `NITIDEZ_MIN` 25 en `Scanner.tsx`) se calibraron con imágenes sintéticas. Hay que confirmarlos con el celular real.
- La lectura de letra a mano funciona bien con letra de molde y números, y mal con cursiva. Hay que probarla con exámenes reales: el usuario puede mandar capturas de «La app leyó: …».
- Lo más confiable para identificar alumnos: que escriban su **número de lista** en Nombre, o usar la **hoja de 50** con el código o el No. de lista rellenado en burbujas.
