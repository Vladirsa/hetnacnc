import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ligaArchivo } from "../../../../../lib/archivo-acceso"
import { T_SOLICITUD, asegurarTablas, recibePropuestas, type Trabajo } from "../../../../../lib/licitacion"
import { faltaNda, puedeDescargarAhora, relacionTaller, tallerPuedeVer } from "../../../../../lib/licitacion-privacidad"

// GET /vendor/hetna-solicitudes/:id/archivos
//
// Ligas (1 hora) a los archivos que subió el cliente. Las pide el taller desde
// su panel, sólo para solicitudes que puede cotizar mientras recibe propuestas,
// o si es el taller elegido. Las ligas son de HETNA (lib/archivo-acceso): al
// abrirlas se revisa otra vez el permiso y queda registrada la descarga.

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })

  await asegurarTablas(knex)
  const s = await knex(T_SOLICITUD).where({ id: String(req.params.id) }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })

  const esSuya = s.modo === "abierta" || s.taller_id === sellerId
  const rel = await relacionTaller(knex, s, sellerId)
  // Cotizar y no ganar ya no da acceso: en cuanto el cliente elige o la
  // solicitud cierra, sólo el taller elegido sigue bajando los planos.
  if (!esSuya || (!recibePropuestas(s) && !rel.elegido)) {
    return res.status(403).json({ message: "Esta solicitud ya no está disponible." })
  }

  // Licitaciones 3.0: privada sólo para invitados; cada archivo según lo que
  // eligió el cliente (públicos, privados o bajo autorización).
  if (!tallerPuedeVer(s, rel)) return res.status(404).json({ message: "Solicitud no encontrada." })

  const archivos = ((s.trabajo as Trabajo)?.archivos || [])
  const ligas: { nombre: string; tamano: number; url: string | null; ver_url?: string | null; bloqueado?: boolean; motivo?: "nda" | "solo_elegido" }[] = []
  const sinNda = faltaNda(s, rel)
  for (const a of archivos) {
    if (!puedeDescargarAhora(s, rel, a.nombre)) {
      // motivo: para decirle al taller qué hacer (aceptar el acuerdo o esperar a ser elegido)
      const motivo = sinNda ? "nda" : a.solo_elegido && !rel.elegido ? "solo_elegido" : undefined
      ligas.push({ nombre: a.nombre, tamano: a.tamano, url: null, bloqueado: true, ...(motivo ? { motivo } : {}) })
      continue
    }
    const permiso = { s: s.id, k: a.clave, a: "taller" as const, i: sellerId }
    ligas.push({ nombre: a.nombre, tamano: a.tamano, url: ligaArchivo(permiso), ver_url: ligaArchivo(permiso, true) })
  }
  return res.json({ archivos: ligas })
}
