# Facturación (CFDI) y envíos: alternativas (15 nov 2026)

Investigación de escritorio con búsqueda web. Varias páginas de proveedores no se pudieron abrir directamente desde la sesión, así que **las cifras hay que confirmarlas** con cada proveedor antes de decidir.

## Facturación CFDI 4.0 por API

| Proveedor | Precio público encontrado | Un emisor por taller (su propio CSD) | API |
|---|---|---|---|
| **Facturapi** (actual) | $299/mes + $0.60 por timbre, IVA incluido | Sí, organizaciones sin costo extra | REST, SDK de Node, llaves de prueba y producción |
| **Facturama** | API $1,650/año + folios a $0.40–0.50 (vencen al año) | Sí ("API Multiemisor") | REST, SDK, sandbox |
| **FiscalAPI** | Desde $199/mes con multi-RFC; precio por timbre no publicado | Sí ("Personas") y transferencia de timbres | SDK de Node, ambientes de prueba y producción |
| **SW Sapien** | $1.89 a $0.24 por timbre según volumen (fuente de terceros) | No verificado | REST, SDK de Node, sandbox |
| **Finkok** | Dato antiguo; verificar vigencia en la lista de PAC del SAT | Sí | SOAP |

Con unos 650 timbres al mes (20 talleres × 30 más 50 de HETNA):
- Facturapi: unos $689 al mes.
- Facturama: unos $463 al mes.

**Recomendación:** quedarse en Facturapi por ahora y completar en nuestro código lo que falta:
- motivos de cancelación 01 (con sustitución) y 04;
- complemento de pagos;
- retenciones según el tipo de emisor y receptor.

Migrar costaría unos 3 a 5 días, obligaría a los talleres a volver a subir su CSD y solo ahorraría unos $200 al mes. Hay que reconsiderarlo arriba de unos 3,000 timbres al mes; la alternativa a cotizar es **FiscalAPI**.

Riesgo: en octubre de 2026 el SAT revocó 5 PAC. Hay que preguntar a cada proveedor qué PAC usa y si tiene respaldo.

Pendiente aparte: **HETNA no factura sus propias suscripciones** del Cotizador (ver `docs/legal/respuestas-2026-11-14.md`).

## Envíos: Skydropx (actual) vs Envia.com

| | Skydropx | Envia.com |
|---|---|---|
| Paqueterías | Más de 20 (FedEx, Estafeta, DHL, Paquetexpress, Redpack) | Más de 100 (incluye 99minutos; J&T solo con origen en CDMX y Estado de México) |
| API | REST con OAuth, webhooks y sandbox | REST, recolección y manifiesto, webhooks, guía para marketplace multivendedor |
| Sobrepesos | Aclaración desde el panel | Se descuentan sin aviso, hasta 60 días hábiles después; hay quejas en reseñas |
| Precios | No publicados | No publicados |

En el código, Skydropx vive en `packages/api/src/modules/skydropx/` y lo usan `lib/guias.ts`, `lib/saldos.ts` y la cotización de envíos. Costo estimado:
- Cambiar a Envia.com: unos 3 a 4 días.
- Tener los dos proveedores con una interfaz común: unos 5 a 7 días.

**Recomendación:** mantener Skydropx. Antes de cambiar, cotizar 10 paquetes reales desde un código postal de Tlaxcala en los dos. Agregar Envia.com como segundo proveedor solo si ahorra más del 10 % de forma constante o da paqueterías que hoy faltan.

Fuentes: facturapi.io/pricing, api.facturama.mx/costos, fiscalapi.com/en/pricing, github.com/FiscalAPI/fiscalapi-node, observatoriocfdi.com, skydropx.com/plataforma/api, help.skydropx.com, docs.envia.com, envia.com (términos), apps.shopify.com (reseñas), idconline.mx (PAC revocados, oct 2026).
