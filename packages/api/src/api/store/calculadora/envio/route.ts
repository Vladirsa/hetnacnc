import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { EnvioCalcError, enviarCalculo } from "../../../../lib/calculadora-envio"
import { ipCliente } from "../../../../lib/ip-cliente"

const Pedido = z.object({
  correo: z.string().max(120),
  proceso: z.string().max(30),
  modo: z.string().max(30),
  c: z.string().max(700),
  acepta_marketing: z.boolean().optional(),
})

/** POST /store/calculadora/envio -- manda por correo la liga a un cálculo de la Calculadora CNC. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const r = Pedido.safeParse(req.body)
  if (!r.success) {
    res.status(400).json({ message: "Revisa tu correo." })
    return
  }
  try {
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    await enviarCalculo(knex, { ...r.data, acepta_marketing: !!r.data.acepta_marketing, ip: ipCliente(req as any) })
    res.json({ ok: true })
  } catch (e) {
    if (e instanceof EnvioCalcError) {
      res.status(e.status).json({ message: e.message })
      return
    }
    throw e
  }
}
