# HETNA CNC · Módulos tipo SAP · Fase 0: análisis de lo que ya existe

**Fecha:** 22 de noviembre de 2026.

**Fuentes revisadas:**
- El código de `hetnacnc.com`: tienda, backend, panel de administración y panel de talleres.
- El código de la app del Cotizador (Flutter + Supabase, repositorio `Vladirsa/Cotizador`).

**Lo que no se revisó:** la base de datos en vivo ni el `.env` de producción. Lo que depende de ellos está marcado **POR VERIFICAR**, con la consulta que lo resuelve.

**Regla:** no se escribe código de ningún módulo hasta que Hetna apruebe este informe.

---

## 1. Resumen en 6 puntos

1. **HETNA tiene mucho más de lo que dice el documento de la idea.** La app del Cotizador ya tiene casi todo para la operación de un taller:
   - gastos con datos del SAT;
   - inventario con descuento de material por pedido;
   - **costo real por pedido y rentabilidad** contra lo cotizado (por pedido, por máquina, por cliente y por material);
   - **mantenimiento de máquinas** por horas o por días;
   - 6 roles de usuario;
   - reportes en Excel, con una utilidad simple.

   HETNA, por su parte, tiene un **módulo de contabilidad propio**: descarga del SAT, cálculo de ISR e IVA y auditor fiscal.
2. **El problema real es que todo está repartido, no que falte.**
   - Las ventas viven en 3 sistemas que no se hablan: los pedidos de la tienda (Medusa), las licitaciones y los pedidos de la app (Supabase).
   - Las cotizaciones están en 3 lugares, los clientes en 3, los trabajos en 4, las máquinas en 3 y el motor de precios copiado en 3 o 4.
3. **Faltan de verdad 4 cosas:**
   - proveedores y órdenes de compra;
   - asignar cada trabajo a una máquina y a un operador;
   - una revisión de calidad con medidas que bloquee la entrega;
   - registro de paros de máquina.
4. **Hay un riesgo de dinero activo:** un pedido de la tienda que se **reembolsa sin cancelarse** se le sigue liberando al taller (`packages/api/src/lib/saldos-talleres.ts`, `liberarVencidos`).
5. **Hay huecos de CFDI:**
   - HETNA no emite factura por sus comisiones, por los créditos ni por los envíos;
   - no hay retenciones;
   - HETNA no puede cancelar sus propias facturas;
   - no hay prorrateo al cambiar de plan;
   - no hay notas de crédito por reembolsos.

   Esto **requiere al contador**.
6. **La recomendación es no crear módulos nuevos al lado,** sino:
   - (a) arreglar los riesgos;
   - (b) completar lo que ya existe en la app del Cotizador, que es donde viven los talleres;
   - (c) dar al panel de HETNA **vistas que junten** los 3 sistemas, sin mover datos.

---

## 2. Mapa actual: lo que existe, quién lo usa y dónde guarda los datos

