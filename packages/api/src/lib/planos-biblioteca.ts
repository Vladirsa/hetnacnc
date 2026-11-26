// Planos de la Biblioteca guardados en la base de datos (además de los 50 que
// viven en el código de la tienda, apps/storefront/src/lib/planos/modelos.ts).
// Los propone el agente semanal (lib/planos-agente.ts) o se importan a mano;
// quedan como BORRADOR y sólo el dueño los publica desde el panel
// (Dashboard → Planos IA). Al publicarse salen solos en /planos, en la tienda
// (producto con ofertas de talleres), en redes y en el correo a suscritos.
//
// Aquí se revisa la FORMA del plano (campos, tipos, tamaños). La revisión de
// geometría (piezas que se tocan, caben en la hoja, grosores) la hace la tienda
// con el mismo motor de la biblioteca: POST /mx/planos/validar.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createHmac, timingSafeEqual } from "crypto"

import { limpiarCacheTienda, sincronizarProductosPlanos } from "./planos-catalogo"
import { PLANOS_NOMBRES, T_BIBLIOTECA, cargarNombresPlanos } from "./planos-correo"
import { STORE_URL } from "./licitacion"
import { secretoLigas } from "./secreto-ligas"

export { T_BIBLIOTECA }

export const SLUG_PLANO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const MATERIALES = ["triplay-18", "triplay-12", "triplay-9", "triplay-6"] as const

export type PiezaDB = { nombre: string; material: (typeof MATERIALES)[number]; x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
export type PlanoDB = {
  slug: string
  categoria: "Taller" | "Casa"
  nombre: string
  resumen: string
  descripcion: string
  nivel: "Fácil" | "Intermedio"
  horas: string
  juego?: { cantidad: number; nombre: string }
  ruedas?: number
  piezas: PiezaDB[]
  pasos: { titulo: string; nota: string; piezas: string[] }[]
  herrajes: string[]
  herramientas: string[]
  notas: string[]
}

export class ErrorPlano extends Error {}

let lista = false
export async function asegurarBiblioteca(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_BIBLIOTECA))) {
    await knex.schema.createTable(T_BIBLIOTECA, (t: any) => {
      t.text("slug").primary()
      t.text("nombre").notNullable()
      t.text("categoria").notNullable()
      t.text("estado").notNullable().defaultTo("borrador") // borrador | publicado | rechazado
      t.text("origen").notNullable().defaultTo("manual") // manual | ia
      t.jsonb("datos").notNullable()
      t.text("razon").nullable() // por qué se propuso (sólo para el dueño, nunca se publica)
      t.jsonb("fuentes").nullable()
      t.jsonb("revision").nullable() // resultado de /mx/planos/validar
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("publicado_en", { useTz: true }).nullable()
      t.index(["estado"])
    })
  }
  lista = true
}

const texto = (v: unknown, max: number, campo: string, min = 1) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim()
  if (s.length < min) throw new ErrorPlano(`Falta ${campo}.`)
  return s.slice(0, max)
}
const lista_ = (v: unknown, max: number, largo: number) => (Array.isArray(v) ? v : []).map((x) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, largo)).filter(Boolean).slice(0, max)
const num = (v: unknown, campo: string) => {
  const n = Number(v)
  if (!Number.isFinite(n) || n < -500 || n > 3000) throw new ErrorPlano(`Medida fuera de rango en ${campo}.`)
  return Math.round(n * 10) / 10
}

