// Reglas de generación de datos sintéticos: única fuente de verdad.
// Cambiar un valor aquí ajusta todas las pruebas sin modificarlas.
export const dataRules = {
  // Marcas que identifican cualquier dato generado, para purgarlo en ambientes compartidos.
  marker: {
    namePrefix: 'QA',
    // Dominio reservado (RFC 2606): nunca pertenece a una persona real.
    emailDomain: 'example.test'
  },

  names: {
    first: ['Ana', 'Luis', 'Marta', 'Jorge', 'Sofía', 'Andrés', 'Camila', 'Diego'],
    last: ['Torres', 'Rojas', 'Gómez', 'Pérez', 'Castro', 'Vargas', 'Ríos', 'Mejía']
  },

  document: {
    // Contrato del API: solo dígitos, entre minDigits y maxDigits.
    minDigits: 8,
    maxDigits: 10,
    // Estructura de un documento válido: prefijo + ejecución + worker + secuencia.
    // Es única por construcción dentro de una ejecución, sin depender del azar.
    prefix: '7',
    runDigits: 3,
    workerDigits: 3,
    sequenceDigits: 3
  },

  // Valores enteros a propósito: la coma flotante (F7) se prueba aparte.
  balance: {
    // Debe cubrir siempre el monto máximo más el cargo de servicio.
    valid: { min: 1000, max: 5000 },
    insufficient: { min: 10, max: 99 }
  },

  operation: {
    amount: { min: 10, max: 500 },
    // Cargo que hoy aplica el backend. PENDIENTE de confirmar con el PO (ver DIAGNOSTICO.md).
    serviceChargeRate: 0.1
  }
};
