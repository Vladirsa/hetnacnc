# Anexo: contrato HETNA SafeDeal para revisión jurídica

Complemento de `revision-juridica-2026-11.md`. Preparado el 14 de noviembre de 2026 a partir del código que genera el contrato (`packages/api/src/lib/safedeal.ts`) y la política de problemas y disputas (`packages/api/src/lib/disputa.ts`).

**Esto no es una opinión legal.** Es el texto exacto que hoy firma la gente, cómo se firma y las preguntas que tiene que contestar un abogado. Mientras no se revise, cada página del PDF dice: *"Modelo de contrato pendiente de revisión legal. Revísenlo antes de firmar."*

## Qué es y cómo funciona hoy

1. Un cliente publica una solicitud de fabricación en hetnacnc.com. Varios talleres CNC le mandan propuestas y el cliente elige una.
2. Cliente y taller conversan dentro de HETNA. Sus datos de contacto quedan ocultos.
3. **SafeDeal es opcional.** Ambos ven una alerta que lo recomienda. Cualquiera de los dos edita las condiciones (12 apartados ya prellenados con los datos de la propuesta). Cada cambio borra las aprobaciones.
4. Cuando los dos aprueban, se genera el PDF, se calcula su huella SHA-256 y esa versión queda bloqueada.
5. **Firma:** firma electrónica simple con:
   - código de 6 dígitos enviado al correo de la cuenta (vale 10 minutos);
   - nombre del firmante y, si aplica, a quién representa;
   - casilla de "leí y acepto".

   Se guardan la fecha y hora, la IP, el navegador y la huella exacta firmada.
6. Con las dos firmas se emite una **constancia de firmas** (PDF aparte con los datos de arriba y el historial) y se comparten los contactos.
7. Cualquier cambio posterior crea una versión nueva que se firma otra vez. La versión firmada no se modifica; ni HETNA puede hacerlo.

Aparte del contrato, en las solicitudes donde **el cliente paga a HETNA**:

- HETNA retiene el pago y lo libera al taller cuando el cliente confirma de recibido, o 10 días después de la entrega si no reporta un problema.
- Si hay un problema, HETNA pide evidencia a los dos y decide.

## Texto que se prellena (los 12 apartados)

Las partes pueden editar todo esto antes de aprobar. Entre corchetes van los datos que se llenan solos.

1. **Identificación de las partes.** CLIENTE: [nombre, empresa]. TALLER: [nombre del taller]. (Agreguen RFC y domicilio si los necesitan en la factura.)
2. **Objeto.** [Descripción de la solicitud] o "Fabricación según la solicitud [folio] de HETNA CNC."
3. **Especificaciones.** Proceso, material, cantidad, medidas, tolerancia, acabado y operaciones, según la solicitud y la propuesta. "Conforme a los planos y archivos compartidos en la solicitud."
4. **Precio.** "$[precio] [moneda], envío incluido / sin envío. Impuestos: indicar si incluye IVA."
5. **Pagos.** "Anticipo de [X]% al firmar y el resto contra entrega" o "Pago del 100% antes de iniciar la fabricación." Más: "Los pagos hechos dentro de HETNA quedan registrados en el folio."
6. **Entrega.** "[N] días naturales a partir del pago (fecha estimada: [fecha]). Lugar: [ciudad, estado]."
7. **Calidad y aceptación.** "Las piezas se aceptan si cumplen las medidas, tolerancias, material y acabado de este acuerdo. El cliente tiene 5 días hábiles desde que recibe para reportar defectos con fotos; el taller los revisa y, si proceden, corrige o repone."
8. **Garantías.** [La garantía que ofreció el taller] o "El taller corrige sin costo los defectos de fabricación reportados en el plazo de aceptación."
9. **Propiedad intelectual.** "Los planos, diseños y archivos del cliente siguen siendo del cliente. El taller sólo los usa para este trabajo y no puede fabricar, vender ni compartir las piezas o los diseños con terceros."
10. **Confidencialidad.** "Ambas partes guardan en secreto la información técnica y comercial que reciban de la otra durante y después de este trabajo, salvo obligación legal."
11. **Incumplimiento.** "Si el taller no entrega en el plazo acordado sin causa justificada, el cliente puede cancelar y pedir la devolución de lo pagado por lo no entregado. Si el cliente no paga en los plazos acordados, el taller puede suspender el trabajo."
12. **Controversias.** "Las partes intentarán resolver cualquier diferencia de buena fe en 15 días. Si no lo logran, se someten a las leyes de los Estados Unidos Mexicanos y a los tribunales competentes del domicilio del cliente."

Y dos cláusulas fijas que nadie puede editar:

