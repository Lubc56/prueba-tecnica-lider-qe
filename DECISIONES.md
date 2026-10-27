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

### Reto 3: datos sintéticos

**Estrategia**

| Pieza | Archivo | Responsabilidad |
|---|---|---|
| Reglas | `tests/support/data/data-rules.js` | Única fuente de verdad: formatos, rangos, marcas y tasa de cargo. Se modifica sin tocar pruebas. |
| Fábrica | `tests/support/data/test-data-factory.js` | `validClient()`, `clientWithInsufficientBalance()`, `operationAmount()`, `invalidClient()`, `invalidAmount()`. |
| Catálogo negativo | `tests/support/data/invalid-cases.js` | Cada caso parte de un cliente válido y rompe una sola regla. Los límites se derivan del contrato (mín − 1, máx + 1). |
| Inyección | `tests/support/fixtures.js` | Las pruebas reciben `dataFactory` y `api` como fixtures; nunca construyen datos a mano. |
| Limpieza | `tests/support/global-teardown.js` | Borra la BD de la ejecución al terminar. |

- **Documentos únicos por construcción:** `prefijo (7) + ejecución (3) + worker (3) + secuencia (3)` = 10 dígitos. Dos pruebas en paralelo nunca generan el mismo documento, sin depender del azar. El correo se deriva del documento, así que también es único.
- **Reproducibilidad:** cada prueba usa una semilla derivada de `DATA_SEED` + su nombre. La semilla se imprime al inicio y queda anotada en el reporte. `DATA_SEED=<valor> npm run test:e2e` repite los mismos nombres, saldos y montos.
- **Datos identificables y sin información personal:** nombres con prefijo `QA`, correos en `example.test` (dominio reservado, RFC 2606) y documentos que empiezan por `7`.
- **Saldo insuficiente robusto ante F2:** el monto supera el saldo por sí solo, sin contar el cargo, para que el `422` no dependa del defecto.
- **Defectos conocidos en el catálogo:** los casos que el API acepta indebidamente (F6) se marcan con `knownDefect` y se ejecutan con `test.fail()`. Si el equipo de desarrollo corrige F6, esas pruebas se ponen en rojo y obligan a quitar la marca.
- **Invariantes protegidas:** `tests/data-factory.spec.js` valida el generador mismo, por ejemplo que un saldo válido siempre cubra el monto máximo más el cargo. Si alguien edita las reglas de forma inconsistente, la suite lo detecta.
- **Montos enteros y sin librerías externas (faker):** se evita una dependencia y la coma flotante (F7) no contamina las aserciones.

**Limitaciones**

- **Sin limpieza en ambientes compartidos:** el API no tiene endpoint de borrado y no se agregan funcionalidades. Con `BASE_URL` la limpieza no es automática; se purga por marcador (correos `@example.test`).
- **Colisión entre ejecuciones en un ambiente compartido:** el identificador de ejecución tiene 3 dígitos, así que dos ejecuciones tienen 1 en 1000 de compartirlo y podrían recibir `409`. En local no aplica, porque la BD se reinicia en cada ejecución.
- **Capacidad por ejecución:** hasta 999 workers y 999 clientes por worker. Si se supera, la fábrica falla con un mensaje explícito en vez de repetir documentos.
- **Reproducibilidad parcial:** se reproducen nombres, saldos y montos. El documento depende del orden de ejecución dentro del worker.
- **Variedad limitada:** el catálogo cubre las reglas de negocio, no fuzzing (nombres largos, unicode extremo, inyección).
- **Limpieza siempre al terminar:** la BD se borra incluso si hubo fallos; `KEEP_TEST_DATA=true` la conserva para depurar.

### Reto 2: automatización funcional

| Pieza | Archivo | Responsabilidad |
|---|---|---|
| Page Object | `tests/support/pages/operations-lab-page.js` | Ubica los campos por su etiqueta visible y espera la respuesta real del API en cada acción. |
| Reglas de negocio | `tests/support/business-rules.js` | Saldo esperado (monto + cargo) y formato de moneda. Los valores esperados se calculan, no se escriben a mano. |
| Evidencias | `tests/support/evidence.js` | Capturas por paso y JSON de la confirmación por API, adjuntos al reporte HTML. |
| Flujo E2E | `tests/operation-flow.spec.js` | Camino feliz completo y rechazo por saldo insuficiente desde la UI. |
| Defectos conocidos | `tests/known-defects.spec.js` | F1, F2, F3, F5 y F7 con `test.fail()` (F6 está en `api-negative.spec.js`). |

- **Validaciones con sentido de negocio:**
  - el ID que muestra la UI es el que devolvió el API, y la UI lo precarga en la operación;
  - el saldo baja exactamente `monto + cargo`;
  - por API, la operación existe con el cliente, monto y estado correctos, una referencia externa UUID, y es la única del cliente.
- **Esperas por condición:** aserciones web-first (`toHaveText`, `toHaveValue`) y `waitForResponse` en el Page Object. No hay ningún `waitForTimeout`.
- **Independencia:** cada prueba crea sus propios datos y `fullyParallel: true` las reparte en cualquier orden entre workers. Las precondiciones que no son objeto de la prueba se crean por API.
- **Evidencias:** el flujo adjunta capturas de cada paso y el JSON de la confirmación aunque pase, porque son la evidencia del resultado de negocio. Video, traza y captura de fallo solo se conservan cuando algo falla.
- **Saldo por API con `toBeCloseTo(…, 2)`:** compara al centavo para no confundir el flujo con F7, que tiene su propia prueba.
- **Política de defectos conocidos:**
  - `test.fail()` mantiene el pipeline útil como señal de regresión: verde significa "nada nuevo se rompió", no "el producto no tiene defectos".
  - Los bugs encontrados no son errores del API sino respuestas `201` que debieron ser rechazos. El front no puede advertirlos; por eso cada uno tiene su prueba.
  - **F2, F3 y F5 bloquean el release** (pérdida de dinero y seguridad): un PR puede integrarse, pero la versión no sale a producción con ellos abiertos.
  - Para que no queden ocultos tras un "27 passed", el pipeline publica la lista de defectos conocidos abiertos (Reto 5).
- **Pruebas originales retiradas** (quedan en el commit `Reto 0`):
  - `clients`, `operation` y `api-confirmation` quedan cubiertas por el flujo E2E;
  - `summary-flaky` pasa a ser la prueba de F1.
- **Local y pipeline:** el mismo comando (`npm run test:e2e`) en ambos. La config detecta `CI` y `BASE_URL`; el pipeline se ajusta en el Reto 5.

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