| Pieza | Qué hace | Usuarios | Dónde guarda | Se conecta con |
|---|---|---|---|---|
| **Tienda / marketplace** (Mercur/Medusa) | Catálogo, carrito, pedido, pago, envío, comisión de Mercur | Cliente, taller (vendedor) | Postgres de Medusa (`order`, `order_seller`) | Mercado Pago, PayPal, Skydropx, saldo de talleres |
| **Saldo de talleres** | Pendiente → disponible → pagado (SPEI manual) | Admin, taller | `hetna_saldo_taller` | Pedidos de Medusa (solo creado y cancelado) |
| **Licitaciones / fabricación a medida** | Solicitud → propuestas → elegir → anticipo y resto → 5 hitos con fotos → entrega; SafeDeal y disputa | Cliente, taller, admin | `hetna_solicitud`, `hetna_propuesta`, `hetna_solicitud_pago`, `hetna_solicitud_hito` | MP / PayPal / Stripe; **no crea pedido de Medusa** |
| **Estimados en /cotizar** | Rango de precio al instante y seguimiento los días 2 y 7 | Cliente | `hetna_estimado` | Correos |
| **App del Cotizador** (Flutter) | Cotizaciones, pedidos con avances, costo real, gastos, inventario, mantenimiento, reportes, CRM, catálogo, marketing, posventa, citas, página en línea, roles | Taller y su equipo | Supabase (`negocios`, `cotizaciones`, `pedidos`, `pedido_costos`, `gastos`, `inventario_bodega`, `movimientos_inventario`, `maquinaria`, `mantenimiento_*`, `clientes`…) | Backend de hetnacnc.com (planes, CFDI, MP del taller) |
| **Suscripciones del Cotizador** | Planes Gratis, Taller $299, Pro $599 e Industrial $1,199; prueba de 14 días; renovación; cancelación | Taller | Supabase `negocios` y `hetna_cobro_suscripcion` | MP, PayPal, Stripe; CFDI de HETNA |
| **Módulo Medusa "cotizador"** | Cotización formal con partidas y PDF | Taller (tienda) | `cotizador_perfil`, `cotizador_cotizacion` | **No se puede aceptar ni cobrar** |
| **Esquema viejo `taller.*`** | Cotizaciones y cuentas antiguas | — | `taller.cotizaciones`, `taller.cuentas` | Marcado en el código como "camino a retirar" |
| **CFDI del taller** | Cada taller timbra con su propio certificado; cancela y sustituye con motivo 01 | Taller | Supabase `cfdi_emitidos` | Facturapi (por omisión en **modo prueba**) |
| **CFDI de HETNA** | Facturas de suscripciones: nominativas, o factura global mensual | HETNA | Contabilidad | Facturapi |
| **Contabilidad de HETNA** | Descarga del SAT con e.firma, XML, ISR e IVA de flujo, auditor fiscal, semáforo, Excel | Dueño y contador | `lib/conta/*`, `hetna_conta_movimiento` | SAT |
| **Envíos** | Guías, rastreo, sobrepesos, saldo de Skydropx | Taller, admin | `hetna_guia`… | Skydropx |
| **Trabajos CAM / Escanear** | Servicios con estados y entregables | Cliente, admin | `cam_job`, `hetna_escanear` | B2 privado |
| **CRM repartido** | Clientes, prospectos, WhatsApp, radar, marketing | Admin | Medusa, Supabase, n8n, Google Sheets | — |
| **Panel HETNA y Centro de control** | Roles del equipo (dueño, operaciones, ventas, finanzas, soporte), ventas, avisos | Equipo interno | `user.metadata.panel_rol` | Todo |
| **Operación técnica** | Respaldo diario cifrado (restic a B2), despliegue seguro, vigilancia de saldos, disco y SSL | Dueño | Servidor | Telegram vía n8n |

---

## 3. Mapa SAP corregido (contra la página 4 del documento)

