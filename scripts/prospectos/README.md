# Prospectos HETNA CNC (correo automatizado)

Busca empresas del nicho CNC (talleres, proveedores, manufactureras, instructores)
en México, EE.UU. y Sudamérica, las guarda **sin duplicados** en una hoja de Google
Sheets y un flujo de n8n les escribe todos los días hasta que **se registran en
HETNA** o **se dan de baja**.

## Piezas

| Pieza | Dónde |
|---|---|
| Hoja de prospectos | Google Sheets «HETNA · Prospectos CNC» (id `1ZgZPQ4ZqsbneZpZCueNY4c1iBy0MnQJQ7Y8qb2v3KQo`) |
| Flujo de n8n | «Prospectos HETNA - Campaña de correo CNC» (`https://n8n.hetnacnc.com/workflow/KsYUdRyd9fcbmYys`) |
| Aviso de registro | `packages/api/src/subscribers/prospecto-registrado-n8n.ts` |
| Raspador (ScrapeGraphAI) | `buscar_prospectos.py` + `consultas.txt` |
| Limpieza / unión | `unir_y_limpiar.py` |
| Código de los nodos de n8n | `n8n/*.js` (plantillas de correo en `n8n/preparar_correos.js`) |

## Columnas de la hoja

`id` (dominio, llave única) · empresa · tipo · tamano · pais · region · ciudad · web ·
dominio · email · telefono · whatsapp · facebook · instagram · linkedin · youtube ·
tiktok · productos_servicios · idioma (es/en/pt) · segmento · fuente_url ·
**control:** fecha_alta · estatus · paso · ultimo_contacto · proximo_contacto · token · notas

**estatus**

| Valor | Qué pasa |
|---|---|
| `NUEVO` | Recibe el correo 1 en el siguiente envío |
| `CONTACTADO` | En secuencia (pasos 1–2) |
| `PAUSA` | Recibió el paso 3; en 60 días recibe un último aviso |
| `FINALIZADO` | Terminó la secuencia |
| `REGISTRADO` | Se dio de alta en HETNA → **no se le vuelve a escribir** |
| `BAJA` | Usó el enlace de baja → no se le vuelve a escribir |
| `RESPONDIO` | Ponlo a mano cuando alguien conteste: sale de la secuencia |
| `SIN_EMAIL` | Sólo tiene teléfono/redes: queda para WhatsApp o contacto manual |
| `REBOTE` / `ERROR` | Correo inválido o falló el envío |

## Secuencia (L-V 9:00, hora de México, 25 s entre cada correo)

**Calentamiento del remitente:** 20 correos al día hasta el 25 de noviembre de 2026;
desde el 26 de noviembre el nodo «Límite del día» sube solo a 40.

1. Presentación según el tipo:
   - **Talleres y proveedores** → vender en HETNA: publicar gratis y 6% de comisión
     (5% en máquinas) contra Mercado Libre (12.5–20.5%) y Amazon (8–20% + $600/mes).
     Aclara que **cada vendedor factura (CFDI) a su cliente**.
   - **Instructores** → publicar cursos en la Academia HETNA.
   - **Compradores / servicios** → cotizar y publicar licitaciones de fabricación.
2. +4 días: seguimiento corto.
3. +6 días (día 10): último aviso (talleres fundadores) → `PAUSA`.
4. +60 días: un recordatorio final → `FINALIZADO`.

Todos los correos llevan **enlace de baja** (abre una página con el botón «Confirmar baja»; sólo al presionarlo se marca `BAJA`, así los antivirus que abren enlaces no dan de baja a nadie) y el domicilio de HETNA
(Col. Centro, Apizaco, Tlaxcala, México). Sólo se usan correos de empresa
publicados por la propia empresa; no se recolectan datos personales.

## Puesta en marcha (una vez)

1. ✅ Credencial «Google Sheets account» asignada a los 8 nodos de Google Sheets.
2. ✅ Envío con la credencial **SMTP account** (Hostinger). Esa cuenta sólo permite
   enviar como `avisos@hetnacnc.com`; las respuestas llegan a `contacto@hetnacnc.com`
   (Reply-To). Para enviar como `contacto@` crea otra credencial SMTP con ese usuario.
3. En el backend (`packages/api`, variables de entorno):
   ```
   N8N_PROSPECTOS_REGISTRO_URL=https://n8n.hetnacnc.com/webhook/hetna-prospecto-registrado
   ```
   y vuelve a desplegar.
4. ✅ Probado de punta a punta (importar, envío, baja y registro) y publicado.

## Más prospectos con ScrapeGraphAI

```bash
cd scripts/prospectos
pip install -r requirements.txt && playwright install chromium
export LLM_MODEL="openai/gpt-4o-mini"      # o groq/..., anthropic/..., ollama/llama3.1
export LLM_API_KEY="..."                   # no hace falta con ollama
python buscar_prospectos.py --max-por-consulta 15 \
  --enviar https://n8n.hetnacnc.com/webhook/hetna-prospectos-importar
```

Edita `consultas.txt` para cambiar ciudades, países o tipos. El script descarta
correos que no aparecen literalmente en la página y n8n vuelve a quitar
duplicados (por dominio y por correo) antes de agregarlos a la hoja.

## Cambiar las plantillas de correo

Edita `n8n/preparar_correos.js` y pega su contenido en el nodo
«Preparar correos del día». `n8n/generar_flujo.py` arma el flujo completo
(`n8n/flujo.sdk.js`) para el Workflow SDK de n8n si hay que recrearlo.

## Respuestas automáticas (flujo «Prospectos HETNA - Respuestas del correo»)

n8n revisa el buzón de la credencial **IMAP account** (`contacto@hetnacnc.com`,
Hostinger) cada vez que llega un correo, sin marcarlo como leído:

| Llega… | En la hoja queda | Aviso |
|---|---|---|
| Respuesta de un prospecto (mismo correo o dominio) | `RESPONDIO` | Telegram |
| Respuesta que pide no recibir más («no me interesa», «baja», «unsubscribe»…) | `BAJA` | Telegram |
| Rebote del servidor (mailer-daemon) con un correo de la hoja | `REBOTE` | Telegram |

Tú sólo supervisas en Telegram y contestas desde `contacto@hetnacnc.com`.
Código: `n8n/clasificar_respuesta.js`.

## Búsqueda automática de prospectos (ScrapeGraphAI + Groq, todas las noches)

`plan_busqueda.json` tiene 572 búsquedas (segmentos × ciudades de México, EE.UU.,
Sudamérica y Brasil). Cada noche se corren las siguientes `TANDA` (15 por defecto);
al terminar todas, empieza otra vuelta y los sitios ya vistos se saltan. Lo nuevo
se manda al webhook «Importar prospectos», que sólo agrega lo que no esté en la hoja.

Instalación en el servidor (una sola vez):

```bash
cd ~/hetnacnc && bash scripts/prospectos/instalar_servidor.sh
nano scripts/prospectos/.env        # pega tu llave de Groq en LLM_API_KEY
scripts/prospectos/correr_diario.sh && tail -n 40 scripts/prospectos/datos/busqueda.log
```

`.env`, `.venv/` y `datos/` no se suben a git (el despliegue sigue limpio).

## WhatsApp (pendiente)

Número que se usará: **+52 221 707 6014**. Las empresas con estatus `SIN_EMAIL`
(sólo teléfono/WhatsApp) quedan para esa campaña cuando se conecte el sistema de
WhatsApp.
