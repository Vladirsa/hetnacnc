// POST /store/muebles/descarga — cobra los créditos de descargar los archivos
// de un mueble del constructor de ensamble. El mismo diseño (misma clave) no se
// vuelve a cobrar en 24 horas: así el cliente puede bajar DXF, SVG y PDF, o
// repetir la descarga, sin pagar dos veces.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

import { CREDIT_MODULE } from "../../../../modules/credit"
import CreditModuleService from "../../../../modules/credit/service"
import { spendCreditsWorkflow } from "../../../../workflows/spend-credits"

export const CREDITOS_DESCARGA_MUEBLE = 1

const Cuerpo = z.object({
  clave: z.string().min(8).max(80).regex(/^[a-z0-9-]+$/),
  descripcion: z.string().max(200).optional(),
})

type Respuesta = { ok: true; cobrado: number; saldo: number | null } | { ok: false; mensaje: string; saldoInsuficiente?: boolean }

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse<Respuesta>) => {
  const datos = Cuerpo.safeParse(req.body)
  if (!datos.success) return res.status(400).json({ ok: false, mensaje: "Datos del mueble inválidos." })
  const customerId = req.auth_context.actor_id
  const referencia = `mueble:${datos.data.clave}`
  const creditos = req.scope.resolve<CreditModuleService>(CREDIT_MODULE)

  // ¿ya pagó este mismo diseño en las últimas 24 horas?
  const previos = await creditos.listCreditLedgerEntries({ customer_id: customerId, reference_id: referencia, type: "consumo" }, { order: { created_at: "DESC" }, take: 1 })
  if (previos[0] && Date.now() - new Date(previos[0].created_at as unknown as string).getTime() < 24 * 3600 * 1000) {
    const [b] = await creditos.listCreditBalances({ customer_id: customerId })
    return res.json({ ok: true, cobrado: 0, saldo: b?.balance ?? 0 })
  }

  try {
    const { result } = await spendCreditsWorkflow(req.scope).run({
      input: {
        customer_id: customerId,
        amount: CREDITOS_DESCARGA_MUEBLE,
        reference_id: referencia,
        description: `Archivos de mueble: ${datos.data.descripcion || "mueble de ensamble"}`.slice(0, 250),
      },
    })
    res.json({ ok: true, cobrado: CREDITOS_DESCARGA_MUEBLE, saldo: (result as { saldo_restante?: number }).saldo_restante ?? null })
  } catch (e) {
    if (e instanceof MedusaError && e.type === MedusaError.Types.NOT_ALLOWED) {
      return res.status(402).json({ ok: false, mensaje: `Necesitas ${CREDITOS_DESCARGA_MUEBLE} crédito para descargar. Compra créditos en tu cuenta.`, saldoInsuficiente: true })
    }
    throw e
  }
}