| SAP | El documento decía | **Lo que hay en el código** | Decisión recomendada |
|---|---|---|---|
| **SD Ventas** | Parcial | **Parcial, en 3 sistemas separados**: pedidos de Medusa, licitaciones y pedidos del Cotizador. La cotización del módulo Medusa no se puede aceptar. | **Completar**: una vista única "Ventas" en el panel que lea los 3, con estado de pago, factura y entrega. No mover datos. |
| **MM Materiales** | Parcial | **Parcial en la app**: inventario con mínimos, retazos y descuento por pedido. **Sin** proveedores, órdenes de compra, recepción ni ubicación. El stock es número entero; el `pedido_id` del movimiento existe pero no se llena; se actualiza sin transacción. | **Completar en la app**: catálogo de proveedores, orden de compra simple → recepción → entrada; llenar `pedido_id`; cantidades decimales; actualización segura. |
| **FI Finanzas** | Parcial | **Más de lo que se pensaba**: HETNA ya emite CFDI de suscripciones y tiene contabilidad propia. **Faltan**: CFDI de comisiones, créditos y envíos; retenciones; cancelación del lado de HETNA; notas de crédito; prorrateo. | **Completar con el contador.** Primero confirmar qué está en vivo (modo de Facturapi). |
| **CRM Clientes** | Parcial | **Parcial y repartido** en 4 lugares (Medusa, Supabase, n8n, Google Sheets). La app sí tiene CRM con bitácora de contactos. | **Ficha única como vista** (Fase 3), sin duplicar la del taller. |
| **CO Costos** | Parcial: "crear la vista" | **Ya existe en la app**: `pedido_costos` (máquina, material, operador), rentabilidad por pedido, máquina, cliente y material, y tiempo estimado contra real. | **Reutilizar.** Solo llevar un resumen al panel de HETNA si se quiere comparar talleres. |
| **PP Producción** | No existe | **Parcial**: estados del pedido con acciones por rol (operador, vendedor, almacenista), avances con quién lo hizo, hitos con fecha planeada contra real en licitaciones, etapas del taller. **Falta**: asignar máquina y operador, cola y carga de máquina. | **Crear ligero, dentro de la app**: máquina y operador por pedido, y vista de cola por máquina. |
| **QM Calidad** | No existe | **Parcial**: paso "aprobar o regresar calidad" del operador en la app; hito "Inspección" con fotos en licitaciones; fotos del paquete; certificaciones; posventa. **Falta**: checklist de medidas contra tolerancia que bloquee la entrega. | **Completar ligero**: checklist de medidas (el mismo patrón que ya usa Escanear) y no dejar marcar "Entrega" sin él. |
| **PM Mantenimiento** | No existe | **Ya existe en la app**: máquinas con horas, tareas cada N horas o días, registros con costo y aviso diario. **Falta**: paros y su causa, y refacciones. | **Completar**: registro de paros (tiempo muerto y causa). |
| **WM Almacén** | No existe | **No existe** (solo existencias de Medusa para vender). | **Después, muy ligero**: un campo "ubicación" en el inventario de la app. |
| **HCM Personal** | No existe | **Parcial**: roles del equipo de HETNA en el panel; equipo de empresas compradoras; 6 roles por taller en la app. | **Endurecer, no crear**: aplicar los roles también en la base de datos. Nómina, no. |
| **TR Tesorería** | No existe | No existe (la contabilidad calcula sobre flujo de efectivo). | **No incorporar.** Basta una vista simple de flujo. |
| **PS Proyectos** | No existe | No existe. | **No incorporar.** Un encargo grande se maneja como pedido con hitos (ya existe). |
| **BASIS** | Parcial | **Bien resuelto**: respaldos diarios con restic y prueba de restauración, despliegue seguro, vigilancia. | **No crear módulo.** Ver riesgos de permisos (§5). |
| **ABAP** | No aplica | — | No aplica. |

---

## 4. Duplicados: qué se queda como la única verdad

| Dato | Dónde está hoy | Recomendación |
|---|---|---|
| **Cotizaciones** | Supabase (app), módulo Medusa `cotizador`, esquema viejo `taller.*` | La **app (Supabase)** es la única para talleres. Retirar `taller.*` y dejar de usar el módulo Medusa, o limitarlo a la tienda. |
| **Clientes del taller** | Supabase `clientes`, `hetna_cloud_cliente`, clientes de la tienda | La **app** para los clientes del taller. Medusa solo para cuentas de la tienda. |
| **Trabajos / pedidos** | Medusa, `hetna_solicitud`, Supabase `pedidos`, `cam_job` | Cada uno se queda donde nace. **La vista "Ventas" los junta**; no se copian. |
| **Máquinas** | Supabase `maquinaria`, metadata del CAM Studio, texto del registro de talleres | La **app** como fuente. El registro y el CAM la leen. |
| **Materiales** | Inventario de la app, `hetna_precio_material` (precios de mercado), texto en propuestas | La **app** para existencias. `hetna_precio_material` se queda como referencia de precios. |
| **Motor de precios** | 3 o 4 copias en el backend y en la app | Unificar en una sola fuente compartida (trabajo técnico, sin cambio visible). |
| **Escaneo 3D** | `escaneo_3d` (servicio de pago) y `hetna_escanear` (ingeniería inversa) | Son productos distintos. Se quedan los 2 con nombres claros. |

