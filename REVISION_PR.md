# Revisión del pull request

**Archivo revisado:** `review-target/payment-helper.js` (30 líneas, dos funciones exportadas: `createPayment` y `createSecondPayment`).

**Decisión: ❌ RECHAZAR.** El sustento está al final del documento.

## Resumen de hallazgos

| # | Ubicación | Hallazgo | Severidad |
|---|---|---|---|
| 1 | L1, L11, L26 | Contraseña de administrador quemada en el código | **Crítica** |
| 2 | L2, L5, L20 | La automatización apunta a **producción** | **Crítica** |
| 3 | L2 | Credenciales enviadas por HTTP sin cifrar | **Alta** |
| 4 | L14–16, L29 | La validación devuelve `true` aunque el pago falle (falso positivo) | **Alta** |
| 5 | L7–9, L22–24 | Datos personales con apariencia real y quemados | **Alta** |
| 6 | L6, L13, L21, L28 | Esperas fijas de 13 s por pago | **Alta** |
| 7 | L19–30 | `createSecondPayment` es una copia de `createPayment` | Media |
| 8 | Todo el archivo | Sin Page Object: navegación, autenticación, datos y verificación mezclados | Media |
| 9 | L4, L19 | Funciones que devuelven un booleano en vez del pago creado | Baja |

## Hallazgos

### 1. Contraseña de administrador quemada en el código — Crítica

- **Ubicación:** L1 (`const adminPassword = '…'`; el valor se omite a propósito en esta revisión), usada en L11 y L26.
- **Descripción:** la contraseña de una cuenta de administrador está en texto plano en el repositorio.
- **Riesgo e impacto:**
  - Cualquiera con acceso al repositorio, a un fork o a un log obtiene privilegios de administrador.
  - Quedó en el historial de la rama: borrarla en un commit posterior **no** la elimina.
  - Las pruebas operan como administrador en lugar de como el usuario real del flujo de pagos. Pueden saltarse validaciones que un cliente sí tendría y dar una falsa cobertura.
- **Recomendación:**
  - **Rotar la contraseña de inmediato**: se considera comprometida.
  - Leerla de un secreto del pipeline (`process.env.PAYMENTS_TEST_PASSWORD`, configurado en el ambiente de GitHub).
  - Usar una **cuenta de prueba con mínimo privilegio**, no la de administrador.
  - Autenticarse una sola vez en un proyecto de setup y reutilizar la sesión (`storageState`), no en cada pago.
  - Agregar escaneo de secretos al pipeline (por ejemplo `gitleaks`) para que esto no vuelva a llegar a un PR.

### 2. La automatización apunta a producción — Crítica

- **Ubicación:** L2 (`const baseUrl = 'http://production.internal.local'`), usada en L5 y L20.
- **Descripción:** el helper navega al ambiente de producción y envía pagos.
- **Riesgo e impacto:**
  - Cada ejecución crea **pagos reales**: impacto financiero, movimientos a nombre de un tercero, datos contaminados y posibles incumplimientos regulatorios.
  - Un CI que lo ejecute en cada PR lo haría decenas de veces al día.
- **Recomendación:**
  - Eliminar la URL del código y usar rutas relativas (`page.goto('/payments')`) con el `baseURL` que define `playwright.config.js` por ambiente (`BASE_URL`).
  - Como barrera adicional, que la configuración rechace explícitamente cualquier URL de producción.

### 3. Credenciales por HTTP sin cifrar — Alta

- **Ubicación:** L2 (`http://` en lugar de `https://`).
- **Descripción:** el formulario envía la contraseña (L11) sin TLS.
- **Riesgo e impacto:** la credencial viaja en claro y puede interceptarse en la red interna. Se suma al hallazgo 1.
- **Recomendación:** todo ambiente que reciba credenciales debe usar HTTPS. Al resolver el hallazgo 2, la URL vendrá de la configuración del ambiente, que debe ser `https://`.

### 4. La validación devuelve `true` aunque el pago falle — Alta

