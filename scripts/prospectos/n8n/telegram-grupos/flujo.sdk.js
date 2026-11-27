import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';

// Respaldo del flujo n8n «Redes - Publicaciones para grupos de Telegram» (id uqHuVucKxiT5VeY2).
// El código del nodo Code está en armar_publicaciones.js (mismo texto que JS de abajo).
const JS = `// Nodo Code "Armar publicaciones": una publicación distinta por grupo de Telegram,
// con el tono de cada grupo. Rota diseños y herramientas para no repetir
// (tabla telegram_grupos_compartidos). Salen pares [aviso, publicación] en orden.
// Sin barras invertidas: los saltos de línea se arman con fromCharCode.
const NL = String.fromCharCode(10);
const CANAL = 't.me/HetNa_CnC';
const SITIO = 'https://hetnacnc.com/mx';
const esc = (s) => String(s == null ? '' : s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;');
// Diseños pausados (archivo dañado o en revisión): no se comparten
const PAUSADOS = ['HDF-20261026-095553'];

const usados = {};
for (const it of $('Ya compartidos').all()) {
  const r = it.json || {};
  if (!r.clave) continue;
  if (!usados[r.clave] || String(r.fecha) > usados[r.clave]) usados[r.clave] = String(r.fecha || '');
}
const tomados = {};
// El primero que nunca se usó; si ya se usaron todos, el más viejo
function elegir(lista, claveDe) {
  const libres = lista.filter((x) => !tomados[claveDe(x)]);
  if (!libres.length) return null;
  const nuevo = libres.find((x) => !usados[claveDe(x)]);
  const x = nuevo || libres.slice().sort((a, b) => (usados[claveDe(a)] < usados[claveDe(b)] ? -1 : 1))[0];
  tomados[claveDe(x)] = true;
  return x;
}

const disenos = $('Diseños publicados').all().map((i) => i.json)
  .filter((d) => d.slug_ia && (d.titulo_comercial_ia || d.titulo_original) && PAUSADOS.indexOf(d.sku) < 0);
const claveD = (d) => 'd:' + d.sku;
const titulo = (d) => String(d.titulo_comercial_ia || d.titulo_original).split(' — ')[0];
const ligaD = (d) => SITIO + '/products/' + d.slug_ia;

const H = {
  imagen3d: { url: SITIO + '/disenar/imagen-a-3d', nombre: 'Foto a modelo 3D con IA', que: 'Subes la foto de una figura, pieza o mascota y en unos minutos te da el modelo 3D con textura para imprimir (STL).', pago: true },
  litofania: { url: SITIO + '/disenar/litofania-relieve', nombre: 'Litofanías y relieves 3D', que: 'Convierte cualquier foto en litofanía plana, curva o de cilindro, o en relieve para router. Descargas el STL al momento.' },
  modelos3d: { url: SITIO + '/disenar/modelos-3d', nombre: 'Generador de modelos 3D', que: 'Piezas paramétricas (soportes, organizadores, cajas) que ajustas a tu medida y bajas en STL.' },
  letras3d: { url: SITIO + '/disenar/letras-3d', nombre: 'Letras 3D', que: 'Escribes tu texto, eliges letra y grosor y bajas el STL para imprimir o el archivo para router.' },
  vectorizador: { url: SITIO + '/disenar/vectorizador', nombre: 'Vectorizador', que: 'Pasa una imagen o logo a DXF/SVG listo para corte láser o router, en el navegador.' },
  cajas: { url: SITIO + '/disenar/cajas', nombre: 'Cajas para láser', que: 'Pones medidas y espesor del material y te arma la caja con uniones de dedo en DXF/SVG.' },
  celosias: { url: SITIO + '/disenar/celosias', nombre: 'Celosías', que: 'Paneles calados con patrón a tu medida, listos para cortar en MDF o acrílico.' },
  letreros: { url: SITIO + '/disenar/letreros', nombre: 'Letreros', que: 'Arma letreros con tu texto y bájalos en vector para láser o router.' },
  cortadores: { url: SITIO + '/disenar/cortadores-galletas', nombre: 'Cortadores de galletas', que: 'De cualquier silueta saca el cortador en STL para imprimir.' },
  rompecabezas: { url: SITIO + '/disenar/rompecabezas', nombre: 'Rompecabezas', que: 'Convierte una imagen en rompecabezas con las piezas en vector para láser.' },
  calculadora: { url: SITIO + '/calculadora-cnc', nombre: 'Calculadora CNC', que: 'Velocidades, avances y tiempos de corte para router y láser, según material y herramienta.', pregunta: '¿Qué parámetros usan ustedes para MDF de 15 mm con fresa de 6 mm?' },
  foro: { url: SITIO + '/foro-cnc', nombre: 'Foro CNC', que: 'Preguntas y respuestas de router, láser, plasma y torno: fresas, materiales, CAM y fallas comunes.', pregunta: '¿Cuál ha sido la falla más rara que les ha dado su router?' },
  blog: { url: SITIO + '/foro-cnc/blog', nombre: 'Guías del blog', que: 'Guías prácticas de CNC: materiales, fresas, parámetros, costos y cómo cotizar trabajos.', pregunta: '¿De qué tema les gustaría una guía?' },
};

// Grupo, aviso y lo que se le comparte (en el orden en que salen)
const GRUPOS = [
  { id: 'VectoresCorteLaserCNC', info: '6.7 mil miembros · láser y CNC', tipo: 'diseno', herramientas: ['vectorizador', 'cajas', 'letreros', 'rompecabezas'] },
  { id: 'cncvectores', info: '588 · archivos gratis', tipo: 'gratis', herramientas: ['cajas', 'celosias', 'vectorizador', 'letreros', 'rompecabezas'] },
  { id: 'venta_archivos_cnc', info: '578 · venta de archivos', tipo: 'diseno', herramientas: [] },
  { id: 'laseresp', info: '1.6 mil · láser (España)', tipo: 'diseno_sin_precio', herramientas: ['cajas', 'vectorizador', 'celosias', 'rompecabezas'] },
  { id: 'cnces', info: '833 · router CNC (España)', tipo: 'tecnico', herramientas: ['calculadora', 'foro', 'blog'] },
  { id: 'stlspanish', info: '1.4 mil · impresión 3D', tipo: 'herramienta3d', herramientas: ['imagen3d', 'litofania', 'letras3d', 'cortadores', 'modelos3d'] },
  { id: 'impresoras3desp', info: '1.3 mil · impresión 3D (España)', tipo: 'herramienta3d', herramientas: ['litofania', 'modelos3d', 'imagen3d', 'cortadores', 'letras3d'] },
  { id: 'aprendezbrush', info: '16 mil · escultura 3D ZBrush', tipo: 'educativo', herramientas: ['imagen3d', 'litofania'] },
];

// Cada liga lleva de qué grupo viene (Panel › Estrategia la cuenta por utm_content).
// Se ve la liga corta; la marca va escondida en el enlace (Telegram la conserva al copiar).
function conUtm(t, gid) {
  const marca = '?utm_source=telegram&amp;utm_medium=grupo&amp;utm_campaign=grupos-telegram&amp;utm_content=' + gid;
  return t.split(NL).map((l) => l.split(' ').map((w) => (w.indexOf('https://hetnacnc.com/') === 0 ? '<a href="' + w + marca + '">' + w.split('https://').join('') + '</a>' : w)).join(' ')).join(NL);
}
const pie = NL + NL + '📢 Más diseños y herramientas gratis en el canal: ' + CANAL;
const out = [];
out.push({ json: { texto: '<b>📣 Publicaciones para tus grupos de Telegram</b>' + NL + NL + 'Abajo va una por grupo. Mantén presionado el mensaje → <b>Copiar</b> → pégalo en el grupo (así no sale «reenviado de un bot»). Lee antes las reglas fijadas de cada grupo.', sinVista: true, clave: '', grupo: '' } });

for (const g of GRUPOS) {
  let texto = '';
  let clave = '';
  if (g.tipo === 'diseno' || g.tipo === 'diseno_sin_precio') {
    const d = elegir(disenos, claveD);
    if (!d) continue;
    clave = claveD(d);
    const precio = Number(d.precio_final_ia) || 0;
    const resumen = String(d.descripcion_corta_ia || '').trim();
    const extra = g.herramientas.length ? H[g.herramientas[0]] : null;
    texto = (g.id === 'venta_archivos_cnc' ? '🛒 ' : '📐 ') + esc(titulo(d)) + (resumen ? NL + NL + esc(resumen) : '') +
      NL + NL + (g.tipo === 'diseno' && precio && !d.gratis ? 'Formato ' + esc(d.formatos || 'DXF') + ' · $' + precio + ' MXN · descarga inmediata' : (d.gratis ? 'Gratis con tu cuenta · ' + esc(d.formatos || 'DXF') : 'Formato ' + esc(d.formatos || 'DXF') + ' · descarga inmediata')) +
      NL + ligaD(d) +
      (extra ? NL + NL + 'Y si quieres armar el tuyo: ' + extra.nombre.toLowerCase() + (extra.pago ? ' en ' : ' gratis en ') + extra.url : '') + pie;
  } else {
    const lista = g.herramientas.map((k) => ({ k: k }));
    const h0 = elegir(lista, (x) => 't:' + g.id + ':' + x.k);
    if (!h0) continue;
    clave = 't:' + g.id + ':' + h0.k;
    const h = H[h0.k];
    if (g.tipo === 'gratis') {
      texto = '🎁 Herramienta gratis: ' + h.nombre + NL + NL + h.que + NL + NL + 'Sin instalar nada y sin pagar: ' + h.url + pie;
    } else if (g.tipo === 'tecnico') {
      texto = '🔧 ' + h.nombre + NL + NL + h.que + NL + NL + (h.pago ? '' : 'Gratis: ') + h.url + (h.pregunta ? NL + NL + h.pregunta : '') + pie;
    } else if (g.tipo === 'educativo') {
      texto = '🗿 Para practicar o sacar una base rápida: ' + h.nombre + NL + NL + h.que + ' Sirve como punto de partida para luego refinar la malla en ZBrush.' + NL + NL + (h.pago ? 'Aquí: ' : 'Gratis: ') + h.url + pie;
    } else {
      texto = '🖨️ ' + h.nombre + (h.pago ? '' : ' (gratis)') + NL + NL + h.que + NL + NL + h.url + pie;
    }
  }
  out.push({ json: { texto: '👇 Para <b>t.me/' + g.id + '</b> (' + g.info + ')', sinVista: true, clave: '', grupo: '' } });
  out.push({ json: { texto: conUtm(texto, g.id), sinVista: false, clave: clave, grupo: g.id } });
}
return out;
`;

