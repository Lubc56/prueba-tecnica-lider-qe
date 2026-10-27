import { dataRules } from './data/data-rules.js';

// Débito que aplica hoy el backend: monto + cargo de servicio (tasa PENDIENTE de confirmar con el PO).
// Replica el mismo cálculo para comparar contra el mismo valor, no contra un número escrito a mano.
export function expectedBalanceAfter(balance, amount) {
  return balance - (amount + amount * dataRules.operation.serviceChargeRate);
}

// El dinero se compara al centavo.
export function toCents(value) {
  return Math.round(value * 100) / 100;
}

// Mismo formato que muestra la UI, por ejemplo $1234.50.
export function formatCurrency(value) {
  return `$${Number(value).toFixed(2)}`;
}
