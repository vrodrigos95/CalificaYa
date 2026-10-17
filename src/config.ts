// Único punto de la app que lee variables de entorno (import.meta.env).
// Para cambiar cualquier valor, edita .env (ver .env.example).

const env = import.meta.env ?? {};

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const APP_NAME = 'CalificaYa';

/** Código que activa la app sin Gumroad, SOLO en modo desarrollo (npm run dev). */
export const LICENCIA_DE_PRUEBA = 'PRUEBA-0000-0000-0000';

export const config = {
  appName: APP_NAME,
  licencia: {
    /** Endpoint central de licencias de trucosdeaula.com (acepta la clave de CalificaYa o la del Pase Maestro). */
    url: env.VITE_LICENCIA_URL || 'https://trucosdeaula.com/api/licencia.php',
    /** Comprar CalificaYa suelta. */
    compraUrl: env.VITE_COMPRA_URL || 'PLACEHOLDER_URL_CALIFICAYA',
    /** Comprar o renovar el Pase Maestro. */
    paseUrl: env.VITE_PASE_URL || 'PLACEHOLDER_URL_PASE',
    /**
     * false (por ahora): CalificaYa es gratis y la licencia es opcional (se activa en Ajustes).
     * true: sin licencia activa se muestra la pantalla de activación.
     */
    obligatoria: env.VITE_LICENCIA_OBLIGATORIA === 'true',
  },
  supportEmail: env.VITE_SUPPORT_EMAIL || 'soporte@ejemplo.com',
  /** Solo para los mensajes: el límite real lo decide el servidor. */
  maxDispositivos: num(env.VITE_MAX_DISPOSITIVOS, 3),
  /** Al abrir la app se vuelve a verificar si pasaron más de estas horas. */
  horasRevalidacion: num(env.VITE_HORAS_REVALIDACION, 24),
  /** Sin internet se puede usar hasta estos días desde la última verificación válida. */
  diasSinConexion: num(env.VITE_DIAS_SIN_CONEXION, 7),
  /**
   * Código personal que activa la app sin Gumroad (opcional, se define al
   * compilar). Útil para usarla tú mismo antes de configurar Gumroad.
   * Ojo: queda dentro del código publicado; no lo compartas.
   */
  codigoMaestro: env.VITE_CODIGO_MAESTRO?.trim() || undefined,
  /** true en `npm run dev`; nunca en la versión publicada. */
  desarrollo: !!env.DEV,
} as const;
