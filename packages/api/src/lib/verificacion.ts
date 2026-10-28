// Lógica compartida de la verificación de talleres (rutas del taller y del administrador).
import type { MedusaContainer } from "@medusajs/framework/types"
import { MercurModules } from "@mercurjs/types"

import { VERIFICACION_MODULE } from "../modules/verificacion"
import type VerificacionModuleService from "../modules/verificacion/service"
import { type Archivo, faltantes, listaArchivos, TIPOS } from "./verificacion-archivos"

export type Estado = "sin_enviar" | "borrador" | "en_revision" | "verificado" | "rechazado"

export type Expediente = {
  id: string
  seller_id: string
  estado: Estado
  archivos: Archivo[]
  motivo: string | null
  enviado_en: Date | string | null
  revisado_en: Date | string | null
  consentimiento_en?: Date | string | null
}

export const servicio = (c: MedusaContainer) => c.resolve<VerificacionModuleService>(VERIFICACION_MODULE)

export async function leerExpediente(c: MedusaContainer, sellerId: string): Promise<Expediente | null> {
  const [fila] = await servicio(c).listVerificacionTallers({ seller_id: sellerId }, { take: 1 })
  if (!fila) return null
  return { ...(fila as unknown as Expediente), archivos: listaArchivos(fila.archivos) }
}

export async function expedienteOCrear(c: MedusaContainer, sellerId: string): Promise<Expediente> {
  const ya = await leerExpediente(c, sellerId)
  if (ya) return ya
  const nuevo = await servicio(c).createVerificacionTallers({ seller_id: sellerId, estado: "borrador", archivos: { lista: [] } })
  return { ...(nuevo as unknown as Expediente), archivos: [] }
}

export async function guardarExpediente(c: MedusaContainer, id: string, cambios: Partial<Omit<Expediente, "id" | "seller_id">>) {
  // La columna JSON guarda un objeto: la lista va dentro de { lista: [...] }
  const { archivos, ...resto } = cambios
  await servicio(c).updateVerificacionTallers({
    id,
    ...(resto as Record<string, unknown>),
    ...(archivos ? { archivos: { lista: archivos } } : {}),
  })
}

// Lo que ve el propio taller (sin nombres internos de archivo)
export function vistaTaller(e: Expediente | null) {
  const archivos = e?.archivos ?? []
  return {
    estado: (e?.estado ?? "sin_enviar") as Estado,
    motivo: e?.estado === "rechazado" ? e.motivo : null,
    enviado_en: e?.enviado_en ?? null,
    revisado_en: e?.revisado_en ?? null,
    archivos: archivos.map(({ id, tipo, mime, tamano, subido_en }) => ({ id, tipo, mime, tamano, subido_en })),
    faltan: faltantes(archivos),
    tipos: TIPOS,
  }
}

// La insignia pública vive en los datos del taller (metadata.verificado), como "fundador".
// Esa llave está protegida: el taller no la puede cambiar desde su panel (ver proteger-metadata).
export async function marcarInsignia(c: MedusaContainer, sellerId: string, verificado: boolean) {
  const sellers = c.resolve(MercurModules.SELLER) as {
    retrieveSeller: (id: string) => Promise<{ metadata?: Record<string, unknown> | null }>
    updateSellers: (d: { id: string; metadata: Record<string, unknown> }) => Promise<unknown>
  }
  const actual = (await sellers.retrieveSeller(sellerId))?.metadata ?? {}
  await sellers.updateSellers({
    id: sellerId,
    metadata: {
      ...actual,
      verificado,
      verificado_desde: verificado ? new Date().toISOString() : "",
    },
  })
}
