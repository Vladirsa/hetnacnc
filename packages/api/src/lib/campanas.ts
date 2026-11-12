// @ts-nocheck
// Motor de campañas de anuncios (Google, Meta y TikTok).
//
// El dueño escoge QUÉ vender, el objetivo, la zona, el presupuesto y en qué
// plataformas. El motor:
//   1. junta los datos reales (planes y precios del Cotizador, 3D Studio,
//      productos de la tienda, fechas especiales y lo que ya vendió en redes);
//   2. le pide a la IA la campaña completa por plataforma (públicos, palabras
//      clave, 3 versiones de textos) y el código revisa los límites de cada
//      plataforma (Google: títulos de 30 y descripciones de 90 letras, etc.);
//   3. hace las imágenes con el estilo nuevo (4:5 para feed y 9:16 para historias
//      y TikTok) y una liga medida por plataforma (los resultados se ven aquí);
//   4. entrega:
//      · Meta: se crea en la cuenta publicitaria EN PAUSA (el dueño la revisa y
//        la activa); nunca se activa sola.
//      · Google: archivo CSV para Google Ads Editor (Importar), en pausa.
//      · TikTok: textos y videos/imágenes verticales listos para TikTok Ads
//        Manager (su API de anuncios pide otra aprobación).
// No inventa precios ni promesas: sólo usa los datos que se le dan.
import Anthropic from "@anthropic-ai/sdk"

import { STORE_URL, nuevoId } from "./licitacion"
import { T_CONFIG_S, T_EVENTO_S, T_LIGA, asegurarSocial, ligaPara, urlCorta } from "./social-hub"
import { aprendizaje, ventasPorPublicacion } from "./social-estadisticas"
import { TOPE_SEMANAL, anunciosListos, graph, leerAnuncios } from "./anuncios"

export const T_CAMPANA = "hetna_campana_ads"
export const PLATAFORMAS = ["meta", "google", "tiktok"] as const
export const QUE_VENDER: Record<string, { nombre: string; ruta: string }> = {
  cotizador: { nombre: "HETNA Cotizador (app para cotizar con DXF)", ruta: "/mx/herramientas-cnc" },
  "3d": { nombre: "HETNA 3D Studio (foto a 3D con IA, STL)", ruta: "/mx/disenar" },
  tienda: { nombre: "Productos de la tienda", ruta: "/mx" },
  talleres: { nombre: "Que se registren talleres CNC", ruta: "/mx/talleres/unete" },
  cotizar: { nombre: "Que los clientes coticen su pieza con talleres", ruta: "/mx/cotizar" },
  anunciate: { nombre: "Vender espacios de publicidad en hetnacnc.com", ruta: "/mx/anunciate" },
}
export const OBJETIVOS = ["clics", "registros", "ventas"] as const

export async function asegurarCampanas(knex: any) {
  await asegurarSocial(knex)
  if (!(await knex.schema.hasTable(T_CAMPANA))) {
    await knex.schema.createTable(T_CAMPANA, (t: any) => {
      t.text("id").primary()
      t.text("nombre").notNullable()
      t.text("que").notNullable()
      t.text("objetivo").notNullable()
      t.text("zona")
      t.decimal("diario", 10, 2)
      t.integer("dias")
      t.jsonb("plataformas")
      t.jsonb("plan") // lo que armó el motor (por plataforma)
      t.jsonb("creativos") // imágenes por formato
      t.jsonb("ligas") // liga medida por plataforma
      t.jsonb("meta") // ids creados en Meta
      t.text("estado").notNullable().defaultTo("lista") // generando | lista | creada_meta | error
      t.text("error")
      t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now())
      t.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now())
    })
  }
}

// ---------------------------------------------------------------------
// Datos reales para la IA
// ---------------------------------------------------------------------

