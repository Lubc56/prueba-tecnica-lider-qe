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

### Reto 4: prueba no funcional

El detalle (cómo ejecutar, parámetros, resultados y política de bloqueo) está en `performance/README.md`.

- **k6 sobre JMeter:**
  - el script es código versionado y revisable en un PR;
  - los umbrales viven en el mismo archivo;
  - el código de salida (99) integra directo con CI, sin plugins.
- **Modelo cerrado (`constant-vus`) con 1 s de pausa:** "50 usuarios concurrentes" describe usuarios, no peticiones por segundo. Sin pausa sería una prueba de estrés. La pausa se ajusta con `THINK_TIME`.
- **p95 y no promedio:** el "tiempo de respuesta objetivo" se interpreta como `p(95) < 800 ms`, porque el promedio esconde la cola de usuarios lentos.
- **Errores con aborto anticipado:** `http_req_failed < 1 %` con `abortOnFail` tras 30 s de calentamiento, para no gastar 5 minutos de pipeline en una prueba ya perdida.
- **`checks > 99 %`:** se valida el contenido, no solo el código HTTP; el resumen debe ser del cliente pedido.
- **Precondición en `setup()`:** si el ambiente no tiene el cliente, falla en el primer segundo con un mensaje claro.
- **Evidencia que no se pierde en silencio:** si la carpeta de destino no existe, k6 no escribe el resumen y aun así sale con código 0. El script de npm crea `performance/results/` y la limpia antes de cada corrida.
- **Evidencia entregada separada de la salida de cada corrida** (ajustado en el Reto 5):
  - `performance/evidence/` (versionada) guarda la evidencia entregada;
  - `performance/results/` (ignorada) es la salida de cada corrida;
  - así el resumen del pipeline nunca puede leer un resultado viejo del repositorio.
- **Dashboard en vivo y reporte HTML (`K6_WEB_DASHBOARD`):** el seguimiento visual equivale al de Gatling. Hallazgo: k6 no termina mientras un navegador siga conectado al dashboard. En CI no ocurre; en local está documentado en `performance/README.md`.
- **Corrida completa ejecutada:** 50 usuarios, 5 minutos y 15.001 peticiones; p95 = 5.58 ms y 0 % de errores. El bloqueo se demostró con un objetivo imposible, que terminó con código 99.

### Reto 5: pipeline (`.github/workflows/quality.yml`)

| Problema original | Corrección |
|---|---|
| `continue-on-error: true`: el pipeline nunca fallaba | Eliminado. Cada job falla si falla una prueba o un umbral. |
| Node 16 (el proyecto exige ≥20) | Node 24 LTS (Node 20 terminó su soporte en abril de 2026) |
| `npm run e2e:test` no existe | `npm run test:e2e` |
| `npm install` | `npm ci` con el lockfile versionado |
| Chromium sin dependencias del sistema | `playwright install --with-deps chromium` |
| `npm start &` sin esperar a que arranque | E2E: Playwright levanta su instancia aislada (`webServer`). Rendimiento: se espera `/health` antes de cargar. |
| Token en texto plano en el YAML | `secrets.RISK_API_TOKEN` del ambiente de GitHub |
| Reporte solo si todo pasaba y en una ruta inexistente (`reports/`) | `playwright-report/` siempre (`!cancelled()`), aunque falle |
| k6 sin instalar, script inexistente y `\|\| true` | `grafana/setup-k6-action` con k6 2.3.0 fijo, el script real y sin `\|\| true` |
| Actions v4 | v7 (versiones vigentes) |
| `push` a cualquier rama + `pull_request` (corridas duplicadas) | `push` a `main`, `pull_request`, nightly y ejecución manual |

- **Ambientes y secretos:**
  - Se usan ambientes de GitHub: `ci` (por defecto), `qa` y `staging`.
  - Cada uno define las variables `BASE_URL` y `RISK_MODE` y el secreto `RISK_API_TOKEN`.
  - La ejecución manual permite elegir el ambiente. Si `BASE_URL` está vacía, las pruebas corren contra una instancia local en el runner.
  - `.env.example` documenta todas las variables y marca cuáles son secretas.
- **Evidencias:**
  - El reporte HTML se publica siempre (14 días).
  - `test-results/` (videos, capturas y trazas) se publica solo con `if: failure()` (7 días). Además, la config solo los genera cuando una prueba falla: hay doble barrera.
- **Visibilidad de defectos conocidos:** un reporter propio (`tests/support/reporters/known-defects-reporter.js`) escribe en el resumen del job la tabla de defectos abiertos. Así un "27 passed" no los oculta, y si alguno se corrige lo marca para retirar el `test.fail()`.
- **Rendimiento:**
  - Corre después del E2E (`needs`), con perfil reducido en los PR (10 usuarios, 1 min) y completo en `main`, nightly y ejecución manual.
  - Publica en el resumen del job una tabla con los umbrales, leídos del propio resultado de k6, y sube `k6-report` como artefacto.
