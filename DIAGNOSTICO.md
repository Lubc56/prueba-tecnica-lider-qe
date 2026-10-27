# Diagnóstico del arnés

## Resumen ejecutivo

La suite original (4 pruebas) falla al 100 % y seguiría sin ser confiable aunque se corrigiera el entorno. Las fallas vienen de tres capas superpuestas:

1. **Entorno:** si la carpeta del proyecto tiene espacios, el servidor no sirve el frontend (`GET /` → 404), pero `/health` responde 200. Playwright arranca contra una app rota y todas las pruebas mueren por timeout.
2. **Automatización:** las pruebas dependen unas de otras y de datos quemados, corren en paralelo sobre una única BD JSON, usan esperas fijas y un servicio de riesgo aleatorio. Al ejecutar desde una ruta sin espacios, dos corridas seguidas dieron 1/4 cada una, pero con una prueba distinta pasando cada vez.
3. **Producto:** hay defectos reales de negocio: estado siempre `PENDING`, sobregiro y doble gasto.

Como el pipeline nunca falla (`continue-on-error: true`), nada de esto era visible. *Entorno de diagnóstico: macOS, Node 24.4.1, Playwright 1.64.1.*

## Defectos funcionales (producto)

F1, F2, F3 y F5 se reprodujeron en la interfaz; F6 y F7 por API.

- **F1:** la operación muestra `APPROVED`, pero el resumen siempre dice `PENDING` (valor quemado en `src/public/app.js:60`).
- **F2 (sobregiro):** `server.js` valida `client.balance < amount`, pero debita `amount + serviceCharge` (10 %). Con saldo 100 y una operación de 100, la UI muestra **$-10.00**.
- **F3 (doble gasto):** entre la validación y el débito hay un `await` al servicio de riesgo, y el botón no se deshabilita mientras procesa. Un **doble clic** en "Realizar operación" con saldo 100 y monto 90 crea dos operaciones `APPROVED` y deja el saldo en **$-98.00**.
- **F4:** `express.static` recibe `URL.pathname`, que deja los espacios codificados (`%20`), y responde 404 en rutas con espacios. Es el único defecto corregido, porque bloquea el arnés.
- **F5:** XSS almacenado. El nombre se renderiza con `innerHTML`; un nombre con `<img onerror=...>` ejecutó código al consultar el resumen.
- **F6:** la UI bloquea el saldo negativo y el email inválido (HTML5), pero la API acepta saldo -500, saldo `"abc"` (lo guarda como `null`) y email `"x"`.
- **F7:** el dinero se maneja en coma flotante; con saldo 1 y una operación de 0.7 el saldo queda en `0.2300000000000001`.
- **Ambigüedad:** el cargo del 10 % no está documentado. La prueba esperaba $900 y la app deja $890; hay que confirmarlo con el PO.

## Problemas de automatización

- **Dependencia entre pruebas:** `operation` usa el cliente 2 que crea `clients`, y `api-confirmation` usa la operación 1. Con 3 workers el orden no está garantizado, porque `serial` solo aplica dentro de cada archivo.
- **Datos quemados sin limpieza:** la segunda corrida falla con `409 document already exists`. La BD es compartida con desarrollo y no tiene reset ni aislamiento.
- **Esperas fijas:** `waitForTimeout(500/3000)` frente a un retraso aleatorio de 300–1500 ms. Además, el riesgo en modo `random` rechaza el 15 %, así que el resultado no es determinista.
- **`webServer`:** verifica `/health` y no el frontend, y reutiliza siempre un servidor existente. `trace`, `video` y `screenshot` están siempre en `on`.
- **Diseño:** no hay Page Objects ni fixtures, los selectores están duplicados y las aserciones no tienen sentido de negocio.
- **Pipeline:** usa Node 16 (el proyecto exige ≥20); el script `e2e:test` no existe; el token está en texto plano; el reporte solo se publica si todo pasa y en una ruta errada; k6 no está instalado, su script no existe y `|| true` se traga los fallos.

## Dependencias y riesgos

- **Dependencias:** Node ≥20, npm, Express, Playwright + Chromium (en Linux, también las librerías de sistema), k6, permiso de escritura para la BD JSON, servicio de riesgo (simulado en `/external/risk`, configurable con `RISK_SERVICE_URL`) y las variables `PORT`, `DATABASE_PATH`, `RISK_SERVICE_URL`, `RISK_API_TOKEN` y `RISK_MODE`.
- **Riesgos:** sin `package-lock.json` los builds no son reproducibles (`^1.49.1` instaló la 1.64.1); nada carga el `.env`, aunque existe `.env.example`; la BD JSON se lee y escribe completa en cada petición, así que no soporta concurrencia ni volumen; `GET /api/clients/:id` expone documento y email sin autenticación.

## Priorización de correcciones

| Prioridad | Hallazgo | Tipo | Impacto | Acción recomendada |
|---|---|---|---|---|
| 1 | Frontend 404 en rutas con espacios (F4) | Producto / entorno | Bloquea toda la suite local | Usar `fileURLToPath`; que `webServer` verifique `/` |
| 2 | El pipeline nunca falla | Automatización (CI) | Los defectos llegan a producción sin alerta | Quitar `continue-on-error`, Node 20, script correcto |
| 3 | Pruebas acopladas, datos quemados, BD compartida | Automatización | Resultados no reproducibles | Datos sintéticos únicos, BD aislada por ejecución, fixtures |
| 4 | Doble gasto y sobregiro (F2, F3) | Funcional (crítico) | Pérdida financiera, saldos negativos | Reportar ya; validación atómica que incluya el cargo |
| 5 | Esperas fijas y riesgo aleatorio | Automatización | Pruebas inestables (flaky) | Esperas por condición; `RISK_MODE=approved` en E2E |
| 6 | Estado `PENDING` quemado (F1) | Funcional | El usuario ve un estado incorrecto | Reportar; prueba con `test.fail()` e ID del defecto |
| 7 | XSS y validaciones débiles (F5, F6, F7) | Funcional / seguridad | Inyección de scripts, datos corruptos | Reportar; escapar la salida y validar en servidor |
| 8 | Secreto en el pipeline; artefactos siempre activos | Gobierno | Fuga de credenciales, costo de almacenamiento | `secrets`; `retain-on-failure` |
