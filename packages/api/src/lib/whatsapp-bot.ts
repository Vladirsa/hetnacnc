// @ts-nocheck
// Agente de ventas del WhatsApp de HETNA. Contesta a quien ESCRIBE primero y lo
// atiende como un vendedor: entiende quién es (alguien que necesita una pieza,
// un comprador de la tienda, un taller, un proveedor), pregunta lo necesario
// (una cosa a la vez), recomienda lo que le sirve con su liga y lo lleva a
// cerrar (comprar, publicar su solicitud, probar el Cotizador, registrarse).
//
// - Recuerda la conversación (últimos mensajes del chat) y el perfil del cliente.
// - Sólo datos reales: DATOS_HETNA, las herramientas y planes con sus precios
//   del código, y productos de la tienda que coinciden (nombre y liga; el precio
//   está en la liga). Nunca inventa precios, descuentos, plazos ni existencias.
// - Precio aproximado de piezas a la medida: el agente junta servicio, material,
//   medidas y cantidad; el rango lo calcula lib/whatsapp-estimado.ts con el mismo
//   estimador de la página y el texto con el precio lo arma el código.
// - Cliente caliente, queja, pago, factura o negociación: te avisa por Telegram
//   con el resumen del cliente para que cierres tú.
// - Espera unos segundos por si el cliente manda varios mensajes seguidos y
//   contesta todo junto. Si alguien del equipo escribe en el chat desde el
//   celular, se calla 12 horas en ese chat.
import Anthropic from "@anthropic-ai/sdk"

import { STORE_URL } from "./licitacion"
import { T_CONFIG_S, asegurarSocial, iaSocial, motivoSinIa } from "./social-hub"
import { DATOS_HETNA } from "./social-comentarios"
import { mandarPrivado } from "./social-telegram"
import { enviarTexto, normalizarNumero, whatsappListo } from "./whatsapp"
import { IA_MODELO_WHATSAPP, modeloIA } from "./ia-modelo"
import { ESQUEMA_ESTIMADO, REGLAS_ESTIMADO, calcularEstimado, catalogoEstimado } from "./whatsapp-estimado"
import { ligaRepetir, pedidosDelNumero, textoPedidos, type PedidoAnterior } from "./whatsapp-repetir"

export const T_CHAT = "hetna_whatsapp_chat"
export const T_MSG = "hetna_whatsapp_msg"
const PAUSA_HUMANO_H = 12
const TOPE_DIA_NUMERO = 30
const ESPERA_MS = 8000 // junta los mensajes seguidos
const HISTORIA = 16

let listo = false
export async function asegurar(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_CHAT))) {
    await knex.schema.createTable(T_CHAT, (t: any) => {
      t.text("numero").primary()
      t.timestamp("pausa_hasta")
      t.text("dia")
      t.integer("respuestas").defaultTo(0)
      t.timestamp("ultima")
      t.integer("pasados").defaultTo(0)
      t.timestamp("updated_at").defaultTo(knex.fn.now())
    })
  }
  for (const [col, tipo] of [["perfil", "jsonb"], ["temperatura", "text"], ["avisado_en", "timestamp"], ["created_at", "timestamp"]] as const) {
    if (!(await knex.schema.hasColumn(T_CHAT, col))) await knex.schema.alterTable(T_CHAT, (t: any) => (tipo === "jsonb" ? t.jsonb(col) : tipo === "timestamp" ? t.timestamp(col) : t.text(col)))
  }
  if (!(await knex.schema.hasTable(T_MSG))) {
    await knex.schema.createTable(T_MSG, (t: any) => {
      t.increments("id").primary()
      t.text("numero").notNullable().index()
      t.text("rol").notNullable() // cliente | agente | equipo
      t.text("texto").notNullable()
      t.timestamp("created_at").defaultTo(knex.fn.now())
    })
  }
  listo = true
}

