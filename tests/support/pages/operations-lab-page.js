import { expect } from '@playwright/test';

// Page Object de la aplicación: crear cliente, ejecutar operación y consultar el resumen.
// Los campos se ubican por su etiqueta visible, como los encuentra un usuario.
export class OperationsLabPage {
  constructor(page) {
    this.page = page;
    this.serviceStatus = page.locator('#service-status');

    this.clientForm = {
      name: page.getByLabel('Nombre', { exact: true }),
      document: page.getByLabel('Documento', { exact: true }),
      email: page.getByLabel('Correo', { exact: true }),
      balance: page.getByLabel('Saldo inicial', { exact: true }),
      submit: page.getByRole('button', { name: 'Crear cliente' })
    };
    this.clientResult = page.locator('#client-result');

    this.operationForm = {
      clientId: page.getByLabel('ID del cliente', { exact: true }),
      amount: page.getByLabel('Valor de la operación', { exact: true }),
      submit: page.getByRole('button', { name: 'Realizar operación' })
    };
    this.operationResult = page.locator('#operation-result');

    const summaryCards = page.locator('#summary article');
    this.summary = {
      clientName: summaryCards.filter({ has: page.getByText('Cliente', { exact: true }) }).locator('strong'),
      balance: page.locator('#summary-balance'),
      lastOperationStatus: page.locator('#summary-status'),
      refresh: page.getByRole('button', { name: 'Actualizar' })
    };
  }

  async open() {
    await this.page.goto('/');
    await expect(this.serviceStatus).toHaveText('Servicio disponible');
  }

  // Devuelve la respuesta del API para validar la UI contra el dato real y no contra una suposición.
  async createClient(client) {
    await this.clientForm.name.fill(client.name);
    await this.clientForm.document.fill(client.document);
    await this.clientForm.email.fill(client.email);
    await this.clientForm.balance.fill(String(client.balance));
    return this.#submitAndReadResponse(this.clientForm.submit, 'POST', path => path === '/api/clients');
  }

  // Sin clientId usa el que la UI precarga al crear el cliente.
  async executeOperation(amount, clientId) {
    if (clientId !== undefined) await this.operationForm.clientId.fill(String(clientId));
    await this.operationForm.amount.fill(String(amount));
    return this.#submitAndReadResponse(this.operationForm.submit, 'POST', path => path === '/api/operations');
  }

  async refreshSummary() {
    return this.#submitAndReadResponse(this.summary.refresh, 'GET', path => path.endsWith('/summary'));
  }

  // Espera la respuesta real del API en lugar de un tiempo fijo.
  async #submitAndReadResponse(trigger, method, matchesPath) {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        candidate => candidate.request().method() === method && matchesPath(new URL(candidate.url()).pathname)
      ),
      trigger.click()
    ]);
    return response.json();
  }
}
