import { test } from '@playwright/test';

// Evidencias de negocio que quedan en el reporte HTML aunque la prueba pase.
// Video, traza y captura de fallo las agrega Playwright solo cuando algo falla (ver playwright.config.js).
export async function attachScreenshot(page, name) {
  await test.info().attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

export async function attachJson(name, data) {
  await test.info().attach(name, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
}
