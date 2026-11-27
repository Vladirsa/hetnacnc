// @ts-nocheck
// Correo mensual «Así vamos creciendo» a los talleres y proveedores de otros
// países que se apuntaron (pedido de Vlado, 27 nov 2026):
//   - talleres del pre-registro de Latinoamérica (hetna_latam_registro, en español,
//     con la liga de su país);
//   - proveedores extranjeros de /sell-in-mexico (hetna_taller_prospecto con
//     «Proveedor extranjero», en inglés).
// Sólo números reales de la base (talleres en la red, productos publicados,
// solicitudes de cotización, planos gratis, pre-registros por país). Una cifra en
// cero no se muestra. Lleva ligas para registrarse y subir productos o servicios.
//
// Uno por persona al mes (hetna_metricas_envio), respeta la baja de correos
// (lib/baja.ts) y lleva su liga para darse de baja.
// METRICAS_EXTRANJEROS_APAGADO=1 lo apaga; METRICAS_EXTRANJEROS_TOPE (80) por corrida.
import { STORE_URL, T_SOLICITUD } from "./licitacion"
import { PAISES_LATAM, T_LATAM, conteoLatam } from "./latam"
import { cargarNombresPlanos, todosLosSlugs } from "./planos-correo"
import { estaDeBaja, ligaBaja } from "./baja"
import { sendEmail } from "./resend"

export const T_METRICAS_ENVIO = "hetna_metricas_envio"
const T_PROSPECTO = "hetna_taller_prospecto"
export const metricasExtranjerosApagado = () => ["1", "true", "si"].includes(String(process.env.METRICAS_EXTRANJEROS_APAGADO || "").toLowerCase())

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const mil = (n: number) => n.toLocaleString("es-MX")

export type Metricas = {
  talleres: number
  talleres_nuevos_30: number
  productos: number
  solicitudes_30: number
  solicitudes_total: number
  planos: number
  paises: { nombre: string; bandera: string; talleres: number; clientes: number }[]
}

async function contar(knex: any, q: () => Promise<any>) {
  try {
    return Number((await q())?.n || 0)
  } catch {
    return 0
  }
}

export async function leerMetricas(knex: any): Promise<Metricas> {
  const hace30 = knex.raw("now() - interval '30 days'")
  const [talleres, talleres_nuevos_30, productos, solicitudes_30, solicitudes_total] = await Promise.all([
    contar(knex, () => knex("seller").whereNull("deleted_at").where("status", "open").count({ n: "*" }).first()),
    contar(knex, () => knex("seller").whereNull("deleted_at").where("status", "open").where("created_at", ">=", hace30).count({ n: "*" }).first()),
    contar(knex, () => knex("product").whereNull("deleted_at").where("status", "published").count({ n: "*" }).first()),
    contar(knex, () => knex(T_SOLICITUD).where("created_at", ">=", hace30).whereNot("estado", "cancelada").count({ n: "*" }).first()),
    contar(knex, () => knex(T_SOLICITUD).whereNot("estado", "cancelada").count({ n: "*" }).first()),
  ])
  await cargarNombresPlanos(knex).catch(() => null)
  const conteo = await conteoLatam(knex).catch(() => ({}))
  const paises = Object.entries(conteo)
    .map(([k, v]: any) => ({ nombre: PAISES_LATAM[k]?.nombre || k, bandera: PAISES_LATAM[k]?.bandera || "", talleres: v.talleres, clientes: v.clientes }))
    .filter((p) => p.talleres + p.clientes > 0)
    .sort((a, b) => b.talleres + b.clientes - (a.talleres + a.clientes))
  return { talleres, talleres_nuevos_30, productos, solicitudes_30, solicitudes_total, planos: todosLosSlugs().length, paises }
}

// ---------------------------------------------------------------------
// Correo
// ---------------------------------------------------------------------

const fila = (num: string, texto: string) =>
  `<tr><td style="padding:10px 14px;font-size:26px;font-weight:800;color:#C2560A;white-space:nowrap">${num}</td><td style="padding:10px 14px;font-size:15px;color:#142033">${texto}</td></tr>`