async function hechosDe(knex: any, que: string) {
  const l: string[] = []
  const { HERRAMIENTAS, DEL_COTIZADOR, DEL_3D } = await import("./fabrica/promociones")
  if (que === "cotizador") {
    try {
      const { PLANES_COTIZADOR } = await import("./cotizador-suscripciones")
      l.push(`Planes: Gratis (5 cotizaciones al mes), prueba de 14 días sin límite, ${Object.values(PLANES_COTIZADOR).map((p: any) => `${p.nombre} $${p.precio} MXN/mes`).join(", ")}.`)
    } catch {}
    for (const h of HERRAMIENTAS.filter((x: any) => DEL_COTIZADOR.includes(x.clave))) l.push(`- ${h.texto}`)
  } else if (que === "3d") {
    for (const h of HERRAMIENTAS.filter((x: any) => DEL_3D.includes(x.clave))) l.push(`- ${h.texto}`)
  } else if (que === "tienda") {
    const ps = await knex("product").whereNull("deleted_at").where({ status: "published" }).whereNotNull("thumbnail").orderBy("created_at", "desc").limit(12).select("title").catch(() => [])
    l.push(`Productos recientes de la tienda: ${ps.map((p: any) => p.title).join("; ")}.`)
    l.push("Pago protegido con Mercado Pago dentro de HETNA, envíos con costo y días antes de pagar, devoluciones en productos físicos sin uso.")
  } else if (que === "talleres") {
    l.push("Registro gratis para talleres CNC. Reciben solicitudes de clientes de su zona y cotizan sin comisión en las licitaciones. Perfil verificado y ranking por evaluaciones reales.")
  } else if (que === "cotizar") {
    l.push("El cliente publica su pieza gratis (plano, foto o medidas), talleres de su zona le mandan cotización y elige. Pago protegido. Corte láser, router CNC, plasma, impresión 3D y maquinado.")
  } else if (que === "anunciate") {
    const h = HERRAMIENTAS.find((x: any) => x.clave === "anunciate")
    if (h) l.push(h.texto)
  }
  const a = await aprendizaje(knex, 60).catch(() => null)
  if (a?.resumen?.length) l.push(`Lo aprendido en redes: ${a.resumen.slice(0, 5).join(" ")}`)
  return l.join("\n")
}

// ---------------------------------------------------------------------
// IA
// ---------------------------------------------------------------------

const TEXTO = { type: "string" }
const LISTA = { type: "array", items: { type: "string" } }
const ESQUEMA = {
  type: "object", additionalProperties: false, required: ["nombre", "resumen", "publico", "titulos_imagen", "meta", "google", "tiktok"],
  properties: {
    nombre: TEXTO, resumen: TEXTO, publico: TEXTO, titulos_imagen: LISTA,
    meta: {
      type: "object", additionalProperties: false, required: ["edad_min", "edad_max", "intereses", "cta", "textos"],
      properties: {
        edad_min: { type: "integer" }, edad_max: { type: "integer" }, intereses: LISTA,
        cta: { type: "string", enum: ["LEARN_MORE", "SIGN_UP", "SHOP_NOW", "GET_QUOTE", "DOWNLOAD"] },
        textos: { type: "array", items: { type: "object", additionalProperties: false, required: ["principal", "titulo", "descripcion"], properties: { principal: TEXTO, titulo: TEXTO, descripcion: TEXTO } } },
      },
    },
    google: {
      type: "object", additionalProperties: false, required: ["grupos", "negativas", "ruta1", "ruta2"],
      properties: {
        ruta1: TEXTO, ruta2: TEXTO, negativas: LISTA,
        grupos: { type: "array", items: { type: "object", additionalProperties: false, required: ["nombre", "palabras", "titulos", "descripciones"], properties: { nombre: TEXTO, palabras: LISTA, titulos: LISTA, descripciones: LISTA } } },
      },
    },
    tiktok: {
      type: "object", additionalProperties: false, required: ["textos", "intereses", "edad_min", "edad_max", "cta"],
      properties: { textos: LISTA, intereses: LISTA, edad_min: { type: "integer" }, edad_max: { type: "integer" }, cta: TEXTO },
    },
  },
}

/** Corta en palabra completa sin pasarse del límite (sin "…"). */
export function caber(t: string, max: number) {
  const s = String(t || "").replace(/\s+/g, " ").trim()
  if (s.length <= max) return s
  const c = s.slice(0, max + 1)
  const i = c.lastIndexOf(" ")
  return (i > max * 0.5 ? c.slice(0, i) : s.slice(0, max)).replace(/[,;:\-–]+$/, "").trim()
}
const unicos = (xs: string[]) => [...new Set(xs.map((x) => String(x || "").trim()).filter(Boolean))]