/** Revisa y limpia la forma de un plano (no su geometría). */
export function normalizarPlano(d: any): PlanoDB {
  if (!d || typeof d !== "object") throw new ErrorPlano("El plano no es válido.")
  const slug = String(d.slug || "").trim().toLowerCase()
  if (slug.length < 3 || slug.length > 40 || !SLUG_PLANO.test(slug)) throw new ErrorPlano("El slug va en minúsculas, con guiones y de 3 a 40 letras.")
  const categoria = d.categoria === "Casa" ? "Casa" : d.categoria === "Taller" ? "Taller" : null
  if (!categoria) throw new ErrorPlano("La categoría es Taller o Casa.")
  if (!Array.isArray(d.piezas) || d.piezas.length < 2 || d.piezas.length > 80) throw new ErrorPlano("El plano lleva de 2 a 80 piezas.")
  const piezas: PiezaDB[] = d.piezas.map((q: any, i: number) => {
    const material = MATERIALES.includes(q?.material) ? q.material : null
    if (!material) throw new ErrorPlano(`Material no válido en la pieza ${i + 1}.`)
    const p = { nombre: texto(q.nombre, 60, `el nombre de la pieza ${i + 1}`), material, x0: num(q.x0, "x0"), x1: num(q.x1, "x1"), y0: num(q.y0, "y0"), y1: num(q.y1, "y1"), z0: num(q.z0, "z0"), z1: num(q.z1, "z1") }
    if (p.x1 <= p.x0 || p.y1 <= p.y0 || p.z1 <= p.z0) throw new ErrorPlano(`La pieza «${p.nombre}» tiene una medida en cero o negativa.`)
    return p
  })
  if (!Array.isArray(d.pasos) || !d.pasos.length || d.pasos.length > 10) throw new ErrorPlano("El plano lleva de 1 a 10 pasos.")
  const pasos = d.pasos.map((ps: any, i: number) => ({
    titulo: texto(ps?.titulo, 60, `el título del paso ${i + 1}`),
    nota: texto(ps?.nota, 240, `la nota del paso ${i + 1}`, 0),
    piezas: lista_(ps?.piezas, 20, 60),
  }))
  const ruedas = d.ruedas == null ? undefined : Math.round(Number(d.ruedas))
  if (ruedas !== undefined && !(ruedas >= 0 && ruedas <= 200)) throw new ErrorPlano("El alto de las ruedas va de 0 a 200 mm.")
  const juego = d.juego && Number(d.juego.cantidad) > 1 ? { cantidad: Math.min(10, Math.round(Number(d.juego.cantidad))), nombre: texto(d.juego.nombre, 40, "el nombre del juego") } : undefined
  return {
    slug,
    categoria,
    nombre: texto(d.nombre, 80, "el nombre", 3),
    resumen: texto(d.resumen, 240, "el resumen", 10),
    descripcion: texto(d.descripcion, 600, "la descripción", 10),
    nivel: d.nivel === "Intermedio" ? "Intermedio" : "Fácil",
    horas: texto(d.horas, 20, "las horas"),
    ...(juego ? { juego } : {}),
    ...(ruedas ? { ruedas } : {}),
    piezas,
    pasos,
    herrajes: lista_(d.herrajes, 12, 200),
    herramientas: lista_(d.herramientas, 12, 200),
    notas: lista_(d.notas, 8, 300),
  }
}

/**
 * Revisión de geometría con el motor de la tienda (POST /mx/planos/validar).
 * Si la tienda tiene PLANOS_VALIDAR_SECRETO, el backend debe mandar el mismo
 * (mismo valor en los dos .env); sin él la tienda sólo acepta planos chicos.
 */
