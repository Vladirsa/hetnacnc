# Auditoría de seguridad (18 nov 2026): los 25 puntos

Revisión de la tienda (hetnacnc.com) y del Cotizador, pedida por el dueño. Parte de las auditorías del 15 de noviembre (`auditoria-2026-11-15.md` y `auditoria-thermos-completa-2026-11-15.md`).

## Cómo se revisó

- **Pruebas desde fuera contra hetnacnc.com:** cabeceras, rutas de administración sin sesión, archivos expuestos, CORS, límite de intentos, recuperación de contraseña. Se repiten con `./scripts/probar-protecciones.sh`.
- **Código:** dos revisiones a fondo de los dos repositorios (tienda y Cotizador).
- **Historial de git:** búsqueda de llaves en todos los commits de la tienda desde el 14 de noviembre (186; lo anterior ya estaba revisado) y en los 693 del Cotizador.
- **Código que llega al navegador:** búsqueda de llaves en los archivos JavaScript que sirve el sitio.
- **Base de datos de la tienda (Supabase "pag web"):** avisos de seguridad y permisos de cada tabla.
- **Copia local del servidor** con base de datos de prueba, para probar las protecciones nuevas sin tocar producción.

**No se pudo revisar desde aquí:** el `.env` y el nginx reales del servidor, y la base de datos del Cotizador (es otro proyecto de Supabase). Para eso están `./scripts/revisar-seguridad.sh` (se corre en el VPS) y las consultas de `cotizador-proteger-plan.sql`.

## Resultado por punto

| # | Punto | Estado | Qué se encontró y qué se hizo |
|---|---|---|---|
| 1 | Autenticación, correos y ligas automáticas | **Corregido** | Ver "Lo más grave" abajo: confirmación de correo, archivos subidos por talleres y correos al administrador. |
| 2 | Llaves fuera del navegador | Bien | Ninguna llave secreta en el código del navegador ni en variables públicas. En el Cotizador sólo van las llaves públicas de Supabase y Firebase. |
| 3 | Base de datos | **Parcial** | Tienda: todas las tablas con seguridad por renglón y sin acceso anónimo. Cotizador: un taller podía cambiarse el plan; el arreglo es `cotizador-proteger-plan.sql` (lo corre el dueño). Los tokens de Mercado Pago, Facturapi y redes siguen guardados sin cifrar. |
| 4 | HTTPS forzado | Bien | HSTS por un año con subdominios. |
| 5 | Contraseñas con hash | Bien | scrypt (el de Medusa). Ninguna contraseña en claro. |
| 6 | Validación en el servidor | **Corregido** | El formulario "quiero unirme" aceptaba cualquier archivo con cualquier nombre; ahora sólo fotos revisadas. Lo demás ya validaba. |
| 7 | XSS | **Corregido** | Los nombres de talleres iban sin escapar en varios correos internos; ya se escapan. En el sitio no se encontró XSS explotable. La política de contenido (CSP) todavía permite scripts en línea. |
| 8 | Registro y vigilancia | **Corregido** | Bitácora nueva: inicios de sesión rechazados y cada cambio en el panel de administración. El Centro de control avisa si hay 10 o más intentos fallidos al panel en 24 horas. |
| 9 | Rutas de admin | Bien | Las 13 rutas probadas sin sesión responden 401. Pendiente: los roles del panel sólo se aplican en la tienda, no en el API. |
| 10 | Consultas parametrizadas | Bien | Ninguna consulta arma SQL con datos del usuario. |
| 11 | Variables de entorno | **Corregido** | El API usaba el secreto de sesión de ejemplo (ver el punto 0 de abajo). Las ligas de correo ya no se firman con un secreto vacío o de ejemplo. `revisar-seguridad.sh` revisa lo que de verdad usa cada proceso, sin enseñar valores. |
| 12 | Límite de peticiones | **Corregido** | El de inicio de sesión funciona. Se agregó recuperar contraseña y las rutas públicas costosas (CAM, escaneos, registro, subidas) en `infra/nginx/hetna-limites.conf`; hay que volver a copiarlo al servidor. |
| 13 | CORS | **Corregido** | Un sitio ajeno no recibía permiso, pero `localhost` y la documentación de Medusa sí (valores de fábrica). Ya sólo tiene permiso hetnacnc.com. |
| 14 | Cabeceras de seguridad | Bien | HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy y CSP. |
| 15 | Cookies de sesión | Bien | httpOnly, Secure y SameSite=Lax en la tienda y en los paneles. |
| 16 | CSRF | **Corregido** | La única acción que cambiaba algo con un GET era confirmar el correo; ya es POST. |
| 17 | Enlaces de recuperación | Bien | Caducan a los 15 minutos, son de un solo uso y no revelan si el correo existe. |
| 18 | Archivos | **Corregido** | El servidor ya rechaza páginas, SVG, scripts e instaladores en lo que suben talleres y panel. Los comprimidos con accesos directos, imágenes de disco o macros se rechazan; RAR y 7z se rechazan si no hay antivirus. |
| 19 | Precios en servidor | Bien | Los montos salen del servidor. Pendiente menor: el nivel del servicio CAM lo manda el navegador. |
| 20 | Modo depuración | Bien | Sin mapas de código ni trazas de error al cliente. `revisar-seguridad.sh` confirma `NODE_ENV=production` y que no haya modos de prueba encendidos. |
| 21 | Dependencias vulnerables | **Corregido en parte** | Next 15.5.24 → 15.5.29 (aviso crítico) y sharp 0.33.5 → 0.35.5. Quedan avisos que llegan por Medusa y Mercur y no se pueden subir sin romper sus parches. |
| 22 | Paquetes sin uso | Pendiente | Lista en "Lo que sigue pendiente". No se quitaron: Medusa carga algunos por nombre y hay que probar cada uno. |
| 23 | Archivos expuestos | **Corregido** | Nada sensible se sirve. Se borraron del repositorio dos respaldos olvidados. |
| 24 | Secretos en el historial de git | Bien | Ninguno en los dos repositorios. |
| 25 | Revocar llaves comprometidas | Sin llaves que revocar | No se encontró ninguna llave filtrada. Vale mientras `/static` no tenga páginas subidas por extraños y la lista de usuarios del panel no tenga desconocidos (pasos 4 y revisión de **Configuraciones → Usuarios**). |

