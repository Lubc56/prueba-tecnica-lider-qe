import http from 'k6/http';
import { check, sleep } from 'k6';

// Prueba de carga de GET /api/clients/:id/summary.
// Todo se parametriza con -e NOMBRE=valor; los valores por defecto son el escenario pedido.
const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const CLIENT_ID = Number(__ENV.CLIENT_ID || 1);
const THINK_TIME_SECONDS = Number(__ENV.THINK_TIME || 1);

// Objetivos de servicio (SLO). El pipeline usa siempre estos valores; sobrescribirlos solo sirve
// para demostrar el bloqueo o para ajustar el SLO de un ambiente con aprobación explícita.
const P95_TARGET_MS = Number(__ENV.P95_TARGET_MS || 800);
const MAX_ERROR_RATE = Number(__ENV.MAX_ERROR_RATE || 0.01);

const summaryUrl = `${BASE_URL}/api/clients/${CLIENT_ID}/summary`;

export const options = {
  scenarios: {
    resumen_cliente: {
      // Modelo cerrado: 50 usuarios simultáneos toda la prueba, cada uno con una pausa entre consultas.
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 50),
      duration: __ENV.DURATION || '5m'
    }
  },
  thresholds: {
    // p95 y no promedio: el promedio esconde la cola de usuarios lentos.
    http_req_duration: [`p(95)<${P95_TARGET_MS}`],
    // Si los errores se disparan no tiene sentido seguir: tras 30 s de calentamiento aborta y falla.
    http_req_failed: [{ threshold: `rate<${MAX_ERROR_RATE}`, abortOnFail: true, delayAbortEval: '30s' }],
    checks: [`rate>${1 - MAX_ERROR_RATE}`]
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max']
};

// Precondición: falla rápido y con un mensaje claro si el ambiente no tiene el cliente.
export function setup() {
  const response = http.get(summaryUrl);
  if (response.status !== 200) {
    throw new Error(`El cliente ${CLIENT_ID} no responde en ${BASE_URL} (HTTP ${response.status}): revisa BASE_URL y CLIENT_ID`);
  }
}

export default function () {
  const response = http.get(summaryUrl, { tags: { name: 'GET /api/clients/:id/summary' } });

  check(response, {
    'responde 200': r => r.status === 200,
    'devuelve el resumen del cliente pedido': r => r.status === 200 && r.json('client.id') === CLIENT_ID
  });

  sleep(THINK_TIME_SECONDS);
}