export async function revisarEnTienda(plano: PlanoDB): Promise<{ ok: boolean; errores: string[]; avisos: string[]; resumen?: Record<string, unknown> }> {
  const r = await fetch(`${STORE_URL}/mx/planos/validar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-hetna-secreto": process.env.PLANOS_VALIDAR_SECRETO || "" },
    body: JSON.stringify({ plano }),
    signal: AbortSignal.timeout(30_000),
  })
  const d = (await r.json().catch(() => null)) as any
  if (!r.ok || !d) throw new Error(`La tienda no pudo revisar el plano (HTTP ${r.status}${d?.message ? `: ${d.message}` : ""})`)
  return { ok: !!d.ok, errores: Array.isArray(d.errores) ? d.errores : [], avisos: Array.isArray(d.avisos) ? d.avisos : [], resumen: d.resumen }
}

// ── Firmas: vista previa de un borrador y llamada a /mx/planos/validar ──────
const firmar = (que: string) => {
  const s = secretoLigas()
  return s ? createHmac("sha256", s).update(que).digest("base64url").slice(0, 32) : ""
}
const igual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(String(b || ""))
  return !!a && x.length === y.length && timingSafeEqual(x, y)
}
export const firmaBorrador = (slug: string) => firmar(`plano-borrador:${slug}`)
export const firmaBorradorValida = (slug: string, t: string) => igual(firmaBorrador(slug), t)
export const ligaVistaPrevia = (slug: string) => `${STORE_URL}/mx/planos/${slug}?borrador=${firmaBorrador(slug)}`

// ── Altas, lista y aprobación ───────────────────────────────────────────────
export async function slugLibre(knex: any, slug: string) {
  await asegurarBiblioteca(knex)
  if (PLANOS_NOMBRES[slug]) return false
  return !(await knex(T_BIBLIOTECA).where({ slug }).first("slug"))
}

/** Guarda un plano como borrador. Revisa forma y geometría; si la geometría falla, lo rechaza. */
export async function guardarBorrador(knex: any, crudo: unknown, o: { origen?: "manual" | "ia"; razon?: string; fuentes?: unknown } = {}) {
  const plano = normalizarPlano(crudo)
  if (!(await slugLibre(knex, plano.slug))) throw new ErrorPlano(`Ya existe un plano «${plano.slug}».`)
  const revision = await revisarEnTienda(plano)
  if (!revision.ok) throw new ErrorPlano(`El plano no pasó la revisión: ${revision.errores.slice(0, 5).join(" · ")}`)
  await knex(T_BIBLIOTECA).insert({
    slug: plano.slug,
    nombre: plano.nombre,
    categoria: plano.categoria,
    estado: "borrador",
    origen: o.origen || "manual",
    datos: JSON.stringify(plano),
    razon: o.razon ? String(o.razon).slice(0, 2000) : null,
    fuentes: o.fuentes ? JSON.stringify(o.fuentes) : null,
    revision: JSON.stringify(revision),
  })
  return { slug: plano.slug, revision }
}

/**
 * Edita un borrador desde el panel (textos, piezas, pasos). Se vuelve a revisar
 * la forma y la geometría con el motor de la tienda; si algo falla no se guarda
 * y se regresan los errores. El slug no cambia.
 */
export async function editarBorrador(knex: any, slug: string, crudo: any) {
  await asegurarBiblioteca(knex)
  const f = await knex(T_BIBLIOTECA).where({ slug }).first("slug", "estado")
  if (!f) throw new ErrorPlano("Ese plano no existe.")
  if (f.estado !== "borrador") throw new ErrorPlano("Sólo se pueden editar borradores.")
  const plano = normalizarPlano({ ...crudo, slug })
  const revision = await revisarEnTienda(plano)
  if (!revision.ok) throw new ErrorPlano(`No pasó la revisión: ${revision.errores.slice(0, 6).join(" · ")}`)
  await knex(T_BIBLIOTECA).where({ slug }).update({ nombre: plano.nombre, categoria: plano.categoria, datos: JSON.stringify(plano), revision: JSON.stringify(revision) })
  return { ok: true, slug, revision }
}

export async function listarBiblioteca(knex: any) {
  await asegurarBiblioteca(knex)
  const filas = await knex(T_BIBLIOTECA).orderByRaw("case estado when 'borrador' then 0 when 'publicado' then 1 else 2 end").orderBy("created_at", "desc").limit(200)
  return filas.map((f: any) => ({
    slug: f.slug,
    nombre: f.nombre,
    categoria: f.categoria,
    estado: f.estado,
    origen: f.origen,
    razon: f.razon,
    fuentes: f.fuentes,
    revision: f.revision,
    resumen: f.datos?.resumen,
    piezas: Array.isArray(f.datos?.piezas) ? f.datos.piezas.length : 0,
    created_at: f.created_at,
    publicado_en: f.publicado_en,
    vista_previa: ligaVistaPrevia(f.slug),
    // el plano completo, sólo de los borradores (para el editor del panel)
    datos: f.estado === "borrador" ? f.datos : undefined,
  }))
}

export async function planoDeBiblioteca(knex: any, slug: string, o: { borrador?: boolean } = {}): Promise<PlanoDB | null> {
  if (!SLUG_PLANO.test(slug)) return null
  await asegurarBiblioteca(knex)
  const q = knex(T_BIBLIOTECA).where({ slug })
  if (!o.borrador) q.where({ estado: "publicado" })
  else q.whereIn("estado", ["borrador", "publicado"])
  const f = await q.first("datos")
  return f?.datos || null
}

export async function publicadosDeBiblioteca(knex: any): Promise<PlanoDB[]> {
  await asegurarBiblioteca(knex)
  const filas = await knex(T_BIBLIOTECA).where({ estado: "publicado" }).orderBy("publicado_en", "asc").select("datos")
  return filas.map((f: any) => f.datos).filter(Boolean)
}

/** publicar | rechazar. Publicar crea el producto en la tienda (con fotos) y lo deja visible. */
export async function resolverPlano(container: any, slug: string, accion: string) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarBiblioteca(knex)
  const f = await knex(T_BIBLIOTECA).where({ slug }).first("slug", "estado")
  if (!f) throw new ErrorPlano("Ese plano no existe.")
  if (accion === "rechazar") {
    await knex(T_BIBLIOTECA).where({ slug }).update({ estado: "rechazado" })
    await cargarNombresPlanos(knex, true)
    return { ok: true, estado: "rechazado" }
  }
  if (accion !== "publicar") throw new ErrorPlano("Acción no válida.")
  await knex(T_BIBLIOTECA).where({ slug }).update({ estado: "publicado", publicado_en: knex.fn.now() })
  await cargarNombresPlanos(knex, true)
  // la lista de /planos se refresca ya (sin esperar su caché de un minuto)
  await limpiarCacheTienda(["planos-biblioteca"]).catch(() => undefined)
  let producto: string | null = null
  try {
    const r = await sincronizarProductosPlanos(container, { publicar: true, solo: [slug] })
    producto = r.creados || r.actualizados ? "listo" : "pendiente"
  } catch (e) {
    container.resolve("logger").warn(`[planos-biblioteca] producto de ${slug}: ${(e as Error).message}`)
    producto = "pendiente"
  }
  return { ok: true, estado: "publicado", producto, url: `${STORE_URL}/mx/planos/${slug}` }
}
