# Prueba técnica Líder QE: rescate de una suite de calidad

[![Quality pipeline](https://github.com/Lubc56/prueba-tecnica-lider-qe/actions/workflows/quality.yml/badge.svg)](https://github.com/Lubc56/prueba-tecnica-lider-qe/actions/workflows/quality.yml)

Solución a la prueba técnica descrita en [`ENUNCIADO.md`](ENUNCIADO.md): diagnosticar, automatizar, estabilizar y gobernar una suite de pruebas heredada.

La suite original fallaba al 100 % y su resultado cambiaba entre corridas. Hoy corre en paralelo de forma determinista, **detecta 7 defectos reales del producto** y bloquea el pipeline ante cualquier regresión funcional o de rendimiento.

## Entregables

| Reto | Qué se entrega | Dónde |
|---|---|---|
| 1. Diagnóstico | Por qué fallaba la suite: defectos del producto vs. de la automatización, con prioridades | [`DIAGNOSTICO.md`](DIAGNOSTICO.md) |
| 2. Automatización funcional | Flujo E2E con Page Object, validaciones de negocio y confirmación por API | [`tests/operation-flow.spec.js`](tests/operation-flow.spec.js) |
| 3. Datos sintéticos | Generador con reglas centralizadas, documentos únicos y limpieza | [`tests/support/data/`](tests/support/data/) |
| 4. Rendimiento | k6 con 50 usuarios durante 5 minutos y umbrales automáticos | [`performance/`](performance/README.md) |
| 5. Pipeline | GitHub Actions que falla de verdad, publica reportes y usa secretos | [`.github/workflows/quality.yml`](.github/workflows/quality.yml) |
| 6. Liderazgo técnico | Revisión del PR: 9 hallazgos y la decisión de rechazarlo | [`REVISION_PR.md`](REVISION_PR.md) |
| Transversal | Decisiones, pendientes, riesgos, herramientas y uso de IA | [`DECISIONES.md`](DECISIONES.md) |

El historial tiene **un commit por reto**, desde el estado original (`Reto 0`); se ve con `git log --oneline`.

## Inicio rápido

Requisitos: Node.js 20 o superior (probado con 24), npm y, para rendimiento, [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/).

```bash
npm ci
npx playwright install chromium
```

### Pruebas funcionales

```bash
npm run test:e2e
```

No hace falta levantar la aplicación: Playwright arranca su propia instancia en el puerto `3100`, con una base de datos aislada que se borra al terminar.

| Para… | Comando |
|---|---|
| Ver el navegador | `npx playwright test --headed` |
| Ir paso a paso | `npm run test:e2e:ui` |
| Abrir el último reporte | `npm run test:e2e:report` |
| Correr un grupo | `npx playwright test --grep @e2e` (también `@smoke`, `@negative`, `@data`, `@known-defect`) |
| Repetir los datos de una corrida | `DATA_SEED=<semilla impresa al inicio> npm run test:e2e` |

### Prueba de rendimiento

```bash
npm run db:reset && npm start
```

En otra terminal:

```bash
npm run test:performance
```

Para una corrida corta: `npm run test:performance -- -e VUS=10 -e DURATION=30s`. Los detalles (umbrales, resultados y cuándo bloquea el pipeline) están en [`performance/README.md`](performance/README.md).

### Aplicación

```bash
npm run db:reset && npm start
```

Queda disponible en `http://127.0.0.1:3000`. Todas las variables configurables están documentadas en [`.env.example`](.env.example).

## Qué cubre la suite

27 pruebas que corren en unos 4 segundos:

| Grupo | Pruebas | Qué valida |
|---|---|---|
| `@e2e` | 2 | Flujo completo crear cliente → operar → validar en la UI → confirmar por API, y el rechazo por saldo insuficiente |
| `@negative` | 14 | El API rechaza datos inválidos, documentos duplicados, saldo insuficiente y montos inválidos |
| `@known-defect` | 5 | Defectos conocidos del producto, marcados con `test.fail()` |
| `@data` | 4 | Garantías del generador de datos: reglas, unicidad, coherencia y reproducibilidad |
| `@smoke` | 2 | La API y el frontend responden |

## Defectos conocidos del producto

La aplicación es el sistema bajo prueba, así que **no se corrigió**. La única excepción es F4, porque impedía ejecutar el arnés. Cada defecto tiene una prueba que describe el comportamiento correcto y está marcada con `test.fail()`:
- el pipeline queda en verde mientras no aparezca nada nuevo;
- si alguien corrige un defecto, su prueba avisa;
- la lista de defectos abiertos se publica en el resumen de cada corrida.

| ID | Defecto | Impacto |
|---|---|---|
| F1 | El resumen muestra siempre `PENDING` | El usuario ve un estado falso |
| F2 | Se valida el saldo sin el cargo del 10 % | Saldos negativos — **bloquea release** |
| F3 | Dos operaciones simultáneas (o un doble clic) sobregiran la cuenta | Pérdida de dinero — **bloquea release** |
| F4 | Los estáticos dan 404 en rutas con espacios | Corregido: bloqueaba el arnés |
| F5 | XSS almacenado en el nombre del cliente | Seguridad — **bloquea release** |
| F6 | El API acepta saldo negativo o no numérico y correos inválidos | Datos corruptos |
| F7 | El dinero se calcula en coma flotante | Errores de redondeo |

La evidencia y la reproducción de cada uno están en [`DIAGNOSTICO.md`](DIAGNOSTICO.md).

## Pipeline

| Evento | Pruebas funcionales | Rendimiento |
|---|---|---|
| Pull request | Suite completa | Perfil reducido (10 usuarios, 1 min) |
| Push a `main`, nightly o manual | Suite completa | Perfil completo (50 usuarios, 5 min) |

- Cualquier prueba fallida o umbral incumplido **hace fallar el pipeline**.
- El reporte HTML se publica siempre. Videos, capturas y trazas solo cuando algo falla.
- Las variables y secretos vienen de los ambientes de GitHub (`ci`, `qa`, `staging`), y la ejecución manual permite elegir el ambiente.
- El job E2E corre sobre la imagen oficial de Playwright, que ya trae el navegador y sus dependencias. No se reinstalan en cada corrida.

## Estructura

```
├── src/                      Aplicación bajo prueba (solo se corrigió F4)
├── tests/
│   ├── operation-flow.spec.js    Flujo E2E
│   ├── known-defects.spec.js     F1, F2, F3, F5 y F7
│   ├── api-negative.spec.js      Validaciones del API (incluye F6)
│   ├── data-factory.spec.js      Garantías del generador de datos
│   ├── smoke.spec.js             Salud del arnés
│   └── support/
│       ├── pages/                Page Object
│       ├── api/                  Cliente del API
│       ├── data/                 Reglas, fábrica y casos inválidos
│       ├── reporters/            Resumen de defectos conocidos
│       └── fixtures.js …         Fixtures, reglas de negocio, evidencias, setup y limpieza
├── performance/              Prueba k6, su documentación y la evidencia de la corrida
├── evidence/                 Reporte HTML de Playwright de la corrida final
├── .github/workflows/        Pipeline
├── review-target/            Código del PR revisado (sin cambios)
├── DIAGNOSTICO.md · DECISIONES.md · REVISION_PR.md
└── ENUNCIADO.md              Enunciado original de la prueba
```
