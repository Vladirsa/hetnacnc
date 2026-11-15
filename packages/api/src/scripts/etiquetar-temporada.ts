// @ts-nocheck
// Poner una etiqueta de temporada (navidad, buen-fin, dia-de-muertos…) a muchos
// productos de una vez, según palabras de su nombre o descripción.
//
// Uso (en /root/hetnacnc/packages/api):
//   1) VER qué productos entrarían (no cambia nada):
//        NODE_ENV=production bunx medusa exec ./src/scripts/etiquetar-temporada.ts
//   2) Ponerles la etiqueta:
//        APLICAR=1 NODE_ENV=production bunx medusa exec ./src/scripts/etiquetar-temporada.ts
//   Opciones:
//        ETIQUETA=navidad                  (por defecto navidad)
//        PALABRAS="navidad,reno,esfera"    (en vez de las de abajo)
//        EXCLUIR="cnc,fresa,router"        (si el nombre trae alguna, no entra)
//        QUITAR=1                          (quita la etiqueta en lugar de ponerla)
//
// Es seguro repetirlo: no duplica etiquetas.
import { randomBytes } from "crypto"
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const NAVIDAD = [
  "navidad", "navideñ", "christmas", "xmas", "santa claus", "reno navideño", "renos", "pino navideño", "arbolito", "árbol de navidad",
  "nacimiento de jesus", "nacimiento navideño", "belén", "belen", "esfera navideña", "esferas navideñas", "estrella de belén", "corona navideña", "muñeco de nieve", "copo de nieve",
  "noche buena", "nochebuena", "regalo", "adorno", "litofan", "llavero", "letrero", "caja de regalo", "calendario de adviento",
]

const sinAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

export default async function etiquetarTemporada({ container }: ExecArgs) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const log = (m: string) => console.log("[etiquetar] " + m)
  const etiqueta = (process.env.ETIQUETA || "navidad").trim().toLowerCase()
  const palabras = (process.env.PALABRAS ? process.env.PALABRAS.split(",") : NAVIDAD).map((x) => sinAcento(x.trim())).filter(Boolean)
  const excluir = (process.env.EXCLUIR || "").split(",").map((x) => sinAcento(x.trim())).filter(Boolean)
  const aplicar = process.env.APLICAR === "1"
  const quitar = process.env.QUITAR === "1"

  const productos = await knex("product")
    .whereNull("deleted_at")
    .whereRaw("coalesce(metadata->>'producto_creditos_3d', 'false') <> 'true'")
    .select("id", "title", "status", "description")
  const texto = (p: any) => sinAcento(`${p.title || ""} ${String(p.description || "").replace(/<[^>]+>/g, " ")}`)
  const elegidos = productos.filter((p: any) => {
    const t = texto(p)
    const n = sinAcento(p.title || "")
    // Palabra completa al inicio ("reno" no entra por "terreno"; "navideñ" sí cubre navideño/navideña)
    const esta = (w: string) => new RegExp(`(^|[^a-z0-9ñ])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(t)
    return palabras.some(esta) && !excluir.some((w) => n.includes(w))
  })

  // Etiqueta (se crea si no existe)
  let tag = await knex("product_tag").whereNull("deleted_at").whereRaw("lower(value) = ?", [etiqueta]).first()
  const yaTienen = new Set(tag ? (await knex("product_tags").where({ product_tag_id: tag.id }).pluck("product_id")) : [])

  log(`Etiqueta: "${etiqueta}" · palabras: ${palabras.length} · productos que coinciden: ${elegidos.length} (de ${productos.length}) · con la etiqueta hoy: ${yaTienen.size}`)
  for (const p of elegidos) log(`  ${yaTienen.has(p.id) ? "✓ ya la tiene" : quitar ? "  (no la tiene)" : "+ nueva     "} · ${p.status === "published" ? "" : `[${p.status}] `}${String(p.title).slice(0, 90)}`)

  if (!aplicar) {
    log("Nada cambió. Si la lista está bien, corre lo mismo con APLICAR=1 adelante. Si sobra alguno, agrégalo con EXCLUIR=\"palabra\".")
    return
  }
  if (quitar) {
    if (!tag) return log("Esa etiqueta no existe: nada que quitar.")
    const n = await knex("product_tags").where({ product_tag_id: tag.id }).whereIn("product_id", elegidos.map((p: any) => p.id)).del()
    return log(`✓ Etiqueta quitada a ${n} productos.`)
  }
  if (!tag) {
    tag = { id: `ptag_${randomBytes(12).toString("hex").toUpperCase()}`, value: etiqueta, created_at: new Date(), updated_at: new Date() }
    await knex("product_tag").insert(tag)
    log(`Etiqueta "${etiqueta}" creada.`)
  }
  const nuevos = elegidos.filter((p: any) => !yaTienen.has(p.id))
  if (nuevos.length) await knex("product_tags").insert(nuevos.map((p: any) => ({ product_id: p.id, product_tag_id: tag.id }))).onConflict(["product_id", "product_tag_id"]).ignore()
  log(`✓ Listo: ${nuevos.length} productos con la etiqueta nueva (${elegidos.length - nuevos.length} de la lista ya la tenían).`)
  log(`Revisa en Social Hub → Fábrica → Fechas especiales que aparezcan con sus fotos.`)
}