const boton = (texto: string, url: string, principal = true) =>
  `<a href="${url}" style="display:inline-block;margin:6px 6px 0 0;padding:12px 18px;border-radius:10px;font-weight:700;text-decoration:none;${principal ? "background:#C2560A;color:#fff" : "border:2px solid #C2560A;color:#C2560A"}">${texto}</a>`

export type Segmento = "extranjero" | "taller" | "cliente"

export function correoMetricas(m: Metricas, d: { nombre?: string; pais?: string; idioma: "es" | "en"; segmento?: Segmento }) {
  const seg: Segmento = d.segmento || "extranjero"
  const en = d.idioma === "en"
  const filas: string[] = []
  if (m.talleres) filas.push(fila(mil(m.talleres), en ? "CNC shops and suppliers in the network" : "talleres y proveedores CNC en la red"))
  if (m.talleres_nuevos_30) filas.push(fila(`+${mil(m.talleres_nuevos_30)}`, en ? "new shops in the last 30 days" : "talleres nuevos en los últimos 30 días"))
  if (m.productos) filas.push(fila(mil(m.productos), en ? "products and services published in the store" : "productos y servicios publicados en la tienda"))
  if (m.solicitudes_30) filas.push(fila(mil(m.solicitudes_30), en ? "quote requests from customers in the last 30 days" : "solicitudes de cotización de clientes en los últimos 30 días"))
  else if (m.solicitudes_total) filas.push(fila(mil(m.solicitudes_total), en ? "quote requests from customers so far" : "solicitudes de cotización de clientes hasta hoy"))
  if (m.planos) filas.push(fila(mil(m.planos), en ? "free furniture plans with cut list and DXF" : "planos de muebles gratis con lista de corte y DXF"))
  const paises = m.paises.slice(0, 6).map((p) => `${p.bandera} ${esc(p.nombre)}: ${mil(p.talleres)} ${en ? "shops" : "talleres"}, ${mil(p.clientes)} ${en ? "customers" : "clientes"}`)

  const paisInfo = d.pais && PAISES_LATAM[d.pais] ? PAISES_LATAM[d.pais] : null
  const ligas = en
    ? [boton("Sell in Mexico", `${STORE_URL}/sell-in-mexico`), boton("Create your seller account", `${STORE_URL}/seller`, false), boton("See open quote requests", `${STORE_URL}/mx/trabajos`, false)]
    : seg === "cliente"
      ? [
          boton("Pide tu cotización gratis", `${STORE_URL}/mx/cotizar`),
          boton("Herramienta y material", `${STORE_URL}/mx/cotizar/suministro`, false),
          boton("Planos gratis", `${STORE_URL}/mx/planos`, false),
          boton("Ver la tienda", `${STORE_URL}/mx`, false),
        ]
      : [
          boton(seg === "taller" ? "Termina tu registro" : "Regístrate gratis", seg === "taller" ? `${STORE_URL}/seller` : `${STORE_URL}/mx/talleres/unete`),
          boton("Sube tus productos o servicios", `${STORE_URL}/seller`, false),
          ...(paisInfo ? [boton(`HETNA en ${paisInfo.nombre}`, `${STORE_URL}/mx/latinoamerica/${d.pais}`, false)] : []),
          boton("Ver solicitudes abiertas", `${STORE_URL}/mx/trabajos`, false),
          ...(seg === "taller" ? [boton("Cotizador gratis", `${STORE_URL}/mx/herramientas-cnc`, false)] : []),
        ]
  const hola = d.nombre ? `${en ? "Hi" : "Hola"} ${esc(d.nombre.split(/\s+/)[0])},` : en ? "Hi," : "Hola,"
  const intro = en
    ? "Here is how HETNA CNC, the CNC marketplace of Mexico, is growing. Customers post what they need, shops and suppliers quote, and the customer chooses — with no commission on quotes."
    : seg === "cliente"
      ? "Así va creciendo HETNA CNC, el marketplace CNC de México. Cada mes hay más talleres y proveedores listos para fabricarle piezas, surtirle herramienta y material o venderle lo que su taller necesita."
      : `Así va creciendo HETNA CNC, el marketplace CNC de México${paisInfo ? `, que se prepara para llegar a ${paisInfo.nombre}` : ""}. Los clientes publican lo que necesitan, los talleres y proveedores cotizan y el cliente elige, sin comisión en las cotizaciones.`
  const ventajas = en
    ? []
    : seg === "cliente"
      ? [
          "Pide su cotización gratis: varios talleres compiten por su pieza y usted elige precio y plazo.",
          "Pago protegido: el taller cobra cuando usted recibe.",
          "¿Necesita herramienta, insertos o material? También se lo conseguimos con proveedores.",
          "Planos de muebles gratis con lista de corte, DXF y medidas a su gusto.",
        ]
      : [
          "Registro gratis y solicitudes de clientes de su zona, sin comisión en las cotizaciones.",
          "Su tienda en HETNA para vender productos y servicios.",
          "El Cotizador para talleres: empieza gratis o con la prueba de 14 días.",
          "Quien contesta rápido gana puntos y recibe primero los trabajos nuevos.",
        ]
  const cierre = en
    ? "Shops that join early get seen first. Create your account, list your products or services and start receiving requests."
    : seg === "cliente"
      ? "Cuéntenos qué necesita y le buscamos el taller o proveedor indicado con los mejores precios."
      : "Los talleres que entran primero son los que más se ven. Crea tu cuenta, sube tus productos o servicios y empieza a recibir solicitudes."
  return {
    asunto: en
      ? "HETNA CNC in numbers: this is how we are growing"
      : seg === "cliente"
        ? "HETNA CNC en números: más talleres para fabricar lo que necesita"
        : `${paisInfo ? `${paisInfo.bandera} ` : ""}HETNA CNC en números: así vamos creciendo`,
    html:
      `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#142033">` +
      `<p style="font-size:22px;font-weight:800;margin:0 0 4px"><span style="color:#C2560A">HETNA</span> CNC</p>` +
      `<p style="font-size:15px;line-height:1.5">${hola}</p><p style="font-size:15px;line-height:1.5">${intro}</p>` +
      (filas.length ? `<table style="border-collapse:collapse;width:100%;background:#FBFAF6;border-radius:12px;margin:10px 0">${filas.join("")}</table>` : "") +
      (paises.length ? `<p style="font-size:14px;color:#40403A;margin:14px 0 4px"><b>${en ? "Pre-registrations by country" : "Pre-registros por país"}</b></p><p style="font-size:14px;color:#40403A;margin:0">${paises.join("<br>")}</p>` : "") +
      (ventajas.length ? `<ul style="font-size:15px;line-height:1.6;padding-left:20px;margin:14px 0">${ventajas.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>` : "") +
      `<p style="font-size:15px;line-height:1.5;margin-top:16px">${cierre}</p>` +
      `<div>${ligas.join("")}</div>` +
      `<p style="font-size:13px;color:#6B675C;margin-top:20px">— ${en ? "The HETNA CNC team" : "Equipo HETNA CNC"} · hetnacnc.com</p></div>`,
  }
}

