import { expect } from '@playwright/test';

// Endpoints del API para crear precondiciones y confirmar resultados sin pasar por la UI.
export class QualityLabApi {
  #request;

  constructor(request) {
    this.#request = request;
  }

  createClient(client) {
    return this.#request.post('/api/clients', { data: client });
  }

  // Precondición: si el API rechaza el cliente, la prueba falla aquí con la causa y no más adelante.
  async givenClient(client) {
    const response = await this.createClient(client);
    expect(response.status(), `crear cliente de precondición: ${await response.text()}`).toBe(201);
    return response.json();
  }

  executeOperation(clientId, amount) {
    return this.#request.post('/api/operations', { data: { clientId, amount } });
  }

  async getClientSummary(clientId) {
    const response = await this.#request.get(`/api/clients/${clientId}/summary`);
    expect(response.status()).toBe(200);
    return response.json();
  }
}