const horario = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.2,
  config: {
    name: 'Lunes y jueves 10:23 (hora de México)',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '23 16 * * 1,4' }] } }
  }
});

const disenos = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Diseños publicados',
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'yJDDrczHzHuY30uF', cachedResultName: 'digital_factory_productos' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'estado', condition: 'eq', keyValue: 'PUBLISHED' }] },
      returnAll: true
    }
  }
});

const compartidos = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Ya compartidos',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'BDLyJ7j8oJpUEoQB', cachedResultName: 'telegram_grupos_compartidos' },
      returnAll: true
    }
  }
});

const armar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Armar publicaciones',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: JS }
  }
});

const mandar = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Mandar al dueño',
    retryOnFail: true,
    maxTries: 3,
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr('{{ $env.TELEGRAM_ADMIN_CHAT_ID }}'),
      text: expr('{{ $json.texto }}'),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: expr('{{ $json.sinVista }}') }
    },
    credentials: { telegramApi: { id: 'bEA8sRVfpQBpl4py', name: 'Telegram account' } }
  }
});

const soloPublicaciones = node({
  type: 'n8n-nodes-base.filter',
  version: 2.2,
  config: {
    name: 'Solo las publicaciones',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr("{{ $('Armar publicaciones').item.json.clave }}"), operator: { type: 'string', operation: 'notEmpty', singleValue: true }, rightValue: '' }],
        combinator: 'and'
      }
    }
  }
});

const anotar = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Anotar lo compartido',
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: 'BDLyJ7j8oJpUEoQB', cachedResultName: 'telegram_grupos_compartidos' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          clave: expr("{{ $('Armar publicaciones').item.json.clave }}"),
          grupo: expr("{{ $('Armar publicaciones').item.json.grupo }}"),
          fecha: expr('{{ $now.toISO() }}')
        },
        schema: [
          { id: 'clave', displayName: 'clave', type: 'string', display: true, canBeUsedToMatch: true },
          { id: 'grupo', displayName: 'grupo', type: 'string', display: true, canBeUsedToMatch: true },
          { id: 'fecha', displayName: 'fecha', type: 'string', display: true, canBeUsedToMatch: true }
        ]
      }
    }
  }
});

export default workflow('telegram-grupos', 'Redes - Publicaciones para grupos de Telegram')
  .add(horario)
  .to(disenos)
  .to(compartidos)
  .to(armar)
  .to(mandar)
  .to(soloPublicaciones)
  .to(anotar);