- **Ubicación:** L14–16 (`if (result) return true`) y L29 (`!== ''`).
- **Descripción:** el resultado depende solo de que `.message` tenga **algún** texto.
  - Un mensaje de error ("Pago rechazado", "Saldo insuficiente") también es texto, así que la función responde `true`.
  - El `return false` es prácticamente inalcanzable: si `.message` no existe, `textContent()` espera y lanza una excepción en vez de devolver `false`.
  - Las dos funciones validan con criterios distintos.
- **Riesgo e impacto:** **falsos positivos**. La prueba pasa aunque el pago falle, y el equipo cree tener cobertura del flujo de pagos sin tenerla. Es el peor tipo de defecto en automatización, porque es silencioso.
- **Recomendación:**
  - Validar el **resultado de negocio esperado** con aserciones que reintentan, por ejemplo `await expect(paymentsPage.message).toHaveText(/aprobado/)`.
  - Devolver el pago creado y confirmarlo por API: monto, cliente y estado.
  - Un helper no debe esconder la causa de un fallo detrás de un booleano.

### 5. Datos personales con apariencia real y quemados — Alta

- **Ubicación:** L7–9 y L22–24: documento, nombre y correo de una persona (los valores se omiten a propósito en esta revisión).
- **Descripción:** el documento tiene formato de cédula real, el nombre es de persona real y el correo usa un dominio público real.
- **Riesgo e impacto:**
  - Si corresponden a una persona real, se tratan sus datos sin autorización, en contra de la normativa de protección de datos (en Colombia, por ejemplo, la Ley 1581 de 2012).
  - El sistema podría enviar notificaciones de pago a un correo real.
  - Al estar quemados, la segunda ejecución choca con la primera (documento duplicado) y las pruebas dejan de ser independientes.
- **Recomendación:** usar el generador de datos sintéticos del proyecto (`dataFactory.validClient()`): datos únicos por ejecución, correos en `example.test` (dominio reservado) y marcadores para purgarlos.

### 6. Esperas fijas de 13 s por pago — Alta

- **Ubicación:** L6 y L21 (`waitForTimeout(5000)`), L13 y L28 (`waitForTimeout(8000)`).
- **Descripción:** se espera un tiempo fijo en lugar de una condición.
- **Riesgo e impacto:**
  - **Inestable:** si el pago tarda más de 8 s, se lee el mensaje antes de tiempo.
  - **Lento:** si tarda 1 s, se desperdician 12. Con 100 pagos son más de 20 minutos de suite solo esperando.
  - La espera de L6 sobra: `fill()` ya espera a que el campo esté listo.
- **Recomendación:** eliminar todos los `waitForTimeout`.
  - Esperar la respuesta real del API de pagos (`page.waitForResponse`) y usar aserciones web-first.
  - Activar la regla `playwright/no-wait-for-timeout` de `eslint-plugin-playwright` para bloquearlo en el PR.

### 7. Código duplicado — Media

- **Ubicación:** L19–30. `createSecondPayment` repite línea por línea `createPayment`, salvo la validación.
- **Riesgo e impacto:** un cambio de selector o de flujo exige editar dos lugares, y ya divergieron (hallazgo 4). El nombre tampoco explica qué tiene de distinto un "segundo pago".
- **Recomendación:** una sola función. Si la intención es probar pagos repetidos o idempotencia, llamarla dos veces desde una prueba con nombre explícito.

### 8. Sin Page Object y responsabilidades mezcladas — Media

- **Ubicación:** todo el archivo.
- **Descripción:**
  - Una sola función navega, se autentica, construye los datos, envía y "verifica".
  - Los selectores son técnicos (`#customer-document`, `.message`) y están repetidos.
  - `.message` es una clase genérica: si la página tiene más de un elemento con esa clase, Playwright falla por *strict mode*.
- **Recomendación:** un Page Object `PaymentsPage` con localizadores por etiqueta o rol, que haga solo las acciones de la página. Los datos vienen de la fábrica, la autenticación del setup y las aserciones viven en la prueba (ver el ejemplo de abajo).

