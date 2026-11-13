#!/usr/bin/env python3
"""Arma flujo.sdk.js (Workflow SDK de n8n) del flujo «HETNA - Directorio de talleres».

El SDK no acepta funciones auxiliares, así que aquí se escribe cada nodo completo.
Uso:  python3 generar_flujo.py            -> flujo.sdk.js con el código de los nodos
      python3 generar_flujo.py --esqueleto -> nodos Code vacíos (para crear y luego pegar el código)
"""
import json
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SHEET_ID = "1ZgZPQ4ZqsbneZpZCueNY4c1iBy0MnQJQ7Y8qb2v3KQo"
ESQUELETO = "--esqueleto" in sys.argv


def codigo_nodo(archivo):
    js = (AQUI / archivo).read_text(encoding="utf-8")
    if archivo != "directorio_publico.js":
        js = (AQUI / "comun.js").read_text(encoding="utf-8") + "\n" + js
    assert "`" not in js and "${" not in js and "\\" not in js, archivo + ": sin backticks, ${ ni barras"
    return "'return [];'" if ESQUELETO else "`" + js + "`"


def leer(var, nombre):
    return f"""const {var} = node({{
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {{
    name: '{nombre}',
    parameters: {{ resource: 'sheet', operation: 'read', authentication: 'oAuth2', documentId: HOJA, sheetName: PESTANA }},
    credentials: GSHEETS,
  }},
}});
"""


def codigo(var, nombre, archivo):
    return f"""const {var} = node({{
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {{ name: '{nombre}', parameters: {{ mode: 'runOnceForAllItems', language: 'javaScript', jsCode: {codigo_nodo(archivo)} }} }},
}});
"""


def ref(origen, campo):
    return "expr(" + json.dumps("{{ $('" + origen + "').item.json." + campo + " }}", ensure_ascii=False) + ")"


def anotar(var, nombre, origen):
    return f"""const {var} = node({{
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {{
    name: '{nombre}',
    parameters: {{
      resource: 'sheet',
      operation: 'update',
      authentication: 'oAuth2',
      documentId: HOJA,
      sheetName: PESTANA,
      columns: {{
        mappingMode: 'defineBelow',
        matchingColumns: ['id'],
        value: {{ id: {ref(origen, 'id')}, notas: {ref(origen, 'notas')} }},
        schema: [C_id, C_notas],
      }},
      options: {{}},
    }},
    credentials: GSHEETS,
  }},
}});
"""


def si(var, nombre, condicion):
    return f"""const {var} = ifElse({{
  version: 2.2,
  config: {{
    name: '{nombre}',
    parameters: {{
      conditions: {{
        options: {{ caseSensitive: true, leftValue: '', typeValidation: 'loose' }},
        conditions: [{{ leftValue: expr({json.dumps(condicion, ensure_ascii=False)}), operator: {{ type: 'boolean', operation: 'true', singleValue: true }} }}],
        combinator: 'and',
      }},
      options: {{}},
    }},
  }},
}});
"""


def correo(var, nombre, origen):
    return f"""const {var} = node({{
  type: 'n8n-nodes-base.emailSend',
  version: 2.1,
  config: {{
    name: '{nombre}',
    onError: 'continueRegularOutput',
    parameters: {{
      operation: 'send',
      fromEmail: 'HETNA CNC <avisos@hetnacnc.com>',
      toEmail: {ref(origen, 'email')},
      subject: {ref(origen, 'asunto')},
      emailFormat: 'both',
      text: {ref(origen, 'texto')},
      html: {ref(origen, 'html')},
      options: {{ appendAttribution: false, replyTo: 'contacto@hetnacnc.com' }},
    }},
    credentials: SMTP,
  }},
}});
"""


def telegram(var, nombre, origen):
    return f"""const {var} = node({{
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {{
    name: '{nombre}',
    onError: 'continueRegularOutput',
    parameters: {{
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr('{{{{ $env.TELEGRAM_ADMIN_CHAT_ID }}}}'),
      text: {ref(origen, 'aviso')},
      additionalFields: {{ appendAttribution: false }},
    }},
    credentials: TELEGRAM,
  }},
}});
"""


def webhook(var, nombre, metodo, ruta, modo):
    return f"""const {var} = trigger({{
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {{
    name: '{nombre}',
    parameters: {{ httpMethod: '{metodo}', path: '{ruta}', responseMode: '{modo}', options: {{}} }},
  }},
}});
"""


