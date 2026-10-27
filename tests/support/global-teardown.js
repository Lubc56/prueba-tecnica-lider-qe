import fs from 'node:fs';
import { dataRules } from './data/data-rules.js';
import { testDatabasePath } from './test-environment.js';

// Limpieza posterior a la ejecución. KEEP_TEST_DATA=true conserva la BD para depurar un fallo.
export default function globalTeardown() {
  if (process.env.BASE_URL) {
    console.warn(
      `[datos] Ambiente externo sin endpoint de borrado: purgar por marcador (correos @${dataRules.marker.emailDomain}).`
    );
    return;
  }
  if (process.env.KEEP_TEST_DATA === 'true') {
    console.log(`[datos] BD de prueba conservada en ${testDatabasePath}`);
    return;
  }
  fs.rmSync(testDatabasePath, { force: true });
  console.log('[datos] BD de prueba eliminada');
}
