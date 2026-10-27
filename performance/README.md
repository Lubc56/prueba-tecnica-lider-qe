# Prueba de rendimiento: `GET /api/clients/:id/summary`

Script: [`critical-endpoint.js`](critical-endpoint.js) (k6).

## Escenario

- **Carga:** 50 usuarios simultáneos (`constant-vus`) durante 5 minutos.
- **Comportamiento de cada usuario:** consulta el resumen del cliente 1 y hace una pausa de 1 s antes de la siguiente consulta, lo que equivale a unas 50 peticiones por segundo.
- **Por qué con pausa:** "50 usuarios concurrentes" describe personas, no peticiones por segundo. Sin pausa (`THINK_TIME=0`) sería una prueba de estrés.

## Umbrales automáticos (SLO)

| Métrica | Umbral | Por qué |
|---|---|---|
| `http_req_duration` | `p(95) < 800 ms` | Interpretación del "tiempo de respuesta objetivo": el 95 % de las peticiones debe responder en menos de 800 ms. Se usa el percentil y no el promedio porque el promedio esconde a los usuarios lentos. |
| `http_req_failed` | `< 1 %` | Tasa de error pedida. Con `abortOnFail`, si se supera después de 30 s de calentamiento, la prueba se detiene y falla sin gastar los 5 minutos. |
| `checks` | `> 99 %` | Valida el contenido y no solo el HTTP 200: la respuesta debe ser el resumen del cliente pedido. |

Si cualquier umbral se incumple, **k6 termina con código de salida 99** y el job de CI falla.

## Cómo ejecutar

1. Levantar la aplicación con la BD en estado conocido:

   ```bash
   npm run db:reset && npm start
   ```

2. En otra terminal, correr la prueba:

   ```bash
   npm run test:performance
   ```

   - Mientras corre hay un dashboard en vivo en `http://127.0.0.1:5665`. **Ciérralo al terminar:** k6 no imprime el resumen mientras un navegador siga conectado. En CI no aplica, porque nadie lo abre.
   - Al terminar deja `results/summary.json` (métricas) y `results/report.html` (gráficas; se abre en el navegador).

Para una corrida reducida, los parámetros se pasan después de `--`:

```bash
npm run test:performance -- -e VUS=10 -e DURATION=30s
```

| Variable | Por defecto | Uso |
|---|---|---|
| `BASE_URL` | `http://127.0.0.1:3000` | Ambiente a probar |
| `CLIENT_ID` | `1` | Cliente consultado (debe existir; si no, `setup()` falla con un mensaje claro) |
| `VUS` / `DURATION` | `50` / `5m` | Usuarios y duración |
| `THINK_TIME` | `1` | Pausa en segundos entre consultas de cada usuario |
| `P95_TARGET_MS` / `MAX_ERROR_RATE` | `800` / `0.01` | SLO. El pipeline **no** los sobrescribe: solo se cambian para demostrar el bloqueo o, con aprobación del dueño del SLO, como cambio versionado. |

## Resultados

Ejecución completa en local, sobre una MacBook Air (Apple Silicon), con k6 2.3.0 y la BD recién reiniciada.

| Métrica | Resultado | Objetivo | Estado |
|---|---|---|---|
| Duración y carga | 5 min, 50 usuarios, 15.001 peticiones (~50/s) | 5 min, 50 usuarios | ✅ |
| p95 | **5.58 ms** | < 800 ms | ✅ |
| p90 / p99 / máx. | 4.71 ms / 7.12 ms / 20.53 ms | (referencia) | |
| Promedio / mediana | 2.62 ms / 2.41 ms | (referencia) | |
| Tasa de error | **0 %** (0 de 15.001) | < 1 % | ✅ |
| Validaciones (`checks`) | 100 % (30.000 de 30.000) | > 99 % | ✅ |
| Código de salida | `0` | | ✅ |

Evidencias:

- [`results/summary.json`](results/summary.json): métricas completas de la corrida de 5 minutos.
- [`results/report.html`](results/report.html): reporte con gráficas de la misma corrida.
- [`results/bloqueo-demo.txt`](results/bloqueo-demo.txt): la misma prueba con un objetivo imposible (`p95 < 1 ms`) termina con **código 99**, que es lo que bloquea el pipeline.

## Cuándo debe bloquearse el pipeline

**Regla:** si se incumple cualquier umbral (código 99) o la prueba no puede ejecutarse (cliente inexistente, aplicación caída o error del script, códigos distintos de 0), el job falla. Nunca se usa `|| true` ni `continue-on-error`.

| Momento | Perfil | ¿Bloquea? |
|---|---|---|
| Cada pull request | Reducido (10 usuarios, 1 min) con los mismos umbrales | **Sí, el merge.** Detecta regresiones groseras sin alargar cada PR 5 minutos. |
| Merge a `main`, nightly o antes de un release | Completo (50 usuarios, 5 min) | **Sí, el release.** Es la prueba de aceptación del SLO. |
| Cambio de umbrales | — | Solo con aprobación del dueño del SLO, como cambio versionado en el script. Un umbral no se relaja para que el pipeline pase. |

**Advertencia sobre los resultados en CI:** en los runners compartidos de GitHub la app y k6 corren en la misma máquina virtual. Ahí la prueba sirve para detectar **regresiones relativas**, no para certificar capacidad de producción; eso requiere un ambiente similar a producción (`BASE_URL`).

## Limitaciones

- **Volumen de datos:** el endpoint lee y filtra el JSON completo en cada petición. Con la BD recién reiniciada, el cliente 1 no tiene operaciones, así que la latencia medida es la mejor posible. Con miles de operaciones crecerá; para producción hay que probar con un volumen representativo.
- **Solo lectura:** no mide la carga combinada con escrituras. Las escrituras usan acceso síncrono a disco y bloquearían el event loop de Node para todas las lecturas.
- **Un solo cliente:** todas las consultas piden el mismo recurso, lo que favorece a la caché del sistema operativo.
