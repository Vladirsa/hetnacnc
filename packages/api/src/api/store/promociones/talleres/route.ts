import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// GET /store/promociones/talleres?seller_ids=sel_1,sel_2
//
// Las promociones automáticas de cada taller, para poder decirle al cliente
// "te faltan $180 para el envío gratis de SASA" mientras todavía tiene el
// carrito abierto. Un umbral que nadie ve no cambia la conducta de nadie: el
// backend ya sabe aplicar el descuento, lo que faltaba era enseñarlo.
//
// Mercur enlaza promoción ↔ taller con el enlace `promotion_seller`, el mismo
// que usa su panel de vendedor para listar "mis promociones" (lo filtra por
// `seller_id` sobre `promotion_id`). Aquí se lee ese enlace al revés: de un
// puñado de talleres a sus promociones, en UNA sola llamada, porque esto se
// pide desde el carrito y ahí la velocidad se nota.
//
// Sobre las unidades: Medusa v2 guarda los totales en la moneda, no en
// centavos, así que el umbral se devuelve tal como está y el storefront lo
// compara directo contra `item.subtotal`. No se multiplica ni se divide nada.

// Los atributos de regla que representan "cuánto lleva en el carrito". Medusa
// resuelve el atributo de la regla como una ruta dentro del carrito, y estos
// cuatro vienen en el contexto con el que se calculan las promociones.
const ATRIBUTOS_DE_MONTO = new Set([
  "item_total",
  "item_subtotal",
  "subtotal",
  "total",
])

type Regla = {
  attribute?: string
  operator?: string
  values?: ({ value?: string } | string)[]
}

type Promocion = {
  id?: string
  type?: string
  status?: string
  is_automatic?: boolean
  rules?: Regla[]
  campaign?: { starts_at?: string | Date | null; ends_at?: string | Date | null } | null
  application_method?: {
    type?: string
    value?: number
    target_type?: string
    currency_code?: string | null
    buy_rules_min_quantity?: number | null
  } | null
}

type EnvioGratis = {
  umbral: number
  // Contra qué total del carrito se compara el umbral. Se devuelve porque el
  // carrito tiene que medir el avance con la MISMA cifra que el backend va a
  // evaluar; si midiera con otra, la barra diría una cosa y el cobro otra.
  atributo: string
  moneda: string | null
  promocion_id: string
}
type Volumen = {
  min_piezas: number
  tipo: string
  valor: number
  moneda: string | null
  promocion_id: string
}

const valoresDe = (regla: Regla): string[] =>
  (regla.values || [])
    .map((v) => (typeof v === "string" ? v : v?.value))
    .filter((v): v is string => typeof v === "string" && v.length > 0)

// El umbral de monto de una promoción: el menor de los valores de la primera
// regla que compare un total del carrito "de aquí para arriba".
const umbralDe = (promo: Promocion): { umbral: number; atributo: string } | null => {
  for (const regla of promo.rules || []) {
    if (!regla.attribute || !ATRIBUTOS_DE_MONTO.has(regla.attribute)) continue
    if (regla.operator !== "gte" && regla.operator !== "gt") continue
    const numeros = valoresDe(regla)
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0)
    if (numeros.length) {
      return { umbral: Math.min(...numeros), atributo: regla.attribute }
    }
  }
  return null
}

// Una promoción vencida o que todavía no empieza no se anuncia. Sin campaña no
// hay ventana que revisar, y entonces está vigente.
const vigente = (promo: Promocion, ahora: number): boolean => {
  const campana = promo.campaign
  if (!campana) return true
  const inicio = campana.starts_at ? new Date(campana.starts_at).getTime() : null
  const fin = campana.ends_at ? new Date(campana.ends_at).getTime() : null
  if (inicio !== null && Number.isFinite(inicio) && ahora < inicio) return false
  if (fin !== null && Number.isFinite(fin) && ahora > fin) return false
  return true
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const crudo = String(req.query.seller_ids || "")
  const sellerIds = crudo
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30)

  if (!sellerIds.length) {
    return res.json({ talleres: {} })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: enlaces } = await query.graph({
    entity: "promotion_seller",
    fields: ["promotion_id", "seller_id"],
    filters: { seller_id: sellerIds },
  })

  const porPromocion = new Map<string, string>()
  for (const enlace of (enlaces || []) as unknown as {
    promotion_id?: string
    seller_id?: string
  }[]) {
    if (enlace.promotion_id && enlace.seller_id) {
      porPromocion.set(enlace.promotion_id, enlace.seller_id)
    }
  }

  if (!porPromocion.size) {
    return res.json({ talleres: {} })
  }

  const { data: promociones } = await query.graph({
    entity: "promotion",
    fields: [
      "id",
      "type",
      "status",
      "is_automatic",
      "rules.attribute",
      "rules.operator",
      "rules.values.value",
      "campaign.starts_at",
      "campaign.ends_at",
      "application_method.type",
      "application_method.value",
      "application_method.target_type",
      "application_method.currency_code",
      "application_method.buy_rules_min_quantity",
    ],
    filters: { id: [...porPromocion.keys()] },
  })

  const ahora = Date.now()
  const talleres: Record<
    string,
    { envio_gratis: EnvioGratis | null; volumen: Volumen[] }
  > = {}

  const deTaller = (id: string) => {
    if (!talleres[id]) talleres[id] = { envio_gratis: null, volumen: [] }
    return talleres[id]
  }

  for (const promo of (promociones || []) as unknown as Promocion[]) {
    if (!promo.id) continue
    const sellerId = porPromocion.get(promo.id)
    if (!sellerId) continue

    // Sólo las automáticas: una promoción con código no se anuncia sola, hay
    // que escribir el código, y prometer el envío gratis sin decir el código
    // sería mentirle al cliente.
    if (!promo.is_automatic) continue
    if (promo.status && promo.status !== "active") continue
    if (!vigente(promo, ahora)) continue

    const metodo = promo.application_method
    if (!metodo) continue

    if (metodo.target_type === "shipping_methods") {
      const regla = umbralDe(promo)
      if (!regla) continue
      const grupo = deTaller(sellerId)
      // Si el taller tiene varios, gana el umbral más bajo: es el que el
      // cliente alcanza primero y el único que le sirve saber.
      if (!grupo.envio_gratis || regla.umbral < grupo.envio_gratis.umbral) {
        grupo.envio_gratis = {
          umbral: regla.umbral,
          atributo: regla.atributo,
          moneda: metodo.currency_code ?? null,
          promocion_id: promo.id,
        }
      }
      continue
    }

    const minPiezas = metodo.buy_rules_min_quantity
    if (promo.type === "buyget" && typeof minPiezas === "number" && minPiezas > 0) {
      deTaller(sellerId).volumen.push({
        min_piezas: minPiezas,
        tipo: metodo.type || "percentage",
        valor: Number(metodo.value ?? 0),
        moneda: metodo.currency_code ?? null,
        promocion_id: promo.id,
      })
    }
  }

  for (const grupo of Object.values(talleres)) {
    grupo.volumen.sort((a, b) => a.min_piezas - b.min_piezas)
  }

  res.json({ talleres })
}
