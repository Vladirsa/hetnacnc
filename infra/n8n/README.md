# Automatización con n8n + WhatsApp para HETNA CNC

Esto NO corre junto con hetnacnc.com. Es un servidor pequeño y separado donde
vive n8n (el "cerebro" que conecta todo) y Evolution API (la conexión de
WhatsApp). hetnacnc.com sigue viviendo donde está hoy; este servidor solo le
habla por internet usando las mismas APIs que ya usa el storefront.

## Qué incluye

- **n8n**: plataforma de automatización donde se armó el flujo del bot de
  catálogo y el de recordatorios de carrito abandonado.
- **Evolution API**: conecta un número de WhatsApp normal (se escanea un QR,
  como WhatsApp Web) para poder recibir y enviar mensajes sin pasar por el
  proceso de aprobación de Meta Business.
- **Caddy**: pone HTTPS automático a los dos subdominios.

## 1. Contratar un servidor (VPS)

Cualquiera de estos sirve, son ~$5-6 USD/mes:

- Hetzner Cloud, plan CX22, imagen **Ubuntu 22.04**.
- DigitalOcean, Droplet básico, imagen **Ubuntu 22.04**.

Al crearlo anota la **IP pública** que te dan.

## 2. Apuntar los subdominios

En el administrador de DNS de hetnacnc.com (donde esté el dominio — Cloudflare
u otro) crea dos registros tipo **A**:

| Nombre | Tipo | Valor              |
|--------|------|--------------------|
| n8n    | A    | IP del servidor     |
| whatsapp | A  | IP del servidor     |

Si el dominio está en Cloudflare: la nube junto a estos dos registros debe
quedar **gris ("DNS only")**, no naranja. Si queda naranja (proxied), Caddy no
puede emitir el certificado SSL.

## 3. Preparar el servidor

Conéctate por SSH al servidor (`ssh root@IP_DEL_SERVIDOR`) y corre:

```bash
curl -fsSL https://get.docker.com | sh
```

## 4. Subir esta carpeta al servidor

Desde tu computadora, dentro del repo:

```bash
scp -r infra/n8n root@IP_DEL_SERVIDOR:/opt/hetnacnc-automation
```

## 5. Configurar las variables

En el servidor:

```bash
cd /opt/hetnacnc-automation
cp .env.example .env
nano .env
```

Completa cada valor siguiendo los comentarios del archivo (contraseñas con
`openssl rand -hex 16`, la publishable key del storefront, etc). Guarda con
`Ctrl+O`, `Enter`, `Ctrl+X`.

## 6. Levantar todo

```bash
docker compose up -d
```

La primera vez Caddy puede tardar 1-2 minutos en obtener los certificados SSL.

## 7. Crear tu cuenta en n8n

Abre `https://n8n.TU_DOMINIO` (el que puso en `N8N_HOST`). La primera vez te
pide crear el usuario "owner" (tu correo y una contraseña).

## 8. Conectar el WhatsApp del negocio

Abre `https://whatsapp.TU_DOMINIO` (panel de Evolution API Manager):

1. Inicia sesión con la `EVOLUTION_API_KEY` que pusiste en `.env`.
2. Crea una instancia con el mismo nombre que pusiste en `EVOLUTION_INSTANCE`.
3. Escanea el código QR con el WhatsApp del negocio (desde el celular:
   Ajustes > Dispositivos vinculados > Vincular dispositivo).
4. En la configuración de la instancia, activa el **Webhook** y pon como URL:
   `https://n8n.TU_DOMINIO/webhook/whatsapp-in` (ese es el path del workflow
   de catálogo), con el evento `MESSAGES_UPSERT` activado.

## 9. Importar los workflows

En n8n: **Overflow menu (⋯) > Import from File**, y sube uno por uno:

- `workflows/whatsapp-catalog-responder.json` — responde preguntas sobre el
  catálogo por WhatsApp.
- `workflows/whatsapp-abandoned-cart-reminder.json` — cada hora revisa
  carritos abandonados con teléfono y manda un recordatorio por WhatsApp.

## 10. Crear la Secret API Key en Mercur

El workflow de carrito abandonado necesita leer carritos desde el Admin de
Mercur. En el panel admin: **Configuración (Settings) > Claves API (API Key
Management) > Crear clave secreta**. Copia el valor y pégalo en
`MEDUSA_ADMIN_SECRET_KEY` dentro de `.env` del servidor, luego:

```bash
docker compose restart n8n
```

## 11. Activar los workflows

De vuelta en n8n, abre cada workflow importado y activa el switch
**"Active"** arriba a la derecha.

## Probar que funciona

- Escríbele al número de WhatsApp conectado algo como "busco un router CNC" y
  debería responder con productos del catálogo real.
- Para el carrito abandonado: en n8n, abre el workflow y usa **"Test
  workflow"** para correrlo manualmente y ver si detecta carritos (si no hay
  carritos abandonados con teléfono en ese momento, no enviará nada — es
  normal).

## Ajustar el formato de los mensajes entrantes

Evolution API puede cambiar ligeramente el formato del webhook según la
versión. Si el nodo **"Extraer teléfono y texto"** no detecta el mensaje:
en n8n, pestaña **Executions**, abre la ejecución fallida y revisa el JSON
real que llegó al Webhook para ajustar las rutas (`data.key.remoteJid`,
`data.message.conversation`, etc.) dentro del nodo.

## Próximos agentes (no incluidos todavía)

Esta base (n8n + conexión a Mercur) es el punto de partida para agregar más
adelante, cuando se definan: publicidad (crear/pausar anuncios según ventas),
generación de contenido (descripciones, posts), publicación en redes
sociales, generación de videos para YouTube. Cada uno es un workflow nuevo
dentro del mismo n8n — no hace falta levantar infraestructura otra vez.
