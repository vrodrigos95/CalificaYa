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
  gumroad: {
    /** Valor de prueba hasta crear el producto en Gumroad. */
    productId: env.VITE_GUMROAD_PRODUCT_ID || 'PRODUCTO_DE_PRUEBA',
    purchaseUrl: env.VITE_GUMROAD_PURCHASE_URL || 'https://gumroad.com/l/calificaya',
    /**
     * Dirección para validar licencias. Vacío = directo a la API de Gumroad.
     * Si el navegador bloqueara la llamada directa (CORS), poner
     * /.netlify/functions/verificar-licencia (ver netlify/functions/).
     */
    verifyUrl: env.VITE_LICENCIA_URL || undefined,
  },
  supportEmail: env.VITE_SUPPORT_EMAIL || 'soporte@ejemplo.com',
  maxActivaciones: num(env.VITE_MAX_ACTIVACIONES, 3),
  diasRevalidacion: num(env.VITE_DIAS_REVALIDACION, 30),
  diasGracia: num(env.VITE_DIAS_GRACIA, 45),
  /** true en `npm run dev`; nunca en la versión publicada. */
  desarrollo: !!env.DEV,
} as const;