/** Aplica los límites de cada plataforma a lo que mandó la IA. */
export function sanear(p: any) {
  const edad = (a: any, d: number) => Math.max(18, Math.min(65, Math.round(Number(a) || d)))
  return {
    nombre: caber(p.nombre, 80), resumen: caber(p.resumen, 600), publico: caber(p.publico, 400),
    titulos_imagen: unicos((p.titulos_imagen || []).map((t: string) => caber(t, 48))).slice(0, 3),
    meta: {
      edad_min: edad(p.meta?.edad_min, 21), edad_max: edad(p.meta?.edad_max, 60),
      intereses: unicos(p.meta?.intereses || []).slice(0, 8),
      cta: p.meta?.cta || "LEARN_MORE",
      textos: (p.meta?.textos || []).slice(0, 3).map((t: any) => ({ principal: caber(t.principal, 125), titulo: caber(t.titulo, 40), descripcion: caber(t.descripcion, 30) })),
    },
    google: {
      ruta1: caber(String(p.google?.ruta1 || "").replace(/[^\p{L}\p{N}-]/gu, ""), 15), ruta2: caber(String(p.google?.ruta2 || "").replace(/[^\p{L}\p{N}-]/gu, ""), 15),
      negativas: unicos(p.google?.negativas || []).slice(0, 30),
      grupos: (p.google?.grupos || []).slice(0, 4).map((g: any) => ({
        nombre: caber(g.nombre, 60),
        palabras: unicos(g.palabras || []).slice(0, 20),
        titulos: unicos((g.titulos || []).map((t: string) => caber(t, 30))).slice(0, 15),
        descripciones: unicos((g.descripciones || []).map((t: string) => caber(t, 90))).slice(0, 4),
      })),
    },
    tiktok: {
      textos: unicos((p.tiktok?.textos || []).map((t: string) => caber(t, 100))).slice(0, 3),
      intereses: unicos(p.tiktok?.intereses || []).slice(0, 8),
      edad_min: edad(p.tiktok?.edad_min, 18), edad_max: edad(p.tiktok?.edad_max, 55),
      cta: caber(p.tiktok?.cta || "Más información", 30),
    },
  }
}

let ia: Anthropic | null = null
async function planConIa(d: { que: string; objetivo: string; zona: string; diario: number; dias: number; hechos: string }, logger?: any) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY en el servidor para armar la campaña.")
  ia ??= new Anthropic()
  const resp = await ia.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 6000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system:
      "Eres el especialista en campañas de anuncios de HETNA CNC (marketplace de fabricación CNC en México). Arma una campaña completa para Meta (Facebook e Instagram), Google Ads (búsqueda) y TikTok Ads. " +
      "Reglas: usa SÓLO los datos que se te dan; no inventes precios, descuentos, cifras, testimonios ni garantías; nada de 'el mejor' ni superlativos sin prueba. Español de México, tuteando. " +
      "Meta: 3 versiones de texto (principal máx. 125 letras con gancho en la primera línea; título máx. 40; descripción máx. 30), intereses reales que existan en Meta (en español o inglés), edad. " +
      "Google: 2 a 4 grupos de anuncios por intención de búsqueda; por grupo 8 a 15 palabras clave (frases que la gente de verdad busca en México, sin signos), 10 a 15 títulos de máx. 30 letras y 4 descripciones de máx. 90; palabras negativas (gratis si no aplica, empleo, curso, segunda mano, etc. según el caso); ruta1/ruta2 cortas sin espacios. " +
      "TikTok: 3 textos de máx. 100 letras, naturales, sin parecer anuncio; intereses; CTA corto. titulos_imagen: 3 títulos de máx. 6 palabras para las imágenes. " +
      "resumen: en 3 o 4 oraciones, la estrategia y por qué; publico: a quién va.",
    messages: [{ role: "user", content: `Qué vender: ${QUE_VENDER[d.que]?.nombre || d.que}\nObjetivo: ${d.objetivo}\nZona: ${d.zona}\nPresupuesto: $${d.diario} MXN al día por ${d.dias} días\n\nDatos reales:\n${d.hechos}` }],
  } as any)
  if (resp.stop_reason === "refusal") throw new Error("La IA no pudo armar esta campaña.")
  const txt = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("")
  return sanear(JSON.parse(txt))
}