- **Higiene:** `permissions: contents: read` (mínimo privilegio), `concurrency` para cancelar corridas viejas de la misma rama y `timeout-minutes` por job.
- **Imagen oficial de Playwright en el job E2E** (ajuste tras la primera ejecución real):
  - Medición: instalar Chromium y sus dependencias del sistema tomó **480 s**; las pruebas, **5 s**. De esos 480 s, **459 s fueron paquetes del sistema** (`apt`: 25.9 MB a 56 kB/s desde el mirror de Ubuntu) y **4 s la descarga del navegador**.
  - Se descartaron los artifacts: guardan resultados de una corrida para descargarlos, no son para reutilizar dependencias entre corridas.
  - Se descartó cachear los navegadores (`actions/cache`): solo evita la descarga del navegador. Las dependencias del sistema (`apt`) se siguen instalando en cada corrida, y la documentación de Playwright desaconseja ese caché porque restaurarlo tarda casi lo mismo que descargar.
  - **Resultado medido:** el job E2E pasó de **499 s a 41 s** (corridas `40541217080` y `40544091353`). Los 480 s de instalación se cambiaron por 26 s de descarga de la imagen.
  - La imagen `mcr.microsoft.com/playwright:v1.64.1-noble` trae todo instalado. Su versión debe coincidir con la de `@playwright/test`; si no, Playwright falla indicando que faltan los navegadores.
  - Las dependencias de npm ya se cacheaban con `setup-node` (`npm ci` tarda 2 s).

**Cómo se validó** (los pasos 1 a 4, antes de tener el repositorio publicado)

