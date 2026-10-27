import { test as base, expect } from '@playwright/test';
import { QualityLabApi } from './api/quality-lab-api.js';
import { TestDataFactory, seedFrom } from './data/test-data-factory.js';

export const test = base.extend({
  // Misma DATA_SEED + mismo nombre de prueba → mismos datos, sin importar el worker ni el orden.
  dataFactory: async ({}, use, testInfo) => {
    const globalSeed = process.env.DATA_SEED || '0';
    testInfo.annotations.push({ type: 'DATA_SEED', description: globalSeed });
    await use(
      new TestDataFactory({
        seed: seedFrom(`${globalSeed}|${testInfo.titlePath.join('|')}`),
        runId: Number(process.env.TEST_RUN_ID || 0),
        workerIndex: testInfo.workerIndex
      })
    );
  },

  api: async ({ request }, use) => {
    await use(new QualityLabApi(request));
  }
});

export { expect };