- **13. Papel de HETNA.** "HETNA CNC proporciona la infraestructura tecnológica que conectó a las partes. HETNA no fabrica los productos ni presta los servicios contratados, no fija los precios ni negocia en nombre de las partes, y no garantiza la calidad, la entrega, la solvencia ni el cumplimiento de ninguna de ellas. La elección del taller fue decisión exclusiva del cliente. Cada parte es responsable de verificar las capacidades, obligaciones y acuerdos de la otra, y los conflictos derivados de este contrato se resolverán entre las partes conforme a lo aquí pactado y a la legislación aplicable. Esta cláusula no limita las obligaciones legales propias de HETNA, como la protección de datos personales y la seguridad de la información."
- **14. Firma electrónica.** "Las partes aceptan firmar electrónicamente este documento conforme a los artículos 89 a 97 del Código de Comercio. Cada firma se otorga con la cuenta del firmante, un código de verificación enviado a su correo y la aceptación expresa del texto. La huella SHA-256 de este PDF y la constancia de firmas forman el expediente. Si se modifica cualquier condición se genera una nueva versión que debe firmarse de nuevo."

## Lo que se ve raro (para que el abogado lo confirme o lo descarte)

1. **La cláusula 13 choca con lo que HETNA hace en la práctica.** Dice que HETNA no garantiza nada y que los conflictos se resuelven "entre las partes". Pero cuando el cliente paga a HETNA, HETNA retiene el dinero, pide evidencia, decide y ordena reembolsos o liberaciones (Términos para clientes, cl. 6). El contrato no menciona ese mecanismo.
2. **Los plazos no coinciden.**
   - Aceptación: 5 días hábiles para reportar defectos (apartado 7).
   - Cierre: la plataforma cierra sola la solicitud y libera el pago 10 días naturales después de la entrega.
   - Disputas: HETNA tiene su propio plazo para decidir.

   Conviene un solo calendario en el contrato y en los términos.
3. **"Devolución de lo pagado" (apartado 11) no dice quién devuelve.** Si el dinero lo retiene HETNA, la devolución la hace HETNA; si se pagó directo al taller, el taller.
4. **El precio puede quedar con el texto "indicar si incluye IVA"** si nadie lo edita.
5. **Propiedad intelectual (apartado 9) sólo cubre los archivos del cliente.** No dice de quién es un diseño o programa CNC que el taller haga para este trabajo.
6. **No hay** pena por retraso, tope de responsabilidad, exclusión de daños indirectos, caso fortuito o fuerza mayor, ni causales de terminación anticipada.
7. **Pagos por fuera.** Al firmar se comparten los contactos. El contrato no avisa que pagar fuera de HETNA deja sin la protección de retención y disputa.
8. **Firma y conservación.** No usa una constancia de conservación de un prestador de servicios de certificación. Solo hay huella SHA-256, IP, navegador y un código por correo.

## Preguntas concretas

1. **Validez de la firma.**
   - ¿La firma electrónica simple con código por correo es suficiente para un contrato de fabricación entre particulares o empresas?
   - ¿Hace falta una constancia de conservación conforme a la NOM-151-SCFI-2016 para que el expediente valga como prueba?
   - ¿Cambia algo si el cliente es consumidor (persona física que compra para sí) y no empresa?
2. **Papel de HETNA.** ¿Cómo debe redactarse la cláusula 13 para que sea verdad tanto si HETNA retiene el pago y decide disputas como si el pago fue directo al taller? ¿Conviene que HETNA aparezca como tercero que acepta un mandato limitado de retener y liberar?
3. **Retener dinero de terceros.** ¿Retener y liberar pagos entre cliente y taller requiere alguna autorización o figura especial (por ejemplo, a la luz de la Ley Fintech), o basta con hacerlo a través de Mercado Pago?
4. **Consumidores.** Si el cliente es consumidor, ¿qué apartados chocan con la Ley Federal de Protección al Consumidor? Por ejemplo, el plazo de 5 días hábiles, la garantía o la jurisdicción. ¿Hay que registrar el modelo de contrato de adhesión ante PROFECO?
5. **Datos personales.** Compartir contactos entre las partes al firmar, ¿está cubierto por el aviso de privacidad vigente (Ley Federal de Protección de Datos Personales en Posesión de los Particulares de 2025) o requiere un consentimiento específico en pantalla?
6. **Textos por defecto.** De los 12 apartados prellenados, ¿cuáles hay que reescribir y cuáles quedan? ¿Qué falta agregar (puntos 5 y 6 de la lista anterior)?
7. **Clientes de otros países.** Un cliente en Estados Unidos que contrata a un taller en México, ¿puede usar el mismo modelo? ¿Qué cambia en ley aplicable y jurisdicción?

## Qué necesito de vuelta del abogado

1. El texto aprobado de cada uno de los 12 apartados por defecto (o "se queda igual").
2. El texto aprobado de las cláusulas 13 (papel de HETNA) y 14 (firma electrónica).
3. Las cláusulas nuevas que agregue.
4. Decisión sobre la NOM-151: sí o no.
5. Si los términos para clientes (cl. 6) y para vendedores tienen que cambiar para que coincidan.

Con eso cambio el código el mismo día y, en el servidor, se pone `SAFEDEAL_REVISADO=1` para quitar la leyenda de "pendiente de revisión" de los PDF nuevos. Los contratos ya firmados conservan su leyenda; no se tocan.
