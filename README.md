# CalificaYa

PWA para calificar exámenes de opción múltiple con la cámara del celular
(hojas de burbujas) y exportar los resultados a Excel. Todo se procesa en el
dispositivo; solo se guardan las claves de examen y el estado de la licencia.

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
npx tsx scripts/omr-try.ts 50 1   # lee una hoja sintética y guarda test-output/foto.png y hoja.png
```

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
| `src/session/` | Sesión de calificación (solo en memoria) |
| `src/components/Scanner.tsx` | Cámara en vivo con captura automática |
| `src/screens/` | Pantallas de la app |
| `tests/` | Pruebas con Vitest; `tests/synthetic/` genera fotos sintéticas |
| `scripts/extract-form-geometry.py` | Extrae la geometría de las hojas de 50/100 desde los PDF originales |

## Estado

- [x] Fase 1: generador de hojas en PDF + gestión de claves
- [x] Fase 2: motor OMR probado con imágenes sintéticas
- [x] Fase 3: escaneo en vivo con cámara
- [x] Fase 4: revisión y exportación a Excel
- [ ] Fase 5: PWA sin internet, lista de alumnos, importar/exportar claves
- [ ] Fase 6: licencia con Gumroad

## Hojas de respuesta y licencia

Las hojas reproducen la distribución de las hojas de ZipGrade, publicadas bajo
licencia Creative Commons Atribución-CompartirIgual 3.0. Por eso cada hoja
generada incluye una línea de crédito y se distribuye bajo la misma licencia.
La app lee tanto las hojas CalificaYa como las originales de ZipGrade.
