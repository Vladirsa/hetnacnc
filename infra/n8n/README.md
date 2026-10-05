# Automatización con n8n + WhatsApp para HETNA CNC

Esto corre en el **mismo VPS** donde ya vive hetnacnc.com (nginx + certbot +
PM2 para `hetna-api`/`hetna-web`, Postgres/Redis de Medusa en Docker). n8n y
Evolution API (WhatsApp) se agregan como contenedores Docker nuevos, escuchando
solo en `127.0.0.1`, y es el nginx que ya está instalado el que expone los
subdominios nuevos con TLS — igual que ya hace con hetnacnc.com.

No se toca nada de lo que ya corre.

## Qué incluye

- **n8n** (`docker-compose.yml`): el motor de automatización donde viven los
  workflows.
- **Evolution API**: conecta un número de WhatsApp normal escaneando un QR
  (como WhatsApp Web), sin pasar por el proceso de aprobación de Meta
  Business.
- **`workflows/`**: los dos flujos listos para importar.
- **`nginx/`**: los server blocks para los subdominios nuevos.

## 1. Apuntar los subdominios

En el DNS donde está hetnacnc.com (Cloudflare u otro) agrega dos registros
tipo **A**, apuntando a la misma IP del VPS que ya usa hetnacnc.com:

| Nombre   | Tipo | Valor         |
|----------|------|---------------|
| n8n      | A    | IP del VPS    |
| whatsapp | A    | IP del VPS    |

Usa el mismo modo de proxy (naranja o gris) que ya tiene configurado
hetnacnc.com — no hace falta cambiarlo.

## 2. Traer esta carpeta al VPS

El repo ya está clonado en el VPS (es de donde corren `hetna-api`/`hetna-web`
con PM2). Entra por SSH o por la terminal del navegador en hPanel y corre:

```bash
cd /root/hetnacnc
git fetch origin claude/vigilant-tesla-cq06q0
git checkout origin/claude/vigilant-tesla-cq06q0 -- infra/n8n
cd infra/n8n
```

(Esto solo trae la carpeta `infra/n8n`, no cambia la rama que está corriendo
en producción.)

## 3. Crear la Secret API Key en Mercur (hazlo antes del paso 4)

Entra a `https://hetnacnc.com/dashboard` (el panel de operador/admin — no
`/seller`, que es el panel de vendedores) con tu cuenta de administrador →
**Configuración/Settings** → **Desarrollador/Developer** → **Gestión de
claves API / API Key Management** → pestaña **Claves secretas/Secret API
Keys** → **Crear clave secreta**. Dale un nombre como `n8n-automation` y
copia el valor — solo se muestra una vez.

## 4. Configurar y levantar

```bash
cp .env.example .env
nano .env
```

Completa cada valor siguiendo los comentarios del archivo:

- `N8N_DB_PASSWORD`, `N8N_ENCRYPTION_KEY`, `EVOLUTION_API_KEY`: generarlas con
  `openssl rand -hex 16` / `-hex 32` / `-hex 24`.
- `MEDUSA_PUBLISHABLE_KEY`: cópiala con
  `grep NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY /root/hetnacnc/apps/storefront/.env`
- `MEDUSA_REGION_ID`: obtenla con
  `curl -s http://127.0.0.1:9000/store/regions -H "x-publishable-api-key: <la de arriba>"`
- `MEDUSA_ADMIN_SECRET_KEY`: la que copiaste en el paso 3.

Luego:

```bash
docker compose up -d
docker compose ps
```

## 5. Exponer los subdominios con nginx + certbot

```bash
cp nginx/n8n.conf /etc/nginx/sites-enabled/n8n
cp nginx/whatsapp.conf /etc/nginx/sites-enabled/whatsapp
nginx -t && systemctl reload nginx

certbot --nginx -d n8n.hetnacnc.com
certbot --nginx -d whatsapp.hetnacnc.com
```

Certbot detecta el `server_name` en cada archivo y agrega el bloque HTTPS
automáticamente (igual que ya está hecho para hetnacnc.com). Si el DNS del
paso 1 aún no propagó, certbot va a fallar la validación — espera unos
minutos y reintenta.

## 6. Crear tu cuenta en n8n

Abre `https://n8n.hetnacnc.com`. La primera vez te pide crear el usuario
"owner" (correo y contraseña).

## 7. Conectar el WhatsApp del negocio

Abre `https://whatsapp.hetnacnc.com` (panel de Evolution API Manager):

1. Inicia sesión con la `EVOLUTION_API_KEY` que pusiste en `.env`.
2. Crea una instancia con el mismo nombre que pusiste en `EVOLUTION_INSTANCE`.
3. Escanea el código QR con el WhatsApp del negocio (desde el celular:
   Ajustes > Dispositivos vinculados > Vincular dispositivo).
4. En la configuración de la instancia, activa el **Webhook** con URL:
   `https://n8n.hetnacnc.com/webhook/whatsapp-in` y el evento
   `MESSAGES_UPSERT` activado.

## 8. Importar los workflows

En n8n: **Overflow menu (⋯) > Import from File**, y sube uno por uno:

- `workflows/whatsapp-catalog-responder.json` — responde preguntas sobre el
  catálogo por WhatsApp.
