import { defineConfig, devices } from '@playwright/test';
import { testDatabasePath } from './tests/support/test-environment.js';

const isCI = Boolean(process.env.CI);

// Con BASE_URL se prueba un ambiente ya desplegado; sin ella se levanta una instancia local aislada.
const externalBaseUrl = process.env.BASE_URL;
const localPort = Number(process.env.TEST_PORT || 3100);
const localBaseUrl = `http://127.0.0.1:${localPort}`;

export default defineConfig({
  testDir: './tests',
  timeout: 20_000,
  // Margen para el servicio de riesgo (hasta ~1 s) y la recarga del resumen (hasta 1,5 s) en CI.
  expect: { timeout: 10_000 },
  // Pruebas independientes: cualquier orden y cualquier reparto entre workers debe funcionar.
  fullyParallel: true,
  retries: 0,
  workers: 3,
  forbidOnly: isCI,
  globalSetup: './tests/support/global-setup.js',
  globalTeardown: './tests/support/global-teardown.js',
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['./tests/support/reporters/known-defects-reporter.js'],
    // En CI los fallos aparecen además como anotaciones sobre el código en el pull request.
    ...(isCI ? [['github']] : [])
  ],
  use: {
    baseURL: externalBaseUrl || localBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        // BD propia y reiniciada en cada ejecución: nunca comparte estado con la de desarrollo.
        command: 'node scripts/reset-db.js && node src/server.js',
        // Se espera por el frontend, no por /health: /health responde 200 aunque la UI dé 404 (F4).
        url: `${localBaseUrl}/`,
        reuseExistingServer: false,
        timeout: 15_000,
        env: {
          PORT: String(localPort),
          DATABASE_PATH: testDatabasePath,
          RISK_MODE: process.env.RISK_MODE || 'approved'
        }
      }
});