## Lo más grave que se encontró (y ya está corregido)

0. **El API corría con el secreto de sesión de ejemplo ("supersecret").** Se encontró al revisar el servidor después del despliegue. El `.env` tenía secretos buenos, pero pm2 tenía guardado el valor de ejemplo desde que se arrancó el proceso, y lo que ya está en el entorno del proceso le gana al `.env` (el orden es: pm2, luego `.env.production`, luego `.env`). Con ese secreto, que es público, cualquiera podía fabricar una sesión de administrador sin contraseña; se comprobó desde fuera con un usuario inventado. **Arreglo en el servidor:** se reinició el API con los secretos buenos (todas las sesiones se cerraron) y se volvió a probar: el pase fabricado ya se rechaza. **Arreglo en el código:** en producción el API ya no arranca nunca con un secreto débil (usa uno al azar para ese arranque y lo avisa), y `revisar-seguridad.sh` revisa el valor que de verdad usa el proceso, no sólo el `.env`.

1. **Un taller podía tomar el control del panel de administración.** Lo que suben los talleres se guarda en `/static` y se sirve desde hetnacnc.com sin revisar el tipo. Un taller (ni siquiera aprobado) podía subir una página `.html` o un `.svg` con código y mandarle la liga al administrador. Al abrirla, esa página corría con la sesión del administrador: podía crear otro administrador o cambiar datos de pago. **Arreglo:** el servidor rechaza esos archivos por extensión, por tipo declarado y por contenido. Segunda barrera: `infra/nginx/hetna-static-seguro.conf`.
2. **La liga "Confirmar mi correo" confirmaba con sólo abrirse.** Los antivirus de correo abren las ligas solos. Un extraño podía registrarse con el correo de un taller y, cuando el antivirus de ese buzón abriera la liga, quedar con la cuenta confirmada: entrar al Cotizador de ese taller o quedar como taller aprobado. **Arreglo:** la liga ahora abre una página con un botón, y sólo el botón confirma.
3. **El correo "Taller nuevo quiere unirse" traía ligas directas a archivos de un extraño.** Cualquiera, sin cuenta, podía subir un comprimido con un troyano, declararlo como "fachada.jpg" y hacer que le llegara al administrador como liga. **Arreglo:** ese formulario sólo acepta fotos revisadas y el correo ya no trae ligas a archivos.
4. **Next.js tenía una falla crítica conocida** en el optimizador de imágenes cuando acepta SVG, que era la configuración de la tienda. **Arreglo:** Next 15.5.29 y el optimizador ya no acepta SVG.
5. **En el Cotizador, un taller podía cambiarse el plan** escribiendo directo en la base con su propia sesión. **Arreglo:** `cotizador-proteger-plan.sql`.

