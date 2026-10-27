import crypto from 'node:crypto';

// Fija la semilla y el identificador de la ejecución; los workers los heredan por variables de entorno.
// Para reproducir los datos de una ejecución: DATA_SEED=<valor impreso> npm run test:e2e
export default function globalSetup() {
  process.env.DATA_SEED ||= String(crypto.randomInt(1, 2 ** 31 - 1));
  process.env.TEST_RUN_ID ||= String(crypto.randomInt(0, 1000));
  console.log(`[datos] DATA_SEED=${process.env.DATA_SEED} TEST_RUN_ID=${process.env.TEST_RUN_ID}`);
}
