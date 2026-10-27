import { test, expect } from './support/fixtures.js';

test('crea un cliente desde la interfaz', async ({ page, dataFactory }) => {
  const client = dataFactory.validClient();

  await page.goto('/');
  await page.locator('#client-name').fill(client.name);
  await page.locator('#client-document').fill(client.document);
  await page.locator('#client-email').fill(client.email);
  await page.locator('#client-balance').fill(String(client.balance));
  await page.getByRole('button', { name: 'Crear cliente' }).click();
  await expect(page.locator('#client-result')).toContainText('Cliente creado');
});