- `workflows/whatsapp-abandoned-cart-reminder.json` — cada hora revisa
  carritos abandonados con teléfono y manda un recordatorio por WhatsApp.
- `workflows/redes-sociales-producto-nuevo.json` — publica en Facebook/
  Instagram cuando subes un producto nuevo (ver sección 9 más abajo antes
  de activarlo, necesita la app de Meta configurada primero).

Abre cada uno y activa el switch **"Active"** arriba a la derecha.

## Probar que funciona

- Escríbele al número de WhatsApp conectado algo como "busco un router CNC" y
  debería responder con productos del catálogo real.
- Para el carrito abandonado: abre el workflow en n8n y usa **"Test
  workflow"** para correrlo manualmente (si no hay carritos abandonados con
  teléfono en ese momento, no enviará nada — es normal).

## 9. Redes sociales: publicar en Facebook e Instagram al subir un producto

Workflow: `workflows/redes-sociales-producto-nuevo.json`. Cuando subes un
producto nuevo al catálogo de Mercur, el backend le avisa a n8n y este
publica la foto + descripción en la Página de Facebook y, si está
vinculada, en la cuenta de Instagram Business.

### 9.1 Crear la app de Meta (una sola vez)

1. Entra a **https://developers.facebook.com/apps** → **Crear app** → tipo
   **"Negocio" (Business)**.
2. Dentro de la app, agrega el producto **"Facebook Login for Business"** y
   el producto **"Instagram Graph API"** (si quieres publicar también en
   Instagram).
3. Ve a **Herramientas > Graph API Explorer**
   (https://developers.facebook.com/tools/explorer/):
   - Selecciona tu app arriba a la derecha.
   - En "User or Page", elige tu **Página de Facebook**.
   - En "Permissions", agrega: `pages_show_list`, `pages_read_engagement`,
     `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`.
   - Dale **"Generate Access Token"** y autoriza.
4. Con ese token generado, obtén el **token de la Página (no el tuyo
   personal)**: en el mismo Explorer, corre `GET /me/accounts` — la
   respuesta trae el `id` de tu Página y un `access_token` específico de
   esa Página. **Ese es el que necesitas** (los tokens de página no
   expiran mientras la app siga activa, a diferencia del tuyo personal que
   dura ~1-2 horas).
5. Para el ID de Instagram: con el token de la Página, corre
   `GET /{ID_DE_LA_PAGINA}?fields=instagram_business_account`.

Guarda tres valores: el **Page Access Token**, el **ID de la Página**
(`FACEBOOK_PAGE_ID`), y el **ID de Instagram Business**
(`INSTAGRAM_BUSINESS_ACCOUNT_ID`).

<Warning>
Mientras la app esté en modo "Desarrollo" (no publicada/verificada por
Meta), estos permisos solo funcionan para las cuentas que agregues como
"Tester" o "Admin" de la app (tu propia Página). Para publicar sin estar
verificado por Meta, eso es suficiente — la verificación solo hace falta
si otros negocios fueran a usar la misma app.
</Warning>

### 9.2 Configurar en el VPS

En `.env` (infra/n8n), agrega `FACEBOOK_PAGE_ID` e
`INSTAGRAM_BUSINESS_ACCOUNT_ID`, luego:

```bash
docker compose up -d n8n
```

En n8n, abre el workflow importado (paso 8) → nodo **"Publicar en
Facebook"** → crea la credencial **"Facebook Graph API"** tipo **Access
Token**, pega el Page Access Token del paso anterior. Los otros dos nodos
de Facebook Graph API usan la misma credencial (selecciónala en cada uno).

### 9.3 Conectar el aviso desde Medusa

En `packages/api/.env` del backend (no en infra/n8n), agrega:

```bash
N8N_PRODUCT_CREATED_WEBHOOK_URL=https://n8n.hetnacnc.com/webhook/producto-nuevo
```

y reinicia el backend (`pm2 restart hetna-api`). Sin esta variable, el
backend no avisa nada — no rompe la creación de productos.

Activa el workflow en n8n (switch "Active"). Prueba subiendo un producto de
verdad (con imagen) desde el panel de administrador — debería aparecer
publicado en la Página de Facebook en unos segundos.

## Ajustar el formato de los mensajes entrantes

Evolution API puede cambiar ligeramente el formato del webhook según la
versión. Si el nodo **"Extraer teléfono y texto"** no detecta el mensaje: en
n8n, pestaña **Executions**, abre la ejecución fallida y revisa el JSON real
que llegó al Webhook para ajustar las rutas (`data.key.remoteJid`,
`data.message.conversation`, etc.) dentro del nodo.

## Próximos agentes (no incluidos todavía)

Ya construidos sobre esta misma base: el bot de catálogo por WhatsApp, el
recordatorio de carrito abandonado, el agente de SEO que escribe y publica
artículos en Aprendizaje CNC (ver `packages/api` — el workflow vive en la
instancia de n8n, no en este repo), y la publicación automática en
Facebook/Instagram al subir un producto.

Pendientes para más adelante, cuando se definan los datos que necesitan:
publicidad (crear/pausar anuncios según ventas), SEO programático
(landing pages por servicio×ciudad), scraping de precios de competidores,
generación de videos para YouTube. Cada uno es un workflow nuevo dentro
del mismo n8n — no hace falta tocar el servidor otra vez.
