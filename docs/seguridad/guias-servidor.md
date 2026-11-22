# Guías de seguridad que se hacen fuera del código (18 nov 2026)

Estas tareas son configuración del servidor o de servicios externos. No se
pueden hacer desde el repositorio. Van en orden de importancia.

## 1. Probar que el respaldo se puede restaurar (una vez al mes)

Después del primer despliegue con estos cambios, corre una vez el respaldo a
mano para que el Centro de control no avise "No hay registro…" hasta la
corrida de la mañana:

```bash
bash /root/hetnacnc/scripts/respaldar.sh
```

El respaldo diario ya corre (`/etc/cron.d/hetna-respaldo`, 9:17 hora del servidor)
y sube cifrado a Backblaze. Una vez al mes, prueba que de verdad se restaura:

```bash
bash /root/hetnacnc/scripts/probar-restauracion.sh
```

Baja el último respaldo, lo carga en una base temporal aislada y compara pedidos,
productos, clientes y talleres con la base real. No toca la tienda.

**Protección extra contra borrado:** quien entre al servidor puede leer la llave
de Backblaze de `/root/.respaldo.env` y borrar los respaldos. Para que un borrado
se pueda deshacer, en Backblaze → **Buckets** → tu bucket → **Lifecycle
Settings** elige **Keep prior versions for this number of days: 30**. Así un
archivo borrado se queda 30 días como versión oculta y se puede recuperar.

**Guarda la contraseña de restic** (`RESTIC_PASSWORD` de `/root/.respaldo.env`)
también en tu gestor de contraseñas: sin ella los respaldos no sirven.

## 2. n8n y WhatsApp detrás de Cloudflare Access (HECHO el 21 nov 2026)

Los paneles de `n8n.hetnacnc.com` y `whatsapp.hetnacnc.com/manager` piden un
código al correo del dueño (Cloudflare Zero Trust, plan Free, equipo
`super-sound-1307`) antes de mostrar la pantalla de entrada. Así quedó:

**Políticas** (Zero Trust › Access › Políticas, reutilizables):

| Política | Acción | Regla |
|---|---|---|
| `Solo dueño` | Allow | Emails: correo del dueño |
| `Libre` | Bypass | Everyone |

**Aplicaciones** (Zero Trust › Access › Aplicaciones, todas *Autohospedado*):

| Aplicación | Nombres de host | Política |
|---|---|---|
| `n8n panel` | `n8n.hetnacnc.com` (sin ruta) | Solo dueño |
| `WhatsApp panel` | `whatsapp.hetnacnc.com/manager` y `/manager/*` | Solo dueño |
| `n8n automatizaciones libre` | `n8n.hetnacnc.com` con las rutas de abajo | Libre |

Rutas libres de n8n (la ruta más específica gana sobre `n8n panel`):

- Automatizaciones (avisos de la tienda, Meta, WhatsApp y formularios):
  `webhook`, `webhook-test`, `webhook-waiting`, `form`, `form-test`, `form-waiting`.
- Conexión de Claude con n8n (MCP y su autorización): `mcp-server`,
  `rest/oauth2-credential`, `.well-known/oauth-protected-resource`,
  `.well-known/oauth-authorization-server`, `mcp-oauth/token`, `mcp-oauth/register`.
  `mcp-oauth/authorize` se queda protegida: ahí el dueño da el permiso desde el
  navegador, después de pasar el código de Cloudflare.
- Certificado de Let's Encrypt: `.well-known/acme-challenge`. Sin ésta,
  `certbot renew` falla para n8n ("reader size limit exceeded").

**No proteger todo `whatsapp.hetnacnc.com`:** el API de la tienda manda los
mensajes por ese dominio. Sólo el panel (`/manager`).

**Si se agrega una automatización que recibe avisos por otra ruta de n8n**,
hay que sumarla a `n8n automatizaciones libre`.

**Pruebas (en el servidor):**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://n8n.hetnacnc.com/webhook/prueba-hetna
```
Debe dar 404 (llega a n8n). El panel debe dar 302 a `cloudflareaccess.com`:
```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://n8n.hetnacnc.com/
```
Lo mismo `https://whatsapp.hetnacnc.com/manager/` (302) y
`https://whatsapp.hetnacnc.com/` (200). Y `certbot renew --dry-run` debe
terminar con los tres certificados en *success*.

**Si algo deja de funcionar:** desactivar o borrar la aplicación que lo causa
en Access › Aplicaciones; el cambio es inmediato.

Además: n8n con verificación en dos pasos (Settings › Personal › 2FA) y SSL/TLS
de Cloudflare en **Completo (estricto)** (los certificados de Let's Encrypt del
servidor cubren los cuatro dominios y se renuevan solos).

## 3. Repositorio de GitHub

Ver `docs/seguridad/guia-github.md` (verificación en dos pasos, repositorio
privado, proteger `main`).

## 4. Llave de cifrado de las llaves guardadas (HECHO el 21 nov 2026: llave puesta y tokens de redes cifrados)

Después de desplegar, para cifrar los tokens de Mercado Pago, Facturapi y redes
que se guardan en la base:

1. Genera la llave y **guárdala en tu gestor de contraseñas** antes de seguir.
   Si se pierde, todos los talleres tienen que volver a conectar Mercado Pago y
   Facturapi, y tú las redes.
   ```bash
   openssl rand -hex 32
   ```
2. Agrégala al `.env` del API como `LLAVES_CIFRADO=...` y reinicia el API
   pasándola también a pm2 (ver el mensaje de entrega).
3. Prueba en seco, sin cambiar nada:
   ```bash
   cd ~/hetnacnc/packages/api && NODE_ENV=production bunx medusa exec ./src/scripts/cifrar-llaves.ts
   ```
4. Si los números se ven bien, lo mismo con `APLICAR=1` al inicio.

Una vez cifrado, no regreses a una versión del código anterior a este cambio:
no sabría leer los tokens.

## 5. Usuario propio para la tienda (en lugar de root)

Hoy la tienda y el API corren como `root`. La guía paso a paso para pasarlos al
usuario `hetna` está en [usuario-sin-root.md](usuario-sin-root.md). Se hace en un
horario tranquilo (unos 2 minutos sin tienda) y con el respaldo recién probado.

## 6. Decisiones pendientes del Cotizador

- **Carpeta `catalogos` pública:** cualquiera con la liga exacta abre un
  catálogo. Hacerla privada rompe las ligas que ya se mandaron a clientes.
  Decide si importa (¿hay listas de precios que no quieres que circulen?).
- **Referidos:** hoy se premia al registrar al invitado; se puede abusar con
  cuentas falsas (hasta 12 meses gratis). Propuesta: premiar cuando el invitado
  paga su primer mes.
- **Token de WhatsApp y llaves de WooCommerce:** la app los lee de la base.
  Moverlos al servidor necesita una versión nueva de la app; las versiones
  viejas (APK instaladas a mano) dejarían de poder usar esas funciones.
- **Auditar las tablas que faltan:** unas 20 tablas y 10 funciones del Cotizador
  no están en el repositorio. El respaldo diario ya trae su estructura
  (`/root/respaldos/supabase-cotizador-*.sql.gz`); se puede revisar desde ahí.
