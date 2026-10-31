// Centro de control > Saldos y recargas (lib/saldos.ts)
//   GET  /admin/hetna-control/recargas            -> { recargas }
//   POST /admin/hetna-control/recargas
//        { id, comprobante_url?, nota? }          -> pone la nota de compra a una recarga
//        { plataforma, monto, comprobante_url?, nota? } -> anota una recarga a mano
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { guardarRecarga, listarRecargas } from "../../../../lib/saldos"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.json({ recargas: await listarRecargas(req.scope, 100) })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as Record<string, unknown>
  try {
    const recarga = await guardarRecarga(req.scope, {
      id: b.id ? Number(b.id) : undefined,
      plataforma: b.plataforma as string,
      monto: b.monto as number,
      comprobante_url: b.comprobante_url as string | undefined,
      nota: b.nota as string | undefined,
    })
    res.json({ recarga })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
