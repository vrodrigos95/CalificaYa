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
npm test           # pruebas automáticas (genera PDFs de muestra en test-output/)
npm run build      # compilación para producción en dist/
npm run preview    # sirve dist/ en http://localhost:4173
npm run icons      # regenera los íconos provisionales de public/icons
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
| `src/db/` | IndexedDB (Dexie): solo claves y licencia |
| `src/screens/` | Pantallas de la app |
| `tests/` | Pruebas con Vitest |

## Estado

- [x] Fase 1: generador de hojas en PDF + gestión de claves
- [ ] Fase 2: motor OMR probado con imágenes sintéticas
- [ ] Fase 3: escaneo en vivo con cámara
- [ ] Fase 4: revisión y exportación a Excel
- [ ] Fase 5: PWA sin internet, lista de alumnos, importar/exportar claves
- [ ] Fase 6: licencia con Gumroad
