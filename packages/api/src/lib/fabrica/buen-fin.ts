// @ts-nocheck
// Buen Fin en HETNA. Sus fechas se anuncian cada año y supone descuentos REALES,
// así que todo lo pone el dueño en el panel: días, el descuento tal cual lo
// quiere decir, el cupón (si hay) y la etiqueta de los productos que lo tienen.
// Sin esos datos no se publica nada; el sistema nunca inventa un descuento.
//
// - 5 días antes: aviso "se viene el Buen Fin" cada 2 días.
// - Durante: una imagen y un video diarios con productos de la etiqueta.
// - Todo lleva `vence` (fin del último día) y se descarta si no salió a tiempo.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { nuevoId } from "../licitacion"
import { T_CONFIG_S, asegurarSocial } from "../social-hub"
import { finDelDia, hoyMx } from "./calendario"
import { T_PROMO, asegurarPromo } from "./promociones"
import { normalizar, piezaDeFecha, productosDeFecha } from "./temporadas"

export type ConfigBuenFin = { activo: boolean; desde: string; hasta: string; descuento: string; cupon: string; etiquetas: string[] }
const INICIAL: ConfigBuenFin = { activo: false, desde: "", hasta: "", descuento: "", cupon: "", etiquetas: ["buen-fin"] }
const AVISO_DIAS = 5
const FECHA = /^\d{4}-\d{2}-\d{2}$/

const diaNum = (s: string) => {
  const [a, m, d] = s.split("-").map(Number)
  return Math.round(Date.UTC(a, m - 1, d) / 86_400_000)
}
const hoyNum = (ahora = new Date()) => {
  const h = hoyMx(ahora)
  return Math.round(Date.UTC(h.anio, h.mes - 1, h.dia) / 86_400_000)
}
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
export function rango(desde: string, hasta: string) {
  const [, m1, d1] = desde.split("-").map(Number)
  const [, m2, d2] = hasta.split("-").map(Number)
  return m1 === m2 ? `del ${d1} al ${d2} de ${MESES[m2 - 1]}` : `del ${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]}`
}

export async function leerBuenFin(knex: any): Promise<ConfigBuenFin> {
  await asegurarSocial(knex)
  const v = (await knex(T_CONFIG_S).where({ clave: "buen_fin" }).first())?.valor || {}
  return {
    activo: !!v.activo,
    desde: FECHA.test(v.desde || "") ? v.desde : "",
    hasta: FECHA.test(v.hasta || "") ? v.hasta : "",
    descuento: String(v.descuento || "").slice(0, 80),
    cupon: String(v.cupon || "").slice(0, 40),
    etiquetas: Array.isArray(v.etiquetas) && v.etiquetas.length ? v.etiquetas.map(normalizar).filter(Boolean) : INICIAL.etiquetas,
  }
}

/** ¿El cupón existe en la tienda? (Promociones de Medusa). null = no se pudo revisar. */
export async function cuponExiste(knex: any, codigo: string): Promise<boolean | null> {
  if (!codigo) return null
  try {
    const f = await knex("promotion").whereRaw("lower(code) = lower(?)", [codigo]).whereNull("deleted_at").first()
    if (!f) return false
    return f.status ? f.status === "active" : true
  } catch {
    return null
  }
}

/** Revisa lo que manda el panel. Lanza error con lo que falta. */
export function validar(c: ConfigBuenFin) {
  if (!c.activo) return
  if (!FECHA.test(c.desde) || !FECHA.test(c.hasta)) throw new Error("Pon las dos fechas del Buen Fin.")
  if (diaNum(c.hasta) < diaNum(c.desde)) throw new Error("La fecha final va después de la inicial.")
  if (diaNum(c.hasta) - diaNum(c.desde) > 14) throw new Error("El Buen Fin no dura más de 2 semanas: revisa las fechas.")
  if (c.descuento.trim().length < 3) throw new Error("Escribe el descuento tal como quieres anunciarlo (ej. «10% en productos seleccionados»).")
}

