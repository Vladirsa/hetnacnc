// @ts-nocheck
// Invitación a los talleres para que publiquen productos de una fecha especial
// (Navidad, Día de las Madres…). Correo + aviso en su panel, una vez por taller
// y fecha, en lotes diarios, respetando las bajas. Lo que publiquen con la
// palabra de la fecha en el NOMBRE se etiqueta solo (ver etiquetarNuevos) y
// entra a los videos de temporada.
import { randomBytes } from "crypto"

import { estaDeBaja, ligaBaja } from "./baja"
import { FECHAS, proxima } from "./fabrica/calendario"
import { VENDOR_URL, boton, esc, marco } from "./licitacion"
import { pushATalleres } from "./push"
import { sendEmail } from "./resend"
import { T_CONFIG_S, asegurarSocial } from "./social-hub"

export const T_ENVIO = "hetna_campana_taller"
const LOTE_DIA = Number(process.env.CAMPANA_TALLERES_LOTE || 60)

/** Palabras (palabra completa, en el nombre) con que se reconoce un producto de la fecha. */
export const PALABRAS_FECHA: Record<string, string[]> = {
  navidad: ["navidad", "navideño", "navideña", "navideños", "navideñas", "nochebuena", "santa claus", "nacimiento navideño", "esfera navideña", "christmas"],
  dia_madre: ["día de las madres", "dia de las madres", "10 de mayo", "para mamá", "para mama"],
  dia_padre: ["día del padre", "dia del padre", "para papá", "para papa"],
  muertos: ["día de muertos", "dia de muertos", "altar de muertos", "catrina", "calaverita"],
  san_valentin: ["san valentín", "san valentin", "14 de febrero", "amor y amistad"],
  reyes: ["día de reyes", "dia de reyes", "reyes magos", "rosca de reyes"],
  dia_nino: ["día del niño", "dia del niño", "dia del nino"],
  dia_maestro: ["día del maestro", "dia del maestro"],
  patrio: ["fiestas patrias", "15 de septiembre", "viva méxico", "viva mexico"],
}

