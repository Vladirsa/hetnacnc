import { workflow, node, trigger, sticky, newCredential, ifElse, splitInBatches, nextBatch, expr } from '@n8n/workflow-sdk';

// Generado por scripts/prospectos/n8n/generar_flujo.py — no editar a mano;
// cambia los .js de esta carpeta y vuelve a generar.

const HOJA = { __rl: true, mode: 'id', value: '__SHEET_ID__', cachedResultName: 'HETNA · Prospectos CNC' };
const PESTANA = { __rl: true, mode: 'list', value: 'gid=0', cachedResultName: 'Prospectos' };
const GSHEETS = { googleSheetsOAuth2Api: newCredential('Google Sheets HETNA') };

const C_id = { id: 'id', displayName: 'id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true };
const C_estatus = { id: 'estatus', displayName: 'estatus', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true };
const C_paso = { id: 'paso', displayName: 'paso', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true };
const C_ultimo_contacto = { id: 'ultimo_contacto', displayName: 'ultimo_contacto', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true };
const C_proximo_contacto = { id: 'proximo_contacto', displayName: 'proximo_contacto', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true };
const C_notas = { id: 'notas', displayName: 'notas', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true };
const C_empresa = { id: 'empresa', displayName: 'empresa', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true };
const C_email = { id: 'email', displayName: 'email', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true };

// ───────── 1) Envío diario ─────────
const diario = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.4,
  config: {
    name: 'L-V 9:00 (hora de México)',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 9 * * 1-5' }] } },
  },
});

const leerDiario = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Leer prospectos',
    parameters: { resource: 'sheet', operation: 'read', authentication: 'oAuth2', documentId: HOJA, sheetName: PESTANA },
    credentials: GSHEETS,
  },
});

const preparar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Preparar correos del día',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: __PREPARAR__ },
  },
});

const uno = splitInBatches({ version: 3, config: { name: 'Uno por uno', parameters: { batchSize: 1, options: {} } } });

const enviar = node({
  type: 'n8n-nodes-base.emailSend',
  version: 2.1,
  config: {
    name: 'Enviar correo',
    onError: 'continueRegularOutput',
    parameters: {
      operation: 'send',
      fromEmail: 'HETNA CNC <contacto@hetnacnc.com>',
      toEmail: expr('{{ $json.email }}'),
      subject: expr('{{ $json.asunto }}'),
      emailFormat: 'html',
      // Agrega las redes de HETNA arriba del pie (antes del <hr>) de cada correo.
      html: expr('{{ $json.html.replace(\'<hr \', \'<p style="font-size:14px">👉 <a href="https://www.facebook.com/hetna.cnc">Facebook</a> · <a href="https://www.instagram.com/hetna_cnc/">Instagram</a> · <a href="https://www.tiktok.com/@hetna_cnc">TikTok</a> · <a href="https://www.youtube.com/channel/UCw3eWFopDZAzKa4mRIM8YoQ">YouTube</a> · <a href="https://x.com/CncHetna">X</a></p><hr \') }}'),
      options: { appendAttribution: false, replyTo: 'contacto@hetnacnc.com' },
    },
    credentials: { smtp: { id: '6IssBAMil5xjjgPf', name: 'SMTP account' } },
  },
});

const marcarEnviado = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Anotar en la hoja',
    parameters: {
      resource: 'sheet',
      operation: 'update',
      authentication: 'oAuth2',
      documentId: HOJA,
      sheetName: PESTANA,
      columns: {
        mappingMode: 'defineBelow',
        matchingColumns: ['id'],
        value: {
          id: expr("{{ $('Uno por uno').item.json.id }}"),
          estatus: expr("{{ $json.error ? 'ERROR' : $('Uno por uno').item.json.estatus }}"),
          paso: expr("{{ $('Uno por uno').item.json.paso }}"),
          ultimo_contacto: expr("{{ $('Uno por uno').item.json.ultimo_contacto }}"),
          proximo_contacto: expr("{{ $json.error ? '' : $('Uno por uno').item.json.proximo_contacto }}"),
          notas: expr("{{ $json.error ? [$('Uno por uno').item.json.notas, 'Error al enviar: ' + ($json.error.message || $json.error)].filter(Boolean).join(' | ') : $('Uno por uno').item.json.notas }}"),
        },
        schema: [C_id, C_estatus, C_paso, C_ultimo_contacto, C_proximo_contacto, C_notas],
      },
      options: {},
    },
    credentials: GSHEETS,
  },
});

const pausa = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: { name: 'Esperar 25 s (entregabilidad)', parameters: { resume: 'timeInterval', amount: 25, unit: 'seconds' } },
});

// ───────── 2) Se registró en HETNA (lo manda el backend) ─────────
const registro = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Registro en HETNA',
    parameters: { httpMethod: 'POST', path: 'hetna-prospecto-registrado', responseMode: 'onReceived', options: {} },
  },
});

const leerRegistro = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Leer prospectos (registro)',
    executeOnce: true,
    parameters: { resource: 'sheet', operation: 'read', authentication: 'oAuth2', documentId: HOJA, sheetName: PESTANA },
    credentials: GSHEETS,
  },
});

const buscarRegistrado = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Buscar al registrado',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: __REGISTRADO__ },
  },
});