## Lo que tiene que hacer el dueño

En este orden. Los comandos están en el mensaje de entrega.

1. **Antes de desplegar:** correr `./scripts/revisar-seguridad.sh` en el servidor y corregir las FALLAS de la sección "Secretos de sesión y de firma". Con un secreto vacío o de ejemplo, las ligas de confirmar correo dejan de salir al desplegar (a propósito: con ese secreto cualquiera podía fabricarlas).
2. Desplegar la tienda (API y tienda juntos, como siempre).
3. Copiar la configuración nueva de nginx (límites y `/static`) y recargar nginx.
4. Volver a correr `./scripts/revisar-seguridad.sh` y corregir lo que quede. Si encuentra páginas o scripts ya subidos a `/static`, bórralos y avisa: habría que cambiar los secretos de sesión y revisar la lista de usuarios del panel.
5. Correr `cotizador-proteger-plan.sql` en el SQL Editor del proyecto de Supabase del Cotizador y revisar las cuatro consultas del final.
6. Poner el repositorio del Cotizador en privado (GitHub → Settings → General → Change visibility).
7. Correr `./scripts/probar-protecciones.sh` desde cualquier computadora.

## Lo que sigue pendiente

- **Cifrar los tokens guardados** (Mercado Pago y Facturapi de los talleres, tokens de TikTok, Pinterest, Google y Threads). Necesita una llave nueva en el `.env` antes de desplegar.
- **Roles del panel aplicados en el API.** Hoy los revisa sólo la tienda.
- **CSP sin scripts en línea.** Con la técnica habitual (nonces) todas las páginas dejarían de guardarse en caché y el sitio se haría lento; hay que hacerlo por partes.
- **Paquetes sin uso** (probando el build de cada uno): en la tienda `i18next`, `i18next-browser-languagedetector`, `react-i18next`, `js-cookie` y Storybook; en el API `http-proxy-middleware`.
- **Avisos de dependencias que llegan por Medusa y Mercur** (`multer`, `body-parser`, `qs`): se arreglan cuando Mercur publique su siguiente versión.
- **Optimizador de imágenes abierto a cualquier dominio `https`.** Cerrarlo a una lista de dominios puede romper las fotos de productos que usan ligas externas; hay que revisar primero qué dominios se usan.
- **Límites de la aplicación en memoria:** se reinician en cada despliegue. Los de nginx no.
- **Cotizador:** guardar en el repositorio el esquema completo de la base (hoy faltan las definiciones de unas 20 tablas y no se pueden auditar), mover a tablas sólo-servidor el token de WhatsApp y las llaves de WooCommerce, y actualizar `supabase_flutter` y Firebase.
- **Servidor:** la tienda corre como root; lo ideal es un usuario propio.

## Sobre revocar llaves (punto 25)

No hay ninguna llave filtrada que revocar. Aun así conviene rotar una vez al año, o antes si alguien que tuvo acceso deja de trabajar contigo: Supabase (service key), Mercado Pago, PayPal, Backblaze, Resend, Anthropic, Facturapi y los tokens de n8n. Cada una se cambia en el panel de su proveedor y luego en el `.env`, seguido de un despliegue.
