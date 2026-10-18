import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { COTIZADOR_MODULE } from "../../../modules/cotizador"
import CotizadorModuleService from "../../../modules/cotizador/service"
import { cotizacionDocumentoHtml } from "../../../lib/cotizacion-documento"

// Ruta pública: el cliente del taller no tiene cuenta aquí. Sirve el documento
// completo y registra la primera vista, que es lo que alimenta el seguimiento
// (enviada → vista → aceptada) y las alertas de día 3, 5 y 7.
//
// Vive FUERA de /store a propósito: Medusa exige el header
// x-publishable-api-key en todo /store/*, y este link se abre dando clic desde
// WhatsApp o un correo, sin headers. La defensa es el token aleatorio de 32
// hex, no la ruta.
//
// Sólo sale lo que va en el documento: notas_internas y el desglose de costos
// se quedan del lado del taller.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { token } = req.params
  const cotizadorModuleService = req.scope.resolve<CotizadorModuleService>(COTIZADOR_MODULE)

  if (!token || !/^[a-f0-9]{32}$/.test(token)) {
    return res.status(404).type("text/plain").send("Cotización no encontrada")
  }

  const [cotizacion] = await cotizadorModuleService.listCotizacions({ token_publico: token })
  if (!cotizacion) {
    return res.status(404).type("text/plain").send("Cotización no encontrada")
  }

  const perfil = await cotizadorModuleService.retrieveTallerPerfil(cotizacion.perfil_id)
  const partidas = await cotizadorModuleService.listCotizacionPartidas(
    { cotizacion_id: cotizacion.id },
    { order: { posicion: "ASC" } }
  )

  const vencida =
    cotizacion.vigencia_hasta instanceof Date
      ? cotizacion.vigencia_hasta.getTime() < Date.now()
      : Boolean(cotizacion.vigencia_hasta && new Date(cotizacion.vigencia_hasta).getTime() < Date.now())

  if (cotizacion.estatus === "enviada") {
    await cotizadorModuleService.updateCotizacions({
      id: cotizacion.id,
      estatus: vencida ? "vencida" : "vista",
      vista_en: cotizacion.vista_en ?? new Date(),
    } as any)
  }

  const html = cotizacionDocumentoHtml({
    perfil: perfil as any,
    cotizacion: cotizacion as any,
    partidas: partidas as any,
  })

  res.status(200).type("text/html").send(html)
}
