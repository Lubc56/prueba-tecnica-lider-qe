import { dataRules } from './data-rules.js';

// Contador del proceso del worker: evita repetir documentos entre pruebas del mismo worker.
let sequence = 0;

// Generador pseudoaleatorio con semilla (mulberry32): la misma semilla produce los mismos datos.
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// Convierte un texto (semilla global + nombre de la prueba) en una semilla numérica (FNV-1a).
export function seedFrom(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function padded(value, digits, label) {
  const text = String(value);
  if (text.length > digits) {
    throw new Error(`${label}=${value} no cabe en ${digits} dígitos: ajusta dataRules.document`);
  }
  return text.padStart(digits, '0');
}

export class TestDataFactory {
  #random;
  #runId;
  #workerIndex;

  constructor({ seed, runId, workerIndex }) {
    this.#random = seededRandom(seed);
    this.#runId = runId;
    this.#workerIndex = workerIndex;
  }

  validClient(overrides = {}) {
    const { marker, names, balance } = dataRules;
    const document = this.#uniqueDocument();
    return {
      name: `${marker.namePrefix} ${this.#pick(names.first)} ${this.#pick(names.last)}`,
      document,
      email: `qa.${document}@${marker.emailDomain}`,
      balance: this.#between(balance.valid),
      ...overrides
    };
  }

  operationAmount() {
    return this.#between(dataRules.operation.amount);
  }

  // El monto supera el saldo por sí solo, sin contar el cargo de servicio (ver F2).
  clientWithInsufficientBalance() {
    const client = this.validClient({ balance: this.#between(dataRules.balance.insufficient) });
    const amount = client.balance + this.#between({ min: 1, max: dataRules.operation.amount.max });
    return { client, amount };
  }

  invalidClient(invalidCase) {
    return invalidCase.apply(this.validClient(), this);
  }

  invalidAmount(invalidCase) {
    return invalidCase.apply(this);
  }

  digits(length) {
    return Array.from({ length }, (_, index) => this.#between({ min: index === 0 ? 1 : 0, max: 9 })).join('');
  }

  #uniqueDocument() {
    const { prefix, runDigits, workerDigits, sequenceDigits } = dataRules.document;
    sequence += 1;
    return (
      prefix +
      padded(this.#runId, runDigits, 'runId') +
      padded(this.#workerIndex, workerDigits, 'workerIndex') +
      padded(sequence, sequenceDigits, 'secuencia')
    );
  }

  #between({ min, max }) {
    return min + Math.floor(this.#random() * (max - min + 1));
  }

  #pick(list) {
    return list[Math.floor(this.#random() * list.length)];
  }
}