PI, PQ = "Preparar aviso de interés", "Preparar retiro de perfil"
partes = [
    "import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';\n",
    "// Generado por scripts/prospectos/n8n/directorio/generar_flujo.py — no editar a mano.\n",
    f"const HOJA = {{ __rl: true, mode: 'id', value: '{SHEET_ID}', cachedResultName: 'HETNA · Prospectos CNC' }};",
    "const PESTANA = { __rl: true, mode: 'list', value: 480734981, cachedResultName: 'Untitled' };",
    "const GSHEETS = { googleSheetsOAuth2Api: { id: 'NVIJb4C1M9pp6Pp5', name: 'Google Sheets account' } };",
    "const SMTP = { smtp: { id: '6IssBAMil5xjjgPf', name: 'SMTP account' } };",
    "const TELEGRAM = { telegramApi: { id: 'bEA8sRVfpQBpl4py', name: 'Telegram account' } };",
    "const C_id = { id: 'id', displayName: 'id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true };",
    "const C_notas = { id: 'notas', displayName: 'notas', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true };\n",
    "// 1) Directorio público (lo lee la tienda con caché de 1 h)",
    webhook("directorio", "Directorio público", "GET", "hetna-directorio", "responseNode"),
    leer("leerDirectorio", "Leer hoja (directorio)"),
    codigo("armar", "Armar directorio público", "directorio_publico.js"),
    """const responder = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Responder directorio',
    parameters: {
      respondWith: 'firstIncomingItem',
      options: { responseHeaders: { entries: [{ name: 'Cache-Control', value: 'public, max-age=600' }] } },
    },
  },
});
""",
    "// 2) Un cliente pidió cotización desde un perfil no reclamado",
    webhook("interes", "Interés de un cliente", "POST", "hetna-directorio-interes", "onReceived"),
    leer("leerInteres", "Leer hoja (interés)"),
    codigo("prepInteres", PI, "interes.js"),
    si("siInteres", "¿Perfil activo?", "{{ $json.anotar }}"),
    anotar("anotarInteres", "Anotar interés", PI),
    si("siCorreoInteres", "¿Avisar al taller por correo?", "{{ $('" + PI + "').item.json.enviar }}"),
    correo("correoInteres", "Correo: un cliente te busca", PI),
    telegram("tgInteres", "Telegram: cliente interesado", PI),
    "// 3) Quitar un perfil (lo confirma la propia empresa por correo)",
    webhook("quitar", "Quitar perfil", "POST", "hetna-directorio-quitar", "onReceived"),
    leer("leerQuitar", "Leer hoja (quitar)"),
    codigo("prepQuitar", PQ, "quitar.js"),
    si("siQuitar", "¿Perfil en la hoja?", "{{ $json.anotar }}"),
    anotar("anotarQuitar", "Anotar solicitud de retiro", PQ),
    si("siCorreoQuitar", "¿Tiene correo?", "{{ $('" + PQ + "').item.json.enviar }}"),
    correo("correoQuitar", "Correo: confirma el retiro", PQ),
    telegram("tgQuitar", "Telegram: piden quitar perfil", PQ),
    """const nota = sticky(
  '## Directorio de talleres (perfiles no reclamados)\\n' +
  'Fuente: hoja «HETNA · Prospectos CNC».\\n\\n' +
  '1. **GET hetna-directorio**: datos públicos (sin correo ni teléfono). Fuera BAJA, REGISTRADO, compradores, descartados y publicar = NO.\\n' +
  '2. **POST hetna-directorio-interes** { slug, folio, servicio, material, cantidad, ciudad, estado_mx }: avisa al taller (máx. 1 cada 7 días, 25 al día) sin datos del cliente, anota en notas y avisa por Telegram.\\n' +
  '3. **POST hetna-directorio-quitar** { slug }: manda a la empresa su enlace de baja para que confirme.\\n\\n' +
  'Para ocultar una empresa a mano: columna **publicar** = NO.',
  [directorio, leerDirectorio, armar, responder],
  { color: 4 }
);

export default workflow('hetna-directorio', 'HETNA - Directorio de talleres (perfiles no reclamados)')
  .add(directorio)
  .to(leerDirectorio)
  .to(armar)
  .to(responder)
  .add(interes)
  .to(leerInteres)
  .to(prepInteres)
  .to(siInteres.onTrue(anotarInteres.to(siCorreoInteres
    .onTrue(correoInteres.to(tgInteres))
    .onFalse(tgInteres))))
  .add(quitar)
  .to(leerQuitar)
  .to(prepQuitar)
  .to(siQuitar.onTrue(anotarQuitar.to(siCorreoQuitar
    .onTrue(correoQuitar.to(tgQuitar))
    .onFalse(tgQuitar))))
  .add(nota);
""",
]
salida = AQUI / ("/tmp/claude-0/esqueleto.js" if ESQUELETO else "flujo.sdk.js")
salida.write_text("\n".join(partes), encoding="utf-8")
print("ok", salida, len(salida.read_text()))
