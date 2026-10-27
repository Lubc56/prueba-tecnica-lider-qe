import { dataRules } from './data-rules.js';

const { minDigits, maxDigits } = dataRules.document;

const requiredFields = { status: 400, body: { error: 'name, document and email are required' } };
const documentFormat = { status: 400, body: { error: `document must contain ${minDigits} to ${maxDigits} digits` } };
const invalidAmount = { status: 400, body: { error: 'amount must be greater than zero' } };

// Cada caso parte de un cliente válido y rompe una sola regla.
export const invalidClientCases = [
  { description: 'sin nombre', expected: requiredFields, apply: client => ({ ...client, name: '' }) },
  { description: 'sin documento', expected: requiredFields, apply: client => ({ ...client, document: '' }) },
  { description: 'sin correo', expected: requiredFields, apply: client => ({ ...client, email: '' }) },
  {
    description: `con documento de ${minDigits - 1} dígitos`,
    expected: documentFormat,
    apply: (client, factory) => ({ ...client, document: factory.digits(minDigits - 1) })
  },
  {
    description: `con documento de ${maxDigits + 1} dígitos`,
    expected: documentFormat,
    apply: (client, factory) => ({ ...client, document: factory.digits(maxDigits + 1) })
  },
  {
    description: 'con letras en el documento',
    expected: documentFormat,
    apply: client => ({ ...client, document: `${client.document.slice(0, -2)}AB` })
  },
  // El negocio debería rechazarlos, pero el API los acepta (F6): se ejecutan como defectos conocidos.
  {
    description: 'con saldo negativo',
    expected: { status: 400 },
    knownDefect: 'F6',
    apply: client => ({ ...client, balance: -client.balance })
  },
  {
    description: 'con saldo no numérico',
    expected: { status: 400 },
    knownDefect: 'F6',
    apply: client => ({ ...client, balance: 'abc' })
  },
  {
    description: 'con correo sin formato válido',
    expected: { status: 400 },
    knownDefect: 'F6',
    apply: client => ({ ...client, email: client.email.replace('@', '-at-') })
  }
];

export const invalidAmountCases = [
  { description: 'cero', expected: invalidAmount, apply: () => 0 },
  { description: 'negativo', expected: invalidAmount, apply: factory => -factory.operationAmount() },
  { description: 'no numérico', expected: invalidAmount, apply: () => 'abc' }
];
