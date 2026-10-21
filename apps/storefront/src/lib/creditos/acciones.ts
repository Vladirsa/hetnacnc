"use server"

// El monedero de créditos del cliente.
//
// Los créditos son la moneda de las herramientas (hoy el escaneo 3D y el
// cotizador). No son pesos: un crédito no se puede retirar ni cambiar a
// efectivo, y por eso el saldo NUNCA se enseña como "MX$0.00" -- se enseña en
// créditos y en lo que alcanzan a pagar, que es lo que el taller quiere saber.
//
// Comprarlos no necesita una pasarela aparte: los paquetes son productos
// normales del catálogo, así que pasan por el mismo carrito y el mismo Mercado
// Pago que todo lo demás. Cuando el pago se confirma, los subscribers
// order-placed-credit-delivery / payment-captured-credit-delivery del backend
// acreditan el monedero. Una sola pasarela que ya está probada vale más que
// una segunda a medias, y así la compra queda en el historial de pedidos.

import { getAuthHeaders } from "@/lib/data/cookies"
import { listOffers } from "@/lib/data/offers"
import { listProducts } from "@/lib/data/products"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

// Los paquetes que creó scripts/seed-creditos-3d.ts. Si se agrega uno nuevo en
// el panel, su handle va aquí.
const HANDLES_PAQUETES = [
  "creditos-3d-basico",
  "creditos-3d-estandar",
  "creditos-3d-pro",
]

export type Movimiento = {
  id: string
  cantidad: number
  tipo: string
  descripcion: string | null
  creado: string
}

export type Saldo = {
  saldo: number
  creditos_por_escaneo: number
  movimientos: Movimiento[]
}

export type RespuestaSaldo =
  | { ok: true; datos: Saldo }
  | { ok: false; mensaje: string; noAutenticado?: boolean }

export async function obtenerSaldo(): Promise<RespuestaSaldo> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) {
    return { ok: false, mensaje: "Necesitas iniciar sesión.", noAutenticado: true }
  }

  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/creditos-3d/saldo`, {
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
        ...auth,
      },
      cache: "no-store",
    })

    if (res.status === 401) {
      return { ok: false, mensaje: "Tu sesión expiró.", noAutenticado: true }
    }
    if (!res.ok) {
      return { ok: false, mensaje: "No se pudo leer tu saldo." }
    }

    const cuerpo = (await res.json()) as Partial<Saldo>
    return {
      ok: true,
      datos: {
        saldo: cuerpo.saldo ?? 0,
        creditos_por_escaneo: cuerpo.creditos_por_escaneo || 5,
        movimientos: cuerpo.movimientos ?? [],
      },
    }
  } catch (e) {
    console.error("[creditos] no se pudo leer el saldo", e)
    return { ok: false, mensaje: "No se pudo conectar con el servidor." }
  }
}

export type Paquete = {
  id: string
  handle: string
  titulo: string
  descripcion: string | null
  thumbnail: string | null
  creditos: number
  precio: number | null
  moneda: string
  // El id de la OFERTA, no el de la variante: en Mercur lo que se agrega al
  // carrito es la oferta de un vendedor, no el producto.
  ofertaId: string | null
}

// Los paquetes con su precio ya calculado para la región del visitante.
export async function listarPaquetes(countryCode: string): Promise<Paquete[]> {
  const { response } = await listProducts({
    countryCode,
    queryParams: { handle: HANDLES_PAQUETES, limit: HANDLES_PAQUETES.length },
  })

  const paquetes = await Promise.all(
    response.products.map(async (p) => {
      const metadata = (p.metadata || {}) as Record<string, unknown>
      const { offers } = await listOffers({ productId: p.id, countryCode, limit: 1 })
      const oferta = offers[0] as
        | { id?: string; calculated_price?: { calculated_amount?: number; currency_code?: string } }
        | undefined

      return {
        id: p.id,
        handle: p.handle || "",
        titulo: p.title,
        descripcion: p.description ?? null,
        thumbnail: p.thumbnail ?? null,
        creditos: Number(metadata.creditos_otorgados) || 0,
        precio: oferta?.calculated_price?.calculated_amount ?? null,
        moneda: oferta?.calculated_price?.currency_code || "mxn",
        ofertaId: oferta?.id ?? null,
      }
    })
  )

  return (
    paquetes
      // Sin créditos no es un paquete, y sin oferta no se puede comprar: si
      // alguien edita el producto en el panel y borra el metadato, o el
      // vendedor despublica su oferta, mejor que no aparezca a que se venda y
      // no acredite nada.
      .filter((p) => p.creditos > 0 && p.ofertaId)
      .sort((a, b) => a.creditos - b.creditos)
  )
}
