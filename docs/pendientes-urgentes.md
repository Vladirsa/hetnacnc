# Pendientes urgentes (del dueño)

Cosas que ya están construidas y fusionadas, pero **apagadas** hasta que se haga el paso. Ninguna llave se manda por chat ni correo: van directo en el `.env` de `packages/api` del servidor, y luego se reinicia con `bash scripts/desplegar.sh`.

## 1. Llaves del SAT y facturación (contabilidad)
- [ ] **`CONTA_EFIRMA_KEY`**: llave de cifrado de la e.firma. Se genera en el servidor con `openssl rand -base64 32`.
- [ ] **Subir la e.firma**: Dashboard → Contabilidad → Datos fiscales (.cer, .key y contraseña) y luego "Traer todo 2026". Sin esto, las facturas no bajan solas del SAT.
- [ ] **Datos fiscales**: RFC y código postal en Contabilidad → Datos fiscales.
- [ ] **Primera prueba real**: subir al semáforo una factura recibida; debe decir "Vigente".
- [ ] **`FACTURAPI_KEY_HETNA`**: llave de la organización de HETNA en Facturapi, con su CSD. Sin ella, las suscripciones del Cotizador no se facturan solas; los cobros quedan pendientes.
- [ ] **Contador**: confirmar la clave de producto 81112106 y la forma de pago 31 de esas facturas.

## 2. Stripe (tarjeta, OXXO y SPEI)
- [ ] Abrir la cuenta en stripe.com/mx (RFC, e.firma y cuenta bancaria).
- [ ] Activar Tarjetas, OXXO y Transferencia (SPEI) en Configuración → Métodos de pago.
- [ ] **`STRIPE_SECRET_KEY`**: primero la de prueba (`sk_test_…`) y, cuando funcione, la real.
- [ ] Webhook a `https://hetnacnc.com/api/stripe-webhook`. Eventos:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
- [ ] Confirmar en Stripe si la cuenta puede cobrar en USD.

## 3. Catálogo para anuncios (Google y Meta)
Los archivos ya se generan solos con los productos de la tienda. Falta darlos de alta una vez:
- [ ] **Google Merchant Center** (merchants.google.com):
  - Productos → Fuentes de datos → Agregar fuente → Archivo programado.
  - URL: `https://hetnacnc.com/feeds/google.xml`, diario.
  - Activar "Fichas gratuitas" para salir en Google Shopping sin pagar.
- [ ] **Meta Commerce Manager** (business.facebook.com/commerce):
  - Catálogo → Fuentes de datos → Feed programado.
  - URL: `https://hetnacnc.com/feeds/meta.xml`, diario.
- [ ] Revisar qué entra y qué se queda fuera, y por qué, en `https://hetnacnc.com/feeds/resumen.json` (y `?catalogo=meta`).

## 4. Tienda y app
- [ ] Subir productos: Dashboard → Cargar productos (plantilla de Excel). La tienda sigue vacía.
- [ ] Probar el Cotizador sin internet en un celular real: abrir con señal, entrar, modo avión y cotizar.
- [ ] Agregar "IVA incluido" en las pantallas de planes del Cotizador (así se factura).

## 5. Cotizador: posventa, kit comercial y "Te cargamos tu catálogo"
Ya están en el código, pero necesitan este orden:
- [ ] **Correr el SQL una vez**: en Supabase (proyecto del Cotizador) → SQL Editor, pegar y correr `supabase/taller_vende_mas.sql` del repo del Cotizador. Sin esto, las pantallas dicen "se está activando".
- [ ] **Desplegar** hetnacnc (`bash scripts/desplegar.sh`) y **publicar la app** (fusionar el PR del Cotizador; la APK y la web se arman solas).
- [ ] **`HETNA_LEADS_EMAIL`** en el `.env` de `packages/api` (si no está): ahí llega el correo "Catálogo por cargar". Sin él, revisa Dashboard → Catálogos por cargar.
- [ ] Prueba rápida: `curl -s -o /dev/null -w '%{http_code}' https://hetnacnc.com/api/cotizador-catalogo` debe dar **401** (no 404).
- [ ] **WhatsApp de soporte**: la app usa el 52 246 121 7072 y la página web el de `NEXT_PUBLIC_WHATSAPP_DEFAULT` (52 221 707 6014 por omisión). Confirmar cuál debe recibir el soporte.

## 6. Google Calendar (pedidos en el calendario)
- [ ] **`CALENDARIO_SECRET`** en el `.env` de `packages/api`: se genera con `openssl rand -base64 32`. Firma las ligas privadas de los calendarios; si se cambia, todas las ligas dejan de servir y hay que volver a suscribirse (sirve para "revocarlas"). Sin ella se usa `JWT_SECRET` si mide 16 caracteres o más.
- [ ] Suscribir **tu** calendario: Dashboard → Google Calendar → "Agregar a Google Calendar" (pedidos de la tienda, cierres de licitaciones, entregas e hitos).
- [ ] Los talleres lo conectan en la app: Más → Google Calendar.
- Prueba: la liga del Dashboard abierta en el navegador debe descargar un archivo `.ics`.

## 7. Legal
- [ ] Respuesta del abogado sobre SafeDeal (`docs/legal/safedeal-revision.md`).
- [ ] Contador: retención como plataforma y si conviene RESICO (`docs/contabilidad/guia-rapida.md`, sección 7).
