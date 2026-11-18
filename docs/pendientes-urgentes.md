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

## 5. Legal
- [ ] Respuesta del abogado sobre SafeDeal (`docs/legal/safedeal-revision.md`).
- [ ] Contador: retención como plataforma y si conviene RESICO (`docs/contabilidad/guia-rapida.md`, sección 7).
