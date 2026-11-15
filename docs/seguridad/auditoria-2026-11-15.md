# Auditoría de seguridad (15 nov 2026)

Revisión de solo lectura del repositorio, hecha desde la sesión de Claude Code. No se tuvo acceso a la configuración de GitHub, al `.env` de producción ni al bloque principal de nginx del VPS.

## Resultado
- **No hay llaves ni contraseñas reales en el repositorio ni en su historial** (432 commits revisados). Nunca se subió un `.env` real.
- **Sin hallazgos críticos verificados.** Los webhooks de pago vuelven a consultar el pago en Mercado Pago o PayPal antes de aceptarlo. El HTML de los vendedores se limpia. Las rutas de taller y de cliente revisan quién es el dueño. No hay inyección SQL. Las subidas validan tipo y tamaño.

## Corregido en el código (15 nov)
- **Redirección abierta después del login:** `?volver=/\evil.com` mandaba a otro sitio. Ahora solo se aceptan rutas del mismo sitio (`apps/storefront/src/lib/seguridad/destino-seguro.ts`).
- **CORS:** `localhost` ya no se acepta en producción (backend y tienda). Para probar la app de Flutter en web contra el API de producción, agregar `APP_CORS=http://localhost:8080` (o el puerto que use) en el `.env`.
- **Secretos de webhooks internos:** se comparan en tiempo constante (`revalidate`, `pub/vencimientos`).
- **Secreto de sesiones:** si en producción falta `JWT_SECRET` o `COOKIE_SECRET`, o vale "supersecret", el backend lo avisa en el registro.

## Auditoría Thermos del PR 185 (15 nov)
Segunda revisión con el método Thermos (`.claude/skills/thermos`). Corregido:
- **Alta:** el primer arreglo de la redirección dejaba pasar `?volver=/.//evil.com` (la normalización de la URL lo convertía en `//evil.com`). Ahora también se revisa el resultado. El formulario de registro usaba todavía el chequeo viejo; ya usa `destinoSeguro`.
- **Media:** en la sustitución de facturas, si Facturapi cancelaba pero no se guardaba el registro, la base quedaba con la factura "vigente". Ahora se reintenta y, al volver a cancelar, se consulta Facturapi para ponerla al día. La factura sustituta debe ser del mismo pedido.
- **Baja:** la fecha "Publicado hace…" se traduce al inglés y las filas de la portada se piden en paralelo (carga más rápida).

Queda como decisión del dueño:
- Si una factura de sustitución debe contar en el cupo mensual del plan (hoy cuenta).
- Si el backend debe negarse a arrancar en producción con un secreto de sesión débil (hoy sólo avisa en el registro).

## Para el dueño (en orden)
1. **Revisar el secreto de sesiones en el VPS.** Si sale `supersecret` o vacío, cambiarlo por uno nuevo de `openssl rand -hex 64` y reiniciar. Todas las sesiones se cierran y hay que volver a entrar.
2. **Cuentas de prueba:** el script de datos de ejemplo crea `seller@mercur.dev`, `kickz@mercur.dev` y `trailhead@mercur.dev` con la contraseña `supersecret`. Si existen en producción, borrarlas.
3. **GitHub:**
   - repositorio **privado**;
   - **2FA** en la cuenta;
   - proteger `main`: exigir PR y bloquear force-push y borrado;
   - activar **Secret scanning** con push protection, **Dependabot** y CodeQL;
   - revocar tokens, llaves SSH y aplicaciones que no se usen;
   - que la llave de despliegue del VPS sea de solo lectura.
4. **VPS:**
   - firewall `ufw` con solo 22, 80 y 443 (22 de preferencia solo desde tu IP);
   - SSH solo con llave (`PasswordAuthentication no`);
   - `fail2ban`;
   - actualizaciones automáticas (`unattended-upgrades`);
   - `.env` con `chmod 600`;
   - Postgres escuchando solo en localhost.
5. **Respaldos:** respaldo diario cifrado de Postgres hacia B2 (`pg_dump | age`, restic o borg), con 30 días de retención y una prueba de restauración al mes. Activar el cifrado del bucket B2.
6. **n8n y WhatsApp** (`n8n.hetnacnc.com`, `whatsapp.hetnacnc.com`): ponerlos detrás de Cloudflare Access o de una lista de IPs, forzar HTTPS y activar 2FA en n8n.
7. **Rotar todas las llaves** si alguna vez se compartieron: Supabase service key, Mercado Pago, PayPal, B2, Resend, Anthropic y tokens de n8n.

## Pendiente de código (siguiente etapa)
- **Cifrar los tokens de Mercado Pago de los talleres** (`negocios_mp`, hoy en claro) con AES-256-GCM y una llave que solo viva en el `.env`.
- **Roles del panel de HETNA** aplicados también en el backend (`/admin/*`); hoy solo los revisa la tienda.
- **Límites de intentos en nginx** para `/store`, `/api` y `/hooks`. Los de la aplicación se borran al reiniciar.
- **Política de seguridad de contenido (CSP)** sin `unsafe-inline` ni `unsafe-eval`, usando nonces.
- **Revisión de dependencias:** correr `npm audit` en el VPS y activar Dependabot.

## Sobre "cifrar el código"
El código de un sitio web no se puede cifrar de forma útil: el servidor tiene que leerlo para ejecutarlo, y el JavaScript que llega al navegador siempre se puede ver. Lo que de verdad protege es:
- un repositorio privado y bien controlado;
- llaves que nunca estén en el código;
- datos cifrados en reposo y en los respaldos;
- un servidor cerrado.
