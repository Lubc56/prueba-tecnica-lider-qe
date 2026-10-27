# Registro de decisiones

## Orden de trabajo

`Reto 0` (estado original) → `Reto 1` (diagnóstico) → **base del arnés** → `Reto 3` → `Reto 2` → `Reto 4` → `Reto 5` → `Reto 6`. Cada paso es un commit.

El generador de datos (Reto 3) va antes del flujo E2E (Reto 2) porque el Reto 2 necesita datos únicos. Hacerlo al revés obligaba a escribir el flujo con datos provisionales y reescribirlo después.

## Decisiones técnicas

### Alcance sobre el producto

- Solo se corrige **F4** (estáticos con `URL.pathname` → `fileURLToPath`): bloqueaba la ejecución local en cualquier ruta con espacios, como la carpeta en que llegó la prueba.
- Los demás defectos (F1–F3, F5–F7) **se reportan y no se corrigen**: la aplicación es el sistema bajo prueba y arreglarla ocultaría lo que la suite debe detectar.

### Base del arnés (`playwright.config.js`)

- **Instancia aislada:** cada ejecución levanta su propio servidor en el puerto `3100` (configurable con `TEST_PORT`), con una BD propia en `artifacts/e2e-db.json` que se reinicia al arrancar. Nunca toca la BD de desarrollo ni el puerto `3000`.
- **`reuseExistingServer: false`:** evita probar contra un servidor ya abierto con otra BD u otro `RISK_MODE`.
- **Espera por `/` y no por `/health`:** `/health` respondía 200 aunque el frontend diera 404 (F4).
- **`RISK_MODE=approved` por defecto:** el modo `random` rechaza el 15 % y vuelve no determinista el camino feliz. Se puede sobrescribir con la variable de entorno.
- **`BASE_URL` opcional:** si se define, se prueba ese ambiente desplegado y no se levanta servidor local.
- **Evidencias solo en fallo:** `trace` y `video` en `retain-on-failure`, `screenshot` en `only-on-failure`.
- **`forbidOnly` en CI:** un `test.only` olvidado no puede reducir la suite en el pipeline.
- **Sin reintentos:** una prueba inestable se corrige, no se oculta reintentándola.
- **Prueba smoke (`@smoke`):** verifica que la API y el frontend responden. Es la red mínima contra regresiones del arnés como F4.
- **`package-lock.json` versionado:** fija las versiones exactas para que local y CI instalen lo mismo.

## Actividades no completadas

_Se completa al cierre._

## Riesgos pendientes

- El camino `REJECTED` del servicio de riesgo no queda cubierto con `RISK_MODE=approved`. Cubrirlo requiere una segunda instancia u otro proyecto de Playwright con `RISK_MODE=rejected`.

## Herramientas utilizadas

_Se completa al cierre._

## Uso de asistentes de inteligencia artificial

_Se completa al cierre._

## Hora declarada de inicio y finalización

_La declara el candidato._
