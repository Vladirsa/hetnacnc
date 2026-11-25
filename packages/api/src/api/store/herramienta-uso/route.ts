import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { contarUso, usoValido } from "../../../lib/herramienta-uso"
import { ipDeFirma } from "../../../lib/ip-firmada"

// Topes en memoria (es una estadística: si el proceso se reinicia, empieza de
// cero y no pasa nada). Por IP firmada por la tienda: 60 eventos por hora.
// Sin IP firmada, un tope por herramienta y evento por hora para todos.
const HORA = 3600_000
const POR_IP = 60
const SIN_IP = 2000
const cubos = new Map<string, { n: number; desde: number }>()
function pasaTope(llave: string, tope: number, ahora = Date.now()) {
  if (cubos.size > 50_000) cubos.clear() // nunca crece sin límite
  const c = cubos.get(llave)
  if (!c || ahora - c.desde > HORA) {
    cubos.set(llave, { n: 1, desde: ahora })
    return true
  }
  return ++c.n <= tope
}

// POST /store/herramienta-uso { herramienta, evento }: uso de las herramientas
// del Estudio para el tablero semanal (lib/herramienta-uso.ts). Nunca falla
// hacia afuera: una estadística perdida no es problema del cliente.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as Record<string, unknown>
  if (!usoValido(b.herramienta, b.evento)) return res.json({ ok: false })
  const ip = ipDeFirma(req.headers["x-hetna-ip"])
  if (ip ? !pasaTope(`ip:${ip}`, POR_IP) : !pasaTope(`h:${b.herramienta}:${b.evento}`, SIN_IP)) return res.json({ ok: true })
  try {
    await contarUso(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION), b.herramienta as string, b.evento)
  } catch (e) {
    req.scope.resolve("logger").warn(`[herramienta-uso] ${(e as Error).message}`)
  }
  res.json({ ok: true })
}
