// GET /admin/hetna-ficha/detalle?correo=...&telefono=... — la ficha completa
// con la siguiente acción sugerida (lib/ficha-unica.ts).
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { armarFicha, ligasAccion, siguientesAcciones } from "../../../../lib/ficha-unica"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const q = (req.query || {}) as Record<string, string>
  try {
    const ficha = await armarFicha(req.scope, { correo: q.correo || null, telefono: q.telefono || null })
    const acciones = siguientesAcciones(ficha).map((a) => ({ ...a, ligas: ligasAccion(a) }))
    res.json({ ficha, acciones })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message || "No se pudo armar la ficha." })
  }
}
