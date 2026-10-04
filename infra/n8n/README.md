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

Abre cada uno y activa el switch **"Active"** arriba a la derecha.

## Probar que funciona

- Escríbele al número de WhatsApp conectado algo como "busco un router CNC" y
  debería responder con productos del catálogo real.
- Para el carrito abandonado: abre el workflow en n8n y usa **"Test
  workflow"** para correrlo manualmente (si no hay carritos abandonados con
  teléfono en ese momento, no enviará nada — es normal).

## Ajustar el formato de los mensajes entrantes

Evolution API puede cambiar ligeramente el formato del webhook según la
versión. Si el nodo **"Extraer teléfono y texto"** no detecta el mensaje: en
n8n, pestaña **Executions**, abre la ejecución fallida y revisa el JSON real
que llegó al Webhook para ajustar las rutas (`data.key.remoteJid`,
`data.message.conversation`, etc.) dentro del nodo.

## Próximos agentes (no incluidos todavía)

Esta base (n8n + conexión directa al backend de Mercur) es el punto de
partida para agregar más adelante, cuando se definan: publicidad
(crear/pausar anuncios según ventas), generación de contenido (descripciones,
posts), publicación en redes sociales, generación de videos para YouTube.
Cada uno es un workflow nuevo dentro del mismo n8n — no hace falta tocar el
servidor otra vez.
