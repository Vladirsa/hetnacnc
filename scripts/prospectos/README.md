# Prospectos HETNA CNC (correo automatizado)

Busca empresas del nicho CNC (talleres, proveedores, manufactureras, instructores)
en México, EE.UU. y Sudamérica, las guarda **sin duplicados** en una hoja de Google
Sheets y un flujo de n8n les escribe todos los días hasta que **se registran en
HETNA** o **se dan de baja**.

## Piezas

| Pieza | Dónde |
|---|---|
| Hoja de prospectos | Google Sheets «HETNA · Prospectos CNC» (id `1KlM-qhS-AMcciyXTMmpZAXKz8STHshJpsY5Icbxcqts`) |
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

## Secuencia (L-V 9:00, hora de México, máx. 40 correos/día, 25 s entre cada uno)

1. Presentación según el tipo:
   - **Talleres y proveedores** → vender en HETNA: publicar gratis y 6% de comisión
     (5% en máquinas) contra Mercado Libre (12.5–20.5%) y Amazon (8–20% + $600/mes).
     Aclara que **cada vendedor factura (CFDI) a su cliente**.
   - **Instructores** → publicar cursos en la Academia HETNA.
   - **Compradores / servicios** → cotizar y publicar licitaciones de fabricación.
2. +4 días: seguimiento corto.
3. +6 días (día 10): último aviso (talleres fundadores) → `PAUSA`.
4. +60 días: un recordatorio final → `FINALIZADO`.

Todos los correos llevan **enlace de baja** y el domicilio de HETNA
(Col. Centro, Apizaco, Tlaxcala, México). Sólo se usan correos de empresa
publicados por la propia empresa; no se recolectan datos personales.

## Puesta en marcha (una vez)

1. **n8n → Credentials → Google Sheets OAuth2**: conecta tu cuenta de Google y
   asígnala a los 7 nodos de Google Sheets del flujo (vienen marcados como
   «Google Sheets HETNA»).
2. Revisa que la credencial **SMTP account** pueda enviar como
   `contacto@hetnacnc.com` (y que el dominio tenga SPF, DKIM y DMARC).
3. En el backend (`packages/api`, variables de entorno):
   ```
   N8N_PROSPECTOS_REGISTRO_URL=https://n8n.hetnacnc.com/webhook/hetna-prospecto-registrado
   ```
   y vuelve a desplegar.
4. En n8n abre el flujo, ejecuta «Leer prospectos → Preparar correos del día» a
   mano para revisar los correos y luego **Publish**.

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
