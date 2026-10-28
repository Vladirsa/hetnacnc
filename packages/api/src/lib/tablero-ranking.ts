import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"

import { reputacionDeTalleres } from "./foro-actividad"
import { DIAS_VENTANA } from "./tablero-taller"

// Ranking de talleres: una sola puntuación que mezcla vender, participar en el
// foro y atender bien.
//
// La mezcla es a propósito. Un ranking por ventas a secas premia al que ya es
// grande y no mueve nada; uno por reputación del foro deja hasta abajo al que
// vende mucho y no postea. Juntando los tres, un taller chico que contesta
// dudas y cuida sus reseñas puede subir, que es justo la conducta que le sirve
// al marketplace.
//
// Cada dimensión se normaliza contra el mejor taller del periodo, así que la
// puntuación siempre va de 0 a 100 y no depende de la escala de los pesos.

const PESO_VENTAS = 0.5
const PESO_FORO = 0.25
const PESO_RESENAS = 0.25

// Debajo de esto, un 5.0 de promedio no dice nada: una sola reseña de un
// conocido pondría al taller arriba de uno con cuarenta reseñas de 4.7.
const RESENAS_MINIMAS = 3

export type PosicionTaller = {
  // null cuando todavía no hay con quién compararse (un solo taller con
  // actividad): enseñar "#1 de 1" es presumirle al taller un logro vacío.
  posicion: number | null
  total_talleres: number
  puntuacion: number
  desglose: {
    ventas: number
    foro: number
    resenas: number
  }
}

type Acumulado = {
  ingresos: number
  reputacion: number
  suma_resenas: number
  num_resenas: number
}

const nuevo = (): Acumulado => ({
  ingresos: 0,
  reputacion: 0,
  suma_resenas: 0,
  num_resenas: 0,
})

// Reparte entre 0 y 1 contra el mejor del periodo. Si nadie tiene nada en esa
// dimensión, todos sacan 0 en vez de dividir entre cero.
const contraElMejor = (valor: number, mejor: number) => (mejor > 0 ? valor / mejor : 0)

export async function rankingDeTalleres(
  container: MedusaContainer,
  sellerId: string
): Promise<PosicionTaller> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const desde = new Date()
  desde.setDate(desde.getDate() - DIAS_VENTANA)

  const porTaller = new Map<string, Acumulado>()
  const dame = (id: string) => {
    const previo = porTaller.get(id)
    if (previo) return previo
    const fresco = nuevo()
    porTaller.set(id, fresco)
    return fresco
  }

  // --- Ventas: ingresos de cada taller en la ventana ---
  //
  // Primero los pedidos del periodo y luego sus enlaces, no al revés: la tabla
  // order_seller crece con cada venta de la historia y pedirla entera para
  // tirar casi todo sería cargar el archivo muerto en memoria cada vez que un
  // taller abre su tablero.
  const { data: ordenes } = await query.graph({
    entity: "order",
    fields: ["id", "total"],
    filters: { created_at: { $gte: desde.toISOString() } },
  })

  const totalDeOrden = new Map<string, number>()
  for (const orden of (ordenes || []) as unknown as { id: string; total: number }[]) {
    totalDeOrden.set(orden.id, Number(orden.total) || 0)
  }

  if (totalDeOrden.size) {
    const { data: enlaces } = await query.graph({
      entity: "order_seller",
      fields: ["order_id", "seller_id"],
      filters: { order_id: [...totalDeOrden.keys()] },
    })
    for (const e of (enlaces || []) as unknown as { order_id: string; seller_id: string }[]) {
      dame(e.seller_id).ingresos += totalDeOrden.get(e.order_id) || 0
    }
  }

  // --- Foro: la reputación que ya lleva cada perfil ---
  const reputaciones = await reputacionDeTalleres()
  for (const [taller, puntos] of reputaciones) {
    dame(taller).reputacion = puntos
  }

  // --- Reseñas: promedio de las publicadas de sus productos ---
  await acumularResenas(container, dame)

  // --- Normalizar y puntuar ---
  let mejorIngresos = 0
  let mejorReputacion = 0
  for (const a of porTaller.values()) {
    if (a.ingresos > mejorIngresos) mejorIngresos = a.ingresos
    if (a.reputacion > mejorReputacion) mejorReputacion = a.reputacion
  }

  const puntuaciones: { seller_id: string; puntuacion: number; desglose: PosicionTaller["desglose"] }[] = []

  for (const [taller, a] of porTaller) {
    const ventas = contraElMejor(a.ingresos, mejorIngresos)
    const foro = contraElMejor(a.reputacion, mejorReputacion)
    // El promedio se lleva a 0-1 sobre 5 estrellas. Con menos reseñas que el
    // mínimo no se puntúa: no es un 0 merecido, es que todavía no se sabe.
    const resenas =
      a.num_resenas >= RESENAS_MINIMAS ? a.suma_resenas / a.num_resenas / 5 : 0

    puntuaciones.push({
      seller_id: taller,
      puntuacion:
        Math.round((ventas * PESO_VENTAS + foro * PESO_FORO + resenas * PESO_RESENAS) * 1000) / 10,
      desglose: {
        ventas: Math.round(ventas * PESO_VENTAS * 1000) / 10,
        foro: Math.round(foro * PESO_FORO * 1000) / 10,
        resenas: Math.round(resenas * PESO_RESENAS * 1000) / 10,
      },
    })
  }

  puntuaciones.sort((a, b) => b.puntuacion - a.puntuacion)

  const indice = puntuaciones.findIndex((p) => p.seller_id === sellerId)
  const mio = indice >= 0 ? puntuaciones[indice] : null

  return {
    // Con un solo taller con actividad no hay ranking que valga.
    posicion: mio && puntuaciones.length > 1 ? indice + 1 : null,
    total_talleres: puntuaciones.length,
    puntuacion: mio?.puntuacion ?? 0,
    desglose: mio?.desglose ?? { ventas: 0, foro: 0, resenas: 0 },
  }
}

// Suma las reseñas publicadas de cada taller. Las reseñas cuelgan del
// producto, así que hay que pasar por la oferta para saber de quién es.
async function acumularResenas(
  container: MedusaContainer,
  dame: (id: string) => Acumulado
): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data: ofertas } = await query.graph({
      entity: "offer",
      fields: ["seller_id", "product.id"],
    })

    const tallerDeProducto = new Map<string, string>()
    for (const o of (ofertas || []) as unknown as {
      seller_id: string
      product?: { id?: string }
    }[]) {
      if (o.product?.id && o.seller_id) tallerDeProducto.set(o.product.id, o.seller_id)
    }
    if (!tallerDeProducto.size) return

    const { data: enlaces } = await query.graph({
      entity: "product_review",
      fields: ["product_id", "review.rating", "review.status"],
      filters: { product_id: [...tallerDeProducto.keys()] },
    })

    for (const enlace of (enlaces || []) as unknown as {
      product_id?: string
      review?: { rating?: number; status?: string }
    }[]) {
      if (enlace.review?.status !== "published" || !enlace.product_id) continue
      const taller = tallerDeProducto.get(enlace.product_id)
      if (!taller) continue
      const a = dame(taller)
      a.suma_resenas += enlace.review.rating || 0
      a.num_resenas += 1
    }
  } catch (e) {
    // Sin reseñas el ranking sigue valiendo con las otras dos dimensiones.
    console.error("[tablero] reseñas del ranking:", e instanceof Error ? e.message : e)
  }
}
