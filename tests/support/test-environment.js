import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// BD exclusiva de las pruebas: nunca la de desarrollo (src/data/quality-lab.json).
export const testDatabasePath = path.join(rootDir, 'artifacts', 'e2e-db.json');