// ---------------------------------------------------------------------
// Generar
// ---------------------------------------------------------------------

export async function generarCampana(scope: any, o: { que: string; objetivo: string; zona?: string; diario: number; dias: number; plataformas: string[] }, logger?: any) {
  const { ContainerRegistrationKeys } = await import("@medusajs/framework/utils")
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarCampanas(knex)
  if (!QUE_VENDER[o.que]) throw new Error("Escoge qué quieres vender.")
  const plataformas = (o.plataformas || []).filter((p) => (PLATAFORMAS as readonly string[]).includes(p))
  if (!plataformas.length) throw new Error("Escoge al menos una plataforma.")
  const dias = Math.max(3, Math.min(30, Math.round(Number(o.dias) || 7)))
  // Tope semanal del sistema (el mismo del agente de anuncios), repartido entre plataformas
  const diario = Math.max(20, Math.min(Math.floor(TOPE_SEMANAL / 7), Number(o.diario) || 100))
  const objetivo = (OBJETIVOS as readonly string[]).includes(o.objetivo) ? o.objetivo : "clics"
  const zona = String(o.zona || "Todo México").slice(0, 80)
  const id = nuevoId("cmp")
  await knex(T_CAMPANA).insert({ id, nombre: `Campaña ${QUE_VENDER[o.que].nombre}`, que: o.que, objetivo, zona, diario, dias, plataformas: JSON.stringify(plataformas), estado: "generando" })
  try {
    const plan = await planConIa({ que: o.que, objetivo, zona, diario, dias, hechos: await hechosDe(knex, o.que) }, logger)
    // Ligas medidas por plataforma (los clics, registros y pagos se cuentan a esta campaña)
    const destino = `${STORE_URL}${QUE_VENDER[o.que].ruta}`
    const ligas: Record<string, string> = {}
    for (const p of plataformas) ligas[p] = urlCorta(await ligaPara(knex, id, p, destino, "ads"))
    // Imágenes con el estilo nuevo: feed (4:5) e historias/TikTok (9:16)
    const creativos: any[] = []
    try {
      const { poster } = await import("./fabrica/poster")
      const { temaPara, iconoPara } = await import("./fabrica/hyperframes")
      const { subir } = await import("./fabrica/index")
      const titulos = plan.titulos_imagen.length ? plan.titulos_imagen : [QUE_VENDER[o.que].nombre]
      for (const [i, titulo] of titulos.entries()) {
        for (const formato of ["4:5", "9:16"] as const) {
          const b = await poster({ formato, tema: temaPara(`${id}-${i}`), cinta: "HETNA CNC", titulo, icono: iconoPara(`${titulo} ${o.que}`), cta: plan.meta.textos[i]?.titulo || "Conoce más", liga: ligas.meta || ligas[plataformas[0]] }, logger)
          if (b) creativos.push({ formato, titulo, url: await subir(scope, `campana-${id}-${i}-${formato.replace(":", "x")}.png`, "image/png", b) })
        }
      }
    } catch (e) {
      logger?.warn?.(`[campañas] imágenes: ${(e as Error).message}`)
    }
    await knex(T_CAMPANA).where({ id }).update({ nombre: plan.nombre || `Campaña ${QUE_VENDER[o.que].nombre}`, plan: JSON.stringify(plan), creativos: JSON.stringify(creativos), ligas: JSON.stringify(ligas), estado: "lista", updated_at: knex.fn.now() })
    return id
  } catch (e) {
    await knex(T_CAMPANA).where({ id }).update({ estado: "error", error: (e as Error).message, updated_at: knex.fn.now() })
    throw e
  }
}

// ---------------------------------------------------------------------
// Google: CSV para Google Ads Editor
// ---------------------------------------------------------------------

