# Guía rápida de contabilidad: persona física con actividad empresarial (régimen 612)

Preparada el 15 de noviembre de 2026 para HETNA CNC. **No es asesoría fiscal**: es un resumen para trabajar con tu contador.

- ✔ = verificado en el texto oficial vigente el 15-nov-2026:
  - Ley del ISR (LISR), texto de diputados.gob.mx, última reforma DOF 01-04-2024;
  - Código Fiscal (CFF), última reforma DOF 09-04-2026;
  - Ley del IVA (LIVA), última reforma DOF 12-11-2021;
  - Anexo 8 de la Miscelánea Fiscal 2026, DOF 28-12-2025.
- ⚠ = sacado de fuentes secundarias (despachos y medios fiscales); confírmalo con tu contador.

El detalle completo, con fuentes, está en `reglas-sat-persona-fisica-2026.md`.

## 1. Cómo pagas impuestos

| | Qué es | Cuándo |
|---|---|---|
| **ISR mensual** | Pago provisional. Se toman lo cobrado y lo gastado (deducible) de enero al mes, se aplica la tarifa del mes y se restan los pagos anteriores y lo que te retuvieron ✔ (LISR art. 106; tarifa Anexo 8 RMF 2026) | A más tardar el **día 17** del mes siguiente ✔ |
| **IVA mensual** | IVA que cobraste − IVA que te retuvieron − IVA que pagaste en gastos deducibles. Si sale a favor, lo usas en los meses siguientes ✔ (LIVA art. 5-D) | **Día 17** del mes siguiente ✔ |
| **Declaración anual** | Ajusta el ISR del año; aquí van tus deducciones personales (médicos, colegiaturas, etc.) | **Abril** del año siguiente ✔ (LISR art. 150) |

**Todo cuenta cuando se cobra o se paga**, no cuando se factura ✔ (LISR arts. 102 y 105). Por eso importan el método de pago y el complemento de pago.

## 2. Qué SÍ y qué NO puedes deducir

**Sí**, si es indispensable para el negocio, tiene factura a tu nombre y está pagado ✔ (LISR arts. 103 y 105):
- material, fresas, insertos, refrigerante y mercancía para vender;
- renta del taller, luz, internet, software, publicidad, comisiones de Mercado Pago y PayPal, hosting;
- maquinaria y equipo, poco a poco por depreciación (ver tabla).

**No, o solo en parte:**

| Caso | Regla |
|---|---|
| Pago de más de **$2,000** en efectivo | No deducible. Debe ser transferencia, cheque nominativo, tarjeta o monedero autorizado ✔ (LISR art. 27 fr. III) |
| **Gasolina o diésel** en efectivo | No deducible **aunque sea poco** ✔ (LISR art. 27 fr. III) |
| **Restaurantes** | Solo el **8.5%**, y pagado con tarjeta ✔ (LISR art. 28 fr. XX). Su IVA se acredita en la misma proporción ✔ (LIVA art. 5 fr. I) |
| **Automóvil** | Se deduce hasta **$175,000** ($250,000 si es eléctrico o híbrido) ✔ (LISR art. 36 fr. II) |
| Gasto **sin factura** | No deducible ✔ (LISR art. 27 fr. III) |
| Factura de un proveedor en la **lista 69-B definitiva** | No tiene efectos: ni deducción ni IVA acreditable ✔ (CFF art. 69-B) |
| Multas, recargos, el propio ISR, regalos | No deducibles ✔ (LISR art. 28) |
| Gastos personales | No en el mensual; algunos van en la anual ✔ (LISR art. 151) |

**Depreciación anual** ✔ (LISR arts. 34 y 35):

| Activo | % por año |
|---|---|
| Computadoras, servidores, impresoras | 30% |
| Herramental, moldes, dados, troqueles | 35% |
| Automóviles | 25% |
| Mobiliario y equipo de oficina | 10% |
| Maquinaria CNC si fabricas productos de metal o maquinaria | **8%** |
| Maquinaria CNC si fabricas productos de plástico o haces impresión gráfica | 9% |
| Maquinaria CNC en otras actividades (por ejemplo MDF y letreros) | **10%** |

Si tienes varias actividades, se usa el porcentaje de la que te dio más ingresos el año anterior ✔.

## 3. Reglas para facturar

**Lo obligatorio:**
- La factura tiene que amparar una **operación real**. Una factura de una operación inexistente se considera **falsa** ✔ (CFF art. 29-A fr. IX, nueva desde el 7-nov-2025). Expedirla o usarla puede ser delito ⚠ (CFF art. 113 Bis).
- Los datos del cliente tienen que ir **exactamente** como en su Constancia de Situación Fiscal: RFC, nombre, régimen y código postal ✔ (CFF art. 29-A).
- **Cancelar:** a más tardar en el mes en que se presenta la anual del año en que emitiste la factura, y **solo si el cliente acepta** ✔ (CFF art. 29-A, reformado 7-nov-2025). Ejemplo: una factura de 2026 se cancela, como máximo, en abril de 2027.

