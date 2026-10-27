import { test, expect } from './support/fixtures.js';
import { expectedBalanceAfter, formatCurrency } from './support/business-rules.js';
import { attachJson, attachScreenshot } from './support/evidence.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test.describe('Flujo de operación de un cliente', { tag: '@e2e' }, () => {
  test('crea un cliente, opera, valida el resultado en la UI y lo confirma por API', async ({ labPage, api, dataFactory }) => {
    const client = dataFactory.validClient();
    const amount = dataFactory.operationAmount();
    const expectedBalance = expectedBalanceAfter(client.balance, amount);

    const createdClient = await test.step('1. Crear el cliente desde la UI', async () => {
      await labPage.open();
      const created = await labPage.createClient(client);

      await expect(labPage.clientResult).toHaveText(`Cliente creado con ID ${created.id}`);
      await expect(labPage.operationForm.clientId).toHaveValue(String(created.id));
      await attachScreenshot(labPage.page, '1-cliente-creado');
      return created;
    });

    const operation = await test.step('2. Ejecutar la operación', async () => {
      const executed = await labPage.executeOperation(amount);

      await expect(labPage.operationResult).toHaveText(`Operación ${executed.id}: APPROVED`);
      await attachScreenshot(labPage.page, '2-operacion-aprobada');
      return executed;
    });

    await test.step('3. Validar el resumen en la UI', async () => {
      await expect(labPage.summary.clientName).toHaveText(client.name);
      await expect(labPage.summary.balance).toHaveText(formatCurrency(expectedBalance));
      await attachScreenshot(labPage.page, '3-resumen-actualizado');
    });

    await test.step('4. Confirmar el registro por API', async () => {
      const persisted = await api.getOperation(operation.id);
      expect(persisted).toMatchObject({ id: operation.id, client_id: createdClient.id, amount, status: 'APPROVED' });
      expect(persisted.external_reference).toMatch(UUID);

      const summary = await api.getClientSummary(createdClient.id);
      expect(summary.operationCount).toBe(1);
      expect(summary.operations[0].id).toBe(operation.id);
      expect(summary.client.balance).toBeCloseTo(expectedBalance, 2);
      await attachJson('4-confirmacion-api', { operation: persisted, summary });
    });
  });

  test('rechaza en la UI una operación sin saldo suficiente y no altera la cuenta', async ({ labPage, api, dataFactory }) => {
    const { client, amount } = dataFactory.clientWithInsufficientBalance();
    // La precondición se crea por API: es más rápida y no es lo que esta prueba valida.
    const created = await api.givenClient(client);

    await test.step('Intentar la operación desde la UI', async () => {
      await labPage.open();
      await labPage.executeOperation(amount, created.id);

      await expect(labPage.operationResult).toHaveText('insufficient balance');
      await expect(labPage.operationResult).toHaveClass(/error/);
      await attachScreenshot(labPage.page, 'operacion-rechazada');
    });

    await test.step('Confirmar por API que no hubo débito ni registro', async () => {
      const summary = await api.getClientSummary(created.id);
      expect(summary.client.balance).toBe(client.balance);
      expect(summary.operationCount).toBe(0);
      await attachJson('confirmacion-api', summary);
    });
  });
});
