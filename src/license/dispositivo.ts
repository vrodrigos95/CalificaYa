// Identificador aleatorio de este dispositivo. Se crea la primera vez y se guarda en el navegador;
// el servidor lo usa para contar en cuántos dispositivos está activa una clave.
// No contiene nada del dispositivo ni del usuario.

const LLAVE = 'calificaya.dispositivo';

function aleatorio(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function idDispositivo(almacen: Pick<Storage, 'getItem' | 'setItem'> = localStorage): string {
  const guardado = almacen.getItem(LLAVE);
  if (guardado && /^[A-Za-z0-9-]{8,64}$/.test(guardado)) return guardado;
  const nuevo = aleatorio();
  almacen.setItem(LLAVE, nuevo);
  return nuevo;
}