export async function botActivo(knex: any) {
  await asegurarSocial(knex)
  return !!(await knex(T_CONFIG_S).where({ clave: "whatsapp_bot" }).first())?.valor?.activo
}
export async function activarBot(knex: any, activo: boolean) {
  await asegurarSocial(knex)
  await knex.raw(`insert into ?? (clave, valor) values ('whatsapp_bot', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify({ activo: !!activo })])
}

export async function guardarMsg(knex: any, numero: string, rol: string, texto: string) {
  if (!String(texto || "").trim()) return
  await knex(T_MSG).insert({ numero, rol, texto: String(texto).slice(0, 2000) })
}

/**
 * ¿Es un mensaje automático del celular (saludo o ausencia de WhatsApp Business)
 * y no una persona contestando? Lo que diga WHATSAPP_SALUDO_AUTO (texto con que
 * empieza, o varios separados por |), o el mismo texto exacto que el equipo ya
 * mandó en otros 2 chats o más en los últimos 30 días.
 */
export async function esMensajeAutomatico(knex: any, numero: string, texto?: string) {
  const t = String(texto || "").trim()
  if (!t) return false
  const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim()
  const inicios = String(process.env.WHATSAPP_SALUDO_AUTO || "gracias por comunicarte con hetna cnc").split("|").map(norm).filter(Boolean)
  if (inicios.some((i) => norm(t).startsWith(i))) return true
  if (t.length < 25) return false // «Dígame», «Hola buenas tardes»: eso lo escribe una persona
  const otros = await knex(T_MSG)
    .where({ rol: "equipo", texto: t.slice(0, 2000) })
    .whereNot({ numero })
    .where("created_at", ">=", knex.raw("now() - interval '30 days'"))
    .countDistinct({ n: "numero" })
    .first()
    .catch(() => null)
  return Number(otros?.n || 0) >= 2
}

/** Alguien del equipo escribió en ese chat desde el celular: el agente se calla y guarda lo que dijo. */
export async function pausarChat(knex: any, numeroCrudo: string, texto?: string) {
  const numero = normalizarNumero(numeroCrudo)
  if (!numero) return
  await asegurar(knex)
  // El saludo automático de WhatsApp Business no es una persona: no calla al agente
  if (await esMensajeAutomatico(knex, numero, texto)) {
    if (texto) await guardarMsg(knex, numero, "equipo", texto).catch(() => null)
    return
  }
  const hasta = new Date(Date.now() + PAUSA_HUMANO_H * 3_600_000)
  await knex.raw(`insert into ?? (numero, pausa_hasta, created_at, updated_at) values (?, ?, now(), now()) on conflict (numero) do update set pausa_hasta = excluded.pausa_hasta, updated_at = now()`, [T_CHAT, numero, hasta])
  if (texto) await guardarMsg(knex, numero, "equipo", texto).catch(() => null)
}

const VACIAS = new Set("hola buenas buenos dias tardes noches tienen tienes tiene quiero quisiera busco necesito precio precios cuanto cuesta cuestan como para donde favor gracias ustedes hacen venden puedo pueden informacion info saber este esta esto unos unas algun alguna".split(" "))
export function palabrasClave(texto: string) {
  return [...new Set(
    String(texto || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9ñ ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !VACIAS.has(w)),
  )].slice(0, 8)
}

/** Productos publicados cuyo nombre trae alguna palabra de la conversación. */
export async function productosParecidos(knex: any, texto: string) {
  const ps = palabrasClave(texto)
  if (!ps.length) return []
  const sinAcento = "lower(translate(p.title, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'))"
  const filas = await knex("product as p")
    .whereNull("p.deleted_at")
    .where("p.status", "published")
    .whereRaw("coalesce(p.metadata->>'producto_creditos_3d', 'false') <> 'true'")
    .where((w: any) => { for (const x of ps) w.orWhereRaw(`${sinAcento} like ?`, [`%${x.replace(/(es|s)$/, "")}%`]) })
    .orderBy("p.created_at", "desc")
    .limit(6)
    .select("p.title", "p.handle")
  return filas.map((f: any) => ({ nombre: String(f.title).slice(0, 90), liga: `${STORE_URL}/mx/products/${f.handle}` }))
}

/** Todo lo que el agente puede ofrecer, con datos reales del código. */
export function catalogoVentas() {
  const l: string[] = [...DATOS_HETNA]
  l.push(`Tienda de productos CNC (diseños, piezas, regalos personalizados, insumos): ${STORE_URL}/mx. Cada producto tiene su precio, costo de envío y botón de compra en su página. Pago protegido con Mercado Pago dentro de HETNA; el envío se ve antes de pagar.`)
  l.push(`Pieza a la medida (corte láser, router CNC, plasma, fibra, impresión 3D, maquinado): el cliente publica gratis su solicitud con plano, foto o medidas en ${STORE_URL}/mx/cotizar; talleres de su zona le mandan cotización y elige. Pago protegido.`)
  try {
    const { PLANES_COTIZADOR } = require("./cotizador-suscripciones")
    l.push(`HETNA Cotizador (app para talleres; es lo que HETNA cobra): plan Gratis con 5 cotizaciones al mes, prueba de 14 días sin límite, y planes ${Object.values(PLANES_COTIZADOR).map((p: any) => `${p.nombre} $${p.precio} MXN/mes`).join(", ")}. Más info: ${STORE_URL}/mx/herramientas-cnc`)
  } catch {}
  try {
    const { HERRAMIENTAS } = require("./fabrica/promociones")
    const vistos = new Set<string>()
    for (const h of HERRAMIENTAS) {
      if (!h.texto || vistos.has(h.nombre)) continue
      vistos.add(h.nombre)
      l.push(`${h.nombre} (para ${h.publico || "todos"}): ${h.texto} Liga: ${STORE_URL}${h.ruta}`)
    }
  } catch {}
  return l
}

const ESQUEMA = {
  type: "object", additionalProperties: false,
  required: ["tipo", "respuesta", "perfil", "temperatura", "avisar_equipo", "resumen_para_equipo", "estimado"],
  properties: {
    tipo: { type: "string", enum: ["responder", "pasar_a_persona", "ignorar"] },
    respuesta: { type: "string" },
    perfil: {
      type: "object", additionalProperties: false,
      required: ["quien", "nombre", "ciudad", "necesidad", "interes"],
      properties: {
        quien: { type: "string", enum: ["necesita_pieza", "comprador_tienda", "taller", "proveedor", "empresa", "otro", "sin_saber"] },
        nombre: { type: "string" }, ciudad: { type: "string" }, necesidad: { type: "string" }, interes: { type: "string" },
      },
    },
    temperatura: { type: "string", enum: ["frio", "tibio", "caliente"] },
    avisar_equipo: { type: "boolean" },
    resumen_para_equipo: { type: "string" },
    estimado: ESQUEMA_ESTIMADO,
    // Estrategia 3.5: folio del pedido anterior que el cliente quiere repetir (de la lista), o null
    repetir_folio: { anyOf: [{ type: "string" }, { type: "null" }] },
    // Solicitud que el sistema registra por el cliente (lib/solicitud-desde-whatsapp), o null
    solicitud: {
      anyOf: [
        { type: "null" },
        {
          type: "object", additionalProperties: false,
          required: ["tipo", "descripcion", "servicio", "material", "medidas", "cantidad", "ciudad", "fecha", "nombre"],
          properties: {
            tipo: { type: "string", enum: ["fabricacion", "suministro"] },
            descripcion: { type: "string" }, servicio: { type: "string" }, material: { type: "string" }, medidas: { type: "string" },
            cantidad: { type: "string" }, ciudad: { type: "string" }, fecha: { type: "string" }, nombre: { type: "string" },
          },
        },
      ],
    },
  },
}

const SISTEMA = (catalogo: string[], productos: { nombre: string; liga: string }[], perfil: any, pedidos: PedidoAnterior[] = [], cuenta = "") =>
  "Eres el asesor comercial del WhatsApp de HETNA CNC, marketplace mexicano de fabricación CNC: clientes que necesitan piezas o herramienta, talleres que fabrican, proveedores que surten y una tienda de productos y herramientas para talleres. " +
  "Tu meta en cada plática es UN resultado concreto: una venta en la tienda, una solicitud de cotización registrada, un taller o proveedor registrado, una prueba del Cotizador o un plan contratado. Una plática que termina sin siguiente paso es una venta perdida.\n\n" +
  "Método (asesor consultivo, no vendedor insistente):\n" +
  "1. Identifica en el primer intercambio quién es: necesita una pieza o producto (cliente), tiene taller o máquinas CNC (taller), vende herramienta o material (proveedor), o es empresa con compras recurrentes. Si no está claro, pregúntalo de forma natural.\n" +
  "2. Entiende su necesidad con preguntas técnicas precisas, UNA por mensaje: qué es, especificación (material, espesor, medidas, norma o modelo), cantidad, para cuándo y dónde. A un taller: qué máquinas tiene, qué procesos y materiales trabaja y en qué estado está. A una empresa: si compra seguido y quién autoriza la compra.\n" +
  "3. Propón UNA solución con su beneficio concreto: «varios talleres compiten por su pieza y usted elige», «pago protegido», «el registro es gratis y recibe trabajos de su zona», «el Cotizador le ahorra horas en cada cotización». Sólo hechos de la lista de abajo.\n" +
  "4. Cierra con un siguiente paso fácil y pregúntalo: «¿Le registro la solicitud?», «¿Le comparto la liga para registrar su taller?», «¿Cuántas piezas necesita para pedírselas a los proveedores?». Todo mensaje termina con una pregunta o una acción clara, salvo la despedida final.\n" +
  "5. Si ya cerró (registró, compró, se registró), confirma, agradece y abre la siguiente oportunidad sin presionar: a un cliente, si conoce algún taller que quiera recibir trabajos; a un taller, que active la prueba del Cotizador o complete su perfil para salir primero en los avisos; a una empresa, si tiene más piezas o compras recurrentes.\n\n" +
  "Cómo escribes:\n" +
  "- Español de México, de usted, formal, técnico y cordial, como un asesor que conoce el oficio. Mensajes de 2 a 4 oraciones, sin emojis o máximo uno, sin listas largas.\n" +
  "- Cuando el cliente escribe «gracias», «ok» o similar, nunca contestes sólo «gracias» o «con gusto»: si todavía no hay siguiente paso, ofrécelo; si falta un dato, pídelo; si ya quedó todo, despídete con algo útil (qué sigue, cuándo le avisamos, una sugerencia relacionada) y deja la puerta abierta.\n" +
  "- Sé versátil: varía la redacción en cada mensaje, no empieces dos mensajes igual ni repitas fórmulas de la conversación; adapta el tono a cómo escribe el cliente (más breve si él es breve, más técnico si él lo es).\n" +
  "- Usa su nombre si lo dio y lo que ya dijo: no repitas preguntas ni lo que ya explicaste.\n" +
  "- Objeciones: reconoce la duda, haz una pregunta para entenderla y responde con un hecho (pago protegido, talleres verificados con evaluaciones, sin comisión en las cotizaciones, el registro y la prueba son gratis). Nunca presiones ni inventes urgencia.\n" +
  "- Si es un taller o proveedor: el registro gratis le trae solicitudes de clientes de su zona, y quien contesta rápido gana puntos y sale antes en los avisos. Si es taller, el Cotizador empieza gratis o con la prueba de 14 días.\n" +
  "- Pedido grande, empresa, compra recurrente o cliente listo para comprar: temperatura caliente y avisa al equipo para que una persona cierre.\n\n" +
  "Reglas que no se rompen:\n" +
  "- Usa SÓLO los datos y productos de abajo. Nunca inventes precios de productos o piezas, descuentos, existencias, tiempos de entrega, costos de envío ni capacidades. El precio de un producto está en su liga; el de una pieza a la medida lo dan los talleres al cotizar (salvo el aproximado que calcula el sistema, ver «estimado» abajo).\n" +
  "- Los únicos precios que puedes decir son los de los planes del Cotizador escritos abajo.\n" +
  "- tipo = pasar_a_persona si: queja, problema con un pedido, pago o envío, factura, piden hablar con alguien, quieren negociar o un trato especial, o no se puede contestar con estos datos. En respuesta dile que una persona del equipo le contesta en breve (y si falta, pídele el dato que ayude: qué pieza, cuántas, ciudad).\n" +
  "- tipo = ignorar sólo para stickers o spam, o para «ok»/«gracias» cuando tu mensaje anterior ya fue la despedida (respuesta vacía). Con tipo responder, respuesta nunca va vacía.\n" +
  "- temperatura: caliente = quiere comprar o cotizar ya, pidió precio de algo concreto con cantidad, es empresa o pedido grande, o quiere contratar un plan; tibio = interesado con dudas; frio = sólo curiosea.\n" +
  "- avisar_equipo = true cuando está caliente o pasas a persona. resumen_para_equipo: quién es, qué necesita, datos que dio y qué le ofreciste, en 2 a 3 líneas.\n" +
  "- perfil: llena lo que ya se sabe de la conversación (vacío si no se sabe).\n\n" +
  "Registrar la solicitud por el cliente (más rápido que mandarlo al formulario):\n" +
  "- Si necesita una pieza fabricada a la medida (fabricacion) o un producto que la tienda NO tiene en la lista de abajo, como insertos, portaherramientas, fresas especiales o material (suministro), regístrale la solicitud tú: llena «solicitud».\n" +
  "- Antes de llenarla, asegúrate de tener qué es (con medidas o especificación técnica: por ejemplo «barra de mandrinar para insertos APMT 1604, zanco 25 mm, largo 250 mm») y la cantidad. Si falta, pregúntalo en UNA pregunta. La ciudad, la fecha y su nombre ayudan; pregúntalos sólo si no alarga la plática.\n" +
  "- descripcion: lo que necesita en palabras técnicas claras (mínimo una oración completa). Lo que no sepas, vacío.\n" +
  "- Al llenarla, en respuesta dile que ya registraste su solicitud y que HETNA le buscará el taller o proveedor indicado con los mejores precios; no escribas folio ni liga (los pone el sistema). Sólo una solicitud por necesidad: si ya se registró en esta plática, solicitud = null.\n\n" +
  "Cuando el cliente ya quedó atendido y se despide o agradece: agradécele y, si están abajo, invítalo a dejar su opinión sincera y a seguirnos para enterarse de ofertas y planos gratis (con esas ligas). No ofrezcas nada a cambio de la opinión.\n" +
  (process.env.SOLICITUD_RESENA_GOOGLE ? `Liga para opinar en Google: ${process.env.SOLICITUD_RESENA_GOOGLE}\n` : "") +
  (process.env.SOLICITUD_SEGUIR ? `Dónde seguirnos: ${String(process.env.SOLICITUD_SEGUIR).split("|").join(" · ")}\n` : "") +
  "\n" +
  REGLAS_ESTIMADO + catalogoEstimado() + "\n\n" +
  "Datos de HETNA (lo único que puedes afirmar):\n- " + catalogo.join("\n- ") +
  "\n\nProductos de la tienda que coinciden con la conversación:\n" + (productos.length ? productos.map((p) => `- ${p.nombre}: ${p.liga}`).join("\n") : "(ninguno)") +
  (perfil ? `\n\nLo que ya sabemos de este cliente: ${JSON.stringify(perfil)}` : "") +
  (pedidos.length
    ? textoPedidos(pedidos) +
      "\nRepetir un pedido: si pide volver a pedir algo («otras 200 como la vez pasada», «lo mismo que en octubre», «repetir»), pon en repetir_folio el folio de la lista que corresponde y en respuesta dile que abajo va su pedido ya lleno para que confirme la cantidad y lo mande (no escribas ninguna liga: la pone el sistema). Si no está claro cuál, pregúntale cuál de los de la lista (por su descripción) y deja repetir_folio en null. Nunca inventes folios ni pedidos que no estén en la lista. Un cliente que repite es caliente."
    : "")

let ia: Anthropic | null = null
export async function redactar(historia: { rol: string; texto: string }[], productos: { nombre: string; liga: string }[], perfil: any, pedidos: PedidoAnterior[] = [], cuenta = "") {
  ia ??= new Anthropic()
  // La conversación como turnos: cliente = user; agente y equipo = assistant
  const turnos: any[] = []
  for (const m of historia) {
    const role = m.rol === "cliente" ? "user" : "assistant"
    const texto = m.rol === "equipo" ? `(Respondió una persona del equipo) ${m.texto}` : m.texto
    if (turnos.length && turnos[turnos.length - 1].role === role) turnos[turnos.length - 1].content += `\n${texto}`
    else turnos.push({ role, content: texto })
  }
  while (turnos.length && turnos[0].role !== "user") turnos.shift()
  if (!turnos.length || turnos[turnos.length - 1].role !== "user") return null
  const resp = await ia.beta.messages.create({
    ...modeloIA(IA_MODELO_WHATSAPP()),
    max_tokens: 1200,
    output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
    system: SISTEMA(catalogoVentas(), productos, perfil, pedidos) + cuenta,
    messages: turnos,
  } as any)
  if (resp.stop_reason === "refusal") return { tipo: "pasar_a_persona", respuesta: "", perfil: null, temperatura: "tibio", avisar_equipo: true, resumen_para_equipo: "La IA no pudo contestar este mensaje." }
  return JSON.parse(resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(""))
}

/**
 * Le pone ?wa=N a la liga de «Solicitar cotización»: con eso la tarjeta que arma
 * WhatsApp muestra uno de los anuncios del espacio «vista_whatsapp» (se turnan;
 * ver apps/storefront/src/lib/publicidad/vista-previa.ts). Sin anuncios sale la
 * imagen de siempre.
 */
export function conVistaPublicidad(texto: string, n = Math.floor(Math.random() * 1000)) {
  const base = STORE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return String(texto || "").replace(new RegExp(`${base}/mx/cotizar(\\?[^\\s]*[^\\s.,)])?(?=[\\s).,]|$)`, "g"), (_m, q) =>
    `${STORE_URL}/mx/cotizar${q ? `${q}&` : "?"}wa=${n}`
  )
}

const turnos = new Map<string, ReturnType<typeof setTimeout>>()
const RESPALDO = `Gracias por escribir a HETNA CNC. En un momento una persona del equipo le atiende. Mientras, puede ver la tienda en ${STORE_URL}/mx o pedir gratis la cotización de la pieza que necesita en ${STORE_URL}/mx/cotizar.`

/**
 * ¿Le toca al agente? (encendido, IA, sin pausa por humano, sin pasar el tope).
 * Si sí, guarda el mensaje, regresa true y contesta unos segundos después
 * (para juntar mensajes seguidos).
 */
export async function intentarResponder(knex: any, m: { numero: string; texto?: string; tipo?: string }, logger?: any) {
  const texto = String(m.texto || "").trim()
  const numero = normalizarNumero(m.numero)
  if (!numero || !whatsappListo() || !iaSocial()) return false
  if (!(await botActivo(knex))) return false
  await asegurar(knex)
  const f = await knex(T_CHAT).where({ numero }).first()
  if (f?.pausa_hasta && new Date(f.pausa_hasta).getTime() > Date.now()) {
    if (texto) await guardarMsg(knex, numero, "cliente", texto) // para que el agente tenga el contexto al volver
    return false
  }
  const hoy = new Date().toISOString().slice(0, 10)
  if (f?.dia === hoy && (f.respuestas || 0) >= TOPE_DIA_NUMERO) return false
  if (!texto) return m.tipo === "imagen" ? false : true
  if (!f) await knex(T_CHAT).insert({ numero, created_at: new Date(), updated_at: new Date() }).onConflict("numero").ignore()
  await guardarMsg(knex, numero, "cliente", texto)
  const previo = turnos.get(numero)
  if (previo) clearTimeout(previo)
  turnos.set(numero, setTimeout(() => {
    turnos.delete(numero)
    void contestar(knex, numero, logger)
  }, ESPERA_MS))
  return true
}

async function contestar(knex: any, numero: string, logger?: any) {
  try {
    const f = await knex(T_CHAT).where({ numero }).first()
    if (f?.pausa_hasta && new Date(f.pausa_hasta).getTime() > Date.now()) return
    const historia = (await knex(T_MSG).where({ numero }).where("created_at", ">=", knex.raw("now() - interval '30 days'")).orderBy("id", "desc").limit(HISTORIA)).reverse()
    if (!historia.length || historia[historia.length - 1].rol !== "cliente") return
    const textoCliente = historia.filter((x: any) => x.rol === "cliente").slice(-4).map((x: any) => x.texto).join(" ")
    const productos = await productosParecidos(knex, textoCliente).catch(() => [])
    const pedidos = await pedidosDelNumero(knex, numero).catch(() => [])
    let r: any
    try {
      // Lo que sabemos de su cuenta: perfil del taller, carrito, solicitudes (lib/agente-cuenta)
      const { leerCuenta, textoCuenta } = require("./agente-cuenta")
      const cuenta = textoCuenta(await leerCuenta(knex, numero).catch(() => ({})))
      r = await redactar(historia, productos, f?.perfil || null, pedidos, cuenta)
    } catch (e) {
      // Sin IA (sin saldo, caída): el cliente no se queda sin respuesta y el dueño se entera
      const msg = (e as Error).message || ""
      logger?.warn?.(`[whatsapp-agente] IA: ${msg.slice(0, 200)}`)
      if (historia.filter((x: any) => x.rol === "agente").slice(-1)[0]?.texto === RESPALDO) return
      r = { tipo: "pasar_a_persona", respuesta: RESPALDO, perfil: null, temperatura: null, avisar_equipo: true, resumen_para_equipo: /credit balance/i.test(msg) ? "⚠️ El agente no pudo contestar: la cuenta de la IA (Anthropic) no tiene saldo." : "⚠️ El agente no pudo contestar: la IA falló." }
    }
    if (!r) return
    const hoy = new Date().toISOString().slice(0, 10)
    await knex(T_CHAT).where({ numero }).update({
      perfil: r.perfil ? JSON.stringify(r.perfil) : f?.perfil ? JSON.stringify(f.perfil) : null,
      temperatura: r.temperatura || f?.temperatura || null,
      dia: hoy,
      respuestas: f?.dia === hoy ? (f.respuestas || 0) + 1 : 1,
      ultima: new Date(),
      updated_at: new Date(),
    })
    let respuesta = String(r.respuesta || "").trim()
    // Precio aproximado: el número y el texto los pone el código, nunca la IA
    if (r.tipo === "responder" && r.estimado?.pedir) {
      const est = calcularEstimado(r.estimado)
      respuesta = [est.texto, respuesta].filter(Boolean).join("\n\n")
      if (est.ok) {
        r.temperatura = "caliente"
        r.avisar_equipo = true
        r.resumen_para_equipo = `${r.resumen_para_equipo || ""} · Le dimos un aproximado: ${est.resumen}`.replace(/^ · /, "")
      }
    }
    // Repetir pedido: la liga la pone el código y sólo para un folio de ESTE número
    const repetir = r.tipo === "responder" && r.repetir_folio ? pedidos.find((p) => p.folio === String(r.repetir_folio).trim().toUpperCase()) : null
    if (repetir) {
      respuesta = `${respuesta}\n\nTu pedido ${repetir.folio} ya lleno, sólo confirma la cantidad y envíalo: ${ligaRepetir(repetir)}`.trim()
      r.temperatura = "caliente"
      r.avisar_equipo = true
      r.resumen_para_equipo = `${r.resumen_para_equipo || ""} · Quiere repetir ${repetir.folio} (${repetir.resumen}); le mandamos la liga.`.replace(/^ · /, "")
    }
    // Solicitud registrada por el agente: folio y liga los pone el código
    if (r.tipo === "responder" && r.solicitud) {
      const { crearSolicitudWhatsapp, datosSuficientes } = require("./solicitud-desde-whatsapp")
      if (datosSuficientes(r.solicitud)) {
        const reg = await crearSolicitudWhatsapp(knex, logger, numero, { ...r.solicitud, nombre: r.solicitud.nombre || r.perfil?.nombre || "" }).catch((e: Error) => {
          logger?.warn?.(`[whatsapp-agente] no se registró la solicitud: ${e.message}`)
          return null
        })
        if (reg) {
          respuesta = `${respuesta}\n\n${reg.nueva ? "Su solicitud quedó registrada con el folio" : "Ya tiene registrada su solicitud"} *${reg.folio}*. Aquí puede ver y comparar las propuestas que lleguen: ${reg.liga}`.trim()
          r.temperatura = "caliente"
        }
      }
    }
    respuesta = conVistaPublicidad(respuesta)
    if (r.tipo === "ignorar" && !respuesta) return
    if (!respuesta) {
      // Sin texto de la IA: sólo se contesta si pasa a una persona (nunca un «gracias» suelto)
      if (r.tipo !== "pasar_a_persona") return
      respuesta = "Gracias por escribir. Una persona del equipo de HETNA le atenderá en breve por este medio."
    }
    await enviarTexto(numero, respuesta.slice(0, 1500))
    await guardarMsg(knex, numero, "agente", respuesta)
    // Aviso al dueño: cliente caliente o que necesita a una persona (no más de uno cada 6 h por chat, salvo pasar a persona)
    const reciente = f?.avisado_en && Date.now() - new Date(f.avisado_en).getTime() < 6 * 3_600_000
    if (r.tipo === "pasar_a_persona" || (r.avisar_equipo && !reciente)) {
      if (r.tipo === "pasar_a_persona") await knex(T_CHAT).where({ numero }).increment("pasados", 1)
      await knex(T_CHAT).where({ numero }).update({ avisado_en: new Date() })
      const p = r.perfil || {}
      const icono = r.tipo === "pasar_a_persona" ? "🙋" : "🔥"
      await mandarPrivado(knex, {
        texto:
          `${icono} WhatsApp: ${r.tipo === "pasar_a_persona" ? "necesita a una persona" : "cliente caliente"}\n` +
          `+${numero}${p.nombre ? ` · ${p.nombre}` : ""}${p.ciudad ? ` · ${p.ciudad}` : ""}\n` +
          `${r.resumen_para_equipo || p.necesidad || ""}\n\n` +
          `Último mensaje: «${historia[historia.length - 1].texto.slice(0, 400)}»\n` +
          `Le contestamos: «${respuesta.slice(0, 400)}»\n\n` +
          `Escríbele desde el celular de HETNA: https://wa.me/${numero} (el agente se calla 12 h en ese chat cuando escribes).`,
      }).catch(() => null)
    }
  } catch (e) {
    logger?.warn?.(`[whatsapp-agente] ${numero}: ${(e as Error).message}`)
  }
}

/** Para el panel. */
export async function resumenBot(knex: any) {
  await asegurar(knex)
  const hoy = new Date().toISOString().slice(0, 10)
  const r = await knex(T_CHAT).where({ dia: hoy }).sum({ n: "respuestas" }).count({ chats: "*" }).first().catch(() => null)
  const p = await knex(T_CHAT).sum({ n: "pasados" }).first().catch(() => null)
  const calientes = await knex(T_CHAT).where({ temperatura: "caliente" }).where("updated_at", ">=", knex.raw("now() - interval '7 days'")).count({ n: "*" }).first().catch(() => null)
  return { activo: await botActivo(knex), ia: iaSocial(), ia_motivo: iaSocial() ? null : motivoSinIa(), respuestas_hoy: Number(r?.n || 0), chats_hoy: Number(r?.chats || 0), pasados: Number(p?.n || 0), calientes_7d: Number(calientes?.n || 0) }
}
