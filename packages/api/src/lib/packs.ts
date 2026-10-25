// @ts-nocheck
// "Llévate 3 de Bujes y el tercero va gratis": los packs por categoría de cada
// taller.
//
// Importante para no buscarlo donde no está: esto NO es un producto nuevo ni un
// módulo propio. Es una promoción `buyget` de Medusa, que es justo esta forma:
//
//   buy_rules      -> qué cuenta para juntar (aquí: una categoría)
//   buy_rules_min_quantity -> cuántas hay que llevar
//   target_rules   -> a qué piezas se les aplica el descuento
//   apply_to_quantity -> a cuántas
//   value + type   -> cuánto se les baja (100% = gratis)
//
// Y Medusa excluye del lado "target" las piezas que ya usó para cumplir el lado
// "buy", así que "lleva 2 y la 3ª gratis" se expresa con min_quantity 2 y
// apply_to_quantity 1, no con 3 y 3.
//
// Mercur ya limita el descuento al taller dueño de la promoción
// (prepareSellerAdjustmentsFromPromotionActionsStep compara el seller de la
// promoción contra el de la oferta del renglón), así que el pack de un taller
// no le regala nada a otro.
//
// Lo que faltaba era enseñarlo: un pack que el cliente no sabe que existe no lo
// hace llevar la tercera pieza.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// El atributo con el que Medusa representa "la categoría del producto" en las
// reglas de promoción. Es el que ofrece el panel de Mercur como
// `product_category`.
const ATRIBUTO_CATEGORIA = "items.product.categories.id"

const valoresDe = (regla) =>
  (regla?.values || [])
    .map((v) => (typeof v === "string" ? v : v?.value))
    .filter((v) => typeof v === "string" && v.length > 0)

// Una promoción vencida o que todavía no empieza no se anuncia. Sin campaña no
// hay ventana que revisar, y entonces está vigente.
const vigente = (promo, ahora) => {
  const campana = promo.campaign
  if (!campana) return true
  const inicio = campana.starts_at ? new Date(campana.starts_at).getTime() : null
  const fin = campana.ends_at ? new Date(campana.ends_at).getTime() : null
  if (inicio !== null && Number.isFinite(inicio) && ahora < inicio) return false
  if (fin !== null && Number.isFinite(fin) && ahora > fin) return false
  return true
}

const CAMPOS_PROMOCION = [
  "id",
  "type",
  "status",
  "is_automatic",
  "campaign.starts_at",
  "campaign.ends_at",
  "application_method.type",
  "application_method.value",
  "application_method.target_type",
  "application_method.currency_code",
  "application_method.buy_rules_min_quantity",
  "application_method.apply_to_quantity",
  "application_method.buy_rules.attribute",
  "application_method.buy_rules.operator",
  "application_method.buy_rules.values.value",
  "application_method.target_rules.attribute",
  "application_method.target_rules.operator",
  "application_method.target_rules.values.value",
]

export type Pack = {
  promocion_id: string
  seller_id: string
  // Categorías que cuentan para juntar las piezas.
  categorias: { id: string; nombre: string | null }[]
  // Cuántas hay que llevar antes de que aplique.
  lleva: number
  // A cuántas piezas se les baja el precio.
  recibe: number
  // "percentage" o "fixed".
  tipo: string
  valor: number
  moneda: string | null
  // true cuando el descuento es del 100%: ahí se dice "gratis" y no "−100%".
  gratis: boolean
}

// Los packs de un puñado de talleres, en dos consultas.
//
// Se entra por el enlace `promotion_seller` -- el mismo que usa el panel de
// vendedor para listar "mis promociones" -- porque lo que se pide aquí es "de
// estos talleres, sus packs", no "de este pack, su taller".
export async function packsDeTalleres(container, sellerIds: string[]): Promise<Pack[]> {
  if (!sellerIds.length) return []

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: enlaces } = await query.graph({
    entity: "promotion_seller",
    fields: ["promotion_id", "seller_id"],
    filters: { seller_id: sellerIds },
  })

  const tallerDePromocion = new Map<string, string>()
  for (const e of enlaces || []) {
    if (e?.promotion_id && e?.seller_id) tallerDePromocion.set(e.promotion_id, e.seller_id)
  }
  if (!tallerDePromocion.size) return []

  const { data: promociones } = await query.graph({
    entity: "promotion",
    fields: CAMPOS_PROMOCION,
    filters: { id: [...tallerDePromocion.keys()] },
  })

  const ahora = Date.now()
  const packs: Pack[] = []
  const idsCategoria = new Set<string>()

  for (const promo of promociones || []) {
    if (!promo?.id) continue
    const sellerId = tallerDePromocion.get(promo.id)
    if (!sellerId) continue

    if (promo.type !== "buyget") continue
    // Sólo las automáticas: una promoción con código no se anuncia sola, hay
    // que escribir el código, y anunciar el pack sin decirlo sería mentir.
    if (!promo.is_automatic) continue
    if (promo.status && promo.status !== "active") continue
    if (!vigente(promo, ahora)) continue

    const metodo = promo.application_method
    if (!metodo) continue

    const lleva = Number(metodo.buy_rules_min_quantity ?? 0)
    const recibe = Number(metodo.apply_to_quantity ?? 0)
    const valor = Number(metodo.value ?? 0)
    if (!(lleva > 0) || !(recibe > 0) || !(valor > 0)) continue

    // Las categorías salen del lado "buy": es lo que el cliente tiene que
    // juntar, y por lo tanto lo único que le sirve saber.
    const categorias: string[] = []
    for (const regla of metodo.buy_rules || []) {
      if (regla?.attribute !== ATRIBUTO_CATEGORIA) continue
      for (const v of valoresDe(regla)) categorias.push(v)
    }
    // Sin categoría esto no es un pack por categoría: puede ser un 2x1 sobre un
    // producto suelto, y eso lo enseña la ficha de ese producto, no aquí.
    if (!categorias.length) continue

    for (const c of categorias) idsCategoria.add(c)

    packs.push({
      promocion_id: promo.id,
      seller_id: sellerId,
      categorias: categorias.map((id) => ({ id, nombre: null })),
      lleva,
      recibe,
      tipo: metodo.type || "percentage",
      valor,
      moneda: metodo.currency_code ?? null,
      gratis: (metodo.type || "percentage") === "percentage" && valor >= 100,
    })
  }

  if (!packs.length) return []

  // Los nombres de las categorías, en una sola consulta para todos los packs.
  // Sin el nombre el aviso diría "lleva 3 de pcat_01J..." y eso no se lo cree
  // nadie.
  const { data: categorias } = await query.graph({
    entity: "product_category",
    fields: ["id", "name"],
    filters: { id: [...idsCategoria] },
  })
  const nombre = new Map<string, string>()
  for (const c of categorias || []) {
    if (c?.id) nombre.set(c.id, c.name || "")
  }

  for (const pack of packs) {
    for (const cat of pack.categorias) {
      cat.nombre = nombre.get(cat.id) || null
    }
  }

  return packs
}
