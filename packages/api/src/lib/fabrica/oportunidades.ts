// @ts-nocheck
// Marketing HETNA — plantillas que conectan los dos lados del marketplace
// (docs/investigacion-disenos-virales.md):
//   1. "Se busca taller": ficha de la solicitud (proceso, material, lugar,
//      cierre y cotizaciones recibidas) para la tarjeta de cada licitación.
//   2. "Radar por estado" (para talleres): cuántas solicitudes abiertas hay en
//      un estado, por proceso. Video vertical + tarjeta.
//   3. "Ya hay talleres listos" (para clientes): cuántos talleres hay en un
//      estado y los 3 pasos para pedir cotización. Video vertical + tarjeta.
// Sólo datos reales y con fecha. No se publica un estado con menos de 3
// solicitudes (o talleres): mejor nada que números débiles. Las solicitudes
// privadas o con ubicación confidencial no cuentan por estado.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { STORE_URL, T_PROPUESTA, T_SOLICITUD, ligaTrabajo, nuevoId } from "../licitacion"
import { privacidadDe, trabajoPublicoPrivado } from "../licitacion-privacidad"
import { T_POST, crearPublicacion, ligaPara, urlCorta } from "../social-hub"
import { fondoDe, musicaAlAzar, subir, temaDe } from "./index"
import { T_PROMO, cuandoPromo, vozPara } from "./promociones"
import { cuadroDato, cuadroVideo, tarjeta } from "./render"
import { corto, ffmpegDisponible } from "./video"

export const MINIMO = 3
const hoyTexto = () => new Date().toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short", year: "numeric" })
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** Cuenta por estado y por proceso (función pura, para pruebas). */
export function agrupar(filas: { estado: string; servicio: string }[]) {
  const porEstado: Record<string, { estado: string; total: number; servicios: Record<string, number> }> = {}
  const servicios: Record<string, number> = {}
  for (const f of filas) {
    const s = f.servicio || "Otros"
    servicios[s] = (servicios[s] || 0) + 1
    if (!f.estado) continue
    const e = (porEstado[f.estado] ??= { estado: f.estado, total: 0, servicios: {} })
    e.total++
    e.servicios[s] = (e.servicios[s] || 0) + 1
  }
  return { total: filas.length, servicios, estados: Object.values(porEstado).sort((a, b) => b.total - a.total) }
}
export const topDe = (m: Record<string, number>, n = 4): [string, string][] => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, String(v)])

/** Solicitudes abiertas y públicas (las mismas del tablero /trabajos). */
export async function solicitudesAbiertas(knex: any) {
  const filas = await knex(T_SOLICITUD)
    .where({ modo: "abierta", estado: "abierta" })
    .whereNot({ modalidad: "privada" })
    .where((q: any) => q.whereNull("cierra_en").orWhere("cierra_en", ">", knex.fn.now()))
    .select("id", "trabajo", "privacidad", "contacto", "tipo", "modalidad")
    .catch(() => [])
  return agrupar(filas.map((s: any) => ({ servicio: String(s.trabajo?.servicio || "").trim(), estado: privacidadDe(s).ubicacion === "confidencial" ? "" : String(trabajoPublicoPrivado(s).estado_mx || "").trim() })))
}

/** Talleres abiertos por estado. */
export async function talleresPorEstado(knex: any) {
  const todos = await knex("seller").whereNull("deleted_at").where({ status: "open" }).select("metadata").catch(() => knex("seller").whereNull("deleted_at").select("metadata").catch(() => []))
  const porEstado: Record<string, number> = {}
  for (const t of todos) {
    const e = String(t.metadata?.perfil?.estado || "").trim()
    if (e) porEstado[e] = (porEstado[e] || 0) + 1
  }
  return { total: todos.length, estados: Object.entries(porEstado).map(([estado, total]) => ({ estado, total })).sort((a, b) => b.total - a.total) }
}