---

## 5. Huecos con riesgo

**Dinero:**
1. **Reembolso que no cancela el pago al taller** (`saldos-talleres.ts`): si un pedido se reembolsa sin cancelarse, el saldo pasa a disponible y se paga. *Arreglo chico; recomiendo hacerlo primero.*
2. **La liquidación de licitaciones** no entra al saldo de talleres: solo manda un aviso y deja una fecha.
3. **HETNA recibe el 100 % del dinero de los pedidos de la tienda** (dinero de terceros) sin registro contable de ese paso.

**Facturación (CFDI), con el contador:**

4. HETNA no emite CFDI por sus **comisiones**, **créditos 3D**, **Envíos HETNA** ni **sobrepesos**.
5. **Sin retenciones** de ISR e IVA (persona moral) ni de plataformas (113-A / 18-J) al emitir. Que apliquen o no es decisión del contador.
6. **HETNA no puede cancelar** sus facturas (el taller sí puede, con motivo 01).
7. **Sin prorrateo** al cambiar de plan: los días ya pagados se pierden.
8. **Sin notas de crédito (tipo E)** por reembolsos.
9. **Licitación cobrada por HETNA**: los datos para facturar solo llegan en un correo; no hay forma de emitir ni subir el CFDI.

**Datos y permisos:**

10. **21 tablas de la app no tienen su CREATE TABLE en el repositorio** (`negocios`, `gastos`, `inventario_bodega`, `maquinaria`…). Si hubiera que rehacer Supabase, no se podría desde el código. *Exportar el esquema en vivo y guardarlo.*
11. **Los roles de la app y el límite de usuarios solo se aplican en la app**, no en la base de datos. Además, si el taller nunca configura permisos, todos los usuarios ven todo.
12. **Roles del panel de HETNA**: mientras ningún admin tenga `panel_rol`, todos son dueño, y las llaves de API de admin (n8n, bot de WhatsApp) entran con acceso total.
13. **El inventario se actualiza sin transacción**: 2 usuarios a la vez pueden dejar mal el stock.

**Promesas que no se cumplen:**

14. **Exportar o borrar los datos del taller**: lo promete el aviso de privacidad y no existe.
15. **"Llave de API" del plan Industrial**: anunciada, sin código.
16. **CFDI en la app**: el código existe, pero se anuncia como "próximamente" y Facturapi está en **modo prueba** por omisión.

**Documentos:** faltan los Términos del Cotizador y la Licencia de diseños digitales (lo dice el documento de la idea; no se revisó el contenido legal).

---

## 6. POR VERIFICAR, y cómo se resuelve

| Qué | Cómo confirmarlo (en el servidor) |
|---|---|
| ¿Facturapi está en modo real o de prueba? | `grep '^FACTURAPI_MODO' packages/api/.env` |
| ¿Hay cobros y facturas reales de suscripciones? | Contar filas de `hetna_cobro_suscripcion` y de facturas de HETNA |
| ¿Stripe, PayPal y MP están activos en vivo? | Revisar las llaves en `.env` (sin mostrar valores) |
| El esquema real de las 21 tablas de la app | Exportar el esquema de Supabase (`pg_dump --schema-only`) |
| ¿El CHECK de estados de pedido acepta `Pago50` y `PagoCompleto`? | Consulta en Supabase |
| ¿Los talleres usan el inventario de Mercur en el panel de vendedor? | Contar existencias con cambios recientes |
| ¿Algún admin ya tiene `panel_rol`? | Consulta a `user.metadata` |

---

## 7. Plan por fases (ajustado a lo encontrado)

