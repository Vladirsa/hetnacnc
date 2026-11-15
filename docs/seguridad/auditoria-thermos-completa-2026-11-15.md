# Auditoría Thermos de todo el código (15 nov 2026)

Revisión de seguridad y fallas del código ya desplegado (rama main después de #186), con la skill `.claude/skills/thermos`, en 6 áreas en paralelo. Solo lectura: los arreglos se hicieron después en la rama `claude/fervent-dirac-2n43to`.

## Corregido en esta rama

Prioridad Alta (los 6):
1. **Datos protegidos del taller:** `plan` y `plan_vence` se podían escribir desde el panel, y `POST /vendor/sellers/:id` y `POST /vendor/sellers` no pasaban por `protegerMetadata` (insignia de verificado, exención de requisitos). Ahora las tres rutas blindan las llaves.
2. **Archivos privados con un producto falso:** un taller podía poner `archivo_storage_key` con la llave de un archivo de pago o de los planos de un cliente. Ahora `/vendor/products*` no acepta `archivo_storage_key`, `archivo_gratis`, `producto_digital`, `precio_mxn` ni `creditos_otorgados`. Además, la entrega rechaza llaves de carpetas privadas (`solicitudes/`, `talleres/`, `envios/`, `propuestas/`, `facturas/`, `cloud/`…). También cierra el M4 de pagos (venta "digital" sin espera) y el M5 (precio de créditos).
3. **Solicitudes de otra persona por su correo:** la liga de pantalla de afiliación se entregaba aunque el número ya existiera, y "Activar mi cuenta" pasaba las solicitudes a una cuenta con el correo sin confirmar. Ahora la liga solo sale si el número es nuevo, la pantalla no muestra el teléfono y las solicitudes se ligan solo con el correo confirmado: con la liga del correo de afiliación o al confirmar el correo de la cuenta (`hooks/verificar-correo`).
4. **Trabajo CAM pagado con cualquier producto:** ahora la línea debe ser del producto y nivel del servicio, y el trabajo debe estar en el carrito.
5. **HetNa Cloud importaba trabajos CAM por `seller.email`,** que el taller puede editar. El correo de acceso tampoco está confirmado. Ahora la liga de confirmación del alta firma el correo al que se mandó, ese correo queda en `metadata.correo_confirmado_email` (protegido) y HetNa Cloud importa solo con él. Los talleres que confirmaron antes de este cambio no importan trabajos CAM automáticamente hasta tener ese dato.
6. **XSS con un "G-code" `.html`:** el archivo siempre se guarda con extensión `.nc`.

Prioridad Media:
- **M1 de pagos:**
  - En el aviso sin `?sol=`, un pago cobrado por la cuenta de un taller conectado ya no se anota como cobro de HETNA.
  - Un pago ya registrado no cambia quién cobra ni el taller.
  - Mientras no está aprobado, monto y comisión se ponen al día.

- **Avisos de Mercado Pago (M3 de pagos), corregido después en la misma rama:**
  - `mp-envio`, `mp-cotizacion`, `mp-comision` y `mp-licitacion` procesan y luego responden: 500 si algo falla, para que Mercado Pago reintente.
  - Los avisos del mismo pago se procesan uno tras otro (`lib/aviso-unico.ts`), lo que también evita el pedido duplicado del Cotizador (M1 del Cotizador).
  - Si un aviso falló después de anotar el pago, el reintento crea el pedido.
  - El puente de la tienda `/api/mp/licitacion` ya no responde 200 cuando la API falla.
  - Un pago de sobrepeso solo se acepta si el sobrepeso estaba `por_cobrar` (B3). Si no, se avisa para devolverlo.

- **PayPal del Cotizador (M2 de pagos, M2 del Cotizador y B1), corregido después:**
  - La orden guarda cuánto cubre en la moneda de la cotización y eso es lo que se acredita. Recargar la página ya no deja el anticipo en 0, y una orden vieja ya no acredita el anticipo nuevo completo.
  - Antes de cobrar se revisa que la orden vaya al PayPal actual del taller y que no sea por más de lo que falta.
  - Un mismo regreso de PayPal se procesa uno tras otro.

## Cómo se probó
- `tsc` del API sin errores y 154 pruebas unitarias.
- Hay pruebas nuevas en `lib/__tests__/auditoria-thermos.unit.spec.ts` para la lista de llaves privadas, el blindaje de la metadata de productos y la regla de pago de trabajos CAM (con un pedido de ejemplo).
- **No se probó de punta a punta** (rutas, webhooks y flujos contra una base y servicios reales). Después de desplegar hay que revisar a mano estos flujos: alta de taller y confirmación de correo, publicar un producto, compra de un servicio CAM, activar cuenta desde una solicitud y un pago de licitación.

## Revisar abusos anteriores (lo arreglado no deshace lo que ya se guardó)
En el VPS, desde `~/hetnacnc/packages/api`, con la `DATABASE_URL` del `.env`. Las consultas solo leen.

Talleres con plan, insignia o exención. Compáralos con los que HETNA aprobó:
```sql
select id, name, email, metadata->>'plan' plan, metadata->>'verificado' verificado,
       metadata->>'empresa_verificada' empresa, metadata->>'requisitos_exento' exento
from seller
where deleted_at is null and (metadata ? 'plan' or metadata->>'verificado' = 'true'
   or metadata->>'empresa_verificada' = 'true' or metadata->>'requisitos_exento' = 'true');
```

Productos con archivo descargable. Revisa que la llave sea del mismo taller y no de carpetas privadas:
```sql
select p.id, p.title, p.metadata->>'archivo_storage_key' llave, p.metadata->>'archivo_gratis' gratis,
       p.metadata->>'producto_digital' digital
from product p
where p.deleted_at is null and (p.metadata ? 'archivo_storage_key' or p.metadata->>'producto_digital' = 'true')
order by 3;
```

## Pendiente (Media y Baja)

Están en los informes de abajo. Los más importantes:
- **Reembolsos y contracargos del Cotizador:** no deshacen el anticipo.
- **WhatsApp:** la verificación no comprueba que el número sea del taller.
- **"Marcar pagado":** puede incluir pedidos que no entraron en la transferencia.
- **Servidor de `/static`:** conviene servirlo con `Content-Disposition: attachment` y `X-Content-Type-Options: nosniff` desde nginx.

---

## Informes por área (texto original de los revisores)


### Área: pagos

**Auditoría de seguridad y fallas — área de pagos (rama main, solo lectura)**

No encontré ningún hallazgo Alta, es decir, explotable en la práctica sin condiciones previas. Los avisos de pago vuelven a consultar el pago al proveedor y casi todos verifican el monto. Encontré 5 hallazgos de prioridad Media y 5 de Baja.

#### Media

**M1. Un aviso de Mercado Pago sin `?sol=` puede cambiar un pago "directo al taller" a "cobra HETNA", y HETNA se lo vuelve a pagar al taller**
- **Dónde:** `packages/api/src/lib/licitacion-cobro.ts:589-591`, `:413-429` y `:706`.
  - En la línea 590 el pago se lee con la llave de HETNA (`consultarPago`), sin revisar `collector_id`.
  - En la línea 428, cuando ya existe la fila del pago (`previo`), se reescriben `cobra`, `negocio_id`, `comision` y `comision_cobrada`, aunque ya estaba aprobado.
  - En la línea 706, `liquidacionTaller` suma las filas con `cobra:"hetna"` como dinero que HETNA le debe al taller.
- **Ataque:**
  1. El cliente le paga al taller directo por Mercado Pago. Se anota bien, con `cobra=taller`.
  2. El taller, que conoce el id del pago, manda `POST /api/mp-licitacion?type=payment&data.id=<id>` sin `sol`. La ruta es pública.
  3. La fila queda como `cobra=hetna`.
  4. Al cerrarse la solicitud, `avisarLiquidacion` manda a HETNA el correo "Transferir al taller $X". El taller cobra dos veces.
- **Condición:** que la llave de HETNA pueda leer los pagos cobrados por un taller conectado. No lo pude confirmar sin llamar a Mercado Pago, pero el propio código lo da por hecho en `cotizacion-liga.ts:660-676` ("en modo marketplace también ve los cobros de sus talleres"). El pago a mano por parte de HETNA es el último freno.
- **Arreglo:**
  - En el camino sin `sol`, exigir que `pago.collector_id` sea la cuenta de HETNA.
  - En `registrarPagoLicitacion`, si ya hay fila, actualizar solo `estado` y nunca `cobra`, `negocio_id`, `proveedor` ni `comision*`.

**M2. Cotización en COP/PEN/CLP cobrada en dólares: si el cliente recarga la página de regreso de PayPal, el anticipo pagado vuelve a 0**
- **Dónde:** `packages/api/src/lib/cotizacion-liga.ts:830`, `:838-855` (`guardarPago` reescribe con `merge-duplicates`, líneas 283-286) y `:621`.
- **Falla:**
  1. En la segunda visita a `GET /api/cotizacion-liga/<token>/paypal?token=<orden>` (botón atrás, recargar, doble clic), la orden ya está COMPLETED, así que no se vuelve a cobrar.
  2. Pero `montoCot` se calcula como `anticipoDe(c) - c.anticipo_pagado`, que ya es 0.
  3. Se reescribe `detalle.monto_cotizacion: 0`. `trasPago` usa `??`, así que el 0 gana y se guarda `anticipo_pagado = 0`.
- **Efecto:** la cotización vuelve a mostrar anticipo pendiente. `pagarConPaypal` y `pagarAnticipo` solo miran `anticipo - anticipo_pagado`, así que el cliente puede volver a pagar, y el taller ve menos de lo cobrado.
- **Arreglo:** si ya existe la fila `pp:<captura>`, no recalcular `montoCot`: reusar el `detalle` guardado o no reescribirlo. Mejor aún, guardar `monto_cotizacion` en la orden (`custom_id` o metadata) al crearla.

**M3. Tres avisos responden 200 antes de procesar y no hay tarea que concilie: si algo falla, el pago se pierde**
- **Dónde:** `packages/api/src/api/api/mp-envio/route.ts:24`, `api/api/mp-cotizacion/route.ts:18` y `api/api/mp-comision/route.ts:15`.
- **Falla:** si Supabase, la base o la API de Mercado Pago fallan en ese momento, Mercado Pago no reintenta porque ya recibió el 200. Lo comprobé: en `jobs/` no hay conciliación de envíos, anticipos de cotización ni comisiones; solo `confirmar-compras-creditos` y `cotizador-conciliar-suscripciones`.
- **Efecto:**
  - El cliente pagó el envío, queda en `pendiente_pago` y no se genera la guía.
  - El anticipo no se anota y el pedido no se crea.
  - La comisión pagada sigue "pendiente".
- **Arreglo:** procesar y luego responder (500 si falla), como ya hace `mp-licitacion`, o agregar una tarea que busque los pagos con `/v1/payments/search?external_reference=…`.
- **Nota aparte:** el puente de la tienda `apps/storefront/src/app/api/mp/licitacion/route.ts:20` siempre responde 200, aunque la API responda 500. No pude verificar si Mercado Pago todavía apunta ahí.

**M4. El taller decide si su venta es "digital" y con eso se salta los 3 días de espera antes de que se le pueda pagar**
- **Dónde:** `packages/api/src/lib/saldos-talleres.ts:136` y `:149-152`.
- **Problema:** usa `metadata.producto_digital === true` del producto. El validador de Mercur (`VendorCreateProduct`/`VendorUpdateProduct`) acepta `metadata` libre, y ningún middleware protege esa llave; solo están `exigirFondoBlanco` y `exigirTallerAprobado`.
- **Ataque:** un taller marca un producto físico como digital, lo vende, y la venta queda "disponible" al instante, sin entrega ni guía. HETNA le transfiere y el comprador nunca recibe nada. Lo limita que el pago al taller es manual.
- **Arreglo:** considerar digital solo si además existe `archivo_storage_key` y el producto lo creó un flujo de HETNA (`publicar-diseno`/`cursos`/`libro`). Mejor: proteger `producto_digital` en `POST /vendor/products*` con un middleware que lo quite.

**M5. El precio y los créditos de cada paquete salen de la metadata de un producto que no es de HETNA, sin revisar quién es el dueño**
- **Dónde:** `packages/api/src/lib/creditos-compra.ts:86-102`.
- **Problema:** se busca el producto por handle (`creditos-3d-*`) y se toman `metadata.precio_mxn` y `metadata.creditos_otorgados`. `scripts/seed-creditos-3d.ts:57` los asigna "al primer seller" que encuentre.
- **Ataque:**
  - El taller dueño de esos productos (si el primer seller no es HETNA) los edita por `/vendor/products/:id` y pone `precio_mxn: 1` y `creditos_otorgados: 10000`.
  - Si los productos no se sembraron, cualquier taller puede crear el handle, porque el validador acepta `handle`.
  - Resultado: créditos de herramientas HETNA casi gratis.
- **Condición:** depende de qué seller es dueño hoy de esos productos y de si Mercur pide aprobación al editar. No lo pude ver sin la base.
- **Arreglo:** precio y créditos solo desde la constante del servidor (o desde un ajuste de admin), nunca desde la metadata. Al menos, exigir que el producto pertenezca al seller de HETNA.

#### Baja

- **B1.** `cotizacion-liga.ts:807-821` (`capturarPaypal` del Cotizador):
  - Cobra una orden aprobada sin comparar su monto con lo que falta, a diferencia de la licitación. Con dos pestañas o una orden vieja, el cliente paga de más.
  - Revisa el `payee` después de cobrar: si el taller cambió de PayPal, el dinero ya se fue a la cuenta anterior y el pago no se anota.
  - **Arreglo:** validar monto y `payee` antes del `/capture`, como en `capturarPaypalLicitacion`.
- **B2.** `saldos-talleres.ts:83`: `PAGADO` incluye `authorized` y `partially_authorized`, así que una venta digital queda "disponible" sin que el pago se haya cobrado de verdad. **Arreglo:** para liberar, exigir `captured`.
- **B3.** `api/api/mp-envio/route.ts:120-127` (`pagoDeSobrepeso`): marca "pagado" aunque el sobrepeso esté `descontado` (ya se cobró de los pagos al taller) o `anulado`. Así se cobra dos veces. **Arreglo:** aceptar el pago solo si el estado es `por_cobrar`; si no, avisar para devolverlo.
- **B4.** `api/store/hetna-cupones/middlewares.ts` (`revisarAlPagar`): si la revisión truena, deja pasar la compra con el comentario "Medusa ya limita los usos". Pero BIENVENIDA no tiene `limit`, así que puede aplicarse fuera de la regla de primera compra. **Arreglo:** si el carrito trae un cupón HETNA, rechazar con 503 en vez de seguir.
- **B5.** `cotizador-comisiones.ts:206-218` (`marcarPagado`): no marca `comision_cobrada=true` en las filas de licitación (`hetna_solicitud_pago`) del cobro. Hoy no afecta porque `PCT_POR_PLAN` está en 0, pero si se reactiva la comisión quedarán como no cobradas. **Arreglo:** actualizar también `T_PAGO_LIC` por `comision_cobro_id`.

#### Revisado sin problemas

Lo leí de punta a punta:
- **Conexión de cuentas del taller (OAuth):** el `state` de Mercado Pago y de PayPal va firmado con HMAC, con secreto propio, comparación segura y vencimiento (`cotizacion-liga.ts:897-1027`).
- **Rutas del Cotizador** (`cotizador-mp/*` y `cotizador-paypal/*`): `adminDesdeToken` valida la sesión de Supabase en el servidor y saca el taller de ahí, con rol de administrador.
- **`mp-cotizacion`:** el pago se relee con el token del taller y se verifican `collector_id` y `external_reference`.
- **`mp-licitacion` con `sol`:** verifica collector y referencia. El monto debe ser el siguiente cobro esperado, la fila se bloquea con `FOR UPDATE` y `externo_id` es único.
- **`capturarPaypalLicitacion`:** revisa referencia, `payee`, moneda y monto antes de cobrar.
- **`mp-tarjeta` y `tarjeta-paypal`:** revisan monto, moneda y tipo de tarjeta, y devuelven el cargo.
- **`mp-verificacion`:** revisa monto y moneda.
- **`mp-suscripcion` y `paypal-suscripcion`:** releen la suscripción al proveedor y validan monto, plan y moneda (`planValido`).
- **`creditos-compra`:** confirmar revisa el dueño de la compra y acredita con un UPDATE condicionado, una sola vez.
- **`mp-envio`:** valida monto y moneda.
- **Filtros a Supabase:** sin inyección en PostgREST (`correoParaFiltro`, regex de `cotizacionPorToken`, ids que vienen de la base).
- **Token de los hooks** (`social-hub-token`): rechaza si falta o si la longitud no coincide.
- **Ligas firmadas de `hooks/*`** (baja, verificar-correo, alta-taller): HMAC con comparación segura.
- **Correos HTML:** los valores van escapados (`esc` y `fila`).
- **Cliente de PayPal** (`paypal-api.ts`): no expone secretos al navegador.


### Área: cotizador

#### Auditoría de seguridad y fallas: Cotizador (rama main, todo el código del área, no un diff)

No encontré ningún hallazgo Alta, es decir, ninguno que alguien de fuera pueda aprovechar en la práctica para robar dinero o datos. `middlewares.ts` no autentica `/api/*`: cada ruta revisa la sesión por su cuenta. Todas las rutas privadas lo hacen bien (`adminDesdeToken` o `tallerDeSesion` en las rutas de facturas) y siempre filtran por el `negocio_id` de la sesión.

#### Media

**1. Pagos que se registran dos veces y crean pedidos duplicados**
- Archivos: `packages/api/src/lib/cotizacion-liga.ts:701-702` y `:836-837` (lectura de `previo`), `:636-637` (`completo`) y `asegurarPedido` en `:190-208`.
- Qué pasa: Mercado Pago suele mandar dos avisos casi al mismo tiempo por un mismo pago (el webhook `type=payment` y el IPN `topic=payment`). Lo mismo ocurre si el cliente recarga el regreso de PayPal.
- Las dos peticiones leen `previo` antes de que la otra guarde, y las dos quedan con `recienAprobado=true`.
- Las dos usan la cotización `c` vieja (sin el anticipo marcado como pagado), así que las dos llaman `asegurarPedido`. Ahí `pedidoDe()` devuelve null para ambas y se insertan **dos pedidos `Pago50`** para la misma cotización. Además salen dos avisos al taller y dos mensajes al cliente.
- Arreglo: que la anotación sea atómica. Por ejemplo, un upsert condicional que regrese la fila solo cuando el estado pasa a `approved`, o `ponerSiVacio` sobre un campo `pedido_creado`. Agregar un índice único en `pedidos(cotizacion_id)`.

**2. PayPal en COP/PEN/CLP acredita lo que falta del anticipo hoy, no lo que cubrió la orden**
- Archivo: `packages/api/src/lib/cotizacion-liga.ts:830`
- El código: `montoCot = monedaCot === moneda ? monto : anticipoDe(c) - anticipo_pagado`.
- Escenario: el cliente crea una orden de PayPal cuando el anticipo era chico. Después el taller corrige la cotización con la misma liga y sube el anticipo. El cliente paga la orden vieja y se le acredita **todo** el anticipo nuevo: queda "pagado" y se crea el pedido.
- También: dos órdenes pagadas en pestañas distintas pueden acreditar dos veces o dejar la segunda en 0.
- Arreglo: guardar en la orden el monto en la moneda de la cotización (en `custom_id` o en una tabla con el id de la orden) y acreditar el menor entre ese monto y lo que falta.

**3. Reembolsos y contracargos no deshacen el anticipo ni el pedido**
- Archivo: `packages/api/src/lib/cotizacion-liga.ts:624-633`
- Si un pago pasa a `refunded`, `charged_back` o `cancelled`, `registrarPago` sí baja `anticipo_pagado`. Pero `anticipo_estado="pagado"`, `estado` y el pedido nunca se revierten, y no se avisa al taller (`recienAprobado=false`).
- Con PayPal nunca se ve un reembolso, porque no hay webhook.
- Escenario: el cliente paga, el taller ve "Anticipo recibido" y empieza a fabricar, y luego el cliente desconoce el cargo.
- Arreglo: si el total aprobado queda por debajo del anticipo, regresar `anticipo_estado` a pendiente y mandar un aviso "pago revertido" al taller. Agregar el webhook de PayPal (`PAYMENT.CAPTURE.REFUNDED` / `REVERSED`).

**4. Las solicitudes del cotizador en línea se pueden usar para saturar al taller (`/api/taller-publico/:slug/solicitar`)**
- Archivos: `packages/api/src/api/api/taller-publico/[slug]/solicitar/route.ts:13` y `packages/api/src/lib/cotizador-en-linea.ts:362-366`, `:392` y `:422`.
- La IP sale de `cf-connecting-ip` / `x-real-ip`, que manda el propio cliente. nginx no los limpia, así que se pueden falsificar pegándole al servidor directo, sin pasar por Cloudflare. No usa `ipCliente`.
- El límite revisa y luego inserta: se cuentan las filas de `solicitudes_en_linea` y la fila nueva se inserta al final, después de subir el archivo (hasta 50 MB).
- Escenario: 100 peticiones en paralelo pasan el límite. Resultado: GB en el bucket `solicitudes`, cotizaciones que gastan el cupo mensual del taller (`SIN_CUPO`), avisos/push/correos al taller y correos de acuse a direcciones de terceros. Además, 60 solicitudes al día bastan para que la página del taller muestre "recibió muchas solicitudes".
- Arreglo: usar `ipCliente(req)`. Reservar el cupo antes de subir (insertar la fila primero o usar un contador atómico). Agregar un límite en memoria con `limitarLiga` en el matcher de `/api/taller-publico/*`.

#### Baja

**5. La IP de la solicitud de distribuidor se puede falsificar**
- Archivo: `packages/api/src/api/api/distribuidor-solicitud/route.ts:12`
- Toma `cf-connecting-ip`, luego `x-real-ip` y luego el **primer** valor de XFF, los tres falsificables. Así se salta el límite de 3 por hora.
- Cada envío manda un correo con remitente HETNA a la dirección que se escriba. Se puede usar para llenar de correos a un tercero, aunque el contenido va escapado.
- Arreglo: usar `ipCliente(req)` y limitar también por correo de destino.

**6. Filtros de PostgREST armados con datos del cliente**
- Archivo: `packages/api/src/lib/cotizador-en-linea.ts:264`. `encodeURIComponent` no protege la gramática de `or=(...)`, porque PostgREST decodifica antes de interpretar.
- Ejemplo: `correo = "x@y.zz,id.not.is.null"` pasa la validación y hace que la solicitud spam quede ligada a un cliente real cualquiera del taller.
- En `packages/api/src/lib/cotizacion-liga.ts:683` el `cotId` sale de `metadata.cotizacion_id` sin validar que sea UUID. El daño queda frenado por las revisiones de collector y `external_reference` que vienen después.
- Arreglo: no meter el correo dentro de `or=` (hacer dos consultas con `correo=eq.<valor>`) y validar UUID en `:683`.

**7. La factura lee la cotización sin revisar que sea del taller**
- Archivo: `packages/api/src/lib/cotizador-cfdi.ts:327-328`
- Lee `cotizaciones?id=eq.${ped.cotizacion_id}` sin `&negocio_id=eq.${n.id}`. Si las reglas de Supabase (RLS) dejan que un taller edite `pedidos.cotizacion_id`, podría timbrar y descargar en PDF/XML las partidas de otro taller. No pude comprobarlo porque las políticas de Supabase no están en el repo.
- Arreglo: agregar el filtro por `negocio_id`.

**8. Cupo de facturas con carrera y elección de taller sin orden**
- Archivos: `packages/api/src/lib/cotizador-cfdi.ts:384-385` y `:81`.
- El cupo se cuenta antes de timbrar y el candado es por pedido. Varias facturas de pedidos distintos emitidas al mismo tiempo entran como "incluidas", así que se pierden cobros de $2.
- `tallerDeSesion` usa `limit=1` sin `order`, mientras `adminDesdeToken` usa `order=id.desc`. Un usuario que está en dos talleres puede facturar bajo un taller distinto al que ve en la app.
- Arreglo: hacer el candado por negocio en modo real y usar el mismo `order=id.desc`.

#### Revisado sin problemas
- Todas las rutas privadas (`cotizador-mp`, `-paypal`, `-cfdi`, `-marketing`, `-pagina`, `-suscripcion`, `vincular`) exigen la sesión de Supabase y filtran por el taller del usuario.
- Facturas (PDF, XML, enviar, cancelar, sustituir) con IDOR cerrado por `negocio_id`; cancelar y sustituir solo los hace el administrador.
- El `state` de OAuth de Mercado Pago y PayPal va firmado con HMAC, se compara en tiempo constante, vence en 30 min y no usa secretos por defecto.
- El webhook `/api/mp-cotizacion` no confía en el cuerpo: vuelve a consultar el pago con el token del taller y revisa collector y `external_reference`.
- PayPal: la orden la crea el servidor, se revisan `custom_id` y payee, y la captura no se repite (`PayPal-Request-Id`). Las suscripciones validan monto y moneda (MP) o plan, producto y precio (PayPal). El cobro de comisiones valida el monto.
- Montos y precios nunca vienen del cliente (el anticipo sale de la base de datos). El PDF de la liga solo se firma para la carpeta del taller.
- Las ligas públicas tienen límite por IP con `ipCliente`, que toma el último valor de XFF.
- El documento público `/api/cotizacion/[token]` escapa todo y `escUrl` solo deja http(s) y `data:image`. Las fotos y el rastreo se filtran a `https`, y los correos de marketing y avisos van escapados.
- `/api/hetna-archivo` usa token firmado con HMAC y vencimiento, revisa el permiso en el momento y registra el acceso.
- La vinculación por código tiene límites guardados en la base y el único `knex.raw` usa parámetros.
- Los CSD (`.cer`/`.key`) van directo a Facturapi sin guardarse, y no hay secretos que lleguen al navegador.
- CORS solo responde a orígenes de la lista y deja fuera localhost en producción.

### Área: store

AUDITORÍA DE SEGURIDAD Y FALLAS: ÁREA store (packages/api/src/api/store/** y sus libs). Solo lectura: no edité nada ni llamé servicios externos.

#### ALTA

**1. Cualquiera puede apoderarse de las solicitudes de fabricación de otra persona usando su correo (enlace de afiliación + «Activar mi cuenta»).**
- Dónde:
  - `api/store/solicitudes-taller/route.ts:281-284 y 301`
  - `lib/afiliacion.ts:95` (`onConflict("email").ignore()` devuelve la fila que ya existía, con su `token_pantalla`)
  - `api/store/hetna-afiliacion/activar/route.ts:42-54`
  - `lib/afiliacion.ts:136` (`ligarSolicitudesPorCorreo`)
  - `api/store/mis-solicitudes/route.ts:41` (`liga: ligaPropuestas(f.token)`)
- Ataque:
  1. El atacante conoce el correo de un cliente que mandó solicitudes sin cuenta.
  2. Manda `POST /store/solicitudes-taller` sin sesión, con `email=víctima`, `crear_cuenta=true` y una descripción cualquiera. Como la víctima no tiene cuenta, la respuesta trae `afiliacion.activar` con el `token_pantalla` de la víctima.
  3. Con ese token, `GET /store/hetna-afiliacion/activar?t=` sin sesión ya devuelve el nombre y el teléfono guardados de la víctima.
  4. Se registra en la tienda con el correo de la víctima. El correo no se verifica: lo confirman el comentario de `customers/proteger-metadata.ts` y el de `hetna-recomienda/middlewares.ts`. Luego llama `POST /store/hetna-afiliacion/activar {t}`. Lo único que se revisa es que `c.email == a.email`, y se cumple.
  5. `ligarSolicitudesPorCorreo` le pasa todas las solicitudes de la víctima que no tienen `cliente_id`.
  6. `GET /store/mis-solicitudes` le entrega el token secreto de cada una.
- Con esos tokens el atacante:
  - ve las propuestas y precios, y el expediente;
  - elige taller y paga;
  - escribe al taller;
  - abre disputas;
  - borra los planos;
  - confirma «recibido», lo que dispara la liquidación al taller (`recibido/route.ts:26-36`).
- Arreglo:
  - Ligar solicitudes por correo solo cuando la liga es `deCorreo` o la cuenta tiene `correo_verificado`.
  - No devolver `token_pantalla` cuando la fila de afiliado ya existía (solo cuando se acaba de crear en esa petición).
  - En el GET de activar, no exponer el teléfono con el token de pantalla.

#### MEDIA

**2. Un cliente puede darse la Membresía Empresarial él mismo.**
- Dónde: `api/store/customers/proteger-metadata.ts:22`. La lista `PROTEGIDAS` no incluye `membresia_empresarial`, y `lib/confianza.ts:207-226` confía en `metadata.membresia_empresarial.activa`.
- Ataque: `POST /store/customers/me {metadata:{membresia_empresarial:{activa:true}}}` desbloquea las licitaciones privadas y restringidas, «solo verificados» y el resumen con IA (que es un gasto de IA).
- Además, `solicitudes-taller/route.ts:213` acepta la membresía con solo escribir en el formulario el correo de un miembro, sin sesión.
- Hoy la membresía es «gratis por ahora»; el riesgo crece en cuanto se cobre.
- Arreglo: agregar `membresia_empresarial` a `PROTEGIDAS`, y en el POST sin sesión no revisar la membresía por correo.

**3. Insignia de «taller (verificado)» en el foro sin probar el correo.**
- Dónde: `api/store/foro/middlewares.ts:9` (solo `authenticate`, sin `exigirCorreoVerificado`) y `foro/mi-taller/route.ts:18-22`.
- Ataque: alguien se registra con el correo de un taller y llama `vincularMiTaller` (`apps/storefront/src/lib/foro/acciones.ts:487`). Su perfil del foro queda como ese taller, con la insignia de verificado. Sirve para hacerse pasar por el taller y para phishing a clientes.
- Arreglo: agregar `exigirCorreoVerificado()` a `/store/foro/mi-taller`.

**4. Rutas públicas que mandan correos a cualquier dirección sin límite.**
- Dónde: `api/store/quote-leads/route.ts:34` y `api/store/solicitudes-taller/route.ts:113`. Las dos son POST sin sesión.
- Ataque: un script manda miles de peticiones con correos ajenos. HETNA termina mandando confirmaciones desde su dominio de Resend: se daña su reputación de envío y se agota la cuota. En solicitudes, además se crean afiliados y se avisa a los talleres cuando no hay revisión, y el texto libre (descripción) llega a los talleres. La trampa `sitio_web` no detiene un script.
- Arreglo: límite por IP y por correo de destino, como ya hace `limitarPorIp` en solicitud-archivos, más CAPTCHA o Turnstile en los dos formularios.

**5. La llave del archivo de un producto digital no se restringe y la decide el taller.**
- Dónde: `lib/mis-descargas.ts:68`, `lib/digital-delivery.ts:120` y `lib/descargas-gratis.ts:141`. Las tres firman `metadata.archivo_storage_key` del producto tal cual viene.
- Mercur deja al taller escribir `metadata` libre (y `status`) en `POST /vendor/products` y `/:id`, y no hay un middleware del proyecto que quite esas llaves.
- Ataque:
  1. Un taller guarda la clave (`solicitudes/…`) de un plano de cliente. La clave se lee decodificando en base64 el token de `/api/hetna-archivo/<token>` (el campo `k`, en `lib/archivo-acceso.ts:43-46`).
  2. Pierde la licitación, y con ella el acceso.
  3. Crea un producto con `producto_digital` o `archivo_gratis` y `archivo_storage_key` igual a esa clave.
  4. Lo «compra» o lo baja gratis y obtiene una liga firmada al plano. Así se salta la revocación del problema 4 de la auditoría.
- Condiciones: necesita la clave y que el producto quede publicado. No verifiqué si Mercur respeta el `status: published` que manda el taller.
- Arreglo: en las tres funciones aceptar solo prefijos de producto digital (por ejemplo `disenos/`, `libros/<seller>/`), y quitar esas llaves de la metadata en `/vendor/products*`.

**6. Posible XSS almacenado o phishing con `archivo_url`.**
- Dónde: `api/store/solicitudes-taller/route.ts:166` guarda `archivo_url` sin revisar el esquema.
- Se pinta como `<a href={t.archivo}>` en dos lugares:
  - `apps/vendor/src/routes/solicitudes/page.tsx:1330`
  - `apps/admin/src/routes/solicitudes/page.tsx:185`
- React 18 no bloquea `javascript:`. Con `target=_blank` que se ejecute depende del navegador, pero como mínimo es una liga arbitraria en el panel de administración y en el del taller.
- Arreglo: al guardar, aceptar solo `https?://`; en los paneles, validar antes de pintar.

#### BAJA

**7. Reseñas de productos que no se compraron.**
- Dónde: `api/store/resenas/route.ts:117`. El `validateReviewStep` de Mercur solo revisa que la orden sea del cliente y que no repita la reseña. No revisa que el producto venga en esa orden ni que la orden esté pagada.
- Ataque: con cualquier pedido se puede reseñar cualquier producto, una vez por pedido.
- Lo mitiga que la reseña nace `pending` y se modera.
- Arreglo: antes del workflow, revisar que `product_id` esté entre los artículos de la orden y que esté pagada (`estaPagada`).

**8. El cupón BIENVENIDA se salta la revisión al aplicarlo.**
- Dónde: `api/store/hetna-cupones/middlewares.ts`.
- `POST /store/carts` también acepta `promo_codes` (validador `CreateCart` de Medusa 2.21), y esa ruta no tiene middleware. Queda solo la revisión al pagar, y esa deja pasar la compra si falla (líneas 75-79).
- Además, dos compras simultáneas pasan las dos `yaCompro`.
- El daño es acotado ($100 por cuenta).
- Arreglo: agregar `revisarAlAplicar` a `POST /store/carts`, y fallar cerrado al pagar cuando hay un cupón HETNA.

**9. Caché sin tope en `lib/perfil-unico.ts:16-21`.**
- Ataque: `GET /store/hetna-perfil-unico?taller=<aleatorio>` es público y cada handle distinto agrega una entrada que nunca se borra. Con muchas peticiones crece la memoria.
- Arreglo: tope de tamaño o LRU, y no guardar en caché los resultados `null` de handles que no existen.

**10. La IP del límite de subidas es la última de `X-Forwarded-For`** (`lib/ip-cliente.ts:18`).
- Si hay Cloudflare delante (`safedeal-http.ts` usa `cf-connecting-ip`, así que parece que sí), esa IP es la del nodo de Cloudflare.
- Consecuencia: el límite de 30 subidas por hora de `solicitud-archivos` se reparte entre muchos clientes reales, que pueden quedar bloqueados.
- Arreglo: usar `cf-connecting-ip` cuando la petición venga de rangos de Cloudflare.

#### Revisado sin problemas

- **Descargas y comprobantes:** `customers/me/descargas*` y comprobante (por `customer_id` y orden pagada).
- **Pedidos y rastreo:** `hetna-pedidos/:id/recibido` y `hetna-rastreo/:id` (ambos revisan que el pedido sea del cliente).
- **Facturas y evidencia:** `customers/me/facturas/:id/archivo` y `envios/:folio/evidencia` (por dueño, con regex de clave).
- **Expedientes:** `expedientes/:clave` (token de 32 caracteres o más, o liga HMAC con comparación de tiempo constante que se vuelve a validar contra el taller elegido).
- **Rutas con token de solicitudes-taller:** `elegir` (transacción contra doble elección), `pagar`, `contraoferta`, `problema` (UPDATE condicional), `acceso`, `invitar`, `borrar-archivos`, `analisis`, `mensajes`, `preguntas`, `resena`, `evaluacion`, `acuerdo` y `documento`.
- **SafeDeal:** el código para firmar tiene 6 dígitos, expira en 10 minutos, permite 5 intentos y obliga a esperar 1 minuto entre reenvíos.
- **Cobro de licitaciones (`lib/licitacion-cobro.ts`):** el monto lo calcula el servidor, el aviso de Mercado Pago se vuelve a consultar con la llave correcta y se revisan `collector_id`, la referencia y la moneda. PayPal se valida antes de capturar. Hay `forUpdate` y un `externo_id` único. Las rutas `api/mp-licitacion` y `api/licitacion-paypal/[token]` solo delegan en esas funciones.
- **Subida de archivos:** `solicitud-archivos` (revisión de contenido real, ZIP y ClamAV; bucket privado; la clave se acepta solo si se registró y no se ha usado). `boleto` está retirado (responde 410).
- **Filtros de PostgREST:** `perfil-unico`, `correoParaFiltro` y `tallerPorCorreo` escapan los comodines o comparan el correo exacto después. No encontré SQL con interpolación en el área: todos los `whereRaw` usan parámetros.
- **Otras rutas:** `verificacion`, `mis-solicitudes` (por `cliente_id`), `cotizador-vinculo` (autenticada y con correo verificado), `resenas/fotos` (el tipo sale de una lista blanca y `ligarFotos` filtra por `customer_id`) y `foro/aviso` (con sesión, tope por hora y ruta validada).

No revisado a fondo: `cam/*`, `cotizador/*`, `creditos-3d/*`, `courses/*`, `escaneos/*`, `hetna-cloud/*` y `trabajos-abiertos/*`, porque no estaban en la lista del área.

### Área: vendor-admin

#### Auditoría de seguridad y fallas: vendor-admin (rama main)

Revisé todas las rutas de `packages/api/src/api/vendor/**` y las de dinero y archivos de `api/admin/**`, siguiendo cada una hasta las libs y hasta el código de Mercur/Medusa instalado en node_modules. Es solo lectura: no edité nada.

#### ALTA

**1. Un taller puede escribir sus propios datos protegidos: insignia de verificado, plan de pago y exención de requisitos**
- Dónde:
  - `packages/api/src/api/vendor/hetna-verificacion/middlewares.ts:21-47` (lista PROTEGIDAS) y `:149` (matcher solo `/vendor/sellers/me`).
  - `lib/licitacion-cobro.ts:122`, `lib/ia-fabricacion.ts:54`, `lib/licitacion-plan.ts:60`.
- Qué pasa:
  - (a) `metadata.plan` y `plan_vence` no están en PROTEGIDAS. `planComision`, `permisoIA` y `cupoLicitacion` dan prioridad al "plan puesto a mano". El propio formulario del panel guarda por `POST /vendor/sellers/me`. Un taller Gratis manda `{"metadata":{"plan":"industrial"}}` y obtiene:
    - el asistente de IA (cuyo costo paga HETNA);
    - propuestas sin límite;
    - la verificación de $299 sin pagar (`debePagarVerificacion` devuelve false si el plan no es gratis);
    - la revisión de certificaciones gratis.
  - (b) Mercur expone también `POST /vendor/sellers/:id` (con `ensureSellerIdParamMiddleware`, que solo exige que :id sea el suyo) y `POST /vendor/sellers` (alta de cuenta). Los dos aceptan `metadata` y ninguno pasa por `protegerMetadata`. Con `POST /vendor/sellers/<su_id>` y `{"metadata":{"verificado":true,"empresa_verificada":true,"requisitos_exento":true,"tarjeta_verificada_en":"…","verificacion_pagada":{"en":"…"},"perfil":{"calificacion":5}}}` el taller:
    - se pone la insignia de verificado sin documentos;
    - entra a licitaciones "solo verificados";
    - se salta la verificación de tarjeta y la aceptación de términos (`estadoRequisitos` devuelve `completo` si está exento).
  - Busqué hooks o suscriptores que reparen esto y no hay ninguno.
- Arreglo:
  - Agregar `plan` y `plan_vence` a PROTEGIDAS.
  - Poner `protegerMetadata` también en `POST /vendor/sellers/:id` y `POST /vendor/sellers` (en el alta, quitar todas las llaves protegidas).
  - Mejor aún: quitar `metadata` de esas rutas y guardar el perfil por una ruta propia con una lista de llaves permitidas.

**2. Cualquier taller aprobado puede descargar cualquier archivo del bucket privado: planos de clientes y productos digitales de pago**
- Dónde:
  - `lib/descargas-gratis.ts:138-144` y `lib/digital-delivery.ts:113-120`: entregan `metadata.archivo_storage_key` sin revisar de quién es ni con qué prefijo empieza.
  - `packages/api/medusa-config.ts:118` (`product_request: false`).
  - `lib/archivo-acceso.ts:42-44`: el token es JSON en base64 sin cifrar e incluye la clave.
- Cadena, comprobada en el código instalado:
  1. Las validaciones de Mercur para crear y editar productos aceptan `metadata` libre.
  2. Con `product_request` apagado, el alta acepta `status: "published"` y las ediciones se confirman solas (`auto-confirm-product-change.js`).
  3. Ningún middleware propio filtra la metadata de productos.
  4. Las claves se pueden conseguir de dos formas:
     - Las de productos de pago (libros `libros/<seller>/<hex>.pdf`, diseños de la Fábrica) salen en `metadata` de `/store/products`: el query-config por defecto de Medusa y el de Mercur incluyen `metadata`.
     - Las de planos de clientes (`solicitudes/...`) van legibles dentro del token de `/api/hetna-archivo/<token>` que recibe el taller (`vendor/hetna-solicitudes/[id]/archivos/route.ts:43`).
- Ataque: el taller crea un producto publicado con `{"archivo_gratis":true,"producto_digital":true,"archivo_storage_key":"<clave robada>"}` y lo baja con su cuenta de cliente en descargas gratis. Resultado:
  - piratería de cualquier archivo de pago;
  - un taller que perdió la licitación sigue bajando los planos confidenciales del cliente, sin la nueva revisión de permiso y sin quedar en el registro de accesos.
- Arreglo:
  - En descargas-gratis y digital-delivery, aceptar solo claves de una lista blanca ligada al dueño (por ejemplo `libros/<seller_del_producto>/`, `disenos/`) y nunca `solicitudes/`, `facturas/`, `propuestas/`, `avances/`, `guias/`, `certificaciones/` ni `cloud/`.
  - Bloquear con un middleware las llaves `archivo_storage_key`, `archivo_gratis` y `producto_digital` en `/vendor/products*`.
  - Quitar `archivo_storage_key` de las respuestas de la tienda.
  - Cifrar o eliminar `k` del token.

#### MEDIA

**3. La verificación de WhatsApp no comprueba que el número sea del taller**
- Dónde: `lib/whatsapp.ts:154` y `:190-197`; `api/vendor/hetna-whatsapp/route.ts:21-26`.
- Qué pasa:
  - `accion:"iniciar"` le devuelve al navegador `liga` con el texto `"…mi código de verificación es <codigo>"` en claro.
  - `accion:"confirmar"` acepta ese mismo código. El taller confirma el número de cualquier persona sin tener ese teléfono.
  - `marcarVerificado` reasigna el número: se le puede quitar el WhatsApp verificado a otro taller y mandar los avisos de HETNA a un tercero (spam desde el número de HETNA).
  - La misma lib la usa la tienda para clientes.
- Arreglo: no devolver el código en `iniciar` (que lo escriba el usuario desde su WhatsApp) o que `confirmar` solo valga para el código mandado por `mandarCodigo`. Agregar un límite de intentos.

**4. "Marcar pagado" puede dar por pagados pedidos que no entraron en la transferencia**
- Dónde: `lib/saldos-talleres.ts:230-238`; `apps/admin/src/routes/pagos-talleres/page.tsx:52`.
- Escenario:
  1. El admin abre la pantalla (disponible: $1,000) y hace el SPEI.
  2. Mientras tanto se vende un producto digital del taller, que pasa a "disponible" al momento (`saldos-talleres.ts:151`), o corre la tarea que libera saldos.
  3. Al confirmar, el POST va sin `order_ids` y `marcarPagado` marca TODO lo disponible como pagado con esa referencia.
  4. El taller deja de ver un saldo que nunca recibió.
- Arreglo: que la pantalla mande los `order_ids` o el total mostrado, y que el backend rechace si no coincide.

#### BAJA

**5. SSRF ciego en la revisión de fondo blanco**
- Dónde: `api/vendor/fondo-blanco/middlewares.ts:46` (alcanzable desde `vendor/hetna-publicar/revisar-foto/route.ts:8`, `/vendor/products` y `hetna-publicar`).
- Qué pasa: hace `fetch` a cualquier URL http(s) que mande el taller, incluidas IPs internas y metadatos de la nube. Solo devuelve true/false/null y no regresa el contenido.
- Arreglo: permitir solo el host del almacenamiento propio o bloquear IPs privadas y de link-local.

**6. Un taller puede borrar la suscripción de avisos de otro**
- Dónde: `api/vendor/hetna-push/route.ts:45-50`.
- Qué pasa: `DELETE` borra por `endpoint` sin filtrar por el taller de la sesión. El endpoint es difícil de adivinar, por eso la prioridad es baja.
- Arreglo: pasarle `sellerId` a `borrarSuscripcion`.

**7. HTML sin escapar en un correo interno**
- Dónde: `lib/promocion.ts:203`.
- Qué pasa: el nombre del taller va sin escapar en el HTML del correo a HETNA_LEADS_EMAIL. Un taller con nombre `<a href=…>` mete enlaces en un correo interno.
- Arreglo: usar `esc()`.

#### Revisado sin problemas

- **Rutas /vendor y aislamiento entre talleres:** todas toman el taller de `seller_context` (Mercur exige `x-seller-id` o la sesión y comprueba que el usuario sea miembro de ese taller) y filtran por `seller_id`. Revisé:
  - facturas (subir, rechazar, archivo; incluye la revisión del RFC en el XML);
  - guías (cotizar, comprar con la toma atómica de la guía, etiqueta, evidencia);
  - HetNa Cloud (proyectos, piezas, archivos con candado de cupo, ligas, descarga);
  - solicitudes: lista, archivos, propuesta, adjunto, acceso, pregunta, respuesta, hitos, hito-foto, avance, contraoferta, expediente, evaluación, y acuerdo/mensajes/documento vía `solicitudTaller`;
  - certificaciones, licencias, ficha extendida, libros (la llave se valida contra `libros/<seller>/`), volumen (comprueba el dueño de la oferta), envíos, saldo, promoción y videos, clientes y chat (solo clientes que le compraron), verificación (documentos y pago de $299 consultando el pago otra vez a Mercado Pago), requisitos, alta, cursos, tablero y meta.
- **Rutas /admin:** Medusa les aplica `authenticate("user")` por defecto y ninguna lo desactiva.
- **SQL:** los `knex.raw` y `whereRaw` del área usan parámetros (solo interpolan nombres de tabla constantes).
- **Escapado en correos:** `fila()` y `boton()` escapan.
- **Frontends:** `apps/vendor/src` y `apps/admin/src` no guardan secretos. El único `dangerouslySetInnerHTML` es la vista previa del blog en el admin, con contenido que escribe el propio admin.
- **Archivos de verificación:** las rutas en disco se arman con ids aleatorios, sin path traversal.
- **OAuth de Pinterest/TikTok:** el parámetro `state` se valida.


### Área: storefront

AUDITORÍA DE SEGURIDAD Y FALLAS — ÁREA STOREFRONT (apps/storefront, rama main)

No encontré ningún hallazgo de prioridad Alta. No hay ruta abierta que dé acceso a datos de otro cliente o taller, ni webhook que acepte pagos sin verificarlos, ni XSS que pueda inyectar un usuario cualquiera.

== MEDIA ==

1. Cualquiera, sin cuenta, puede tumbar toda la tienda (checkout incluido) con el CAM Studio
   - apps/storefront/src/app/api/cam/post/route.ts:118-121. `vm.runInContext` es síncrono y tiene un tope de 25 s. Corre en el hilo principal del único proceso `next start` (pm2 hetna-web). El cuerpo admite hasta 12 MB gzip → 40 MB, y hasta 600 000 movimientos.
   - apps/storefront/src/app/api/cam/gcode/route.ts:168. Cada petición lanza un proceso de Python de hasta 30 s, sin límite de concurrencia.
   - Ninguna de las dos pide sesión para calcular. nginx no limita /api/cam/* (infra/nginx/hetna-limites.conf solo cubre /auth y login).
   - Escenario: un script manda peticiones POST /api/cam/post seguidas con n alto. Mientras el motor corre, el hilo de Node no atiende ninguna otra petición, y la tienda deja de responder a todos. En /api/cam/gcode, decenas de Pythons en paralelo agotan CPU y RAM.
   - Relacionados:
     - taller/foto-escaneo/route.ts:25-40 lee 12 MB en memoria antes de saber si hay sesión.
     - csp-reporte/route.ts:14 hace `req.text()` completo antes de recortar.
   - Nota: `vm` no es aislamiento. Al contexto entran objetos del proceso principal (`cab.estado`, `console`, `performance`). No encontré cómo aprovecharlo, pero no hay que tratarlo como sandbox.
   - Arreglo:
     - Mover el posprocesado a un worker_thread o pool con concurrencia 1-2 y una cola.
     - Poner `limit_req` en nginx para /api/cam/(post|gcode|torno).
     - Exigir sesión arriba de N movimientos y bajar el timeout.
     - En foto-escaneo, revisar la sesión antes de `formData()`.

2. El candado del plan del CAM Studio se puede saltar sin cuenta
   - cam/post/route.ts:130-131. Sin `descargar` devuelve las primeras 80 líneas y `total`, y el cliente elige `n` libremente.
     - Escenario: se manda la trayectoria en trozos de unas decenas de movimientos. Cada vista trae el programa completo de ese trozo (total ≤ 80), y pegándolas sale el G-code de 3D o multieje sin plan ni cupo.
     - Supuesto: que el encabezado del post ocupe menos de 80 líneas, que es lo normal. Lo deduje del código; no lo corrí.
   - cam/gcode/route.ts:136 junto con lib/cam/leer-gcode.ts: la vista devuelve la trayectoria completa, con X/Y/Z de cada segmento y el diámetro de la fresa. Con eso se rearma el G-code 2D.
   - cam/torno/route.ts:50-52 sigue el mismo patrón, con 60 líneas.
   - Arreglo:
     - En la vista, nunca devolver un programa completo (por ejemplo, si total ≤ 80, dar solo el encabezado).
     - Pedir un mínimo de movimientos, o firmar el trabajo en el servidor.
     - Para la simulación 2D, mandar una trayectoria simplificada o sin Z.

3. SSRF por el optimizador de imágenes de Next
   - apps/storefront/next.config.ts:141 y :146 permiten `{protocol:'http', hostname:'localhost'}` (sin puerto, o sea cualquiera) y `{protocol:'https', hostname:'**'}`.
   - En Next 15.5.24, `fetchExternalImage` (node_modules/next/dist/server/image-optimizer.js:852) hace un `fetch` simple: no bloquea IPs privadas y sigue redirecciones. Además devuelve el código de estado de la respuesta.
   - Escenario: `/_next/image?url=http://localhost:5678/webhook/...&w=64&q=75`, o `url=https://atacante/redir` → 302 a una IP interna. El servidor hace GET a n8n, a Medusa :9000 o a la red interna. Un webhook de n8n que acepte GET se dispara. El código de estado sirve para escanear puertos y rutas internas.
   - Solo devuelve el cuerpo si es una imagen. Además, con `minimumCacheTTL` de 1 año, sirve para llenar el disco con imágenes de terceros.
   - Arreglo: quitar `localhost` y `**` y dejar solo los hosts reales de imágenes (hetnacnc.com, el CDN o bucket de Backblaze, el que se use).

== BAJA ==

4. Se pueden vender más lugares de publicidad de los que hay
   - lib/publicidad/pedidos.ts:104-126 (`marcarPagado`) no revisa el cupo. `lugaresLibres` solo se consulta al crear el pedido (api/pub/comprar/route.ts:65).
   - Escenario: dos anunciantes abren el pago del último lugar y los dos pagan. Ambos quedan como "pagado", lo que obliga a reembolsar a mano.
   - Arreglo: dentro de la transacción de `marcarPagado`, bloquear y contar los pagados vigentes del espacio. Si está lleno, marcar el pedido "pagado_sin_lugar" y avisar a n8n.

5. Ligas de correo que cambian estado con un simple GET
   - api/baja/route.ts:31-32, api/app/verificar-correo/route.ts:26-31 y api/app/confirmar-taller/route.ts:28-37.
   - Los escáneres de ligas (Outlook SafeLinks, antivirus corporativos) abren las ligas solos. Resultado:
     - Clientes dados de baja sin haber hecho clic.
     - Correos confirmados sin que nadie los abriera. Alguien puede registrar una cuenta con el correo de otra persona y el escáner de esa persona la deja confirmada.
   - aprobar-taller ya resuelve esto con un formulario.
   - Arreglo: que el GET solo muestre un botón y que la confirmación sea por POST. Conservar el POST de RFC 8058 en baja.

6. Roles del HETNA Panel: se abren por default y solo existen en la tienda
   - lib/panel/sesion.ts:62-67: si falla `/admin/users?limit=100`, el usuario entra como "dueño".
   - Los roles solo se aplican en Next; cualquier administrador de Medusa puede llamar /admin directo, o ponerse `panel_rol` en su propio usuario.
   - Riesgo bajo, porque los administradores ya son de confianza.
   - Arreglo: que un error dé `sin_acceso` (salvo la lista PANEL_DUENOS), y documentar que los roles son de pantalla, no de permisos.

7. El HTML del blog se pinta sin limpiar
   - app/[locale]/(main)/foro-cnc/blog/[slug]/page.tsx:97 usa `dangerouslySetInnerHTML={{ __html: a.content_html }}`.
   - El HTML puede venir del pipeline de IA "fábrica" (packages/api/src/lib/fabrica/index.ts:354). Si un artículo generado trae `<script>` u `onerror` por inyección de instrucciones y un administrador lo publica sin revisar el HTML, el código corre en hetnacnc.com. La CSP tiene 'unsafe-inline', así que no lo frena.
   - Arreglo: pasar el contenido por `htmlSeguro`, extendido para `img` y `figure`, o limpiarlo en el backend al guardar.

8. calculadora/envio confía en cabeceras de IP que manda el cliente (condicional)
   - api/calculadora/envio/route.ts:12-17 usa `cf-connecting-ip` / `x-real-ip` tal como llegan.
   - Solo es explotable si se puede llegar al servidor de origen sin pasar por Cloudflare; el repo no permite saberlo.
   - Escenario: rotar IPs falsas para saltarse el límite del backend y mandar correos de HETNA a terceros.
   - Arreglo: usar `ipDe` de lib/seguridad/ip-cliente.ts, igual que las demás rutas.

== REVISADO SIN PROBLEMAS ==

- Pagos de publicidad:
  - pub/mp-aviso vuelve a consultar el pago en Mercado Pago, compara monto y moneda, y `marcarPagado` es idempotente por estado.
  - pub/comprar calcula el monto en el servidor y tiene cabecera anti-CSRF y límite por IP.
  - mp/licitacion solo reenvía el aviso al backend.
- Rutas con secreto: revalidate, pub/vencimientos y fundadores-aviso comparan el secreto en tiempo constante.
- Rutas de administrador:
  - pub/admin, pub/fundadores y pub/subir verifican contra /admin/users/me (los tokens de cliente y de vendedor no pasan) y piden la cabecera x-hetna-pub.
  - panel/accion tiene lista blanca de rutas y revisa el rol.
  - panel/archivo sirve el tipo detectado por firma de bytes en el backend, con nosniff.
- Acceso a recursos del usuario:
  - escaneos/[id]: el backend filtra por customer_id, y las fotos ajenas se rechazan por prefijo.
  - cam/proyectos y cam/pruebas: el ID se valida con regex, la sesión se manda al backend.
  - contrato/[token] usa token de 32 o más caracteres; resena-foto tiene regex.
- Subidas: foro/foto valida firma de bytes y el SQL va parametrizado.
- SQL: todo el de publicidad y del foro va parametrizado; las interpolaciones son nombres de tabla o columna fijos, o números.
- XSS: `htmlSeguro` está bien hecho, todos los JSON-LD escapan `<` como <, los popups de MapaTalleres escapan los textos, y los SVG de los generadores solo usan datos propios.
- Secretos: ningún NEXT_PUBLIC_* lleva un secreto y no hay llaves escritas en src ni public.
- Configuración: CORS de /api/app con lista blanca (localhost solo fuera de producción), `destinoSeguro`, y cookies de sesión httpOnly.
- Middleware: solo protege pantallas; el backend vuelve a validar el token.
- Server actions de carrito, checkout y cliente: dan las mismas capacidades que la API store de Medusa con la llave publicable. El monto lo calcula el backend y `urlRetorno` valida el `return_url`.
- courses.ts valida el slug con regex.
- Los bridges de Python reciben las rutas por argumentos y la config no llega a ninguna ruta de archivo.
- No revisé a fondo products.ts, offers.ts, seller.ts ni fulfillment.ts.

### Área: integraciones

Auditoría de seguridad y fallas del área de integraciones (main, commit 31926a59). Fue solo lectura: no edité nada ni hice commits.

#### Alta

**1. Cualquiera marca como "pagado" su trabajo CAM comprando el producto más barato**
- **Dónde:** `packages/api/src/workflows/cam/steps/mark-cam-jobs-paid.ts:31` y `:48`, que corre con el suscriptor `subscribers/cam-order-placed.ts` en `order.placed`.
- **Ataque:**
  1. El atacante crea un trabajo CAM, aun sin sesión (`POST /store/cam/jobs`), y recibe su `id`.
  2. Agrega al carrito cualquier oferta barata: `POST /store/carts/:id/line-items {offer_id, quantity:1, metadata:{cam_job_id:"<id>"}}`. Lo comprobé en `@mercurjs/core .../store/carts/[id]/line-items`: Mercur acepta `metadata` libre y la copia a la línea.
  3. Paga el pedido. El paso solo busca `items.metadata.cam_job_id` y pone el trabajo en `paid`. No revisa que la línea sea del producto de servicio CAM, ni el nivel ni el precio, ni que el trabajo estuviera `in_cart` con ese carrito.
  4. Resultado: HETNA hace un trabajo de 5 ejes cobrando, por ejemplo, $20, y los entregables quedan liberados (`files/[file_id]/route.ts`).
- **Arreglo:** marcar `paid` solo si la línea es de una variante de `CAM_PRODUCT_HANDLES`, del servicio y nivel del trabajo, y si `job.status==="in_cart" && job.cart_id===order.cart_id`. Además, quitar `cam_job_id` del `metadata` que llega por `/store/carts/*/line-items` (un middleware de entrada).

**2. Un taller ve los modelos y G-code CAM pagados de otra persona con solo cambiar su correo**
- **Dónde:** `packages/api/src/lib/cloud.ts:328-339` (`importarCam`), que corre en cada `GET /vendor/hetna-cloud` (`api/vendor/hetna-cloud/route.ts:20`).
- **Ataque:**
  1. El taller A manda `POST /vendor/sellers/me {email:"cliente@empresa.com"}`. Mercur acepta `email` en `UpdateSeller` y `protegerMetadata` no lo bloquea; no se pide volver a confirmar el correo.
  2. Abre HetNa Cloud. `importarCam` busca los `cam_job` pagados cuyo `j.email` sea ese correo, o cuyo `customer_id` sea de un cliente con ese correo.
  3. Se crean proyectos con `clave = medusa:<file_id>` del modelo, el G-code y los entregables, hasta 50 trabajos.
  4. `archivos/[id]/descarga` → `ligaMedusa` le entrega la URL de cada archivo. Es lectura entre clientes y talleres de archivos pagados y confidenciales.
- **Arreglo:** no relacionar trabajos CAM por un correo que el taller puede editar. Ligar por la identidad de acceso del miembro, o pedir confirmación del correo antes de guardar `seller.email`. Como mínimo, importar solo con `j.customer_id` de un cliente cuya cuenta sea del mismo `auth_identity`.

**3. XSS guardado en el origen del panel con un "G-code" subido sin sesión**
- **Condición:** que `/static` se sirva en el mismo dominio que `/seller`. Es lo que dicen `FILE_BACKEND_URL` por omisión (`http://localhost:9000/static`) y AGENTS.md (panel en `:9000/seller`).
- **Dónde:** `packages/api/src/api/cam-middlewares.ts:45`, `api/store/cam/jobs/route.ts:43-47` y `apps/admin/src/routes/trabajos-cam/page.tsx:357`.
- **Ataque:**
  1. `checkModelFile` solo revisa `model`. El campo `gcode` acepta cualquier nombre: `safeFilename` deja `x.html` o `x.svg`.
  2. `file-local` guarda los archivos "private" dentro de `static/` (dice en su código que es "no way to serve private files"). El G-code queda en `/static/private-<ts>-x.html` y se sirve como `text/html`.
  3. Cuando el admin toca "Descargar G-code", se ejecuta `window.open(url)` y el script corre con la sesión del administrador.
- **Arreglo:** exigir extensión de G-code (`nc|tap|ngc|gcode|txt`) y renombrar en el servidor. Servir `/static` con `Content-Disposition: attachment` y `nosniff`, o mover los archivos privados fuera de `static` o a B2.

#### Media

**4. El correo de la cuenta de cliente no se verifica en el backend, y varias funciones confían en él**
- **Dónde:** `api/store/hetna-cloud/cam/route.ts:35`, `lib/push.ts:186` y `lib/whatsapp-pedidos.ts:135`.
- **Por qué es posible:** comprobé que `createCustomerAccountWorkflow` de Medusa toma `email` del cuerpo, sin ligarlo a la identidad. Solo falla si ya existe una cuenta con contraseña para ese correo. `correo_verificado` solo lo revisa la tienda (`/store/verificacion`).
- **Escenario A:** el atacante abre una cuenta de cliente con el correo de un taller que no tiene cuenta de cliente. Con `/store/hetna-cloud/cam` escribe en la nube de ese taller: le gasta el cupo y le deja archivos falsos.
- **Escenario B:** con el correo de alguien que solo compró como invitado, el atacante verifica su propio WhatsApp o push. Recibe los avisos de pedido de la víctima: número de pedido, total, paquetería, guía y liga de rastreo.
- **Lo mismo fuera del área:** `api/store/foro/mi-taller/route.ts:18`.
- **Arreglo:** en todas las búsquedas por correo, aceptar solo clientes con `metadata.correo_verificado===true` (o creados antes de `VERIFICAR_DESDE`). Mejor aún, exigir la verificación con un middleware del backend.

**5. El precio del servicio CAM sale de datos del navegador**
- **Dónde:** `api/store/cam/jobs/route.ts:32` y `:52`.
- **Falla:** `tier = computeTier(p.stats)` y `service = serviceFromStrategy(p.strategy_kind)` vienen del cliente. `resolve-cam-line-items` elige la variante, y con ella el precio, a partir de esos valores.
- **Ataque:** mandar `stats:{minutes:0,points:0,triangles:0}` y `strategy_kind:"top3"` para un trabajo de 5 ejes y pagar el nivel "Básica" de 3 ejes.
- **Arreglo:** calcular triángulos y servicio en el servidor a partir del modelo y del `config`, o que el admin confirme el nivel antes de cobrar.

#### Baja

**6. Verificación de WhatsApp sin tope de intentos**
- **Dónde:** `lib/whatsapp.ts:190-196` (`confirmarCodigo`) y `api/store/customers/me/whatsapp/route.ts:25-30`.
- **Ataque:** cualquier cuenta inicia la verificación de un número ajeno y prueba los 900 mil códigos durante los 30 minutos de vigencia (unas 250 peticiones por segundo). Con eso liga el número de la víctima a su cuenta y le quita el vínculo con la suya. Hay límites en `infra/nginx/hetna-limites.conf`, pero no revisé si cubren esta ruta.
- **Otro detalle:** `mandarCodigo` limita por número, no por cuenta, y gasta el tope diario compartido (`TOPE_DIA`).
- **Arreglo:** máximo 5 intentos por código y por cuenta, y aceptar el código solo si `pend_customer_id`/`pend_seller_id` es quien lo confirma.

**7. Firmas HMAC con secreto de respaldo débil**
- **Dónde:** `lib/alta-taller.ts:36`, `lib/verificar-correo.ts:23` y `lib/baja.ts:16`.
- **Falla:** si falta `BAJA_SECRET` y `COOKIE_SECRET` es `supersecret` (el valor de `.env.template`; `medusa-config.ts` solo avisa), cualquiera falsifica la liga de `/hooks/alta-taller/aprobar` y se aprueba su propio taller. También puede confirmar cualquier correo. Además, `baja.ts` no rechaza un secreto vacío.
- **Arreglo:** exigir un `BAJA_SECRET` propio de 32 caracteres o más, y rechazar el vacío o `supersecret`.

**8. Carrera en el modelo IA gratis del mes**
- **Dónde:** `workflows/create-escaneo/steps/create-escaneo.ts:150`.
- **Falla:** varios `POST /store/escaneos` en paralelo ven todos `usados=0`, así que salen varios modelos gratis, y Tencent cobra cada uno.
- **Arreglo:** `pg_advisory_xact_lock` por cliente antes de contar y crear.

**9. SSRF a ciegas por la suscripción push**
- **Dónde:** `lib/push.ts:80`.
- **Falla:** se acepta cualquier endpoint `https://`. En cada aviso, incluido `pushATodosLosClientes`, el servidor hace un POST a hosts internos o arbitrarios.
- **Arreglo:** permitir solo los servicios de push conocidos: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com` y `*.notify.windows.com`.

**10. Vincular el bot de Telegram sin tope de intentos**
- **Dónde:** `lib/social-telegram.ts:141-146`.
- **Falla:** mientras el código de `/vincular` está vigente (15 minutos), cualquiera que escriba al bot puede probar códigos sin límite y tomar el control de aprobar o publicar en redes.
- **Arreglo:** pocos intentos, y luego invalidar el código.

**11. La foto del taller se publica sola en las redes de HETNA**
- **Dónde:** `api/hooks/alta-taller/aprobar/route.ts:57`.
- **Falla:** `seller.photo` es una URL que pone el taller. Al aprobarlo, se programa una publicación con esa imagen, automática si `cfg.automatico.taller` está activo. Así se puede meter contenido ajeno en las redes de HETNA.
- **Arreglo:** usar solo imágenes del bucket propio, o dejar la publicación como borrador.

---

**Revisado sin problemas:**
- Token `x-hetna-token` con `timingSafeEqual` en todos los `/hooks/social-hub/*` y `/hooks/whatsapp`, y token del relay `/r/wa`.
- `state` de OAuth de TikTok y Pinterest.
- `mp-licitacion`: vuelve a consultar el pago, valida collector, referencia, moneda y el id externo único.
- `/escaneos/callback`: secreto, idempotencia y reembolso.
- Escaneos: subida con revisión de bytes y ruta armada por el servidor, aislamiento por `customer_id` y prefijo propio de las fotos.
- Rutas de vendedor de HetNa Cloud: todas filtran por `seller_id`, con candado de cupo; la liga compartida excluye `solicitudes/`.
- `verificacion-archivos.ts`: revisa bytes y la ruta con expresión regular.
- Archivos CAM: piden token o dueño.
- Entrega de créditos y descargas digitales: piden el pago completado.
- Sin inyección de comandos (`spawn` con lista de argumentos, sin shell) ni SQL interpolado con datos de usuario en el área.

**No revisado a fondo:** la mayoría de los 48 jobs y parte de los 21 subscribers (`saldo-taller-pedido`, `cupon-lo-paga-hetna` y cursos solo por encima). Falta confirmar el límite de tamaño del cuerpo JSON de `/hooks/whatsapp`: acepta 12 MB en base64 y no tiene `bodyParser` propio en `middlewares.ts`, así que las fotos del taller podrían no llegar nunca.