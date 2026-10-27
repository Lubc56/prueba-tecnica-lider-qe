# Diagnóstico del arnés

## Resumen ejecutivo

La suite original (4 pruebas) falla al 100 % por tres capas superpuestas; cada una esconde a la siguiente:

1. **Entorno:** en rutas con espacios el frontend responde 404 mientras `/health` responde 200. Playwright arranca contra una app rota y todo muere por timeout.
2. **Automatización:** pruebas acopladas, datos quemados, BD compartida, esperas fijas y riesgo aleatorio. Dos corridas seguidas pasan 1 de 4, pero cada vez una prueba distinta.
3. **Producto:** siete defectos reales, dos con pérdida de dinero.

El pipeline nunca falla (`continue-on-error`), así que nada de esto era visible. Cada hallazgo se reprodujo por UI o API (macOS, Node 24.4.1, Playwright 1.64.1).

## Defectos funcionales

| ID | Defecto | Evidencia |
|---|---|---|
| F1 | El resumen muestra siempre `PENDING` (quemado en `app.js:60`) | Operación `APPROVED`, resumen `PENDING` |
| F2 | Valida `saldo < monto`, pero debita monto + 10 % | Saldo 100, operación de 100 → **$-10.00** |
| F3 | Validación y débito no atómicos (`await` al riesgo en medio) | Doble clic con saldo 100 y monto 90 → **$-98.00** |
| F4 | `URL.pathname` deja `%20`: estáticos en 404 | Único corregido: bloqueaba el arnés |
| F5 | XSS almacenado: el nombre se pinta con `innerHTML` | Un `<img onerror>` ejecutó código |
| F6 | El API acepta saldo negativo o no numérico y email inválido (la UI sí los bloquea) | `-500`, `"abc"` → `null`, `"x"` |
| F7 | Dinero en coma flotante | Saldo `0.2300000000000001` |

**Ambigüedad:** el cargo del 10 % no está documentado (la prueba esperaba $900 y la app deja $890). Hay que confirmarlo con el PO.

## Problemas de automatización

- **Pruebas dependientes entre sí** (usan "el cliente 2" y "la operación 1"): con 3 workers el orden no está garantizado.
- **Datos quemados sin limpieza**, sobre la BD de desarrollo: la segunda corrida falla con `409`.
- **Resultados no deterministas:** `waitForTimeout` frente a retrasos aleatorios, y `RISK_MODE=random` (15 % de rechazos).
- **Arnés débil:** `webServer` espera `/health` y reutiliza servidores; trazas y videos siempre activos; sin Page Objects.
- **Pipeline:** Node 16, un script inexistente, el token en texto plano, el reporte solo si todo pasa y k6 inexistente con `|| true`.

## Dependencias y riesgos

- **Dependencias:** Node ≥20, npm, Express, Playwright + Chromium (en Linux, con librerías del sistema), k6, escritura en disco para la BD JSON, el servicio de riesgo (`/external/risk`) y las variables `PORT`, `DATABASE_PATH`, `RISK_SERVICE_URL`, `RISK_API_TOKEN` y `RISK_MODE`.
- **Riesgos:** sin lockfile (se instaló Playwright 1.64.1 y no 1.49); nada carga el `.env`; la BD JSON se lee y escribe completa en cada petición, así que no soporta concurrencia ni volumen; `GET /api/clients/:id` expone documento y email sin autenticación.

## Priorización de correcciones

| Prioridad | Hallazgo | Tipo | Impacto | Acción recomendada |
|---|---|---|---|---|
| 1 | Frontend 404 (F4) | Entorno | Bloquea la suite | `fileURLToPath`; `webServer` espera `/` |
| 2 | El pipeline nunca falla | CI | Defectos sin alerta | Quitar `continue-on-error`, corregir Node y el script |
| 3 | Pruebas acopladas, BD compartida | Automatización | Resultados no reproducibles | Datos sintéticos, BD aislada, fixtures |
| 4 | F2 y F3 | Funcional crítico | Pérdida de dinero | Reportar ya; débito atómico con el cargo incluido |
| 5 | Esperas fijas, riesgo aleatorio | Automatización | Pruebas inestables | Esperas por condición; `RISK_MODE=approved` |
| 6 | F1, F5, F6 y F7 | Funcional / seguridad | Estado falso, XSS, datos corruptos | Reportar; pruebas con `test.fail()` |
| 7 | Secreto en el YAML; artefactos siempre activos | Gobierno | Fuga de credenciales | `secrets`; `retain-on-failure` |