/** Ficha "Se busca taller" de una solicitud (respeta la privacidad elegida por el cliente). */
export async function fichaSolicitud(knex: any, solicitudId: string) {
  const s = await knex(T_SOLICITUD).where({ id: solicitudId }).first().catch(() => null)
  if (!s) return null
  const t = s.trabajo || {}
  const pub = trabajoPublicoPrivado(s)
  const n = Number((await knex(T_PROPUESTA).where({ solicitud_id: s.id }).count({ n: "*" }).first().catch(() => null))?.n || 0)
  const lugar = [pub.ciudad, pub.estado_mx].filter(Boolean).join(", ")
  const cierra = s.cierra_en ? new Date(s.cierra_en).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", weekday: "long", day: "numeric", month: "long" }) : ""
  const datos: [string, string][] = []
  if (t.servicio) datos.push(["Proceso", String(t.servicio)])
  if (t.material || t.cantidad) datos.push(["Material", [t.material, t.cantidad && `${t.cantidad} pzas`].filter(Boolean).join(" · ")])
  if (lugar) datos.push(["Lugar", lugar])
  if (cierra) datos.push(["Cierra", cierra])
  datos.push(["Cotizaciones", n ? `${n} recibida${n === 1 ? "" : "s"}` : "sé el primero"])
  return {
    cinta: { texto: pub.tipo === "suministro" ? "Se busca proveedor" : "Se busca taller" },
    titulo: [t.servicio, lugar && `en ${pub.ciudad || pub.estado_mx}`].filter(Boolean).join(" ") || "Trabajo de fabricación CNC",
    datos: datos.map(([k, v]) => [k, String(v).slice(0, 60)]) as [string, string][],
    sub: `Datos al ${hoyTexto()}`,
    cta: "Cotiza gratis, sin comisión",
    url: ligaTrabajo(s.folio),
  }
}

const usados = (knex: any, tipo: string, dias: number) => knex(T_PROMO).where({ tipo }).where("created_at", ">=", knex.raw(`now() - (? || ' days')::interval`, [String(dias)])).pluck("ref")

/** Arma tarjeta + video de un dato del mercado y los deja como publicaciones. */
async function publicarDato(scope: any, d: {
  tipo: string; ref: string; titulo: string; texto: string; url: string; tema: string
  tarjeta: { cinta: string; titulo: string; datos: [string, string][]; cta: string }
  cuadros: { cinta: string; numero?: string; etiqueta: string; filas?: [string, string][] }[]
  frases: string[]; cierre: string
}, logger?: any) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const nota = `Datos de hetnacnc.com al ${hoyTexto()}`
  const posts: string[] = []
  const c1 = await cuandoPromo(knex, 1)
  const p1 = await crearPublicacion(knex, { origen: "manual", fuente: "promo", titulo: `Oportunidad · ${d.titulo}`, texto_base: d.texto, url: d.url, redes: ["facebook", "instagram", "telegram", "grupos_facebook", "whatsapp"], estado: c1.estado, programada_para: c1.fecha, mercado: "mx" }, logger)
  const liga1 = urlCorta(await ligaPara(knex, p1, "facebook", d.url))
  const png = await tarjeta({ tema: d.tema, foto_url: await fondoDe(knex, d.tema), cinta: { texto: d.tarjeta.cinta }, titulo: d.tarjeta.titulo, datos: d.tarjeta.datos, sub: nota, cta: d.tarjeta.cta, liga: liga1 })
  await knex(T_POST).where({ id: p1 }).update({ medios: JSON.stringify([{ url: await subir(scope, `oportunidad-${p1}.png`, "image/png", png), tipo: "imagen" }]) })
  posts.push(p1)
  if (ffmpegDisponible()) {
    const c2 = await cuandoPromo(knex, 5)
    const p2 = await crearPublicacion(knex, { origen: "manual", fuente: "promo", titulo: `Oportunidad video · ${d.titulo}`, texto_base: d.texto, url: d.url, redes: ["instagram", "facebook", "tiktok", "youtube"], estado: c2.estado, programada_para: c2.fecha, mercado: "mx" }, logger)
    const liga2 = urlCorta(await ligaPara(knex, p2, "instagram", d.url))
    const voz = await vozPara(`oportunidad-${p2}`, [...d.frases, d.cierre], "mx", logger)
    const dur = (k: number, porOmision: number) => (voz?.duraciones?.[k] ? Math.max(1.6, voz.duraciones[k] + 0.25) : porOmision)
    const escenas = []
    for (const [k, c] of d.cuadros.entries()) escenas.push({ png: await cuadroDato({ ...c, nota, tema: d.tema, foto_url: await fondoDe(knex, d.tema), semilla: k + 1 }), segundos: dur(k, c.filas?.length ? 4 : 3) })
    escenas.push({ png: await cuadroVideo({ tipo: "cierre", texto: d.cierre, tema: d.tema, liga: liga2 }), segundos: dur(d.cuadros.length, 2.8) })
    const v = await corto(escenas, { musica: await musicaAlAzar(knex), voz: voz?.url || null })
    await knex(T_POST).where({ id: p2 }).update({ medios: JSON.stringify([{ url: await subir(scope, `oportunidad-${p2}.mp4`, "video/mp4", v.buf), tipo: "video" }]) })
    posts.push(p2)
  }
  await knex(T_PROMO).insert({ id: nuevoId("promo"), tipo: d.tipo, ref: d.ref, posts: JSON.stringify(posts) })
  return posts
}

