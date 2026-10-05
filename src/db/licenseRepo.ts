import { db, type EstadoLicencia } from './db';
import type { RepoLicencia } from '../license/licenseService';

export const repoLicencia: RepoLicencia = {
  leer: () => db.licencia.get('actual'),
  guardar: async (l: EstadoLicencia) => { await db.licencia.put({ ...l, id: 'actual' }); },
  borrar: () => db.licencia.delete('actual'),
};
