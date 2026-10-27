import { test, expect } from './support/fixtures.js';
import { dataRules } from './support/data/data-rules.js';
import { TestDataFactory } from './support/data/test-data-factory.js';

const { document: documentRules, marker } = dataRules;
const documentContract = new RegExp(`^\\d{${documentRules.minDigits},${documentRules.maxDigits}}$`);

// El generador también es código: estas pruebas protegen sus garantías ante cambios en las reglas.
test.describe('Generador de datos sintéticos', { tag: '@data' }, () => {
  test('genera clientes válidos según las reglas centralizadas', async ({ dataFactory }) => {
    const client = dataFactory.validClient();

    expect(client.name.startsWith(`${marker.namePrefix} `)).toBe(true);
    expect(client.document).toMatch(documentContract);
    expect(client.email).toBe(`qa.${client.document}@${marker.emailDomain}`);
    expect(client.balance).toBeGreaterThanOrEqual(dataRules.balance.valid.min);
    expect(client.balance).toBeLessThanOrEqual(dataRules.balance.valid.max);
  });

  test('no repite documentos', async ({ dataFactory }) => {
    const documents = Array.from({ length: 200 }, () => dataFactory.validClient().document);

    expect(new Set(documents).size).toBe(documents.length);
  });

  test('un cliente válido cubre cualquier operación válida y uno sin saldo no', async ({ dataFactory }) => {
    const { amount, serviceChargeRate } = dataRules.operation;
    expect(dataRules.balance.valid.min).toBeGreaterThanOrEqual(amount.max * (1 + serviceChargeRate));

    const insufficient = dataFactory.clientWithInsufficientBalance();
    expect(insufficient.amount).toBeGreaterThan(insufficient.client.balance);
  });

  test('la misma semilla reproduce los mismos datos', () => {
    const options = { seed: 2026, runId: 1, workerIndex: 0 };

    const first = new TestDataFactory(options).validClient();
    const second = new TestDataFactory(options).validClient();

    expect(second.name).toBe(first.name);
    expect(second.balance).toBe(first.balance);
  });
});