/** Plantilla 2 — Radar por estado (para talleres). */
export async function radarEstado(scope: any, logger?: any) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const m = await solicitudesAbiertas(knex)
  const ya = await usados(knex, "radar_estado", 7)
  const e = m.estados.find((x) => x.total >= MINIMO && !ya.includes(x.estado))
  // Sin un estado con suficientes solicitudes: el dato nacional (si alcanza)
  if (!e && (m.total < MINIMO || ya.includes("México"))) return null
  const lugar = e?.estado || "México"
  const total = e?.total || m.total
  const filas = topDe(e?.servicios || m.servicios)
  const url = `${STORE_URL}/mx/trabajos${e ? `?estado=${encodeURIComponent(e.estado)}` : ""}`
  return publicarDato(scope, {
    tipo: "radar_estado", ref: lugar, titulo: `${lugar}: ${plural(total, "solicitud abierta", "solicitudes abiertas")}`, url, tema: temaDe(filas[0]?.[0] || "taller"),
    texto: `${lugar}: ${plural(total, "solicitud CNC abierta", "solicitudes CNC abiertas")} hoy en HETNA.\n\n${filas.map(([k, v]) => `• ${k}: ${v}`).join("\n")}\n\n¿Tienes taller? Cotiza gratis, sin comisión: {{liga}}\n\nMándaselo a un taller que ande buscando trabajo.`,
    tarjeta: { cinta: "Trabajo para talleres", titulo: `${lugar}: ${plural(total, "solicitud CNC abierta", "solicitudes CNC abiertas")}`, datos: filas, cta: "Cotiza gratis, sin comisión" },
    cuadros: [
      { cinta: "Para talleres CNC", numero: String(total), etiqueta: `${total === 1 ? "solicitud abierta" : "solicitudes abiertas"} hoy en ${lugar}` },
      { cinta: lugar, etiqueta: "¿Qué están pidiendo?", filas },
      { cinta: "HETNA CNC", numero: "0%", etiqueta: "de comisión por cotizar y ganar el trabajo" },
    ],
    frases: [`${lugar}: ${plural(total, "solicitud abierta", "solicitudes abiertas")} hoy.`, `Piden ${filas.slice(0, 3).map(([k]) => k.toLowerCase()).join(", ")}.`, "Cotizas gratis y sin comisión."],
    cierre: "Entra y cotiza hoy",
  }, logger)
}

/** Plantilla 3 — Ya hay talleres listos (para clientes). */
export async function talleresListos(scope: any, logger?: any) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const t = await talleresPorEstado(knex)
  const ya = await usados(knex, "talleres_listos", 10)
  const e = t.estados.find((x) => x.total >= MINIMO && !ya.includes(x.estado))
  if (!e && (t.total < MINIMO || ya.includes("México"))) return null
  const lugar = e?.estado || "México"
  const total = e?.total || t.total
  const pasos: [string, string][] = [["Publica tu solicitud gratis", "1"], ["Los talleres te cotizan", "2"], ["Comparas y eliges", "3"]]
  return publicarDato(scope, {
    tipo: "talleres_listos", ref: lugar, titulo: `${plural(total, "taller listo", "talleres listos")} en ${lugar}`, url: `${STORE_URL}/mx/cotizar`, tema: "taller",
    texto: `¿Necesitas una pieza CNC en ${lugar}?\n\nHay ${plural(total, "taller registrado", "talleres registrados")} en HETNA ${e ? "en tu estado" : "en todo el país"}: corte láser, plasma, router, torno y fresado.\n\nPublica tu solicitud gratis y recibe cotizaciones: {{liga}}\n\nMándaselo a quien necesite fabricar algo.`,
    tarjeta: { cinta: "¿Necesitas una pieza CNC?", titulo: `Hay ${plural(total, "taller listo", "talleres listos")} para cotizarte en ${lugar}`, datos: pasos.map(([k, v]) => [`Paso ${v}`, k]) as [string, string][], cta: "Publica tu solicitud gratis" },
    cuadros: [
      { cinta: `En ${lugar}`, etiqueta: "¿Necesitas fabricar una pieza CNC?" },
      { cinta: "Ya están listos", numero: String(total), etiqueta: `${total === 1 ? "taller" : "talleres"} en ${lugar} para cotizarte` },
      { cinta: "Así de fácil", etiqueta: "3 pasos", filas: pasos },
    ],
    frases: [`¿Necesitas fabricar una pieza en ${lugar}?`, `Hay ${plural(total, "taller listo", "talleres listos")} para cotizarte.`, "Publicas gratis, te cotizan y tú eliges."],
    cierre: "Publica tu solicitud gratis",
  }, logger)
}