// ---------------------------------------------------------------------
// A quién y envío
// ---------------------------------------------------------------------

export type Destinatario = { correo: string; nombre?: string; pais?: string; idioma: "es" | "en"; segmento?: Segmento }

export async function destinatariosExtranjeros(knex: any): Promise<Destinatario[]> {
  const out = new Map<string, Destinatario>()
  if (await knex.schema.hasTable(T_LATAM)) {
    const l = (await knex(T_LATAM).where({ tipo: "taller" }).select("correo", "nombre", "pais").catch(() => [])) as any[]
    for (const r of l) if (r.correo) out.set(r.correo.toLowerCase(), { correo: r.correo.toLowerCase(), nombre: r.nombre, pais: r.pais, idioma: "es" })
  }
  if (await knex.schema.hasTable(T_PROSPECTO)) {
    const p = (await knex(T_PROSPECTO).whereRaw("datos->>'comentarios' ilike ?", ["%Proveedor extranjero%"]).whereNot("estado", "descartado").select("email", "datos").catch(() => [])) as any[]
    for (const r of p) {
      const correo = String(r.email || "").toLowerCase()
      if (correo && !out.has(correo)) out.set(correo, { correo, nombre: r.datos?.contacto || r.datos?.nombre_taller || "", idioma: "en" })
    }
  }
  return [...out.values()]
}

