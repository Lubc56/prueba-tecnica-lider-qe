import { test, expect } from '@playwright/test';

// Confirma que el arnés levantó la aplicación completa y no solo la API (ver F4 en DIAGNOSTICO.md).
test.describe('Smoke del arnés', { tag: '@smoke' }, () => {
  test('la API responde el health check', async ({ request }) => {
    const response = await request.get('/health');

    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });

  test('el frontend carga y reporta el servicio disponible', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Operaciones de clientes' })).toBeVisible();
    await expect(page.locator('#service-status')).toHaveText('Servicio disponible');
  });
});
