# HETNA CNC — Expediente para revisión jurídica

Preparado el 14 de noviembre de 2026 a partir de la auditoría externa (punto 7, "Aspectos legales y confianza") y de una lectura de los documentos publicados en hetnacnc.com.

**Esto no es una opinión legal.** Es un inventario para que un abogado (y, en lo fiscal, un contador) revise con menos horas: qué dice hoy cada documento, qué huecos se ven y qué preguntas hay que responder. Nadie ha verificado que los documentos cumplan con la ley de México ni de otros países.

## Documentos publicados

| Documento | Dirección | Versión o fecha visible | Notas |
|---|---|---|---|
| Términos y condiciones (clientes) | /mx/terminos-y-condiciones | 12 nov 2026 | 10 cláusulas. Hasta el 14 nov mostraba "7 de octubre" por un error de fecha (corregido). |
| Términos para vendedores y talleres | /mx/terminos-vendedores | v1.3, 4 nov 2026 | 19 cláusulas. El texto ya incluye cambios del 12 nov (licitaciones sin comisión, disputas) que **no se han publicado como versión nueva**: falta el aviso de 15 días (cl. 17) y subir a v1.5. Se marca como "BORRADOR para revisión de abogado y contador" en el código. |
| Aviso de privacidad | /mx/aviso-de-privacidad | v2.5, 12 nov 2026 | Español e inglés. Incluye secciones por país (EE. UU., Brasil, Colombia, Chile, Argentina y otros). |
| Política de devoluciones | /mx/devoluciones | 4 nov 2026 | Físicos, trabajos a la medida, diseños digitales, garantía. |
| Formas de pago | /mx/formas-de-pago | sin fecha | Mercado Pago, SPEI, trabajos a la medida, suscripciones del Cotizador. |
| Acuerdo SafeDeal (opcional) | dentro de cada solicitud | — | Contrato de 12 secciones que firman cliente y taller (incluye incumplimiento y controversias). |

**Faltan dos documentos** (se venden servicios que no tienen contrato propio):

1. **Términos del Cotizador para talleres** (SaaS de $0 / $299 / $599 / $1,199 al mes). Ningún documento lo menciona: no hay reglas de suscripción, renovación, cancelación, reembolso, cambio de plan, disponibilidad del servicio, propiedad de los datos del taller, exportación al darse de baja, ni facturación.
2. **Licencia de diseños digitales.** Los términos dicen sólo "se venden para uso según su descripción; no se permite revenderlos ni compartirlos" (cl. 8) y una categoría dice "si lo quieres para producir y vender piezas, escríbenos antes de comprar". No hay licencia tipo (personal / comercial / número de piezas / atribución).

## Temas que pidió revisar la auditoría

### 1. Responsabilidad de HETNA frente a clientes y talleres
**Hoy:** TyC cl. 9: HETNA "actúa como plataforma entre clientes y vendedores… cada vendedor responde por sus productos y trabajos". Vendedores cl. 15: el vendedor saca en paz y a salvo a HETNA; HETNA no responde por interrupciones ni fallas de terceros; "nada de esto limita los derechos que la ley da a los consumidores".
**Huecos:**
- HETNA **sí** cobra y retiene dinero en varios casos (tienda, solicitudes con cobro "hetna", anticipos) y **media y decide disputas** (TyC cl. 6, desde el 12 nov). Eso puede acercarla a la figura de proveedor o intermediario con obligaciones propias ante PROFECO, más allá de "sólo plataforma".
- No hay tope de responsabilidad ni exclusión de daños indirectos.
**Preguntas:** ¿Qué responsabilidad tiene HETNA ante el consumidor (LFPC) cuando cobra y retiene el pago? ¿Es válida la decisión de HETNA en disputas como mecanismo contractual? ¿Conviene un tope de responsabilidad para los talleres (B2B)?

### 2. Protección de propiedad intelectual
**Hoy:** Vendedores cl. 7 (publicar implica tener derechos; retiro ante reclamos). TyC cl. 8. Los archivos de solicitudes son confidenciales, con descargas registradas, sólo el taller elegido conserva el acceso y se borran 180 días después del cierre (aviso de privacidad, sección 8).
**Huecos:** no hay un procedimiento formal de notificación y retiro (datos que debe traer el reclamo, contranotificación, plazos). No hay cláusula de confidencialidad expresa para el taller sobre los planos del cliente fuera del SafeDeal opcional.
**Preguntas:** ¿Basta la cl. 7 o hace falta un procedimiento tipo notificación y retiro (en EE. UU., DMCA)? ¿Debe incluirse una obligación de confidencialidad del taller en los términos de vendedores (no sólo en SafeDeal)? ¿Quién es dueño del diseño que un taller dibuja para un cliente?

### 3. Licencias de diseños digitales
**Hoy:** ver "Faltan dos documentos".
**Preguntas:** ¿Qué licencias tipo conviene ofrecer (personal, comercial limitada, comercial ilimitada)? ¿Cómo se acredita que el vendedor tiene derechos sobre diseños que se parecen a marcas o personajes (la categoría "religiosos" y diseños virales)?

