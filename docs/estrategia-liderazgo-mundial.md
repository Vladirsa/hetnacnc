# HETNA CNC: estrategia para ser el líder mundial del CNC

*Noviembre 2026. Se basa en `reporte-competencia` (unas 45 plataformas en 5 continentes).*

**Decisiones del dueño:**
- Atacamos **taller/maker y empresas al mismo tiempo**, en dos carriles.
- **HETNA como único responsable** del pedido: sí, pero al final.
- Crecimiento: **México → Latinoamérica → EUA hispano y España**.

---

## La meta en una frase

> Ser el **único lugar del mundo** donde cualquier persona o empresa sube un archivo y recibe su pieza CNC, y donde cualquier taller consigue clientes, cotiza, cobra y crece. Todo en español, por WhatsApp, con IA.

Hoy nadie junta las seis piezas: marketplace de máquinas e insumos, fabricación a pedido, licitaciones, software para el taller, comunidad y marketing con IA. Cada competidor tiene una sola. **Nuestra ventaja es juntarlas; nuestro trabajo es que cada pieza sea tan buena como la del mejor especialista.**

---

## Lo que ya tenemos (no se empieza de cero)

| Lo que tiene el competidor | Lo que ya tiene HETNA | Qué le falta para igualarlo o superarlo |
|---|---|---|
| Lectura de archivos (OSH Cut, Fractory) | Lee DXF, SVG, STL y OBJ en el navegador: medidas, largo de corte, perforaciones, volumen | **Revisión del archivo (DFM)**: avisar de problemas antes de cotizar |
| Precio instantáneo (JLC, SendCutSend) | Calculadoras por servicio que dan un rango estimado | **Precio desglosado** que cambia en vivo |
| Tienda de cotización por taller (Lantek Metal Shop, CutQuote) | Cotizador en línea de cada taller en `/t/<taller>` | Widget para pegar en su web o Facebook, QR y estadísticas |
| Red verificada (FACTUREE, Fictiv) | Insignia "Taller verificado", empresa verificada, ranking, reseñas | **Métricas públicas**: puntualidad y tiempo de respuesta |
| Pago protegido (Laserhub) | SafeDeal y expediente del pedido | Pasar de "protegido" a "HETNA responde" (Fase 4) |
| Anidado y plantillas (O'Brien, JLC) | Generadores paramétricos y anidado | Unirlos con cotizar y comprar en un solo paso |
| Software gratis para el taller (Xometry Workcenter) | App Cotizador con plan gratis | Ya lo tenemos y es más completo; hay que comunicarlo |
| Páginas por ciudad (LaserBoost, QuickCut) | `/cnc/<guía>/<ciudad>` con 8 ciudades, pero sólo la guía de corte láser en MDF las tiene activas | Llevarlo a láser, router y plasma, con calculadora en la página |
| Guías de diseño (LaserBoost) | Guía "archivos DXF para router" | Guías de preparar archivo para láser y plasma |
| Métricas públicas (Fictiv) | Se calculan cada día (% a tiempo, trabajos terminados, reclamos), pero sólo se ven al comparar propuestas | Mostrarlas en el perfil y el ranking, y medir el tiempo de respuesta |
| Asignación de taller (Factorem, Laserhub) | La solicitud se difunde a hasta 60 talleres por material y zona, y la ronda se amplía sola | Elegir el mejor taller por capacidad, puntualidad y cercanía |
| Pago retenido (Laserhub) | En modo "hetna" el cliente le paga a HETNA y el taller cobra al entregar; hay fotos por hito | Garantía de fecha, exprés y reposición (Fase 4) |
| Generador → fabricar | El diseño pasa directo a la solicitud de fabricación | Mostrar precio y comprar en el mismo paso |
| Nesting | Se usa en los generadores para contar hojas | Usarlo para cobrar material real en el precio |

---

## El plan por fases (de lo más fácil a lo más difícil)

Cada fase tiene dos carriles:
- 🛠️ **Taller y maker**
- 🏢 **Empresas**

### Fase 1: rápida, solo software (semanas 1 a 4)

No cambia la operación. Cada punto se puede programar y desplegar por separado.

| # | Mejora | Copiado de | Carril | Por qué primero |
|---|---|---|---|---|
| 1.1 ✅ | **Revisión automática del archivo**: contornos abiertos, líneas duplicadas (corte doble), huecos muy chicos, piezas fuera de medida de hoja, texto sin convertir, malla 3D abierta. Se muestra como lista ✓/⚠ con cómo arreglarlo. | OSH Cut, RapidDirect, Protolabs | 🛠️🏢 | La lectura del archivo ya existe; un solo cambio mejora los 3 cotizadores (tienda, `/t/<taller>`, solicitudes). Menos reclamos y más confianza. |
| 1.2 ✅ | **Precio desglosado y en vivo**: material, corte, perforaciones, cantidad y envío. Cambia al mover material, espesor o cantidad. | JLC, Ponoko | 🛠️🏢 | El precio se ve justo; el cliente prueba opciones en vez de irse. |
| 1.3 ✅ | **Métricas públicas del taller**: % de entregas a tiempo, tiempo de respuesta y trabajos terminados, en el perfil y el ranking. | Fictiv (95.4%), FACTUREE | 🛠️🏢 | Las insignias ya existen; con números reales se gana confianza B2B. |
| 1.4 ✅ | **Páginas por ciudad × servicio** ("corte láser en Puebla", "router CNC en Monterrey"…) con calculadora y talleres de esa ciudad, más **guías de diseño en español** (cómo preparar tu DXF para láser, router, plasma). | LaserBoost, QuickCut, Craftcloud | 🛠️🏢 | Tráfico gratis de Google que llega directo a cotizar. La fábrica de contenido las genera. |
| 1.5 ✅ | **Programa de creadores**: landing y código por youtuber o tiktoker CNC, con comisión por venta o por taller registrado. | SendCutSend, Inventables | 🛠️ | Adquisición barata y creíble; ya existen referidos y cupones. |

### Fase 2: diferenciadores (meses 2 y 3)

| # | Mejora | Copiado de | Carril |
|---|---|---|---|
| 2.1 ✅ | **Acabados en el carrito**: pintura electrostática, doblez, grabado, roscado y lijado. Los talleres marcan qué hacen y su precio; el pedido se asigna a quien lo ofrece. | SendCutSend, Fractory, Prymax | 🛠️🏢 |
| 2.2 ✅ | **Licitación desde una foto o un boceto con IA**: el cliente sin archivo toma foto, la IA arma la solicitud con medidas y material y la manda a talleres. | Alibaba Accio | 🛠️🏢 |
| 2.3 ✅ | **Widget del cotizador del taller**: código para pegar en su web o Facebook, QR para su local y estadísticas de visitas y solicitudes. | Lantek Metal Shop, CutQuote | 🛠️ |
| 2.4 ✅ (parte 1) | **Portal Empresas (v1)**: cuenta de empresa con varios usuarios, biblioteca de piezas para **repetir pedido en 1 clic**, órdenes de compra y CFDI. | Xometry, Kreatize | 🏢 |
| 2.5 ✅ | **Recotizar trabajos parecidos** en la app Cotizador: sube un archivo y te muestra trabajos anteriores parecidos con su precio. | CADDi | 🛠️ |
| 2.6 ✅ | **Generador → cotizar → comprar en un paso**: diseñas la caja, letrero o gabinete, ves el precio y lo mandas a fabricar con el material en el mismo carrito. | O'Brien, JLC | 🛠️ |

### Fase 3: nivel industrial (meses 4 a 6)

| # | Mejora | Copiado de | Carril |
|---|---|---|---|
| 3.1 | **STEP con doblez**: desdoblar lámina 3D, cobrar dobleces y revisar radios. | OSH Cut, Fractory, meviy | 🏢 |
| 3.2 ✅ (sin precio de material) | **Nesting real en el Cotizador**: cuántas piezas caben por hoja y el costo real de material. | Lantek, Almacam | 🛠️🏢 |
| 3.3 ✅ (recomendación) | **Asignación automática de taller** por capacidad, cercanía, calificación y puntualidad, con opción "elige tú" o "HETNA elige". | Factorem, Laserhub | 🏢 |
| 3.4 ✅ | **Precio dinámico por capacidad libre**: descuento si el taller tiene horas muertas esta semana. | Geomiq | 🛠️🏢 |
| 3.5 ✅ (repetir pedido) | **Copiloto de compras con IA por WhatsApp para empresas**: "necesito 200 placas como la del mes pasado" y se arma el pedido. | Geomiq, Accio | 🏢 |

### Fase 4: HETNA responde (meses 6 a 12)

Requiere contador y abogado, y cambia la operación.

| # | Mejora | Copiado de |
|---|---|---|
| 4.1 | **HETNA único responsable**: el cliente le paga y le compra a HETNA; HETNA factura, retiene el pago y le paga al taller al entregar (crecer desde SafeDeal). | Laserhub, Xometry |
| 4.2 | **Fecha garantizada y Exprés** con sobreprecio; si se atrasa, se compensa. | Fractory, Fictiv |
| 4.3 | **Control de calidad**: fotos de la pieza antes de enviar, medición y garantía de reposición. | FACTUREE, Zetwerk |
| 4.4 | **Crédito para empresas** (pago a 30 días) y contratos marco. | Xometry, FACTUREE |

### Fase 5: expansión

1. **Latinoamérica**: Colombia, Chile, Perú, Argentina y Guatemala. Multimoneda, envíos locales, talleres fundadores por país y precios en moneda local.
2. **EUA hispano** (ya existe `/us/cotizador`) y **España** (solo LaserBoost tiene presencia; no hay red de talleres con SaaS).
3. **África** después: el modelo no existe ahí.

---

## Cómo sabremos que somos los mejores (indicadores)

| Indicador | Hoy | Meta 6 meses | Meta 12 meses |
|---|---|---|---|
| Talleres activos (cotizan cada mes) | medir | ×3 | ×10 |
| Solicitudes de fabricación por mes | medir | ×3 | ×10 |
| Tiempo a la primera propuesta | medir | < 2 h | < 30 min |
| % de entregas a tiempo (público) | no se mide | medido y > 90% | > 95% (mejor que Fictiv) |
| Archivos con problema detectados antes de cotizar | 0% | > 80% | > 95% |
| Países con talleres | 1 | 1 | 4 |

---

## Riesgos y cómo cubrirnos

| Riesgo | Respuesta |
|---|---|
| **Xometry** llega en español (ya tiene proveedores en México) | Ganar primero al taller: si los mejores talleres usan nuestra app y reciben nuestros clientes, Xometry no tiene con quién fabricar barato aquí. |
| **Radii** baja al taller pequeño | Ser mejores en lo que ellos no hacen: WhatsApp, router de madera y acrílico, software del taller gratis, comunidad. |
| **JLC** y los chinos con precio bajísimo | Competir con tiempo (días, no semanas), atención en español y piezas grandes (madera, MDF, lámina) que no conviene importar. |
| Hacer todo a la vez y no terminar nada | Una mejora a la vez, desplegada y medida antes de la siguiente. |