> Sin fechas ni precios, como pide el documento. El tamaño es relativo: **chico** = días, **mediano** = 1–2 semanas, **grande** = más.
> Cada paso se prueba con el taller de HETNA antes de abrirlo. La app del Cotizador es otro repositorio: los cambios ahí van en su propia publicación.

**Fase 1: Núcleo (Ventas, Materiales, Finanzas)**

| # | Qué | Dónde | Tamaño | Requiere |
|---|---|---|---|---|
| 1.1 | Arreglar el pago al taller de pedidos reembolsados | hetnacnc.com | Chico | Nada |
| 1.2 | **Vista "Ventas"** en el panel: pedidos de la tienda, licitaciones y pedidos de la app en una sola lista, con estado de pago, factura y entrega (solo lectura) | Panel HETNA | Mediano | Nada |
| 1.3 | **Exportar los datos del taller** (cumplir el aviso de privacidad) | Backend + app | Mediano | Nada |
| 1.4 | **Proveedores y orden de compra simple** → recepción → entrada al inventario; llenar el pedido en cada movimiento; cantidades con decimales; actualización segura | App del Cotizador + Supabase | Mediano | Probar con el taller de HETNA |
| 1.5 | Guardar en el repositorio el esquema real de Supabase | Repo Cotizador | Chico | Acceso a Supabase |
| 1.6 | **CFDI de HETNA**: comisiones, créditos, envíos; cancelación con motivo 01; notas de crédito; retenciones si aplican; prorrateo | hetnacnc.com | Grande | **Contador** |

**Fase 2: Taller (Producción, Calidad, Mantenimiento, Costos)**

| # | Qué | Dónde | Tamaño |
|---|---|---|---|
| 2.1 | Máquina y operador por pedido, y **cola por máquina** (qué sigue, en qué máquina y para cuándo) | App | Mediano |
| 2.2 | **Checklist de calidad** con medidas contra tolerancia y foto; no deja marcar "Entrega" sin aprobarlo | App (y hitos de licitación) | Mediano |
| 2.3 | **Paros de máquina**: tiempo muerto, causa y refacciones | App | Chico |
| 2.4 | Costos: **ya existen**; solo un resumen por taller en el panel de HETNA, si se quiere | Panel | Chico |

**Fase 3: Crecimiento (Clientes, Almacén, Personal)**

| # | Qué | Dónde | Tamaño |
|---|---|---|---|
| 3.1 | **Ficha única** de cliente, taller y proveedor (vista que junte Medusa, Supabase, prospectos y WhatsApp) con siguiente acción | Panel | Grande |
| 3.2 | Ubicación simple en el inventario | App | Chico |
| 3.3 | Roles y límite de usuarios también en la base de datos; roles del panel obligatorios | App + backend | Mediano |

**No se incorpora:** Tesorería avanzada, Proyectos (PS), almacén avanzado (EWM), nómina y evaluaciones (SuccessFactors), BASIS y ABAP como módulos. Lo que ya existe cubre lo necesario para el tamaño actual de HETNA.

**Para el usuario final:** nombres de HETNA (Ventas, Materiales, Producción, Calidad, Mantenimiento, Clientes), nunca siglas de SAP.

---

## 8. Decisiones que quedan de Hetna

1. **Aprobar o corregir este informe** antes de cualquier código.
2. **¿Arreglo ya el riesgo 1.1** (pago al taller de pedidos reembolsados)? Es dinero real y el arreglo es chico.
3. **La única verdad**: ¿confirmas que la app del Cotizador es la fuente de cotizaciones, clientes, máquinas e inventario de los talleres, y que se retiran el esquema viejo `taller.*` y el uso del módulo Medusa "cotizador"?
4. **Taller de prueba** para las Fases 1.4 y 2: ¿el taller de HETNA?
5. **Contador**: agendar la revisión de los CFDI de la Fase 1.6.
6. **Proveedores**: ¿con panel propio en Fase 3 o solo ficha interna?
