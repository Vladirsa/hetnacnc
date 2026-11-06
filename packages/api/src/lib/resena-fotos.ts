// Fotos en las reseñas de producto: el cliente sube hasta 3 fotos de lo que
// recibió. Una reseña con foto convence mucho más que una con puro texto.
//
// Se guardan en la base (tabla hetna_resena_foto), ya reducidas en el navegador
// a ~1280 px en JPEG, como las fotos del foro. Primero se suben sueltas
// (review_id vacío) y se ligan a la reseña al publicarla; las sueltas de más de
// un día se borran. Sólo se muestran cuando la reseña ya está publicada (pasó
// la moderación).
import { randomBytes } from "crypto"

export const T_FOTO = "hetna_resena_foto"
export const MAX_FOTOS_RESENA = 3
const MAX_BYTES = 1_500_000
const TIPOS = new Set(["image/jpeg", "image/png", "image/webp"])

let lista = false
export async function asegurarTablaFotos(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_FOTO))) {
    await knex.schema.createTable(T_FOTO, (t: any) => {
      t.text("id").primary()
      t.text("customer_id").notNullable().index()
      t.text("review_id").nullable().index()
      t.text("tipo").notNullable()
      t.binary("datos").notNullable()
      t.integer("orden").notNullable().defaultTo(0)
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  lista = true
}

/** Guarda una foto suelta (data URL base64). Devuelve su id. */
export async function guardarFotoResena(knex: any, customerId: string, dataUrl: string): Promise<string> {
  const m = String(dataUrl || "").match(/^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/)
  if (!m || !TIPOS.has(m[1])) throw Object.assign(new Error("Sube una foto JPG, PNG o WEBP."), { status: 400 })
  const datos = Buffer.from(m[2], "base64")
  if (!datos.length || datos.length > MAX_BYTES) throw Object.assign(new Error("La foto es muy pesada (máximo 1.5 MB)."), { status: 400 })
  // Firma real del archivo, no sólo lo que dice el navegador
  const esJpg = datos[0] === 0xff && datos[1] === 0xd8
  const esPng = datos[0] === 0x89 && datos[1] === 0x50
  const esWebp = datos.subarray(0, 4).toString() === "RIFF" && datos.subarray(8, 12).toString() === "WEBP"
  if (!esJpg && !esPng && !esWebp) throw Object.assign(new Error("El archivo no es una imagen."), { status: 400 })

  await asegurarTablaFotos(knex)
  // Limpieza: fotos que se subieron y nunca se ligaron a una reseña
  await knex(T_FOTO).whereNull("review_id").where("created_at", "<", new Date(Date.now() - 86_400_000)).delete().catch(() => undefined)
  const sueltas = await knex(T_FOTO).where({ customer_id: customerId }).whereNull("review_id").count("* as n").first()
  if (Number(sueltas?.n || 0) >= 10) throw Object.assign(new Error("Subiste demasiadas fotos. Publica tu reseña primero."), { status: 429 })

  const id = `rfoto_${randomBytes(12).toString("hex")}`
  await knex(T_FOTO).insert({ id, customer_id: customerId, tipo: esJpg ? "image/jpeg" : esPng ? "image/png" : "image/webp", datos })
  return id
}

/** Liga las fotos sueltas del cliente a su reseña recién creada. */
export async function ligarFotos(knex: any, customerId: string, reviewId: string, ids: unknown) {
  const lista = (Array.isArray(ids) ? ids : []).map(String).filter((x) => /^rfoto_[a-f0-9]{24}$/.test(x)).slice(0, MAX_FOTOS_RESENA)
  if (!lista.length) return 0
  await asegurarTablaFotos(knex)
  let n = 0
  for (const [i, id] of lista.entries()) {
    n += await knex(T_FOTO).where({ id, customer_id: customerId }).whereNull("review_id").update({ review_id: reviewId, orden: i })
  }
  return n
}

/** ids de foto por reseña, en orden. */
export async function fotosDeResenas(knex: any, reviewIds: string[]): Promise<Map<string, string[]>> {
  const mapa = new Map<string, string[]>()
  if (!reviewIds.length) return mapa
  try {
    await asegurarTablaFotos(knex)
    const filas = await knex(T_FOTO).whereIn("review_id", reviewIds).orderBy("orden").select("id", "review_id")
    for (const f of filas) mapa.set(f.review_id, [...(mapa.get(f.review_id) || []), f.id])
  } catch {
    /* sin fotos */
  }
  return mapa
}

export async function leerFotoResena(knex: any, id: string) {
  if (!/^rfoto_[a-f0-9]{24}$/.test(id)) return null
  await asegurarTablaFotos(knex)
  return knex(T_FOTO).where({ id }).whereNotNull("review_id").first("tipo", "datos", "review_id")
}
