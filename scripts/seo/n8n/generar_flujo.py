#!/usr/bin/env python3
"""Arma flujo.sdk.js (Workflow SDK de n8n) del flujo «SEO - Search Console semanal»
con los nodos Code de esta carpeta (fechas.js, armar.js, titulos.js).

  python3 scripts/seo/n8n/generar_flujo.py

Tablas de n8n que usa: seo_paginas, seo_consultas, seo_semanal (proyecto personal).
"""
import json
from pathlib import Path

AQUI = Path(__file__).resolve().parent
T = {"paginas": "mhFa04ZEixjp5TQe", "consultas": "linTWPwHpsV99mrz", "semanal": "WSWfgij9FAEK6Xhi"}
COLUMNAS = {
    "paginas": [("url", "string"), ("slug_directorio", "string"), ("clics", "number"), ("impresiones", "number"), ("ctr", "number"),
                ("posicion", "number"), ("consulta_top", "string"), ("periodo", "string"), ("dias", "number"), ("fuente", "string")],
    "consultas": [("consulta", "string"), ("clics", "number"), ("impresiones", "number"), ("ctr", "number"), ("posicion", "number"),
                  ("url_top", "string"), ("periodo", "string"), ("dias", "number"), ("fuente", "string")],
    "semanal": [("semana", "string"), ("clics", "number"), ("impresiones", "number"), ("ctr", "number"), ("posicion", "number"), ("fuente", "string")],
}
code = {n: json.dumps((AQUI / f"{n}.js").read_text(encoding="utf-8")) for n in ("fechas", "armar", "titulos")}


def tabla(clave):
    return "{ __rl: true, mode: 'id', value: '%s', cachedResultName: 'seo_%s' }" % (T[clave], clave)


def guardar(nombre, clave):
    cols = COLUMNAS[clave]
    valor = ", ".join("%s: expr('{{ $json.%s }}')" % (c, c) for c, _ in cols)
    esquema = ", ".join("{ id: '%s', displayName: '%s', required: false, defaultMatch: false, display: true, type: '%s', canBeUsedToMatch: true }" % (c, c, t) for c, t in cols)
    return f"""node({{
  type: 'n8n-nodes-base.dataTable', version: 1.1,
  config: {{ name: '{nombre}', parameters: {{ resource: 'row', operation: 'insert', dataTableId: {tabla(clave)},
    columns: {{ mappingMode: 'defineBelow', value: {{ {valor} }}, schema: [{esquema}] }}, options: {{ optimizeBulk: true }} }} }}
}})"""


def borrar(nombre, clave, cond):
    return f"""node({{
  type: 'n8n-nodes-base.dataTable', version: 1.1,
  config: {{ name: '{nombre}', executeOnce: true, alwaysOutputData: true, parameters: {{ resource: 'row', operation: 'deleteRows', dataTableId: {tabla(clave)},
    matchType: 'allConditions', filters: {{ conditions: [{cond}] }} }} }}
}})"""


def filas(nombre, campo):
    return f"""node({{
  type: 'n8n-nodes-base.code', version: 2,
  config: {{ name: '{nombre}', parameters: {{ mode: 'runOnceForAllItems', language: 'javaScript',
    jsCode: "return ($('Armar datos').first().json.{campo} || []).map((json) => ({{ json }}));" }} }}
}})"""


def gsc(nombre, cuerpo):
    return f"""node({{
  type: 'n8n-nodes-base.httpRequest', version: 4.5,
  config: {{ name: '{nombre}', executeOnce: true, onError: 'continueRegularOutput',
    parameters: {{ method: 'POST', url: expr("{{{{ $('Fechas').first().json.api }}}}"), authentication: 'predefinedCredentialType', nodeCredentialType: 'googleOAuth2Api',
      sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr("{cuerpo}"), options: {{ timeout: 60000 }} }},
    credentials: {{ googleOAuth2Api: newCredential('Google Search Console') }} }}
}})"""


def tg(var, nombre, texto):
    return f"""const {var} = node({{ type: 'n8n-nodes-base.telegram', version: 1.2, config: {{ name: '{nombre}', executeOnce: true, onError: 'continueRegularOutput',
  parameters: {{ resource: 'message', operation: 'sendMessage', chatId: expr('{{{{ $env.TELEGRAM_ADMIN_CHAT_ID }}}}'), text: {texto}, additionalFields: {{ appendAttribution: false, parse_mode: 'HTML' }} }},
  credentials: {{ telegramApi: {{ id: 'bEA8sRVfpQBpl4py', name: 'Telegram account' }} }} }} }});"""


F = "$('Fechas').first().json"
cuerpo = lambda dims, ini, filas_max: '{{ JSON.stringify({ startDate: ' + F + '.' + ini + ', endDate: ' + F + '.fin, dimensions: ' + dims + ', rowLimit: ' + str(filas_max) + ' }) }}'

