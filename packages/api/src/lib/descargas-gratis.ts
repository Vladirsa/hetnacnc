import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { COTIZADOR_MODULE } from "../modules/cotizador"
import type CotizadorModuleService from "../modules/cotizador/service"
import { DESCARGAS_MODULE } from "../modules/descargas"
import type DescargasModuleService from "../modules/descargas/service"
import { getSignedDownloadUrl } from "./backblaze"
import { planEfectivo, type PerfilParaPlan } from "./cotizador-plan"

// Archivos gratis de HETNA: los que el producto marca con
// metadata.archivo_gratis = true. No pasan por el carrito: un pedido de $0 no
// lo puede cobrar Mercado Pago y no hay nada que cobrar.
//
// Regla de cupo (decidida por HETNA el 28 de octubre de 2026):
//   - con cuenta gratis, DESCARGAS_GRATIS_SEMANA archivos (20) en 7 días;
//   - con un plan del Cotizador vigente (taller, pro o industrial), sin límite.
//
// Son 7 días corridos y no "la semana del lunes": con semana de calendario,
// quien baja 20 el domingo baja otros 20 el lunes. Con días corridos, cada
// descarga se libera justo una semana después de hecha.
//
// Volver a bajar un archivo que ya bajó en la ventana no cuenta otra vez: se
// le cayó la descarga o cambió de computadora, no es un archivo más.

const VENTANA_MS = 7 * 24 * 60 * 60 * 1000

// La liga de un archivo gratis se usa en el momento: dura una hora y no siete
// días como la de una compra, porque se pide otra en un clic.
const DURACION_LIGA_S = 60 * 60

const PLANES_SIN_LIMITE = ["taller", "pro", "industrial"]

export const limiteSemanal = () => {
  const n = Number(process.env.DESCARGAS_GRATIS_SEMANA || 20)
  return n > 0 ? Math.floor(n) : 20
}

export type EstadoDescargas = {
  ilimitado: boolean
  plan: string
  limite: number | null
  usadas: number
  restantes: number | null
  // Cuándo se libera la siguiente, si ya no le quedan. ISO.
  proxima_liberacion: string | null
}

export class DescargaError extends Error {
  constructor(
    public codigo: "no_es_gratis" | "sin_archivo" | "sin_cupo" | "liga",
    mensaje: string
  ) {
    super(mensaje)
  }
}

const servicio = (container: MedusaContainer) =>
  container.resolve<DescargasModuleService>(DESCARGAS_MODULE)

async function planDelCliente(container: MedusaContainer, customerId: string): Promise<string> {
  try {
    // Al servicio del módulo y no con query.graph("cotizador_perfil"): con
    // query.graph Medusa busca "listCotizadorPerfils", que no existe (el
    // modelo se registró como TallerPerfil), y el plan siempre salía vacío.
    const cotizador = container.resolve<CotizadorModuleService>(COTIZADOR_MODULE)
    const [perfil] = await cotizador.listTallerPerfils(
      { customer_id: customerId },
      { take: 1, select: ["plan", "plan_hasta", "prueba_hasta"] }
    )
    return perfil ? planEfectivo(perfil as PerfilParaPlan) : "gratis"
  } catch {
    // Sin Cotizador no hay plan: cuenta gratis, que es lo seguro.
    return "gratis"
  }
}

async function descargasEnVentana(container: MedusaContainer, customerId: string) {
  const desde = new Date(Date.now() - VENTANA_MS)
  return servicio(container).listDescargas(
    { customer_id: customerId, created_at: { $gte: desde } },
    { order: { created_at: "ASC" }, select: ["id", "product_id", "created_at"] }
  )
}

function armarEstado(plan: string, filas: { product_id: string; created_at: Date | string }[]): EstadoDescargas {
  if (PLANES_SIN_LIMITE.includes(plan)) {
    return { ilimitado: true, plan, limite: null, usadas: filas.length, restantes: null, proxima_liberacion: null }
  }
  const limite = limiteSemanal()
  // Se cuentan archivos distintos: bajar dos veces el mismo es una descarga.
  const distintos = new Set(filas.map((f) => f.product_id)).size
  const restantes = Math.max(0, limite - distintos)

  let proxima: string | null = null
  if (restantes === 0 && filas.length) {
    // La más vieja de la ventana es la primera que se libera.
    proxima = new Date(new Date(filas[0].created_at).getTime() + VENTANA_MS).toISOString()
  }
  return { ilimitado: false, plan, limite, usadas: distintos, restantes, proxima_liberacion: proxima }
}

export async function estadoDescargas(
  container: MedusaContainer,
  customerId: string
): Promise<EstadoDescargas> {
  const [plan, filas] = await Promise.all([
    planDelCliente(container, customerId),
    descargasEnVentana(container, customerId),
  ])
  return armarEstado(plan, filas)
}

export async function descargarGratis(
  container: MedusaContainer,
  customerId: string,
  productId: string
): Promise<{ url: string; expira: string; titulo: string; estado: EstadoDescargas }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "status", "metadata"],
    filters: { id: productId },
  })
  const producto = data?.[0] as
    | { id: string; title: string; status: string; metadata?: Record<string, unknown> | null }
    | undefined
  const meta = producto?.metadata || {}

  if (!producto || producto.status !== "published" || meta.archivo_gratis !== true) {
    throw new DescargaError("no_es_gratis", "Este archivo no es de descarga gratis.")
  }
  const storageKey = typeof meta.archivo_storage_key === "string" ? meta.archivo_storage_key : ""
  if (!storageKey) {
    throw new DescargaError("sin_archivo", "Este archivo todavía no está listo para descargarse.")
  }

  const [plan, filas] = await Promise.all([
    planDelCliente(container, customerId),
    descargasEnVentana(container, customerId),
  ])
  const yaLoBajo = filas.some((f) => f.product_id === productId)
  const antes = armarEstado(plan, filas)

  if (!yaLoBajo && !antes.ilimitado && (antes.restantes ?? 0) <= 0) {
    throw new DescargaError(
      "sin_cupo",
      `Ya bajaste tus ${antes.limite} archivos gratis de esta semana.`
    )
  }

  // La liga se pide ANTES de anotar la descarga: si B2 falla, el cliente no
  // pierde un lugar de su cupo por un archivo que no recibió.
  const liga = await getSignedDownloadUrl(storageKey, DURACION_LIGA_S)
  if (!liga.ok) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(`[descargas-gratis] sin liga para ${storageKey}: ${liga.reason}`)
    throw new DescargaError("liga", "No pudimos preparar la descarga. Intenta de nuevo en un momento.")
  }

  let estado = antes
  if (!yaLoBajo) {
    await servicio(container).createDescargas({ customer_id: customerId, product_id: productId })
    estado = armarEstado(plan, [...filas, { product_id: productId, created_at: new Date() }])
  }

  return { url: liga.url, expira: liga.expiresAt, titulo: producto.title, estado }
}