const sinAcento = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
export function esDeLaFecha(titulo: string, clave: string) {
  const t = sinAcento(titulo)
  return (PALABRAS_FECHA[clave] || []).some((w) => new RegExp(`(^|[^a-z0-9])${sinAcento(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(t))
}

async function asegurar(knex: any) {
  await asegurarSocial(knex)
  if (!(await knex.schema.hasTable(T_ENVIO))) {
    await knex.schema.createTable(T_ENVIO, (t: any) => {
      t.text("campana").notNullable()
      t.text("correo").notNullable()
      t.timestamp("enviado_en").defaultTo(knex.fn.now())
      t.primary(["campana", "correo"])
    })
  }
}

const claveCampana = (clave: string, anio: number) => `${clave}-${anio}`

export function correoFecha(f: { nombre: string; clave: string }, fecha: string, nombreTaller?: string) {
  const ejemplo = (PALABRAS_FECHA[f.clave] || [f.nombre])[0]
  return marco(
    `${f.nombre} en HETNA: publica tus productos`,
    `<p style="color:#40403A;line-height:1.55">Hola${nombreTaller ? ` ${esc(nombreTaller)}` : ""}: se acerca <b>${esc(f.nombre)}</b> (${esc(fecha)}) y en HETNA vamos a hacer videos e imágenes para redes con los productos de la temporada.</p>
     <p style="color:#40403A;line-height:1.55">Si haces piezas para ${esc(f.nombre)} (adornos, letreros, regalos, cajas, llaveros…), publícalas en tu tienda de HETNA con la palabra <b>«${esc(ejemplo)}»</b> en el nombre del producto. Así entran solas a nuestras publicaciones de temporada en Facebook, Instagram, TikTok y YouTube, <b>sin costo</b>.</p>
     <p style="color:#40403A;line-height:1.55">Publicar es gratis y sólo pagas comisión cuando vendes.</p>
     ${boton("Publicar un producto", `${VENDOR_URL}/publicar`)}`,
  )
}

/** Prende la invitación de una fecha y manda el primer lote en segundo plano. */
export async function iniciarInvitacionFecha(knex: any, clave: string, logger?: any) {
  const f = FECHAS.find((x) => x.clave === clave)
  if (!f) throw new Error("Fecha desconocida")
  await asegurar(knex)
  const p = proxima(f)!
  const campana = claveCampana(clave, p.anio)
  const cfg = (await knex(T_CONFIG_S).where({ clave: "campanas_talleres" }).first())?.valor || {}
  cfg[campana] = { activo: true, desde: new Date().toISOString() }
  await knex.raw(`insert into ?? (clave, valor) values ('campanas_talleres', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify(cfg)])
  const pendientes = await pendientesDe(knex, campana, LOTE_DIA)
  void loteFecha(knex, clave, logger).catch((e) => logger?.warn?.(`[campana-talleres] ${(e as Error).message}`))
  return { iniciada: true, hoy: pendientes.length }
}

async function pendientesDe(knex: any, campana: string, limite: number) {
  return knex("seller as s")
    .whereNull("s.deleted_at")
    .whereNotNull("s.email")
    .whereNotExists(function () { this.select(knex.raw("1")).from(`${T_ENVIO} as e`).where("e.campana", campana).whereRaw("lower(e.correo) = lower(s.email)") })
    .orderBy("s.created_at", "desc")
    .limit(limite)
    .select("s.id", "s.name", "s.email")
}

async function loteFecha(knex: any, clave: string, logger?: any) {
  const f = FECHAS.find((x) => x.clave === clave)!
  const p = proxima(f)!
  const campana = claveCampana(clave, p.anio)
  const fecha = new Date(Date.UTC(p.anio, p.mes - 1, p.dia, 12)).toLocaleDateString("es-MX", { day: "numeric", month: "long", timeZone: "UTC" })
  const filas = await pendientesDe(knex, campana, LOTE_DIA)
  let enviados = 0
  const ids: string[] = []
  for (const s of filas) {
    const correo = String(s.email).trim().toLowerCase()
    try {
      if (!(await estaDeBaja(knex, correo).catch(() => false))) {
        const r = await sendEmail({ to: correo, bajaUrl: ligaBaja(correo), subject: `${f.nombre} en HETNA: tus productos en nuestros videos, sin costo`, html: correoFecha(f, fecha, s.name) })
        if (!r.sent) {
          if (r.configuracion || /quota|limit|429/i.test(String(r.reason || ""))) break
          continue
        }
        enviados++
        ids.push(s.id)
        await new Promise((ok) => setTimeout(ok, 700))
      }
      await knex(T_ENVIO).insert({ campana, correo }).onConflict(["campana", "correo"]).ignore()
    } catch (e) {
      logger?.warn?.(`[campana-talleres] ${(e as Error).message}`)
    }
  }
  if (ids.length) await pushATalleres(knex, ids, { titulo: `${f.nombre} en HETNA 🎄`, cuerpo: "Publica tus productos de temporada y salen en nuestros videos, sin costo.", url: "/seller/publicar", etiqueta: `campana-${campana}` }, logger).catch(() => null)
  logger?.info?.(`[campana-talleres] ${campana}: ${enviados} correos`)
  const quedan = (await pendientesDe(knex, campana, 1)).length > 0
  if (!quedan) {
    const cfg = (await knex(T_CONFIG_S).where({ clave: "campanas_talleres" }).first())?.valor || {}
    cfg[campana] = { ...(cfg[campana] || {}), activo: false, terminada: new Date().toISOString() }
    await knex.raw(`insert into ?? (clave, valor) values ('campanas_talleres', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify(cfg)])
  }
  return { enviados, quedan }
}

/** Job diario: sigue las invitaciones prendidas. */
export async function seguirInvitacionesFecha(knex: any, logger?: any) {
  await asegurar(knex)
  const cfg = (await knex(T_CONFIG_S).where({ clave: "campanas_talleres" }).first())?.valor || {}
  for (const [campana, v] of Object.entries<any>(cfg)) {
    if (!v?.activo) continue
    const clave = campana.replace(/-\d{4}$/, "")
    await loteFecha(knex, clave, logger)
  }
}

/** Etiqueta sola los productos cuyo NOMBRE dice la fecha (p. ej. "Esfera navideña") en temporada. */
export async function etiquetarNuevos(knex: any, claves: string[], logger?: any) {
  let n = 0
  for (const clave of claves) {
    const prods = await knex("product").whereNull("deleted_at").whereRaw("coalesce(metadata->>'producto_creditos_3d', 'false') <> 'true'").select("id", "title")
    const de = prods.filter((p: any) => esDeLaFecha(p.title, clave))
    if (!de.length) continue
    const valor = clave === "dia_madre" ? "dia-de-las-madres" : clave === "dia_padre" ? "dia-del-padre" : clave === "muertos" ? "dia-de-muertos" : clave.replace(/_/g, "-")
    let tag = await knex("product_tag").whereNull("deleted_at").whereRaw("lower(value) = ?", [valor]).first()
    if (!tag) {
      tag = { id: `ptag_${randomBytes(12).toString("hex").toUpperCase()}`, value: valor, created_at: new Date(), updated_at: new Date() }
      await knex("product_tag").insert(tag)
    }
    const ya = new Set(await knex("product_tags").where({ product_tag_id: tag.id }).pluck("product_id"))
    const nuevos = de.filter((p: any) => !ya.has(p.id))
    if (nuevos.length) {
      await knex("product_tags").insert(nuevos.map((p: any) => ({ product_id: p.id, product_tag_id: tag.id }))).onConflict(["product_id", "product_tag_id"]).ignore()
      n += nuevos.length
      logger?.info?.(`[temporada] etiqueta ${valor} a ${nuevos.length} productos nuevos`)
    }
  }
  return n
}

export async function resumenInvitacionesFecha(knex: any) {
  await asegurar(knex)
  const cfg = (await knex(T_CONFIG_S).where({ clave: "campanas_talleres" }).first())?.valor || {}
  const conteos = await knex(T_ENVIO).select("campana").count({ n: "*" }).groupBy("campana").catch(() => [])
  const n = Object.fromEntries(conteos.map((c: any) => [c.campana, Number(c.n)]))
  return Object.fromEntries(Object.entries<any>(cfg).map(([k, v]) => [k, { ...v, invitados: n[k] || 0 }]))
}
