import { test, expect } from './support/fixtures.js';
import { invalidAmountCases, invalidClientCases } from './support/data/invalid-cases.js';

test.describe('Validaciones del API con datos inválidos', { tag: '@negative' }, () => {
  for (const invalidCase of invalidClientCases) {
    test(`rechaza crear un cliente ${invalidCase.description}`, async ({ api, dataFactory }) => {
      test.fail(Boolean(invalidCase.knownDefect), `Defecto conocido ${invalidCase.knownDefect}: el API no valida este dato`);

      const response = await api.createClient(dataFactory.invalidClient(invalidCase));

      expect(response.status()).toBe(invalidCase.expected.status);
      expect(await response.json()).toMatchObject(invalidCase.expected.body ?? {});
    });
  }

  test('rechaza un documento ya registrado', async ({ api, dataFactory }) => {
    const existing = await api.givenClient(dataFactory.validClient());

    const response = await api.createClient(dataFactory.validClient({ document: existing.document }));

    expect(response.status()).toBe(409);
    expect(await response.json()).toEqual({ error: 'document already exists' });
  });

  test('rechaza una operación sin saldo suficiente y no altera la cuenta', async ({ api, dataFactory }) => {
    const { client, amount } = dataFactory.clientWithInsufficientBalance();
    const created = await api.givenClient(client);

    const response = await api.executeOperation(created.id, amount);

    expect(response.status()).toBe(422);
    expect(await response.json()).toEqual({ error: 'insufficient balance' });
    const summary = await api.getClientSummary(created.id);
    expect(summary.client.balance).toBe(client.balance);
    expect(summary.operationCount).toBe(0);
  });

  for (const invalidCase of invalidAmountCases) {
    test(`rechaza una operación con monto ${invalidCase.description}`, async ({ api, dataFactory }) => {
      const created = await api.givenClient(dataFactory.validClient());

      const response = await api.executeOperation(created.id, dataFactory.invalidAmount(invalidCase));

      expect(response.status()).toBe(invalidCase.expected.status);
      expect(await response.json()).toEqual(invalidCase.expected.body);
      const summary = await api.getClientSummary(created.id);
      expect(summary.client.balance).toBe(created.balance);
    });
  }
});