const csv = (v: any) => {
  const s = String(v ?? "")
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Campaña de búsqueda para importar en Google Ads Editor (Cuenta → Importar → Desde archivo). Queda en pausa. */
export function csvGoogle(c: any) {
  const p = c.plan?.google
  if (!p) return ""
  const nombre = caber(c.nombre, 60)
  const url = c.ligas?.google || `${STORE_URL}${QUE_VENDER[c.que]?.ruta || "/mx"}`
  const H = Array.from({ length: 15 }, (_, i) => `Headline ${i + 1}`)
  const D = Array.from({ length: 4 }, (_, i) => `Description ${i + 1}`)
  const cab = ["Campaign", "Campaign Type", "Networks", "Budget", "Budget type", "Campaign Status", "Language", "Location", "Ad Group", "Ad Group Status", "Keyword", "Criterion Type", "Ad type", ...H, ...D, "Final URL", "Path 1", "Path 2", "Status"]
  const fila = (o: Record<string, any>) => cab.map((k) => csv(o[k] ?? "")).join(",")
  const filas = [cab.join(",")]
  filas.push(fila({ Campaign: nombre, "Campaign Type": "Search", Networks: "Google search", Budget: Number(c.diario).toFixed(2), "Budget type": "Daily", "Campaign Status": "Paused", Language: "es", Location: c.zona && !/m[eé]xico/i.test(c.zona) ? c.zona : "Mexico" }))
  for (const neg of p.negativas || []) filas.push(fila({ Campaign: nombre, Keyword: neg, "Criterion Type": "Campaign Negative Broad" }))
  for (const g of p.grupos || []) {
    filas.push(fila({ Campaign: nombre, "Ad Group": g.nombre, "Ad Group Status": "Enabled" }))
    for (const k of g.palabras) filas.push(fila({ Campaign: nombre, "Ad Group": g.nombre, Keyword: k, "Criterion Type": "Phrase" }))
    const ad: Record<string, any> = { Campaign: nombre, "Ad Group": g.nombre, "Ad type": "Responsive search ad", "Final URL": url, "Path 1": p.ruta1, "Path 2": p.ruta2, Status: "Enabled" }
    g.titulos.forEach((t: string, i: number) => (ad[H[i]] = t))
    g.descripciones.forEach((t: string, i: number) => (ad[D[i]] = t))
    filas.push(fila(ad))
  }
  return filas.join("\n")
}

// ---------------------------------------------------------------------
// Meta: crear en la cuenta publicitaria, EN PAUSA
// ---------------------------------------------------------------------

const PAGINA = () => process.env.META_PAGE_ID || "109722907076187"

/**
 * Crea campaña de tráfico, conjunto (presupuesto diario, fecha de fin, edad,
 * intereses que existan en Meta) y un anuncio por versión de texto con su
 * imagen. Todo queda EN PAUSA: el dueño lo revisa en el Administrador de
 * anuncios y lo activa ahí. Si algo falla, lo creado se queda en pausa.
 */
export async function crearEnMeta(knex: any, id: string, logger?: any) {
  const cfg = await leerAnuncios(knex)
  if (!anunciosListos()) throw new Error("Falta META_ADS_TOKEN en el servidor.")
  if (!cfg.cuenta) throw new Error("Pon la cuenta publicitaria en Resultados → Anuncios en Meta.")
  const c = await knex(T_CAMPANA).where({ id }).first()
  if (!c?.plan?.meta) throw new Error("Esa campaña no tiene parte de Meta.")
  if (c.meta?.campana) throw new Error("Ya se creó en Meta.")
  const act = `act_${cfg.cuenta}`
  const m = c.plan.meta
  const meta: any = { anuncios: [] }
  try {
    meta.campana = (await graph(`${act}/campaigns`, { name: c.nombre, objective: "OUTCOME_TRAFFIC", status: "PAUSED", special_ad_categories: [], is_adset_budget_sharing_enabled: false })).id
    // Intereses: sólo los que Meta reconoce
    const intereses: any[] = []
    for (const n of m.intereses || []) {
      const r = await graph(`search?type=adinterest&limit=1&q=${encodeURIComponent(n)}`).catch(() => null)
      const x = r?.data?.[0]
      if (x?.id) intereses.push({ id: x.id, name: x.name })
    }
    const fin = new Date(Date.now() + Number(c.dias) * 86_400_000)
    meta.conjunto = (
      await graph(`${act}/adsets`, {
        name: c.nombre, campaign_id: meta.campana, daily_budget: String(Math.round(Number(c.diario) * 100)), billing_event: "IMPRESSIONS",
        optimization_goal: "LINK_CLICKS", bid_strategy: "LOWEST_COST_WITHOUT_CAP", destination_type: "WEBSITE", end_time: fin.toISOString(), status: "PAUSED",
        targeting: { geo_locations: { countries: ["MX"] }, age_min: m.edad_min, age_max: m.edad_max, ...(intereses.length ? { flexible_spec: [{ interests: intereses }] } : {}), targeting_automation: { advantage_audience: 0 } }, // respeta la edad y los intereses del plan
      })
    ).id
    const imagenes = (c.creativos || []).filter((x: any) => x.formato === "4:5")
    for (const [i, t] of (m.textos || []).entries()) {
      const img = imagenes[i % Math.max(1, imagenes.length)]
      let hash: string | null = null
      if (img?.url) {
        const r = await fetch(img.url, { signal: AbortSignal.timeout(60_000) })
        if (r.ok) {
          const up = await graph(`${act}/adimages`, { bytes: Buffer.from(await r.arrayBuffer()).toString("base64") })
          hash = (Object.values(up.images || {})[0] as any)?.hash || null
        }
      }
      const link = c.ligas?.meta || `${STORE_URL}${QUE_VENDER[c.que]?.ruta || "/mx"}`
      const creativo = (
        await graph(`${act}/adcreatives`, {
          name: `${c.nombre} · versión ${i + 1}`,
          object_story_spec: { page_id: PAGINA(), link_data: { link, message: t.principal, name: t.titulo, description: t.descripcion, ...(hash ? { image_hash: hash } : {}), call_to_action: { type: m.cta, value: { link } } } },
        })
      ).id
      const ad = (await graph(`${act}/ads`, { name: `${c.nombre} · versión ${i + 1}`, adset_id: meta.conjunto, creative: { creative_id: creativo }, status: "PAUSED" })).id
      meta.anuncios.push({ creativo, ad })
    }
    await knex(T_CAMPANA).where({ id }).update({ meta: JSON.stringify(meta), estado: "creada_meta", error: null, updated_at: knex.fn.now() })
    logger?.info?.(`[campañas] ${id} creada en Meta en pausa (${meta.anuncios.length} anuncios)`)
    return { ok: true, meta, administrador: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${cfg.cuenta}&selected_campaign_ids=${meta.campana}` }
  } catch (e) {
    if (meta.campana) await graph(meta.campana, { status: "PAUSED" }).catch(() => null)
    await knex(T_CAMPANA).where({ id }).update({ meta: JSON.stringify(meta), error: (e as Error).message, updated_at: knex.fn.now() })
    throw e
  }
}

// ---------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------

/** Lista con resultados medidos de cada campaña (clics y conversiones de sus ligas). */
export async function listarCampanas(knex: any) {
  await asegurarCampanas(knex)
  const filas = await knex(T_CAMPANA).orderBy("created_at", "desc").limit(30)
  const ids = filas.map((f: any) => f.id)
  const ligas = ids.length ? await knex(T_LIGA).whereIn("post_id", ids).select("codigo", "post_id", "red", "clics") : []
  const ev = ligas.length ? await knex(T_EVENTO_S).whereIn("codigo", ligas.map((l: any) => l.codigo)).whereNot("tipo", "clic").groupBy("codigo", "tipo").select("codigo", "tipo").count({ n: "*" }) : []
  const cfg = await leerAnuncios(knex)
  return {
    meta_listo: anunciosListos() && !!cfg.cuenta,
    cuenta_meta: cfg.cuenta || null,
    campanas: filas.map((f: any) => {
      const mias = ligas.filter((l: any) => l.post_id === f.id)
      const res: Record<string, any> = {}
      for (const l of mias) {
        const e = ev.filter((x: any) => x.codigo === l.codigo)
        res[l.red] = { clics: Number(l.clics) || 0, ...Object.fromEntries(e.map((x: any) => [x.tipo, Number(x.n)])) }
      }
      return { ...f, resultados: res }
    }),
  }
}

export { csvGoogle as exportarGoogle }
