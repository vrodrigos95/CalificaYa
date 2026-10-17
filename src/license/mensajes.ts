import { config } from '../config';
import type { Motivo } from './licenseService';

export interface MensajeLicencia {
  texto: string;
  enlace?: { href: string; texto: string };
  /** Mostrar cómo liberar un dispositivo desde Ajustes. */
  comoLiberar?: boolean;
}

const renovar = { href: config.licencia.paseUrl, texto: 'Renovar el Pase Maestro' };

export const MENSAJES: Record<Motivo, MensajeLicencia> = {
  vacia: { texto: 'Escribe tu clave de licencia.' },
  clave_invalida: {
    texto: 'Esa clave no es válida para CalificaYa. Cópiala completa del correo de compra de Gumroad (incluye los guiones). Sirve la clave de CalificaYa o la del Pase Maestro.',
  },
  pase_vencido: { texto: 'Tu Pase Maestro ya venció. Renuévalo para seguir usando CalificaYa con esta clave.', enlace: renovar },
  pago_fallido: {
    texto: 'No se pudo cobrar la renovación de tu Pase Maestro. Actualiza tu forma de pago en Gumroad o renueva el pase.',
    enlace: renovar,
  },
  reembolsada: { texto: 'Esta compra fue reembolsada, así que la clave ya no es válida.' },
  contracargo: { texto: 'Esta compra tiene un contracargo, así que la clave ya no es válida.' },
  disputa: { texto: 'Esta compra está en disputa con el banco. Podrás activarla cuando se resuelva.' },
  limite_dispositivos: {
    texto: `Esta clave ya está activa en ${config.maxDispositivos} dispositivos.`,
    comoLiberar: true,
  },
  sin_conexion: { texto: 'Necesitas conexión a internet para verificar tu clave. Conéctate e inténtalo de nuevo.' },
  gumroad_no_disponible: { texto: 'No pudimos comprobar tu clave en este momento porque Gumroad no responde. Inténtalo en unos minutos.' },
  demasiados_intentos: { texto: 'Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.' },
  error_servidor: { texto: 'El servidor de licencias tuvo un problema. Inténtalo en unos minutos.' },
};

export const COMO_LIBERAR = `Para usarla aquí, abre CalificaYa en uno de esos dispositivos y entra a Ajustes → “Desactivar en este dispositivo”: eso libera su lugar. Si ya no tienes ese dispositivo, escribe a ${config.supportEmail}.`;
