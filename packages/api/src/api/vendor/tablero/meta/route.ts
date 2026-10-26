import { MedusaResponse } from "@medusajs/framework/http"

import { VendorRequest } from "../vendor-request"
import { mesDeMexico } from "../../../../lib/tablero-taller"
import { TABLERO_MODULE } from "../../../../modules/tablero"
import type TableroModuleService from "../../../../modules/tablero/service"

// POST /vendor/tablero/meta  -> { objetivo: number, mes?: "YYYY-MM" }
//
// La meta de venta que el taller se pone para el mes. Se guarda por mes y no
// como un solo campo "meta actual" para que en marzo se pueda ver si cumplió
// la de marzo, aunque en abril ya se haya puesto otra.
export const POST = async (
  req: VendorRequest<{ objetivo?: unknown; mes?: unknown }>,
  res: MedusaResponse
) => {
  const sellerId = req.seller_context!.seller_id
  const servicio = req.scope.resolve<TableroModuleService>(TABLERO_MODULE)

  const objetivo = Number(req.body?.objetivo)
  if (!Number.isFinite(objetivo) || objetivo < 0) {
    return res.status(400).json({ message: "El objetivo tiene que ser un número de 0 para arriba." })
  }

  // Sólo se acepta el mes en curso o uno futuro: dejar reescribir la meta de
  // un mes ya cerrado convertiría el historial en algo que no se puede creer.
  const mesPedido = typeof req.body?.mes === "string" ? req.body.mes : mesDeMexico()
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mesPedido)) {
    return res.status(400).json({ message: "El mes va en formato AAAA-MM." })
  }
  if (mesPedido < mesDeMexico()) {
    return res.status(400).json({ message: "No se puede cambiar la meta de un mes que ya pasó." })
  }

  const moneda = req.seller_context?.currency_code || "mxn"
  const existentes = await servicio.listTallerMetas({ seller_id: sellerId, mes: mesPedido })
  const existente = existentes?.[0]

  if (existente) {
    await servicio.updateTallerMetas({
      id: existente.id,
      meta_ingresos: objetivo,
      moneda,
    })
  } else {
    await servicio.createTallerMetas({
      seller_id: sellerId,
      mes: mesPedido,
      meta_ingresos: objetivo,
      moneda,
    })
  }

  res.json({ mes: mesPedido, objetivo, puesta: true })
}