/**
 * Nacionales que nos dejaron su correo:
 *  - talleres que llenaron «Únete» pero no han creado su cuenta (prospectos nuevos o contactados);
 *  - clientes con cuenta en la tienda.
 * Nunca listas compradas ni correos que no se registraron.
 */
export async function destinatariosNacionales(knex: any): Promise<Destinatario[]> {
  const out = new Map<string, Destinatario>()
  if (await knex.schema.hasTable(T_PROSPECTO)) {
    const p = (await knex(T_PROSPECTO)
      .whereIn("estado", ["nuevo", "contactado"])
      .whereRaw("coalesce(datos->>'comentarios', '') not ilike ?", ["%Proveedor extranjero%"])
      .select("email", "datos")
      .catch(() => [])) as any[]
    for (const r of p) {
      const correo = String(r.email || "").toLowerCase()
      if (correo) out.set(correo, { correo, nombre: r.datos?.contacto || "", idioma: "es", segmento: "taller" })
    }
  }
  const sellers = new Set(((await knex("seller").whereNotNull("email").pluck("email").catch(() => [])) as string[]).map((e) => e.toLowerCase()))
  const clientes = (await knex("customer").whereNull("deleted_at").where("has_account", true).whereNotNull("email").select("email", "first_name").catch(() => [])) as any[]
  for (const c of clientes) {
    const correo = String(c.email || "").toLowerCase()
    if (correo && !out.has(correo) && !sellers.has(correo)) out.set(correo, { correo, nombre: c.first_name || "", idioma: "es", segmento: "cliente" })
  }
  return [...out.values()]
}

async function asegurarEnvios(knex: any) {
  if (await knex.schema.hasTable(T_METRICAS_ENVIO)) return
  await knex.schema.createTable(T_METRICAS_ENVIO, (t: any) => {
    t.text("correo").notNullable()
    t.text("mes").notNullable() // AAAA-MM
    t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now())
    t.primary(["correo", "mes"])
  })
}

/** Manda el correo del mes a quien no lo haya recibido. probar: no manda, sólo cuenta. */
export async function correrMetricasExtranjeros(knex: any, o: { probar?: boolean; soloA?: string } = {}) {
  const r = { enviados: 0, baja: 0, ya: 0, fallidos: 0, pendientes: 0 }
  await asegurarEnvios(knex)
  const mes = new Date().toISOString().slice(0, 7)
  const m = await leerMetricas(knex)
  const tope = Math.max(1, Number(process.env.METRICAS_EXTRANJEROS_TOPE) || 150)
  const ext = (await destinatariosExtranjeros(knex)).map((d) => ({ ...d, segmento: "extranjero" as Segmento }))
  const vistos = new Set(ext.map((d) => d.correo))
  let lista = [...ext, ...(await destinatariosNacionales(knex)).filter((d) => !vistos.has(d.correo))]
  // Prueba a un solo correo (el tuyo), sin marcarlo como enviado
  if (o.soloA) lista = [{ correo: o.soloA, nombre: "", idioma: "es", ...(lista.find((x) => x.correo === o.soloA) || {}) }]
  r.pendientes = lista.length
  for (const d of lista) {
    if (r.enviados >= tope) break
    if (!o.soloA && (await knex(T_METRICAS_ENVIO).where({ correo: d.correo, mes }).first())) {
      r.ya++
      continue
    }
    if (await estaDeBaja(knex, d.correo)) {
      r.baja++
      continue
    }
    if (o.probar) continue
    const c = correoMetricas(m, d)
    const envio = await sendEmail({ to: d.correo, subject: c.asunto, html: c.html, bajaUrl: ligaBaja(d.correo) })
    if (!envio.sent) {
      r.fallidos++
      if (envio.configuracion) break
      continue
    }
    if (!o.soloA) await knex(T_METRICAS_ENVIO).insert({ correo: d.correo, mes }).onConflict(["correo", "mes"]).ignore()
    r.enviados++
  }
  return { ...r, metricas: m }
}