### 4. Tratamiento de archivos confidenciales
**Hoy:** aviso de privacidad secciones 7 y 8 (v2.5); controles técnicos: revisión de contenido y antivirus al subir, descargas con permiso y registro (incluye IP), borrado a 180 días.
**Preguntas:** ¿HETNA es responsable o encargado de los planos del cliente frente al taller? ¿Hace falta un contrato de encargado para los talleres que reciben datos personales del cliente (vendedores cl. 12)? ¿Es correcto registrar la IP de quien descarga y conservarla mientras exista la solicitud?

### 5. Política de reembolsos
**Hoy:** devoluciones (días hábiles según `EMPRESA.diasDevolucion`, físicos sin uso; trabajos a la medida sin devolución por cambio de opinión; digitales sin devolución una vez descargados salvo defecto). TyC cl. 6: cancelación antes de que el taller reporte avance = 100 %; retraso de 7 días tras la fecha prometida = cancelar con reembolso; disputas decididas por HETNA en 5 días hábiles; con pago directo al taller, el reembolso lo hace el taller.
**Huecos:** no hay política de reembolso de **suscripciones del Cotizador** ni de créditos 3D; el plazo de "5 días hábiles" para decidir disputas no está respaldado por ningún proceso garantizado.
**Preguntas:** ¿Son válidas las excepciones a devolución de digitales y de trabajos a la medida frente a la LFPC (art. 56 y relacionados)? ¿Qué debe decir la política de cancelación de una suscripción mensual (cobros por adelantado, prorrateo)?

### 6. Tratamiento de pagos y anticipos
**Hoy:** TyC cl. 6 y vendedores cl. 8. Modelos: (a) el cliente paga a HETNA, que retiene y libera al taller al confirmar o 10 días después de la entrega; (b) el cliente paga directo a la cuenta del taller conectada (Mercado Pago o PayPal); (c) trato fuera de la plataforma, sin protección.
**Huecos y riesgos:** en el modelo (a) HETNA **recibe y retiene dinero de terceros** por días o semanas.
**Preguntas:** ¿Retener y liberar pagos de terceros exige alguna figura regulada (agregador de pagos, comisionista, Ley Fintech) o basta con hacerlo a través de Mercado Pago/PayPal? ¿Cómo debe documentarse el anticipo (contrato de comisión mercantil, mandato)? ¿Quién factura el anticipo, HETNA o el taller?

### 7. Comisiones y obligaciones fiscales
**Hoy:** vendedores cl. 8 (comisiones por tipo de producto; licitaciones sin comisión desde el 7 nov) y cl. 9 (cada vendedor emite su CFDI; HETNA retendrá ISR e IVA como plataforma digital de intermediación cuando la ley lo obligue). El Cotizador emite CFDI de las suscripciones (ver la auditoría técnica del Cotizador).
**Preguntas (contador):** ¿HETNA está obligada hoy a retener ISR e IVA a los vendedores personas físicas (LISR art. 113-A y LIVA art. 18-J) y a reportar al SAT? ¿Cómo se factura cuando el cliente paga a HETNA y HETNA libera al taller? ¿La persona física responsable puede operar así o conviene constituir la persona moral antes de crecer?

### 8. Protección de datos en México, Estados Unidos y otros países
**Hoy:** aviso v2.5 con LFPDPPP (México), sección 13 por país (EE. UU. con derechos estatales, Brasil/LGPD, Colombia Ley 1581, Chile, Argentina y otros), transferencias a EE. UU. y Singapur (sección 6), cookies con consentimiento.
**Huecos:** términos y aviso remiten a ley mexicana y tribunales de Apizaco, Tlaxcala, también para clientes de otros países. No hay contacto ni representante en la UE (si se vende a Europa).
**Preguntas:** ¿Es exigible la jurisdicción de Apizaco frente a consumidores extranjeros? ¿Qué falta para vender a EE. UU. (impuestos sobre ventas por estado, avisos estatales de privacidad, accesibilidad) y a la UE (GDPR, IVA digital)? ¿Conviene limitar por ahora la venta a México y declararlo?

## Inconsistencias que ya se corrigieron (sin necesidad de abogado)
- Todas las páginas legales mostraban la misma fecha ("7 de octubre de 2026"), aunque los términos cambiaron el 12 nov y la política de devoluciones el 4 nov. Cada documento ahora muestra su propia fecha.
- "Formas de pago" no mencionaba PayPal, que sí se usa en las solicitudes de fabricación y en el Cotizador.

## Pendientes del dueño antes de la revisión
- Decidir si se constituye persona moral (cambia razón social, RFC y varias respuestas fiscales).
- Crear el correo de privacidad (hoy se usa contacto@hetnacnc.com para derechos ARCO).
- Publicar los términos de vendedores v1.5 con aviso de 15 días.
- Pedir al abogado los dos documentos que faltan: Términos del Cotizador y Licencia de diseños digitales.
