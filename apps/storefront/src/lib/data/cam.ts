"use server"

// Laboratorio CAM 3/4/5 ejes (public/cam-lab/index.html, dentro de /cam/lab).
//
// El laboratorio corre en el navegador: carga la pieza, calcula la trayectoria
// y manda el trabajo al backend (POST /store/cam/jobs). Aquí sólo quedan las
// dos cosas que necesitan la sesión del cliente, que vive en una cookie del
// servidor: meter el trabajo al carrito y listar "Mis trabajos CAM".
//
// El precio nunca sale del navegador: el backend elige el servicio y el nivel
// (Básica / Media / Alta) y usa la OFERTA de la tienda HETNA de esa variante.

import { revalidateTag } from "next/cache"

import { getOrSetCart } from "./cart"
import { getAuthHeaders, getCacheTag } from "./cookies"
import { listOffers } from "./offers"
import { listProducts } from "./products"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PK = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string

export type StoreCamJob = {
  id: string
  status: "received" | "in_cart" | "paid" | "in_review" | "delivered" | "cancelled"
  service: "cam_3" | "cam_4" | "cam_5" | "post"
  tier: string | null
  model_name: string
  controller: string | null
  kinematics: string | null
  stats: Record<string, number> | null
  review_requested: boolean
  created_at: string
  paid_at: string | null
  delivered_at: string | null
  deliverables?: { id: string; url: string; name: string }[]
}

export type ServicioCam = {
  handle: string
  titulo: string
  subtitulo: string | null
  descripcion: string | null
  desde: number | null
  moneda: string
}

// Los productos que crea packages/api/src/scripts/seed-cam-services.ts
const HANDLES = [
  "servicio-cam-3-ejes",
  "servicio-cam-4-ejes",
  "servicio-cam-5-ejes",
  "posprocesador-personalizado",
  "revision-especialista-cam",
]

async function backend<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${MEDUSA_BACKEND_URL}${ruta}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-publishable-api-key": PK,
      ...(await getAuthHeaders()),
      ...(init.headers || {}),
    },
    cache: "no-store",
  })
  const cuerpo = (await res.json().catch(() => ({}))) as T & { message?: string }
  if (!res.ok) {
    throw new Error(cuerpo?.message || `Error ${res.status}`)
  }
  return cuerpo
}

/**
 * Mete al carrito un trabajo creado en el laboratorio. Devuelve { ok } en vez
 * de lanzar error, para que la pantalla pueda decir qué pasó.
 */
export async function addCamJobToCart({
  jobId,
  token,
  review,
  countryCode,
}: {
  jobId: string
  token: string
  review: boolean
  countryCode: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!/^camjob_[A-Za-z0-9]+$/.test(jobId) || !/^[a-f0-9]{16,}$/i.test(token)) {
    return { ok: false, error: "Trabajo no válido" }
  }
  try {
    const cart = await getOrSetCart(countryCode)
    if (!cart) {
      return { ok: false, error: "No se pudo crear el carrito" }
    }
    await backend(`/store/cam/jobs/${jobId}/cart`, {
      method: "POST",
      body: JSON.stringify({ cart_id: cart.id, access_token: token, review }),
    })
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e)
    // Si ya estaba en el carrito, no es un error para el cliente.
    if (!/ya está en tu carrito/i.test(mensaje)) {
      return { ok: false, error: mensaje || "No se pudo agregar al carrito" }
    }
  }

  revalidateTag(await getCacheTag("carts"))
  revalidateTag(await getCacheTag("fulfillment"))
  return { ok: true }
}

/** Trabajos CAM del cliente con sesión iniciada (vacío si no hay sesión). */
export async function listMyCamJobs(): Promise<{ jobs: StoreCamJob[]; sesion: boolean }> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) {
    return { jobs: [], sesion: false }
  }
  const jobs = await backend<{ jobs: StoreCamJob[] }>("/store/cam/jobs")
    .then((r) => r.jobs)
    .catch(() => [] as StoreCamJob[])

  // Enlaces de descarga recién pedidos (los archivos del cliente son privados).
  const conEnlaces = await Promise.all(
    jobs.map(async (job) => ({
      ...job,
      deliverables: await Promise.all(
        (job.deliverables ?? []).map(async (d) => {
          const url = await backend<{ url: string }>(
            `/store/cam/jobs/${job.id}/files/${encodeURIComponent(d.id)}`
          )
            .then((r) => r.url)
            .catch(() => d.url)
          return { ...d, url }
        })
      ),
    }))
  )
  return { jobs: conEnlaces, sesion: true }
}

/** Servicios CAM con su precio "desde" (la oferta más barata de cada uno). */
export async function listarServiciosCam(countryCode: string): Promise<ServicioCam[]> {
  try {
    const { response } = await listProducts({
      countryCode,
      queryParams: { handle: HANDLES, limit: HANDLES.length },
    })
    const servicios = await Promise.all(
      response.products.map(async (p) => {
        const { offers } = await listOffers({ productId: p.id, countryCode, limit: 10 }).catch(() => ({
          offers: [],
        }))
        const precios = (offers as { calculated_price?: { calculated_amount?: number; currency_code?: string } }[])
          .map((o) => o.calculated_price)
          .filter((c): c is { calculated_amount: number; currency_code?: string } => typeof c?.calculated_amount === "number")
          .sort((a, b) => a.calculated_amount - b.calculated_amount)
        return {
          handle: p.handle || "",
          titulo: p.title,
          subtitulo: p.subtitle ?? null,
          descripcion: p.description ?? null,
          desde: precios[0]?.calculated_amount ?? null,
          moneda: precios[0]?.currency_code || "mxn",
        }
      })
    )
    return servicios.sort((a, b) => HANDLES.indexOf(a.handle) - HANDLES.indexOf(b.handle))
  } catch {
    return []
  }
}
