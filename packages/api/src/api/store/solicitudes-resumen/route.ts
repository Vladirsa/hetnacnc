// GET /store/solicitudes-resumen
// Cuántas solicitudes de fabricación han llegado a HETNA, por material y por
// estado de la república (pedido de la auditoría del 27 nov 2026: "a los
// talleres les falta saber cuántas solicitudes llegan por material o zona").
// Sólo conteos: nada de nombres, contactos, descripciones ni folios.
// No cuenta las que HETNA descartó o rechazó en la revisión (spam, pruebas).
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_SOLICITUD, asegurarTablas } from "../../../lib/licitacion"

// Grupos de material: el cliente lo escribe libre ("MDF NATURAL", "acrilico
// 3mm"...), así que se acomoda en grupos que un taller reconoce.
const GRUPOS: [string, RegExp][] = [
  ["MDF y madera", /mdf|madera|triplay|pino|encino|okume|melamina|aglomerado/],
  ["Acrílico", /acr[ií]lico|plexi|policarbonato/],
  ["Aluminio", /alumin/],
  ["Acero e inoxidable", /acero|inox|hierro|l[aá]mina|placa negra|galvaniz/],
  ["Latón, cobre y bronce", /lat[oó]n|cobre|bronce/],
  ["Plásticos", /pl[aá]stico|nylamid|nylon|\bpvc\b|delrin|acetal|teflon|uhmw|polietileno|\babs\b|\bpla\b|petg|resina/],
  ["Otros materiales", /./],
]

const grupoMaterial = (m: string) => {
  const t = String(m || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
  if (!t.trim()) return "Sin material indicado"
  return GRUPOS.find(([, re]) => re.test(t))?.[0] || "Otros materiales"
}

let cache: { hasta: number; datos: unknown } | null = null

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (cache && cache.hasta > Date.now()) return res.json(cache.datos)
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablas(knex)

  const filas = (await knex(T_SOLICITUD)
    .whereNotIn("estado", ["descartada", "rechazada"])
    .select(knex.raw("trabajo->>'material' as material"), knex.raw("trabajo->>'estado_mx' as estado_mx"))) as {
    material: string | null
    estado_mx: string | null
  }[]

  const cuenta = (claves: string[]) => {
    const m = new Map<string, number>()
    for (const k of claves) m.set(k, (m.get(k) || 0) + 1)
    return [...m.entries()].map(([nombre, n]) => ({ nombre, n })).sort((a, b) => b.n - a.n)
  }

  const datos = {
    total: filas.length,
    por_material: cuenta(filas.map((f) => grupoMaterial(f.material || ""))),
    por_estado: cuenta(filas.map((f) => String(f.estado_mx || "").trim() || "Sin estado indicado")).slice(0, 12),
  }
  cache = { hasta: Date.now() + 10 * 60_000, datos }
  res.json(datos)
}
