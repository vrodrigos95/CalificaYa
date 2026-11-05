# CalificaYa — estado de la mudanza a Hostinger e identidad visual

Última actualización: 5 de noviembre de 2026

| Fase | Nombre | Estado |
|---|---|---|
| 1 | Backend de licencia en PHP y ajustes para Hostinger | hecha, PR abierto sin merge |
| 2 | Despliegue automático a Hostinger | pendiente |
| 3 | Cambio de sitio y limpieza (quitar Netlify) | pendiente |
| 4 | Identidad: ícono, logo y base de estilo rsrapps | pendiente |
| 5 | Estilo en el resto de las pantallas | pendiente |

> Orden nuevo: Rodrigo adelantó el despliegue (Fase 2) y la salida de Netlify (Fase 3). En PLAN.md siguen como Fases 4 y 5; falta renumerar PLAN.md.

## Qué quedó hecho
**Fase 1**
- `public/api/verificar-licencia.php`: mismo contrato que la función de Netlify (solo POST; solo `product_id`, `license_key`, `increment_uses_count` recortados a 200 caracteres; cURL con 10 s; respuesta y código de Gumroad tal cual; 502 `gumroad-no-disponible`). Además: 405 con `Allow: POST`, 429 `demasiados-intentos` después de 30 intentos por IP en 10 minutos.
- `public/.htaccess`: HTTPS obligatorio, brotli/gzip, `no-cache` para `sw.js`, `manifest.webmanifest`, `index.html` y `version.json`, `immutable` para `/assets/*`, sin listado de carpetas.
- `src/config.ts`: en producción la licencia se valida en `/api/verificar-licencia.php`; en desarrollo, directo a Gumroad. `VITE_LICENCIA_URL` sigue mandando.
- `.env.example` sin referencias a `/.netlify/functions/`.
- `tests/licenciaPhp.test.ts`: prueba de contrato del PHP (se omite si no hay `php`).
- Verificado: `php -l` sin errores (PHP 8.3), `npm test` (121 pruebas), `npm run typecheck` y `npm run build` en verde; `dist/` contiene `.htaccess` y `api/verificar-licencia.php`; con `php -S` un GET da 405, un POST da 502 (el entorno de pruebas no llega a Gumroad) y el intento 31 da 429.

## Decisiones tomadas
- Destino: calificaya.rsrapps.com (Hostinger, PHP).
- La verificación de licencia pasa de la función de Netlify a un PHP en el mismo dominio.
- El contador de intentos vive en `sys_get_temp_dir()/calificaya-limite/`, un archivo por IP con nombre en hash SHA-256 (la IP no se guarda en claro). Si no se puede escribir, no se bloquea a nadie.
- Se usa solo `REMOTE_ADDR` para la IP (no `X-Forwarded-For`, que se puede falsificar).
- `vite.config.ts` no se tocó: Vite ya copia los archivos ocultos de `public/`.
- `index.html` y `version.json` también llevan `no-cache`, igual que en `netlify.toml`.
- Estilo: el de rsrapps.com ("Fresco — lima y pasteles"), tomado de `src/estilos/tokens.css` del repo `vrodrigos95/rsrapps`.
- Despliegue con GitHub Actions por FTPS.

## Pendientes
- **Antes del merge de la Fase 1:** en Netlify, agregar `VITE_LICENCIA_URL=/.netlify/functions/verificar-licencia`; sin eso, la versión de Netlify buscaría el PHP, que allí no existe.
- Crear subdominio, SSL y cuenta FTP en hPanel.
- Crear el producto real en Gumroad y obtener su `product_id`.
- Probar el PHP con Gumroad real desde Hostinger (aquí no hubo acceso a Gumroad).
- Renumerar las fases en PLAN.md.

## Pasos manuales para Rodrigo
**Fase 1**
1. En Netlify: Site configuration → Environment variables → agregar `VITE_LICENCIA_URL` con el valor `/.netlify/functions/verificar-licencia`.
2. Revisar y hacer merge del PR de la Fase 1.
3. En GitHub Desktop: cambiar a `main` y hacer "Pull origin".

## Pull requests
- Fase 1: https://github.com/vrodrigos95/CalificaYa/pull/11
