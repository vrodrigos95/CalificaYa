# CalificaYa — estado de la mudanza a Hostinger e identidad visual

Última actualización: 5 de noviembre de 2026

| Fase | Nombre | Estado |
|---|---|---|
| 1 | Backend de licencia en PHP y ajustes para Hostinger | hecha y fusionada (PR #11) |
| 2 | Despliegue automático a Hostinger | hecha, PR abierto sin merge |
| 3 | Cambio de sitio y limpieza (quitar Netlify) | pendiente |
| 4 | Identidad: ícono, logo y base de estilo rsrapps | pendiente |
| 5 | Estilo en el resto de las pantallas | pendiente |

> Orden nuevo: Rodrigo adelantó el despliegue (Fase 2) y la salida de Netlify (Fase 3). PLAN.md ya está renumerado.

## Qué quedó hecho
**Fase 1**
- `public/api/verificar-licencia.php`: mismo contrato que la función de Netlify (solo POST; solo `product_id`, `license_key`, `increment_uses_count` recortados a 200 caracteres; cURL con 10 s; respuesta y código de Gumroad tal cual; 502 `gumroad-no-disponible`). Además: 405 con `Allow: POST`, 429 `demasiados-intentos` después de 30 intentos por IP en 10 minutos.
- `public/.htaccess`: HTTPS obligatorio, brotli/gzip, `no-cache` para `sw.js`, `manifest.webmanifest`, `index.html` y `version.json`, `immutable` para `/assets/*`, sin listado de carpetas.
- `src/config.ts`: en producción la licencia se valida en `/api/verificar-licencia.php`; en desarrollo, directo a Gumroad. `VITE_LICENCIA_URL` sigue mandando.
- `.env.example` sin referencias a `/.netlify/functions/`.
- `tests/licenciaPhp.test.ts`: prueba de contrato del PHP (se omite si no hay `php`).
- Verificado: `php -l` sin errores (PHP 8.3), `npm test` (121 pruebas), `npm run typecheck` y `npm run build` en verde; `dist/` contiene `.htaccess` y `api/verificar-licencia.php`; con `php -S` un GET da 405, un POST da 502 (el entorno de pruebas no llega a Gumroad) y el intento 31 da 429.

**Fase 2**
- `.github/workflows/deploy-hostinger.yml`: en push a `main` y a mano (*Actions → Publicar en Hostinger → Run workflow*). `npm ci` → `npm test` → `npm run typecheck` → `npm run build` (con `COMMIT_REF=github.sha`, `VITE_*` desde Variables y `VITE_CODIGO_MAESTRO` desde Secrets) → comprueba que `dist/` traiga `.htaccess`, el PHP e `index.html` → sube por FTPS → verifica con curl 200 en `https://calificaya.rsrapps.com/` y 405 en `GET /api/verificar-licencia.php` (si no, el job falla).
- `README.md`: sección "Publicar (Hostinger)" (tabla de secretos y variables, orden, lanzar a mano, qué no toca en el servidor). Nota de CORS actualizada al PHP.
- `.env.example`: explica GitHub Variables/Secrets en lugar de Netlify.
- `PLAN.md`: fases renumeradas; las capturas con estilo nuevo pasan al final de la Fase 5.
- Verificado: actionlint 1.7.7 sin errores (shellcheck no estaba instalado); `npm test` (121), `npm run typecheck` y `npm run build` en verde; el script de verificación probado contra `dist/` con `php -S` (pasa con 200/405, falla con 404). La publicación real no se pudo probar aquí.

## Decisiones tomadas
- Destino: calificaya.rsrapps.com (Hostinger, PHP).
- La verificación de licencia pasa de la función de Netlify a un PHP en el mismo dominio.
- El contador de intentos vive en `sys_get_temp_dir()/calificaya-limite/`, un archivo por IP con nombre en hash SHA-256 (la IP no se guarda en claro). Si no se puede escribir, no se bloquea a nadie.
- Se usa solo `REMOTE_ADDR` para la IP (no `X-Forwarded-For`, que se puede falsificar).
- `vite.config.ts` no se tocó: Vite ya copia los archivos ocultos de `public/`.
- `index.html` y `version.json` también llevan `no-cache`, igual que en `netlify.toml`.
- Estilo: el de rsrapps.com ("Fresco — lima y pasteles"), tomado de `src/estilos/tokens.css` del repo `vrodrigos95/rsrapps`.
- Despliegue con GitHub Actions por FTPS.
- `SamKirkland/FTP-Deploy-Action` v4.4.0 (corre en Node 24), `actions/checkout` v6.1.0 y `actions/setup-node` v6.5.0, todas fijadas por SHA de commit.
- Subida incremental: la acción guarda lo subido en `.ftp-deploy-sync-state.json` (en el servidor) y solo borra lo que ella subió. `dangerous-clean-slate: false` y exclusiones para `.user.ini`, `php.ini`, `.well-known/`, `cgi-bin/` y `error_log`.
- `concurrency` sin cancelar: si llegan dos merges seguidos, el segundo espera; nunca se corta una subida a medias.
- El secreto del código maestro se llama `VITE_CODIGO_MAESTRO` (en `pages.yml` sigue siendo `CODIGO_MAESTRO`; no se tocó).
- Los `VITE_*` numéricos que no se definan llegan vacíos y `src/config.ts` usa su valor por defecto (3, 30, 45).
- Se recomienda que la cuenta FTP tenga como raíz la carpeta del subdominio (`FTP_SERVER_DIR=./`), para que no pueda tocar el resto de `rsrapps.com`.

## Pendientes
- Confirmar que en Netlify esté `VITE_LICENCIA_URL=/.netlify/functions/verificar-licencia` (lo pedía la Fase 1); si no, la licencia falla en calificaya.netlify.app hasta la Fase 3.
- Crear subdominio, SSL y cuenta FTP en hPanel.
- Crear el producto real en Gumroad y obtener su `product_id`.
- Probar el PHP con Gumroad real desde Hostinger (aquí no hubo acceso a Gumroad).
- Primera publicación real en Hostinger y comprobación del 405 (paso manual de Rodrigo tras el merge).
- Fase 3: quitar `netlify.toml` y `netlify/`, aviso de mudanza en Netlify, repo privado.

## Pasos manuales para Rodrigo
**Fase 1**
1. En Netlify: Site configuration → Environment variables → agregar `VITE_LICENCIA_URL` con el valor `/.netlify/functions/verificar-licencia`.
2. Revisar y hacer merge del PR de la Fase 1.
3. En GitHub Desktop: cambiar a `main` y hacer "Pull origin".

**Fase 2** (en este orden)
1. hPanel: crear el subdominio `calificaya.rsrapps.com` y activar su SSL.
2. hPanel: crear una cuenta FTP con la carpeta del subdominio como raíz.
3. GitHub → Settings → Secrets and variables → Actions: Secrets `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_SERVER_DIR` (`./`) y opcional `VITE_CODIGO_MAESTRO`; Variables `VITE_GUMROAD_PRODUCT_ID`, `VITE_GUMROAD_PURCHASE_URL`, `VITE_SUPPORT_EMAIL`.
4. Merge del PR de la Fase 2 y revisar la pestaña Actions (debe quedar en verde).
5. Abrir https://calificaya.rsrapps.com y comprobar el 405 de `/api/verificar-licencia.php`.
6. GitHub Desktop: `main` → "Pull origin".

## Pull requests
- Fase 1: https://github.com/vrodrigos95/CalificaYa/pull/11
- Fase 2: https://github.com/vrodrigos95/CalificaYa/pull/12
