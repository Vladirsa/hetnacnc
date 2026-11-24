# Facturación (CFDI) de HETNA: preguntas para el contador

**Para qué es esta hoja:** HETNA cobra por varios conceptos, pero hoy sólo
emite CFDI automático por las suscripciones del Cotizador. Antes de programar
el resto necesitamos que el contador decida, concepto por concepto: si se
factura, a quién, con qué claves del SAT, con qué impuestos y si aplica alguna
retención. No vamos a inventar ninguna regla fiscal: todo queda configurable y
se activa cuando el contador lo apruebe.

---

## 1. Datos de HETNA (para confirmar)

| Pregunta | Respuesta del contador |
|---|---|
| ¿HETNA factura como persona física o moral? ¿Qué régimen fiscal (clave)? | |
| ¿RFC y código postal fiscal con los que se emite? | |
| ¿Hay CSD (sello digital) vigente cargado en Facturapi? ¿Ya está en modo real o sigue en prueba? | |
| ¿Serie y folio por tipo de ingreso (ej. SUS suscripciones, COM comisiones, ENV envíos, CRE créditos)? | |

## 2. Lo que HETNA cobra y cómo se factura hoy

| # | Concepto | Quién paga y cómo | ¿HETNA emite CFDI hoy? |
|---|---|---|---|
| A | **Suscripción del Cotizador** (Taller $299, Pro $599, Industrial $1,199 al mes, IVA incluido) | El taller, con Mercado Pago, PayPal (USD) o Stripe | **Sí, automático.** Nominativo (uso G03) si el taller capturó sus datos; si no, va a la factura global del mes. Clave propuesta 81112106, forma de pago 31, PUE. |
| B | **Comisión por venta en la tienda** (marketplace) | Se descuenta al taller de lo que se le paga por cada pedido | No |
| C | **Comisión por licitación** (Gratis 5 %, Taller 4 %, Pro 3 %, Industrial 2 %) | Mercado Pago la descuenta sola, o se cobra el día 1 (PayPal) | No |
| D | **Licitación cobrada por HETNA** (el taller no tiene cuenta conectada) | El cliente paga el 100 % a HETNA; HETNA paga al taller sin la comisión | No. Los datos para facturar sólo llegan por correo. |
| E | **Créditos de diseño / escaneo 3D** (paquetes) | El cliente final, con Mercado Pago o PayPal | No |
| F | **Envíos HETNA** (guías de paquetería revendidas) | El cliente, con Mercado Pago | No |
| G | **Sobrepesos** de envíos | El cliente o el taller | No |
| H | **Ventas de la tienda propia de HETNA** (cuando HETNA es el vendedor) | El cliente, en la tienda | Las solicitudes de factura llegan como a cualquier vendedor; se timbran a mano |

## 3. Preguntas por concepto (B a H)

Para **cada** concepto, por favor contestar:

1. **¿Se factura?** ¿A quién: al taller, al cliente o a público en general?
2. **¿Factura por cada cobro o una global al mes?**
3. **Clave de producto/servicio del SAT** y **clave de unidad**.
4. **IVA:** ¿16 %? ¿El precio ya lo incluye?
5. **Forma de pago y método** (PUE o PPD). Si es PPD, ¿se necesitan complementos de pago?
6. **Uso del CFDI** que se pone al receptor.

Preguntas específicas:

- **B y C (comisiones):** ¿la factura de la comisión va al taller por cada pedido o una al mes con todas sus comisiones?
- **D (licitación cobrada por HETNA):** HETNA recibe el dinero completo y paga al taller.
  - ¿HETNA sólo factura su comisión y el taller factura el trabajo al cliente?
  - ¿O cómo se documenta ese dinero que pasa por HETNA?
- **F y G (envíos):** ¿es reventa de un servicio de paquetería (clave de transporte) o intermediación?

## 4. Plataformas tecnológicas (posibles retenciones)

HETNA funciona como **plataforma**: talleres (muchos son personas físicas)
venden por hetnacnc.com y cobran a través de ella en algunos casos.

- ¿HETNA está obligada a **retener ISR e IVA** a los talleres personas físicas
  por las ventas que pasan por la plataforma (art. 113-A LISR y 18-J LIVA)?
- Si sí: ¿en qué casos? (pagos que pasan por HETNA, como el concepto D, o
  también cuando el taller cobra directo), ¿qué tasas?, ¿qué **CFDI de
  retenciones** se emite y con qué periodicidad?, ¿qué declaración informativa?
- ¿Los talleres deben estar en el régimen 625 (plataformas tecnológicas)?

## 5. Correcciones

- **Cancelación:** hoy HETNA no puede cancelar sus propias facturas desde el sistema.
  - ¿Qué motivos se van a usar? 01 con sustitución, 02 con errores sin relación, 03 no se llevó a cabo, 04 nominativa relacionada con global.
  - ¿Quién autoriza cada cancelación?
- **Reembolsos:** cuando se devuelve dinero (suscripción, créditos, envío),
  ¿se emite **nota de crédito** (CFDI de egreso) o se cancela la factura?
- **Prorrateo:** si un taller cambia de plan a mitad de mes, ¿cómo se factura la diferencia?

## 6. Lo que ya se puede revisar en el sistema

- Contabilidad de HETNA en el dashboard (**Contabilidad**): CFDI descargados del
  SAT, movimientos, auditor fiscal, semáforo y Excel.
- Suscripciones facturadas: **Contabilidad → Suscripciones**.

---

*Con las respuestas, se programa cada concepto por separado (primero los de
más volumen) y se prueba en modo de prueba de Facturapi antes de timbrar en real.*
