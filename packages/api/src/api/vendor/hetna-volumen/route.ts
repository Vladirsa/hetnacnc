// @ts-nocheck
// Pantalla simple de "Precios por cantidad" del taller (/seller > Precios por cantidad).
//   GET  -> sus ofertas con el precio de una pieza y el escalón que tenga puesto.
//   POST -> { offer_id, desde (número o null), precio }
//
// Por qué existe esta ruta y no se usa el panel de Mercur: su API de ofertas SÍ
// acepta `min_quantity` en los precios, pero su pantalla no tiene el campo para
// escribirlo -- sólo lo lee. Así que el mecanismo existe y lo único que faltaba
// era una forma de capturarlo. Igual que pasó con "envío gratis desde".
//
// El taller no ve juegos de precios, reglas ni monedas: ve "desde cuántas
// piezas" y "a cuánto la pieza".
//
// CUIDADO al escribir: `upsertOfferPricesWorkflow` REEMPLAZA los precios de la
// oferta. Todo precio suyo que no se vuelva a mandar se borra. Por eso aquí
// siempre se leen los de hoy y se reenvían con su `id`: mandar sólo el escalón
// dejaría a la oferta sin precio base, es decir, sin precio.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { upsertOfferPricesWorkflow } from "@mercurjs/core/workflows"

const MONEDA = "mxn"

const numero = (v) => {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const CAMPOS = [
  "id",
  "seller_id",
  "product.id",
  "product.title",
  "product_variant.title",
  "prices.id",
  "prices.amount",
  "prices.currency_code",
  "prices.min_quantity",
  "prices.max_quantity",
]

async function cargarOfertas(container, sellerId, offerId) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "offer",
    fields: CAMPOS,
    filters: offerId ? { id: offerId } : { seller_id: sellerId },
  })
  return data || []
}

// Separa los precios de una oferta en "el de una pieza" y "los escalones".
// Sólo cuenta la moneda de la tienda: mezclar monedas diría una cifra que nadie
// va a pagar.
function partirPrecios(oferta) {
  const precios = (oferta.prices || []).filter(
    (p) => p && String(p.currency_code || "").toLowerCase() === MONEDA
  )
  const base = precios.find((p) => {
    const min = numero(p.min_quantity)
    return min === null || min <= 1
  })
  const escalones = precios
    .filter((p) => {
      const min = numero(p.min_quantity)
      return min !== null && min >= 2
    })
    .sort((a, b) => numero(a.min_quantity) - numero(b.min_quantity))

  return { precios, base, escalones }
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = req.seller_context?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })

  const ofertas = await cargarOfertas(req.scope, sellerId)

  const lista = ofertas.map((oferta) => {
    const { base, escalones } = partirPrecios(oferta)
    const primero = escalones[0]
    return {
      offer_id: oferta.id,
      titulo:
        oferta.product?.title ||
        oferta.product_variant?.title ||
        "Producto sin nombre",
      variante: oferta.product_variant?.title || null,
      precio: base ? Number(base.amount) : null,
      desde: primero ? numero(primero.min_quantity) : null,
      precio_escalon: primero ? Number(primero.amount) : null,
    }
  })

  // Primero las que ya tienen escalón, para que el taller vea de un golpe lo
  // que ya ofreció; después las demás, por nombre.
  lista.sort((a, b) => {
    if (!!a.desde !== !!b.desde) return a.desde ? -1 : 1
    return a.titulo.localeCompare(b.titulo, "es")
  })

  return res.json({ ofertas: lista, moneda: MONEDA })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = req.seller_context?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })

  const cuerpo = req.body || {}
  const offerId = typeof cuerpo.offer_id === "string" ? cuerpo.offer_id : ""
  if (!offerId) {
    return res.status(400).json({ message: "Falta la oferta." })
  }

  const [oferta] = await cargarOfertas(req.scope, sellerId, offerId)
  if (!oferta) {
    return res.status(404).json({ message: "No encontramos esa oferta." })
  }
  // Se comprueba el dueño aquí mismo y no sólo en el filtro: un taller no puede
  // tocar los precios de otro ni mandando el id a mano.
  if (oferta.seller_id !== sellerId) {
    return res.status(403).json({ message: "Esa oferta no es de tu taller." })
  }

  const { base, escalones } = partirPrecios(oferta)
  if (!base) {
    return res.status(409).json({
      message:
        "Esta oferta todavía no tiene precio de una pieza. Ponlo primero en Ofertas.",
    })
  }
  const precioBase = Number(base.amount)

  const quitar = cuerpo.desde === null || cuerpo.desde === "" || cuerpo.desde === undefined
  let desde = null
  let precio = null

  if (!quitar) {
    desde = numero(cuerpo.desde)
    precio = numero(cuerpo.precio)

    if (desde === null || !Number.isInteger(desde) || desde < 2 || desde > 100000) {
      return res.status(400).json({
        message: "La cantidad mínima debe ser un número entero de 2 o más.",
      })
    }
    if (precio === null || precio <= 0) {
      return res.status(400).json({ message: "Escribe el precio por pieza del escalón." })
    }
    // Un escalón que no baja el precio no es una oferta: se rechaza en vez de
    // guardarlo y dejar que el storefront decida no enseñarlo.
    if (precio >= precioBase) {
      return res.status(400).json({
        message: `El precio por cantidad tiene que ser MENOR a ${precioBase}, que es lo que cuesta una pieza.`,
      })
    }
  }

  // El precio base se reenvía con su id para que se actualice en su lugar. Si
  // se omitiera, el workflow lo borraría y la oferta se quedaría sin precio.
  const precios = [
    { id: base.id, amount: precioBase, currency_code: MONEDA },
  ]
  if (!quitar) {
    // Si ya había un escalón se reusa su id: así se cambia el de antes en vez
    // de dejar dos escalones peleándose por la misma cantidad.
    const previo = escalones[0]
    precios.push({
      ...(previo?.id ? { id: previo.id } : {}),
      amount: precio,
      currency_code: MONEDA,
      min_quantity: desde,
    })
  }

  try {
    await upsertOfferPricesWorkflow(req.scope).run({
      input: { offers: [{ id: offerId, prices: precios }] },
    })
    return res.json({ ok: true })
  } catch (e) {
    const logger = req.scope.resolve("logger")
    logger.error(
      `[volumen-taller] no se pudo guardar la oferta ${offerId} del taller ${sellerId}: ${e?.message || e}`
    )
    return res.status(500).json({
      message: "No se pudo guardar. Intenta de nuevo; si sigue igual, escríbenos.",
    })
  }
}
