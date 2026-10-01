// Único punto de la app que lee variables de entorno (import.meta.env).
// Para cambiar cualquier valor, edita .env (ver .env.example).

const env = import.meta.env ?? {};

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const APP_NAME = 'CalificaYa';

export const config = {
  appName: APP_NAME,
  gumroad: {
    productId: env.VITE_GUMROAD_PRODUCT_ID ?? '',
    purchaseUrl: env.VITE_GUMROAD_PURCHASE_URL ?? 'https://gumroad.com',
  },
  supportEmail: env.VITE_SUPPORT_EMAIL ?? 'soporte@ejemplo.com',
  maxActivaciones: num(env.VITE_MAX_ACTIVACIONES, 3),
  diasRevalidacion: num(env.VITE_DIAS_REVALIDACION, 30),
  diasGracia: num(env.VITE_DIAS_GRACIA, 45),
  idDigitosDefault: num(env.VITE_ID_DIGITOS_DEFAULT, 9),
} as const;