const marcarRegistrado = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Marcar REGISTRADO',
    parameters: {
      resource: 'sheet',
      operation: 'update',
      authentication: 'oAuth2',
      documentId: HOJA,
      sheetName: PESTANA,
      columns: {
        mappingMode: 'autoMapInputData',
        matchingColumns: ['id'],
        value: {},
        schema: [C_id, C_estatus, C_proximo_contacto, C_notas],
      },
      options: { handlingExtraData: 'ignoreIt' },
    },
    credentials: GSHEETS,
  },
});

// ───────── 3) Enlace de baja ─────────
const baja = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Enlace de baja',
    parameters: { httpMethod: 'GET', path: 'hetna-prospectos-baja', responseMode: 'responseNode', options: { ignoreBots: true } },
  },
});

const leerBaja = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Leer prospectos (baja)',
    executeOnce: true,
    parameters: { resource: 'sheet', operation: 'read', authentication: 'oAuth2', documentId: HOJA, sheetName: PESTANA },
    credentials: GSHEETS,
  },
});

const validarBaja = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validar baja',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: __BAJA__ },
  },
});

const bajaValida = ifElse({
  version: 2.2,
  config: {
    name: '¿Enlace válido?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
    },
  },
});

const marcarBaja = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Marcar BAJA',
    parameters: {
      resource: 'sheet',
      operation: 'update',
      authentication: 'oAuth2',
      documentId: HOJA,
      sheetName: PESTANA,
      columns: {
        mappingMode: 'autoMapInputData',
        matchingColumns: ['id'],
        value: {},
        schema: [C_id, C_estatus, C_proximo_contacto, C_notas],
      },
      options: { handlingExtraData: 'ignoreIt' },
    },
    credentials: GSHEETS,
  },
});

const PAGINA_OK = '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Baja confirmada · HETNA CNC</title><body style="font-family:Arial,sans-serif;max-width:520px;margin:60px auto;padding:0 20px;color:#111827"><h1 style="color:#f97316">Listo</h1><p>Ya no recibirás más correos de prospección de HETNA CNC. / You will not receive more emails. / Você não receberá mais e-mails.</p><p><a href="https://www.hetnacnc.com">hetnacnc.com</a></p></body></html>';
const PAGINA_MAL = '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HETNA CNC</title><body style="font-family:Arial,sans-serif;max-width:520px;margin:60px auto;padding:0 20px;color:#111827"><h1>Enlace no válido</h1><p>No encontramos tu registro. Escríbenos a contacto@hetnacnc.com y te damos de baja manualmente.</p></body></html>';

const responderOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Página: baja confirmada',
    parameters: {
      respondWith: 'text',
      responseBody: PAGINA_OK,
      options: { responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }] } },
    },
  },
});

const responderMal = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Página: enlace no válido',
    parameters: {
      respondWith: 'text',
      responseBody: PAGINA_MAL,
      options: { responseCode: 404, responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }] } },
    },
  },
});

// ───────── 4) Importar prospectos nuevos (ScrapeGraphAI) sin duplicar ─────────
const importar = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Importar prospectos',
    parameters: { httpMethod: 'POST', path: 'hetna-prospectos-importar', responseMode: 'onReceived', options: {} },
  },
});

const leerImportar = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Leer prospectos (importar)',
    executeOnce: true,
    parameters: { resource: 'sheet', operation: 'read', authentication: 'oAuth2', documentId: HOJA, sheetName: PESTANA },
    credentials: GSHEETS,
  },
});

const quitarDuplicados = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Quitar duplicados',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: __IMPORTAR__ },
  },
});

const agregar = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Agregar a la hoja',
    parameters: {
      resource: 'sheet',
      operation: 'append',
      authentication: 'oAuth2',
      documentId: HOJA,
      sheetName: PESTANA,
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [C_id, C_empresa, C_email] },
      options: { handlingExtraData: 'ignoreIt' },
    },
    credentials: GSHEETS,
  },
});

const nota = sticky(
  '## Prospectos HETNA CNC\n' +
  '**Hoja:** HETNA · Prospectos CNC (Google Sheets).\n\n' +
  '1. **Diario L-V 9:00**: hasta 40 correos, primero seguimientos. Secuencia 1 → +4 días → +6 días → pausa 60 días → último aviso.\n' +
  '2. **Registro en HETNA**: el backend avisa (seller.created / customer.created) y la fila queda REGISTRADO: ya no se le escribe.\n' +
  '3. **Baja**: el enlace de cada correo marca BAJA.\n' +
  '4. **Importar**: POST { prospectos: [...] } agrega sólo los que no existen (por dominio y correo).\n\n' +
  'Estatus que nunca reciben correo: REGISTRADO, BAJA, RESPONDIO, REBOTE, SIN_EMAIL, FINALIZADO, ERROR.\n' +
  'Si alguien responde, cambia su estatus a RESPONDIO en la hoja.',
  [diario, leerDiario, preparar],
  { color: 4 }
);

export default workflow('hetna-prospectos', 'Prospectos HETNA - Campaña de correo CNC')
  .add(diario)
  .to(leerDiario)
  .to(preparar)
  .to(uno
    .onEachBatch(enviar.to(marcarEnviado.to(pausa.to(nextBatch(uno)))))
  )
  .add(registro)
  .to(leerRegistro)
  .to(buscarRegistrado)
  .to(marcarRegistrado)
  .add(baja)
  .to(leerBaja)
  .to(validarBaja)
  .to(bajaValida
    .onTrue(marcarBaja.to(responderOk))
    .onFalse(responderMal))
  .add(importar)
  .to(leerImportar)
  .to(quitarDuplicados)
  .to(agregar)
  .add(nota);