// ---------------------------------------------------------------------
// Las mismas cifras como anuncio en redes y grupos (una vez al mes)
// ---------------------------------------------------------------------

export function textoAnuncioMetricas(m: Metricas) {
  const l: string[] = []
  if (m.talleres) l.push(`🏭 ${mil(m.talleres)} talleres y proveedores CNC en la red${m.talleres_nuevos_30 ? ` (+${mil(m.talleres_nuevos_30)} este mes)` : ""}`)
  if (m.productos) l.push(`🛒 ${mil(m.productos)} productos y servicios en la tienda`)
  if (m.solicitudes_30) l.push(`📋 ${mil(m.solicitudes_30)} solicitudes de cotización en los últimos 30 días`)
  if (m.planos) l.push(`📐 ${mil(m.planos)} planos de muebles gratis`)
  return (
    "📈 Así va creciendo HETNA CNC, el marketplace CNC de México\n\n" +
    l.join("\n") +
    "\n\n¿Tienes taller o vendes herramienta? Regístrate gratis y recibe solicitudes de tu zona, sin comisión.\n¿Necesitas una pieza? Pide tu cotización gratis y elige entre varios talleres.\n\n👉 {{liga}}"
  )
}

/** Crea el anuncio del mes (con su tarjeta) si todavía no existe. scope: contenedor de Medusa. */
export async function publicarMetricas(scope: any, knex: any, logger?: any) {
  const { T_POST, crearPublicacion } = require("./social-hub")
  const mes = new Date().toISOString().slice(0, 7)
  const ya = await knex(T_POST).where({ fuente: "metricas" }).whereRaw("to_char(created_at, 'YYYY-MM') = ?", [mes]).first("id").catch(() => null)
  if (ya) return null
  const m = await leerMetricas(knex)
  if (!m.talleres && !m.productos) return null
  const destino = `${STORE_URL}/mx/talleres/unete`
  let medios: { url: string; tipo: string }[] = []
  try {
    const { tarjeta } = require("./fabrica/render")
    const { fondoDe, subir } = require("./fabrica")
    const datos: [string, string][] = []
    if (m.talleres) datos.push(["Talleres y proveedores", `${mil(m.talleres)}${m.talleres_nuevos_30 ? ` (+${mil(m.talleres_nuevos_30)})` : ""}`])
    if (m.productos) datos.push(["Productos en tienda", mil(m.productos)])
    if (m.solicitudes_30) datos.push(["Solicitudes (30 días)", mil(m.solicitudes_30)])
    if (m.planos) datos.push(["Planos gratis", mil(m.planos)])
    const png = await tarjeta({ tema: "taller", foto_url: await fondoDe(knex, "taller").catch(() => null), cinta: { texto: "HETNA CNC en números", tono: "verde" }, titulo: "Así vamos creciendo", datos, cta: "Regístrate gratis", liga: destino })
    medios = [{ url: await subir(scope, `metricas-${mes}.png`, "image/png", png), tipo: "imagen" }]
  } catch (e) {
    logger?.warn?.(`[metricas] tarjeta: ${(e as Error).message}`)
  }
  const id = await crearPublicacion(
    knex,
    { origen: "manual", titulo: `HETNA CNC en números (${mes})`, texto_base: textoAnuncioMetricas(m), url: destino, medios, estado: "programada", programada_para: new Date(), fuente: "metricas" } as any,
    logger
  )
  logger?.info?.(`[metricas] anuncio del mes creado: ${id}`)
  return id
}