**Contado o crédito:**
- **De contado (PUE):** el cliente ya pagó. Pones la forma real de pago (transferencia, tarjeta…).
- **A crédito o en parcialidades (PPD):**
  - la forma de pago va como "99 Por definir" ⚠;
  - cada vez que te paguen, emites un **complemento de pago**, a más tardar el **día 5 del mes siguiente** ⚠;
  - sin complemento, el cliente no puede deducir y tú no tienes bien soportado tu ingreso.
- **Notas de crédito** (descuentos, devoluciones): van relacionadas a la factura que corrigen ⚠ (Anexo 20).

**Casos especiales:**
- **Público en general:** las ventas sin factura van en una **factura global** con el RFC XAXX010101000 ⚠ (periodicidad según la Miscelánea).
- **Clientes del extranjero:**
  - RFC XEXX010101000;
  - IVA 0% solo en exportación real: bienes con pedimento, o servicios e intangibles aprovechados en el extranjero que encajen en el art. 29 de la LIVA ✔;
  - maquinar piezas para un cliente extranjero lleva 16% salvo excepciones ⚠.

## 4. Calendario

| Cuándo | Qué |
|---|---|
| Cada vez que cobras | Factura (o inclúyelo en la global) |
| **Día 5** de cada mes | Complementos de pago de lo cobrado el mes anterior ⚠ |
| **Día 17** de cada mes | ISR provisional e IVA del mes anterior ✔ |
| Antes de pagarle a un proveedor | Revisa su factura en el **semáforo** del dashboard |
| **Abril** | Declaración anual del año anterior ✔. Último mes para cancelar facturas de ese año ✔ |
| Siempre | Conserva XML y papeles **5 años** desde la declaración ✔ (CFF art. 30) |

## 5. Checklist mensual (para el día 10)

1. [ ] Que estén en el sistema todas las facturas del mes, emitidas y recibidas.
2. [ ] Complementos de pago emitidos por todo lo cobrado a crédito (día 5).
3. [ ] Revisar la pestaña **Auditoría**: que no haya hallazgos graves.
4. [ ] Revisar "Lo que no se dedujo y por qué" en el Resumen.
5. [ ] Marcar como inversión las compras de maquinaria o equipo, con su tipo de activo.
6. [ ] Subir los cobros sin factura (plantilla de Excel) o emitir la factura global.
7. [ ] Descargar el Excel y mandárselo a tu contador.
8. [ ] Presentar ISR e IVA a más tardar el **día 17**.

## 6. Qué hace el sistema hoy y qué falta

**Hace:**
- lee tus facturas (XML o ZIP) y calcula el ISR y el IVA de cada mes;
- genera el Excel con fórmulas, sube movimientos sin factura y da una liga para Excel o Google Sheets conectados;
- audita todos los días con reglas fiscales y forenses:
  - lista 69-B y no localizados del SAT;
  - estatus de cada factura en el SAT;
  - duplicados y patrones raros;
- tiene el semáforo antes de pagar.

**Todavía no:**
- **Las facturas no entran solas.** Por ahora se suben a mano: falta conectar la descarga masiva del SAT (necesita tu e.firma), Facturapi y la tienda.
- **RESICO** no está soportado; solo el régimen 612.
- No considera **pérdidas de años anteriores, PTU pagada ni estímulos** (por ejemplo frontera norte).
- **No presenta nada ante el SAT.** Tu contador revisa y presenta.
- La consulta de estatus al SAT ya se probó, pero solo con una factura inventada. Falta la primera prueba con una factura real: sube una al semáforo y debe salir "Vigente".

## 7. Lo que tu contador tiene que confirmar

1. **Retenciones como plataforma.** Si hetnacnc tiene que retener ISR e IVA a los talleres que venden en el marketplace (LISR 113-A y siguientes; LIVA 18-J), y con qué tasa.
   - La investigación reporta que para 2026 la retención subió de 1% a 2.5%. Pero el texto de la LISR publicado por la Cámara de Diputados muestra como última reforma la de abril de 2024.
   - Hay que confirmar si el cambio está en otra ley (por ejemplo la Ley de Ingresos 2026) o si la fuente se equivocó.
   - También depende de si HETNA cobra el dinero por cuenta del taller.
2. **Dinero de terceros.** Que el dinero que HETNA cobra por cuenta de los talleres en las licitaciones no es ingreso tuyo, y cómo se factura.
3. **Reglas de facturación sin verificar:** la forma de pago "99" en PPD, el plazo del complemento de pago, la periodicidad de la factura global y la cancelación sin aceptación (las ⚠ de la sección 3).
4. **Porcentaje de depreciación de tus máquinas:** 8% o 10%, según tu actividad principal.
5. **RESICO:** si te conviene. Paga del 1% al 2.5% sobre lo cobrado, sin deducciones; para negocios de margen alto como diseños o software, suele salir más barato ⚠.
