# CalificaYa

PWA para calificar exámenes de opción múltiple con la cámara del celular
(hojas de burbujas) y exportar los resultados a Excel. Todo se procesa en el
dispositivo; solo se guardan las claves de examen y el estado de la licencia.

> 👩‍🏫 **¿Eres docente y quieres usar la app?** Lee la guía paso a paso: **[COMO_USAR.md](COMO_USAR.md)** o el PDF con imágenes **[docs/Guia_CalificaYa.pdf](docs/Guia_CalificaYa.pdf)**.
>
> Lo que sigue es información técnica para desarrollo.

## Requisitos

- Node.js 20 o superior

## Comandos

```bash
npm install
npm run dev        # servidor de desarrollo en http://localhost:5173
npm run dev:celular  # igual, con HTTPS y visible en la red local (la cámara del celular exige HTTPS)
npm test           # pruebas automáticas (genera PDFs y un Excel de muestra en test-output/;
                   # si hay LibreOffice instalado, también recalcula y verifica las fórmulas)
npm run build      # compilación para producción en dist/
npm run preview    # sirve dist/ en http://localhost:4173
npm run icons      # regenera los íconos provisionales de public/icons
node scripts/guia-pdf.cjs        # regenera docs/Guia_CalificaYa.pdf desde docs/guia/guia.html
npx tsx scripts/omr-try.ts 50 1   # lee una hoja sintética y guarda test-output/foto.png y hoja.png
```

## Publicar (Netlify)

1. En Netlify: *Add new site → Import an existing project* y elige este repositorio.
2. `netlify.toml` ya indica el comando (`npm run build`) y la carpeta (`dist`).
3. Agrega las variables de `.env.example` en *Site configuration → Environment variables*.
   Opcional: `VITE_CODIGO_MAESTRO` (código personal para usar la app sin Gumroad mientras lo configuras).

Netlify da HTTPS automáticamente, necesario para la cámara y para instalar la app.
La primera visita descarga ~15 MB (OpenCV); después la app funciona sin internet.

## Publicar (GitHub Pages)

1. Fusiona a `main`.
2. *Settings → Pages → Source:* **GitHub Actions** (no “Deploy from a branch”: la app se
   tiene que compilar). El flujo `.github/workflows/pages.yml` compila y publica (se lanza a mano desde
   *Actions → Publicar en GitHub Pages → Run workflow*) en `https://<usuario>.github.io/CalificaYa/`.
3. Opcional, en *Settings → Secrets and variables → Actions*:
   - **Variables:** `VITE_GUMROAD_PRODUCT_ID`, `VITE_GUMROAD_PURCHASE_URL`, `VITE_SUPPORT_EMAIL`.
   - **Secret** `CODIGO_MAESTRO`: un código personal que activa la app sin Gumroad (para
     usarla tú mientras configuras Gumroad). Queda dentro del código publicado: no lo compartas.

## Configuración

Copia `.env.example` a `.env`. Todos los valores configurables se leen
únicamente en `src/config.ts`.

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/layout/` | Geometría de las hojas (fuente única para PDF y OMR) y tira de formato |
| `src/pdf/` | Generador de hojas de respuesta en PDF (jsPDF) |
| `src/keys/` | Modelo de datos de las claves de examen |
| `src/omr/` | Motor OMR (OpenCV.js en Web Worker) |
| `src/grading/` | Calificación de una hoja contra la clave |
| `src/export/excel.ts` | Exportación a Excel (ExcelJS) con fórmulas |
| `src/db/` | IndexedDB (Dexie): solo claves y licencia |
| `src/license/servidor.ts` | Único módulo que llama al servidor de licencias de trucosdeaula.com |
| `src/license/licenseService.ts` | Reglas: activación, verificación cada 24 h, 7 días sin conexión, desactivar |
| `src/session/` | Sesión de calificación y lista de alumnos (solo en memoria) |
| `src/keys/keysJson.ts` | Importar / exportar claves en JSON |
| `src/components/Scanner.tsx` | Cámara en vivo con captura automática |
| `src/screens/` | Pantallas de la app |
| `tests/` | Pruebas con Vitest; `tests/synthetic/` genera fotos sintéticas |
| `scripts/extract-form-geometry.py` | Extrae la geometría de las hojas de 50/100 desde los PDF originales |

## Estado

- [x] Fase 1: generador de hojas en PDF + gestión de claves
- [x] Fase 2: motor OMR probado con imágenes sintéticas
- [x] Fase 3: escaneo en vivo con cámara
- [x] Fase 4: revisión y exportación a Excel
- [x] Fase 5: PWA sin internet, lista de alumnos, importar/exportar claves
- [x] Fase 6: licencia con Gumroad
- [x] Fase 7: licencia con el servidor central de trucosdeaula.com (clave suelta o Pase Maestro)
- [ ] Pendiente: decidir qué queda gratis sin clave. Por ahora todo es gratis
  (`VITE_LICENCIA_OBLIGATORIA=false`); al decidirlo, activar el bloqueo correspondiente.

## Licencia

- **Servidor:** `https://trucosdeaula.com/api/licencia.php` (repositorio TrucosDeAula). Acepta
  la clave de CalificaYa o la del Pase Maestro; solo responde a trucosdeaula.com y sus
  subdominios, así que la app tiene que publicarse en `calificaya.trucosdeaula.com`.
- **Por ahora es opcional:** con `VITE_LICENCIA_OBLIGATORIA=false` nada se bloquea; la clave se
  activa en Ajustes. Con `true`, sin licencia activa se muestra la pantalla de activación.
- **Activar:** se genera un identificador aleatorio de dispositivo (se guarda en el navegador) y
  se manda con la clave. Si es válida se guardan la clave y la fecha de verificación.
- **Al abrir:** si pasaron más de 24 h se verifica en segundo plano. Sin internet (o con Gumroad
  caído) se puede usar hasta 7 días desde la última verificación válida; después se pide conexión.
  Un pase cancelado sirve hasta su `vigenteHasta`.
- **Rechazos:** clave inválida, reembolso, contracargo, disputa, pago fallido o pase vencido
  quitan la licencia de este dispositivo con un mensaje claro (y link para renovar el pase).
- **Límite:** 3 dispositivos por clave. “Desactivar en este dispositivo” (Ajustes) libera el lugar
  en el servidor; necesita internet.
- **Desarrollo:** con `npm run dev` en `localhost` la licencia se omite; desde otra
  dirección (p. ej. el celular con `dev:celular`) se acepta `PRUEBA-0000-0000-0000`.
  La versión publicada no acepta ese código.

## Hojas de respuesta y licencia

Las hojas reproducen la distribución de las hojas de ZipGrade, publicadas bajo
licencia Creative Commons Atribución-CompartirIgual 3.0. Por eso cada hoja
generada incluye una línea de crédito y se distribuye bajo la misma licencia.
La app lee tanto las hojas CalificaYa como las originales de ZipGrade.
