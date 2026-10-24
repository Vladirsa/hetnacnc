import { StoreOffer } from "./buybox"

// Descuento por volumen: "llevando 3 o más, cada pieza te sale en $450".
//
// No es una promoción ni un cupón. Es precio escalonado nativo de Medusa: el
// taller guarda, en la misma oferta, un precio extra con `min_quantity`. Cuando
// el carrito calcula el precio del renglón manda la cantidad en el contexto
// (`quantity: item.quantity`), el módulo de precios se queda con los precios
// cuyo rango de cantidad incluye esa cifra, y entre los que empatan gana el más
// barato. Así que a partir de 3 piezas el renglón se cobra al precio del
// escalón, solo, sin que el carrito tenga que hacer nada.
//
// Por eso esto es sólo lectura: lo único que falta es ENSEÑARLO, porque un
// descuento que el cliente no sabe que existe no lo hace comprar más.

export type Escalon = {
  // Desde cuántas piezas aplica.
  desde: number
  precio: number
  moneda: string
  // Cuánto se ahorra por pieza contra el precio de una sola, en porcentaje.
  porcentaje: number
}

type PrecioDeOferta = {
  amount?: number | string | null
  currency_code?: string | null
  min_quantity?: number | string | null
  max_quantity?: number | string | null
}

const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Los escalones de una oferta, de menos a más piezas. Devuelve vacío si el
// taller no puso ninguno, que es el caso normal.
export const escalonesDeOferta = (offer: StoreOffer): Escalon[] => {
  const precios = ((offer as unknown as { prices?: PrecioDeOferta[] }).prices ||
    []) as PrecioDeOferta[]
  if (!precios.length) return []

  // La moneda que manda es la del precio que el carrito ya está cobrando: si
  // la oferta trae precios en varias monedas, mezclarlas diría una cifra que
  // nadie va a pagar.
  const moneda = (
    offer.calculated_price?.currency_code ||
    precios.find((p) => p.currency_code)?.currency_code ||
    "mxn"
  ).toLowerCase()

  const deLaMoneda = precios.filter(
    (p) => String(p.currency_code || "").toLowerCase() === moneda
  )

  // El precio de una pieza: el que no pide cantidad mínima, o la pide de 1.
  const unitarios = deLaMoneda
    .filter((p) => {
      const min = numero(p.min_quantity)
      return min === null || min <= 1
    })
    .map((p) => numero(p.amount))
    .filter((n): n is number => n !== null && n > 0)

  if (!unitarios.length) return []
  const base = Math.min(...unitarios)

  const escalones: Escalon[] = []
  for (const p of deLaMoneda) {
    const desde = numero(p.min_quantity)
    const precio = numero(p.amount)
    if (desde === null || desde < 2) continue
    if (precio === null || precio <= 0) continue
    // Un escalón que no baja el precio no es una oferta y no se anuncia.
    if (precio >= base) continue
    escalones.push({
      desde,
      precio,
      moneda,
      porcentaje: Math.round(((base - precio) / base) * 100),
    })
  }

  // Si hay dos escalones para la misma cantidad gana el más barato, que es el
  // que el módulo de precios va a cobrar.
  const porCantidad = new Map<number, Escalon>()
  for (const e of escalones) {
    const previo = porCantidad.get(e.desde)
    if (!previo || e.precio < previo.precio) porCantidad.set(e.desde, e)
  }

  return [...porCantidad.values()].sort((a, b) => a.desde - b.desde)
}

// El escalón que vale la pena anunciar en una tarjeta, donde sólo cabe uno: el
// primero que alcanza el cliente.
export const primerEscalon = (offer: StoreOffer): Escalon | null =>
  escalonesDeOferta(offer)[0] ?? null
