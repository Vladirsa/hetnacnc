import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { COTIZADOR_MODULE } from "../../../../../../modules/cotizador"
import CotizadorModuleService from "../../../../../../modules/cotizador/service"

// Marca la cotización como enviada y devuelve el link público y el texto de
// WhatsApp listo. No manda el mensaje: el envío lo dispara el taller (o n8n),
// igual que las alertas del cotizador actual.
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const { id } = req.params
  const cotizadorModuleService = req.scope.resolve<CotizadorModuleService>(COTIZADOR_MODULE)

  const [perfil] = await cotizadorModuleService.listTallerPerfils({ customer_id: customerId })
  if (!perfil) {
    return res.status(404).json({ message: "Cotización no encontrada" })
  }

  const [cotizacion] = await cotizadorModuleService.listCotizacions({ id, perfil_id: perfil.id })
  if (!cotizacion) {
    return res.status(404).json({ message: "Cotización no encontrada" })
  }

  if (cotizacion.estatus === "borrador") {
    await cotizadorModuleService.updateCotizacions({
      id: cotizacion.id,
      estatus: "enviada",
      enviada_en: new Date(),
    } as any)
  }

  const url = linkPublico(req, cotizacion.token_publico)
  const texto = [
    `Hola${cotizacion.cliente_nombre ? ` ${cotizacion.cliente_nombre}` : ""}, le comparto la cotización ${cotizacion.folio} de ${perfil.nombre_comercial}.`,
    cotizacion.proyecto_referencia ? `Proyecto: ${cotizacion.proyecto_referencia}.` : null,
    url ? `Puede abrirla aquí: ${url}` : null,
  ]
    .filter(Boolean)
    .join(" ")

  const telefono = (cotizacion.cliente_telefono || "").replace(/\D/g, "")

  res.json({
    cotizacion_id: cotizacion.id,
    folio: cotizacion.folio,
    url_publica: url,
    whatsapp_url: telefono
      ? `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`,
  })
}

// COTIZADOR_PUBLIC_BASE_URL permite poner el link bajo un dominio bonito
// cuando el storefront tenga su propia página de cotización; sin esa variable
// se arma desde el host de la petición, que siempre es correcto.
function linkPublico(req: AuthenticatedMedusaRequest, token: string | null): string | null {
  if (!token) {
    return null
  }
  const base = process.env.COTIZADOR_PUBLIC_BASE_URL?.replace(/\/$/, "")
  if (base) {
    return `${base}/${token}`
  }
  const host = req.get("host")
  if (!host) {
    return null
  }
  return `${req.protocol}://${host}/cotizacion/${token}`
}
