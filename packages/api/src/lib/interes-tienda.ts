// Interés en la tienda (/mx/tienda): lo que dice qué stock conseguir primero.
//
//   avisame           Alguien quiere que le avisen cuando haya productos en una
//                     categoría que hoy está "Próximamente". Se guarda con su
//                     contacto (correo o celular) para avisarle dentro de HETNA.
//   busqueda_cotizar  Alguien buscó algo que no hay y pidió cotizarlo desde el
//                     estado vacío de la búsqueda (se guarda el término).
//
// Todo queda en hetna_interes_tienda. El resumen por categoría y por término
// lo da /admin/hetna-interes-tienda.
import { correosDeLaCasa } from "./cuentas-casa"
import { sendEmail } from "./resend"

export const T_INTERES = "hetna_interes_tienda"
export const TIPOS_INTERES = ["avisame", "busqueda_cotizar"] as const
type TipoInteres = (typeof TIPOS_INTERES)[number]

// Las categorías de /mx/tienda (mismas claves que lib/hetna/tienda.ts del storefront)
export const CATEGORIAS_TIENDA = [
  "disenos-digitales",
  "servicios-cam",
  "creditos-3d",
  "maquinas-cnc",
  "herramientas-materiales",
] as const

export class ErrorInteres extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

let lista = false
async function asegurarTabla(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_INTERES))) {
    await knex.schema.createTable(T_INTERES, (t: any) => {
      t.bigIncrements("id").primary()
      t.text("tipo").notNullable().index()
      t.text("categoria").nullable().index()
      t.text("termino").nullable()
      t.text("correo").nullable()
      t.text("telefono").nullable()
      t.timestamp("avisado_en", { useTz: true }).nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  lista = true
}

const limpio = (v: unknown, n: number) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n)
const CORREO = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

// Freno por IP: 6 avisos y 60 búsquedas por hora
const intentos = new Map<string, number[]>()
function excedido(clave: string, max: number) {
  const ahora = Date.now()
  const l = (intentos.get(clave) || []).filter((t) => ahora - t < 3600_000)
  l.push(ahora)
  intentos.set(clave, l)
  if (intentos.size > 5000) intentos.clear()
  return l.length > max
}

export async function guardarInteres(knex: any, b: any, ip: string) {
  if (limpio(b?.sitio_web, 200)) return { ok: true } // trampa para robots: se finge éxito
  const tipo = String(b?.tipo || "") as TipoInteres
  if (!(TIPOS_INTERES as readonly string[]).includes(tipo)) throw new ErrorInteres("Tipo no válido.")

  if (tipo === "busqueda_cotizar") {
    if (excedido(`b:${ip}`, 60)) return { ok: true }
    const termino = limpio(b?.termino, 120)
    if (!termino) throw new ErrorInteres("Falta el término.")
    await asegurarTabla(knex)
    await knex(T_INTERES).insert({ tipo, termino: termino.toLowerCase() })
    return { ok: true }
  }

  // avisame
  const categoria = limpio(b?.categoria, 60)
  if (!(CATEGORIAS_TIENDA as readonly string[]).includes(categoria)) throw new ErrorInteres("Categoría no válida.")
  const contacto = limpio(b?.contacto, 120)
  const correo = CORREO.test(contacto) ? contacto.toLowerCase() : ""
  const digitos = contacto.replace(/\D/g, "")
  const telefono = !correo && digitos.length >= 10 && digitos.length <= 13 ? digitos : ""
  if (!correo && !telefono) throw new ErrorInteres("Escribe tu correo o tu celular a 10 dígitos.")
  if (excedido(`a:${ip}`, 6)) throw new ErrorInteres("Ya quedaste anotado. Te avisamos en cuanto haya productos.", 429)
  await asegurarTabla(knex)
  // Una sola vez por contacto y categoría
  const ya = await knex(T_INTERES)
    .where({ tipo, categoria })
    .andWhere((q: any) => (correo ? q.where({ correo }) : q.where({ telefono })))
    .first("id")
  if (ya) return { ok: true, repetido: true }
  await knex(T_INTERES).insert({ tipo, categoria, correo: correo || null, telefono: telefono || null })

  const para = String(process.env.CONTROL_AVISOS_PARA || correosDeLaCasa()[0] || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
  const total = await knex(T_INTERES).where({ tipo, categoria }).count({ n: "*" }).first()
  for (const to of para) {
    await sendEmail({
      to,
      subject: `Tienda: alguien quiere ${categoria} (${Number(total?.n) || 1} en espera)`,
      html: `<div style="font-family:Arial,sans-serif"><p>Pidieron que les avisemos cuando haya productos en <b>${esc(categoria)}</b>.</p><p>Contacto: <b>${esc(correo || telefono)}</b></p><p>Ya son <b>${Number(total?.n) || 1}</b> personas esperando esa categoría.</p></div>`,
    }).catch(() => null)
  }
  return { ok: true }
}

/** Resumen para HETNA: espera por categoría y lo más buscado sin resultados. */
export async function resumenInteres(knex: any) {
  await asegurarTabla(knex)
  const [porCategoria, terminos, cotizadas] = await Promise.all([
    knex(T_INTERES).where({ tipo: "avisame" }).groupBy("categoria").select("categoria").count({ n: "*" }).orderBy("n", "desc"),
    knex(T_INTERES).where({ tipo: "busqueda_cotizar" }).groupBy("termino").select("termino").count({ n: "*" }).orderBy("n", "desc").limit(30),
    knex(T_INTERES).where({ tipo: "busqueda_cotizar" }).count({ n: "*" }).first(),
  ])
  return {
    avisame_por_categoria: porCategoria.map((r: any) => ({ categoria: r.categoria, personas: Number(r.n) })),
    cotizaciones_desde_busqueda: Number(cotizadas?.n) || 0,
    terminos_mas_buscados: terminos.map((r: any) => ({ termino: r.termino, veces: Number(r.n) })),
  }
}
