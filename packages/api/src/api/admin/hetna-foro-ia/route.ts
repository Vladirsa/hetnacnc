// Dashboard > Foro e IA (lib/foro-agente.ts)
//   GET  /admin/hetna-foro-ia                                  -> { pendientes, recientes, secciones }
//   POST /admin/hetna-foro-ia { id, accion: publicar|descartar, texto?, titulo?, seccion? }
//   POST /admin/hetna-foro-ia { correr: "respondedor" | "investigador" }   (a mano)
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { correrInvestigador, correrRespondedor, listarForoIa, resolverForoIa } from "../../../lib/foro-agente"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json(await listarForoIa(req.scope))
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as Record<string, any>
  try {
    if (b.correr === "respondedor") return res.json(await correrRespondedor(req.scope))
    if (b.correr === "investigador") return res.json(await correrInvestigador(req.scope))
    const id = Number(b.id)
    if (!id) return res.status(400).json({ message: "Falta el id." })
    const r = await resolverForoIa(req.scope, id, String(b.accion || ""), { texto: b.texto, titulo: b.titulo, seccion: b.seccion })
    res.status(r.ok ? 200 : 400).json(r)
  } catch (e) {
    res.status(500).json({ message: (e as Error).message })
  }
}