sdk = f"""import {{ workflow, node, trigger, ifElse, newCredential, expr }} from '@n8n/workflow-sdk';

const lunes = trigger({{
  type: 'n8n-nodes-base.scheduleTrigger', version: 1.4,
  config: {{ name: 'Lunes 8:13 (hora de México)', parameters: {{ rule: {{ interval: [{{ field: 'cronExpression', expression: '13 8 * * 1' }}] }} }} }}
}});
const manual = trigger({{ type: 'n8n-nodes-base.manualTrigger', version: 1, config: {{ name: 'Probar a mano' }} }});

const fechas = node({{ type: 'n8n-nodes-base.code', version: 2, config: {{ name: 'Fechas', parameters: {{ mode: 'runOnceForAllItems', language: 'javaScript', jsCode: {code['fechas']} }} }} }});
const gscPaginas = {gsc('GSC páginas', cuerpo("['page']", 'inicio', 5000))};
const gscConsultas = {gsc('GSC consultas', cuerpo("['query']", 'inicio', 2000))};
const gscPaginaConsulta = {gsc('GSC página y consulta', cuerpo("['page','query']", 'inicio', 5000))};
const gscDias = {gsc('GSC por día', cuerpo("['date']", 'inicioComparar', 100))};
const armar = node({{ type: 'n8n-nodes-base.code', version: 2, config: {{ name: 'Armar datos', parameters: {{ mode: 'runOnceForAllItems', language: 'javaScript', jsCode: {code['armar']} }} }} }});

const hayDatos = ifElse({{ version: 2.2, config: {{ name: '¿Hay datos?', parameters: {{ conditions: {{
  options: {{ caseSensitive: true, leftValue: '', typeValidation: 'loose' }},
  conditions: [{{ leftValue: expr('{{{{ $json.ok }}}}'), operator: {{ type: 'boolean', operation: 'true', singleValue: true }} }}],
  combinator: 'and' }} }} }} }});

const borrarPaginas = {borrar('Borrar páginas viejas', 'paginas', "{ keyName: 'id', condition: 'gte', keyValue: '0' }")};
const filasPaginas = {filas('Filas de páginas', 'paginas')};
const guardarPaginas = {guardar('Guardar páginas', 'paginas')};
const borrarConsultas = {borrar('Borrar consultas viejas', 'consultas', "{ keyName: 'id', condition: 'gte', keyValue: '0' }")};
const filasConsultas = {filas('Filas de consultas', 'consultas')};
const guardarConsultas = {guardar('Guardar consultas', 'consultas')};
const borrarSemanas = {borrar('Borrar semanas repetidas', 'semanal', "{ keyName: 'semana', condition: 'gte', keyValue: expr(\"{{ $('Armar datos').first().json.primeraSemana }}\") }")};
const filasSemanas = {filas('Filas de semanas', 'semanas')};
const guardarSemanas = {guardar('Guardar semanas', 'semanal')};

const revisar = node({{ type: 'n8n-nodes-base.code', version: 2, config: {{ name: 'Páginas a revisar', parameters: {{ mode: 'runOnceForAllItems', language: 'javaScript',
  jsCode: "const r = $('Armar datos').first().json.revisar || [];\\nreturn (r.length ? r : [{{ url: '' }}]).map((json) => ({{ json }}));" }} }} }});
const bajar = node({{ type: 'n8n-nodes-base.httpRequest', version: 4.5, config: {{ name: 'Bajar página', onError: 'continueRegularOutput',
  parameters: {{ method: 'GET', url: expr("{{{{ $json.url || 'https://hetnacnc.com/mx' }}}}"), options: {{ timeout: 30000, response: {{ response: {{ responseFormat: 'text', outputPropertyName: 'data' }} }} }} }} }} }});
const titulos = node({{ type: 'n8n-nodes-base.code', version: 2, config: {{ name: 'Sugerir títulos', parameters: {{ mode: 'runOnceForAllItems', language: 'javaScript', jsCode: {code['titulos']} }} }} }});

{tg('reporte', 'Telegram: reporte SEO', "expr('{{ $json.texto }}')")}
{tg('falla', 'Telegram: no pude leer Search Console', 'expr("⚠️ SEO semanal: no pude leer Search Console. {{ $json.error }} Revisa la credencial «Google Search Console» en n8n (scope webmasters.readonly) y que la cuenta tenga acceso a la propiedad.")')}

export default workflow('seo-search-console', 'SEO - Search Console semanal')
  .add(lunes).to(fechas)
  .add(manual).to(fechas)
  .add(fechas).to(gscPaginas).to(gscConsultas).to(gscPaginaConsulta).to(gscDias).to(armar)
  .to(hayDatos
    .onTrue(borrarPaginas.to(filasPaginas).to(guardarPaginas).to(borrarConsultas).to(filasConsultas).to(guardarConsultas)
      .to(borrarSemanas).to(filasSemanas).to(guardarSemanas).to(revisar).to(bajar).to(titulos).to(reporte))
    .onFalse(falla));
"""
(AQUI / "flujo.sdk.js").write_text(sdk, encoding="utf-8")
print("ok", len(sdk))
