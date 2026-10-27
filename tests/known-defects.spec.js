import { test, expect } from './support/fixtures.js';
import { expectedBalanceAfter, toCents } from './support/business-rules.js';
import { htmlInjectionName } from './support/data/invalid-cases.js';

// Cada prueba describe el comportamiento CORRECTO y se marca con test.fail() mientras el defecto exista.
// Cuando desarrollo lo corrija, la prueba pasará, Playwright la reportará como fallo inesperado
// y obligará a retirar la marca: el defecto no se olvida ni se oculta. IDs en DIAGNOSTICO.md.
test.describe('Defectos conocidos', { tag: '@known-defect' }, () => {
  test('F1: el resumen muestra el estado real de la última operación', async ({ labPage, dataFactory }) => {
    test.fail(true, 'F1: app.js muestra siempre PENDING');
    await labPage.open();
    await labPage.createClient(dataFactory.validClient());
    const operation = await labPage.executeOperation(dataFactory.operationAmount());

    // El saldo visible indica que el resumen ya cargó; desde ahí el estado es definitivo.
    await expect(labPage.summary.balance).toBeVisible();
    expect(await labPage.summary.lastOperationStatus.textContent()).toBe(operation.status);
  });

  test('F2: rechaza una operación que con el cargo de servicio supera el saldo', async ({ api, dataFactory }) => {
    test.fail(true, 'F2: valida saldo < monto, pero debita monto + cargo y el saldo queda negativo');
    const created = await api.givenClient(dataFactory.validClient());

    const response = await api.executeOperation(created.id, created.balance);

    expect(response.status()).toBe(422);
  });

  test('F3: dos operaciones simultáneas no pueden sobregirar la cuenta', async ({ api, dataFactory }) => {
    test.fail(true, 'F3: la validación y el débito no son atómicos (await al servicio de riesgo en medio)');
    const created = await api.givenClient(dataFactory.validClient());
    // Cada operación cabe sola (66 % del saldo con el cargo), pero dos juntas no (132 %).
    const amount = Math.floor(created.balance * 0.6);

    await Promise.all([api.executeOperation(created.id, amount), api.executeOperation(created.id, amount)]);

    const summary = await api.getClientSummary(created.id);
    expect(summary.client.balance).toBeGreaterThanOrEqual(0);
  });

  test('F5: el nombre del cliente se muestra como texto y no se ejecuta como HTML', async ({ labPage, dataFactory }) => {
    test.fail(true, 'F5: el resumen usa innerHTML con datos del usuario (XSS almacenado)');
    await labPage.open();
    await labPage.createClient(dataFactory.validClient({ name: htmlInjectionName }));
    await labPage.refreshSummary();

    await expect(labPage.summary.balance).toBeVisible();
    expect(await labPage.summary.clientName.textContent()).toBe(htmlInjectionName);
  });

  test('F7: el saldo se calcula con precisión de centavos', async ({ api, dataFactory }) => {
    test.fail(true, 'F7: el dinero se maneja en coma flotante');
    // Valores mínimos que reproducen el error de redondeo (la UI no permite decimales; el API sí).
    const created = await api.givenClient(dataFactory.validClient({ balance: 1 }));
    const amount = 0.7;

    await api.executeOperation(created.id, amount);

    const summary = await api.getClientSummary(created.id);
    expect(summary.client.balance).toBe(toCents(expectedBalanceAfter(created.balance, amount)));
  });
});