export async function guardarBuenFin(knex: any, b: any) {
  const actual = await leerBuenFin(knex)
  const c: ConfigBuenFin = {
    activo: typeof b.activo === "boolean" ? b.activo : actual.activo,
    desde: typeof b.desde === "string" ? b.desde.trim() : actual.desde,
    hasta: typeof b.hasta === "string" ? b.hasta.trim() : actual.hasta,
    descuento: typeof b.descuento === "string" ? b.descuento.trim().slice(0, 80) : actual.descuento,
    cupon: typeof b.cupon === "string" ? b.cupon.trim().toUpperCase().slice(0, 40) : actual.cupon,
    etiquetas: Array.isArray(b.etiquetas) ? b.etiquetas.map(normalizar).filter(Boolean).slice(0, 12) : actual.etiquetas,
  }
  validar(c)
  if (c.activo && c.cupon && (await cuponExiste(knex, c.cupon)) === false) {
    throw new Error(`El cupón ${c.cupon} no existe o no está activo en Promociones. Créalo primero (o deja el campo vacío).`)
  }
  await knex.raw(`insert into ?? (clave, valor) values ('buen_fin', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify(c)])
  return c
}

/** "antes" (aviso), "durante" o null. */
export function etapa(c: ConfigBuenFin, ahora = new Date()) {
  if (!c.activo || !c.desde || !c.hasta) return null
  const hoy = hoyNum(ahora)
  if (hoy > diaNum(c.hasta)) return null
  if (hoy >= diaNum(c.desde)) return "durante"
  if (diaNum(c.desde) - hoy <= AVISO_DIAS) return "antes"
  return null
}

/** Los textos salen SÓLO de lo que escribió el dueño. */
export function fechaBuenFin(c: ConfigBuenFin, et: "antes" | "durante") {
  const r = rango(c.desde, c.hasta)
  return {
    clave: "buen_fin",
    nombre: "Buen Fin",
    tema: "naranja",
    icono: "dinero",
    gancho: et === "antes" ? "Se viene el Buen Fin" : "Buen Fin en HETNA",
    narracion: et === "antes" ? `Se viene el Buen Fin en HETNA, ${r}: ${c.descuento}.` : `Buen Fin en HETNA: ${c.descuento}. Sólo ${r}.`,
    cta: et === "durante" && c.cupon ? `Usa el cupón ${c.cupon}` : et === "antes" ? "Ve eligiendo en HETNA" : "Aprovecha en HETNA",
  }
}

const VUELTA = { activa: false }

export async function promoBuenFin(scope: any, logger?: any, o: { forzar?: boolean; ahora?: Date } = {}) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const c = await leerBuenFin(knex)
  const ahora = o.ahora || new Date()
  const et = etapa(c, ahora)
  if (!et) return { hecho: false, motivo: c.activo ? "Hoy no está en las fechas del Buen Fin (ni en los 5 días de aviso)." : "El Buen Fin está apagado." }
  await asegurarPromo(knex)
  const tipo = `buen_fin:${c.desde}`
  const ultima = await knex(T_PROMO).where({ tipo }).max({ en: "created_at" }).first().catch(() => null)
  const dias = ultima?.en ? (ahora.getTime() - new Date(ultima.en).getTime()) / 86_400_000 : 999
  if (!o.forzar && dias < (et === "durante" ? 0.9 : 1.9)) return { hecho: false, motivo: "Ya se hizo la pieza de hoy." }
  const recientes = await knex(T_PROMO).where({ tipo }).where("created_at", ">=", knex.raw("now() - interval '4 days'")).pluck("ref")
  const prods = await productosDeFecha(knex, c.etiquetas, { excluir: recientes, limite: 3 })
  if (!prods.length) return { hecho: false, motivo: `Ningún producto publicado tiene la etiqueta ${c.etiquetas.join(", ")}. Ponla a los productos que tienen el descuento.` }
  if (VUELTA.activa) return { hecho: false, motivo: "Ya se está haciendo una." }
  VUELTA.activa = true
  try {
    const [a, m, d] = c.hasta.split("-").map(Number)
    const posts = await piezaDeFecha(scope, fechaBuenFin(c, et), { anio: a, mes: m, dia: d }, prods, logger)
    for (const pr of prods) await knex(T_PROMO).insert({ id: nuevoId("promo"), tipo, ref: pr.id, posts: JSON.stringify(posts) })
    logger?.info?.(`[buen-fin] ${et}: ${prods.length} productos, ${posts.length} publicaciones`)
    return { hecho: true, etapa: et, productos: prods.map((x: any) => x.title), posts }
  } finally {
    VUELTA.activa = false
  }
}

/** Para el panel. */
export async function resumenBuenFin(knex: any) {
  const c = await leerBuenFin(knex)
  const prods = await productosDeFecha(knex, c.etiquetas, { limite: 6 }).catch(() => [])
  return {
    ...c,
    etapa: etapa(c),
    vence: c.hasta ? finDelDia({ anio: +c.hasta.slice(0, 4), mes: +c.hasta.slice(5, 7), dia: +c.hasta.slice(8, 10) }) : null,
    cupon_ok: await cuponExiste(knex, c.cupon),
    productos: prods.map((x: any) => ({ id: x.id, titulo: x.title, foto: x.thumbnail })),
  }
}