### 9. Devuelve un booleano en vez del pago — Baja

- **Ubicación:** firmas de L4 y L19.
- **Descripción:** quien llama solo recibe `true` o `false`, sin ID ni estado del pago.
- **Riesgo e impacto:** impide confirmar el registro por API o encadenar validaciones, y empuja a la prueba a confiar en el booleano roto del hallazgo 4.
- **Recomendación:** devolver la respuesta del API (ID, estado, monto) y documentar la función.

## Cómo debería verse

Patrón ya usado en este repositorio (`tests/support/pages/operations-lab-page.js`). Las etiquetas son ilustrativas y hay que ajustarlas a la UI real de pagos.

```js
// tests/support/pages/payments-page.js
export class PaymentsPage {
  constructor(page) {
    this.page = page;
    this.document = page.getByLabel('Documento');
    this.name = page.getByLabel('Nombre');
    this.email = page.getByLabel('Correo');
    this.amount = page.getByLabel('Monto');
    this.password = page.getByLabel('Contraseña');
    this.submit = page.getByRole('button', { name: 'Pagar' });
    this.message = page.getByRole('status');
  }

  async open() {
    await this.page.goto('/payments'); // baseURL del ambiente, nunca producción
  }

  // Devuelve el pago registrado para que la prueba lo confirme por API.
  async pay(customer, amount) {
    await this.document.fill(customer.document);
    await this.name.fill(customer.name);
    await this.email.fill(customer.email);
    await this.amount.fill(String(amount));
    await this.password.fill(process.env.PAYMENTS_TEST_PASSWORD); // secreto del pipeline, cuenta de prueba
    const [response] = await Promise.all([
      this.page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/payments')),
      this.submit.click()
    ]);
    return response.json();
  }
}

// En la prueba: datos sintéticos, resultado de negocio y confirmación por API.
const payment = await paymentsPage.pay(dataFactory.validClient(), dataFactory.operationAmount());
await expect(paymentsPage.message).toHaveText(`Pago ${payment.id} aprobado`);
expect(await api.getPayment(payment.id)).toMatchObject({ status: 'APPROVED' });
```

## Decisión final

**❌ Rechazar el pull request** (no "solicitar cambios").

1. **Los dos hallazgos críticos impiden integrarlo en cualquier forma.** Ejecutarlo aunque sea una vez crea pagos reales en producción con una cuenta de administrador.
2. **"Solicitar cambios" no resuelve el problema de seguridad.** La contraseña ya está en el historial de la rama, y corregirla en un commit nuevo la deja expuesta. Hay que cerrar el PR, **rotar la credencial** y eliminar la rama.
3. **El diseño no se arregla con ajustes puntuales.** La validación siempre exitosa, los datos quemados, las esperas fijas y el código duplicado obligan a reescribirlo. Hacerlo sobre los componentes que ya existen (Page Object, fábrica de datos, fixtures, `baseURL` por ambiente) toma menos de lo que costaría corregir este archivo.

**Acciones inmediatas:**

| Acción | Responsable | Cuándo |
|---|---|---|
| Rotar la contraseña de administrador y revisar su uso reciente | Seguridad / dueño de la cuenta | Hoy |
| Cerrar el PR y eliminar la rama | Autor | Hoy |
| Sesión de pair programming para reimplementarlo con los patrones del repositorio | Autor + líder QE | Esta semana |
| Barreras en CI para que no se repita: escaneo de secretos, `no-wait-for-timeout`, bloqueo de URLs de producción y checklist en la plantilla de PR | Líder QE | Próximo sprint |

**Nota para el autor:** los comentarios son sobre el código, no sobre la persona. Los riesgos más graves (credenciales y ambiente) son fáciles de cometer cuando no hay barreras automáticas que los detecten, y esa parte es responsabilidad del equipo de QE. Por eso la última acción queda a cargo del líder.