1. **actionlint 1.7.12 + shellcheck:** 0 errores. Sobre el workflow **original** también da 0: el linter valida sintaxis, no lógica. Por eso hacen falta los pasos siguientes.
2. **Simulación del job E2E** (`CI=true`, con `GITHUB_STEP_SUMMARY` apuntando a un archivo local): código 0, 27 pruebas pasan, aparece la anotación `::notice`, el resumen muestra los 8 defectos abiertos y `test-results/` pesa 36 KB sin videos ni trazas.
3. **Falla forzada** (`RISK_MODE=rejected`): código 1, anotación `::error` con "esperado APPROVED, recibido REJECTED", y video, captura y traza **solo** de la prueba que falló.
4. **Simulación del job de rendimiento:** el perfil reducido por variables de entorno sale con código 0 y resumen ✅; con un umbral imposible sale con código 99 y resumen ❌.
5. **Ejecución real en GitHub Actions** (corrida `40541217080`, push a `main`): **en verde**. El job E2E corrió las 27 pruebas y el job de rendimiento, con perfil completo (15.001 peticiones), dio p95 = 2.79 ms y 0 % de errores.
6. **Fallos forzados en GitHub**, con dos PR de demostración que simulan regresiones reales. Se cerraron sin merge y quedan en el historial:

   | PR | Regresión simulada | Resultado del pipeline |
   |---|---|---|
   | [#1](https://github.com/Lubc56/prueba-tecnica-lider-qe/pull/1) | Cargo de servicio del 10 % al 15 % | ❌ E2E: 1 fallida y 26 pasan. El saldo esperado era $4069.30 y se recibió $4050.45. Se publicó `playwright-evidencia-fallo` (video, captura y traza). Rendimiento no se ejecutó. |
   | [#2](https://github.com/Lubc56/prueba-tecnica-lider-qe/pull/2) | 1 s extra en `GET /api/clients/:id/summary` | ✅ E2E pasa, sin evidencias de fallo. ❌ k6 (perfil reducido de PR): `p(95)<800` incumplido con p95 = 1 s, **exit code 99**. |

   El #1 demuestra que las validaciones de negocio detectan un cambio silencioso de dinero. El #2, que una degradación de rendimiento bloquea el PR aunque la funcionalidad esté intacta.

### Reto 6: liderazgo técnico

El detalle está en `REVISION_PR.md`.

- **Decisión: rechazar el PR de `payment-helper.js`.** Tiene 9 hallazgos: 2 críticos (contraseña de administrador en el código y ejecución contra producción), 4 altos, 2 medios y 1 bajo.
- **Por qué rechazar y no solicitar cambios:** la credencial ya quedó en el historial de la rama (hay que rotarla y eliminar la rama), y el diseño exige reescribirlo sobre los componentes existentes.
- **Acciones de equipo además del código:** escaneo de secretos en CI, la regla `no-wait-for-timeout`, bloqueo de URLs de producción, un checklist en la plantilla de PR y pair programming con el autor.

## Evidencias entregadas

| Evidencia | Ubicación |
|---|---|
| Reporte HTML de Playwright de la corrida final: 27 pruebas pasan, con capturas por paso y el JSON de confirmación por API | `evidence/playwright-report/` (abrir con `npx playwright show-report evidence/playwright-report`) |
| Resultado de k6: 50 usuarios durante 5 minutos | `performance/evidence/summary.json` y `performance/evidence/report.html` |
| Demostración de bloqueo por umbral (código 99) | `performance/evidence/bloqueo-demo.txt` |
| Orden de trabajo | Historial de git: un commit por reto, desde el estado original (`Reto 0`) |

## Actividades no completadas

| Pendiente | Riesgo | Acción siguiente |
|---|---|---|
| Registrar F1–F7 en la herramienta de seguimiento del equipo | Defectos conocidos solo en la documentación, sin dueño ni fecha | Un ticket por defecto con su prueba asociada; F2, F3 y F5 marcados como bloqueantes de release |
| Flujo E2E con el servicio de riesgo en `REJECTED` | Una regresión en el manejo del rechazo en la UI no se detectaría | Segundo proyecto de Playwright con su propia instancia en `RISK_MODE=rejected` |
| Rendimiento con volumen de datos representativo | La latencia medida es el mejor caso (BD recién creada); con miles de operaciones puede incumplir el SLO | Sembrar la BD con un volumen similar a producción y repetir en un ambiente parecido a producción |
| Barreras propuestas en el Reto 6: escaneo de secretos, `no-wait-for-timeout`, bloqueo de URLs de producción | Credenciales o esperas fijas pueden volver a llegar a un PR | Agregar `gitleaks` y `eslint-plugin-playwright` al pipeline como pasos bloqueantes |

## Riesgos pendientes

- **Defectos críticos abiertos en el producto:** F2 y F3 (pérdida de dinero) y F5 (XSS) siguen presentes. La suite los detecta, pero no deben salir a producción.
- **Token expuesto en el historial:** el workflow original traía el valor de `RISK_API_TOKEN` en texto plano y quedó en el commit `Reto 0`, que se conserva como línea base. Ya no está en el código, pero publicar el repositorio expone el historial: si el token es real, debe rotarse.
- **Rendimiento en runners compartidos:** la app y k6 comparten máquina, así que el job detecta regresiones relativas, no capacidad de producción (ver `performance/README.md`).
- El camino `REJECTED` del servicio de riesgo no queda cubierto con `RISK_MODE=approved`. Cubrirlo requiere una segunda instancia u otro proyecto de Playwright con `RISK_MODE=rejected`.

## Herramientas utilizadas

| Herramienta | Versión | Uso |
|---|---|---|
| Node.js / npm | 24.4.1 / 11.4.2 | Ejecución local |
| Playwright + Chromium | 1.64.1 | Pruebas E2E y de API |
| k6 | 2.3.0 | Prueba de rendimiento |
| actionlint + shellcheck | 1.7.12 | Validación estática del workflow |
| GitHub Actions | `checkout`, `setup-node` y `upload-artifact` v7; `setup-k6-action` v1 | Pipeline |
| Git | 2.39.5 | Historial con un commit por reto |
| Homebrew | — | Instalación de k6, actionlint y shellcheck |
| Claude Code | Claude Opus 5.5 | Asistente de IA (ver la sección siguiente) |

## Uso de asistentes de inteligencia artificial

Se usó **Claude Code** (Anthropic, modelo Claude Opus 5.5) como asistente durante toda la prueba, con un trabajo en pareja paso a paso.

- **Qué hizo el asistente:**
  - leyó el código y ejecutó la suite, la aplicación y los comandos en la terminal del candidato, a la vista;
  - propuso el diagnóstico y las opciones de solución;
  - redactó el código, la configuración y la documentación.
- **Qué hizo el candidato:**
  - definió la forma de trabajo: un reto a la vez, viendo cada ejecución y validando antes de cada commit;
  - decidió el alcance y las políticas a partir de las opciones propuestas: no corregir el producto salvo F4, `test.fail()` con release bloqueado por F2/F3/F5, el orden base → 3 → 2, k6, y rechazar el PR;
  - pidió reproducir visualmente los defectos;
  - revisó los diffs y aprobó cada commit.
- **Cómo se verificó lo generado:**
  - ninguna afirmación del diagnóstico quedó sin reproducir (por UI, API o Playwright);
  - cada prueba de defecto conocido se comprobó fallando por la razón correcta, no por un error de la prueba;
  - el pipeline se validó con actionlint, simulación local y fallas forzadas.
- **Trazabilidad:** cada commit de trabajo incluye la línea `Co-Authored-By: Claude`.

## Hora declarada de inicio y finalización

- **Inicio:** 2026-10-27, 09:20 (UTC-5). Es el primer registro verificable: la instalación de dependencias.
- **Finalización:** 2026-10-27, 11:23 (UTC-5). Hora del commit de cierre.
