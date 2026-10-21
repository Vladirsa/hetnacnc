// Calculadora CNC para la app del taller.
// GET  → lista de calculadoras con sus campos (la app arma el formulario con esto).
// POST → { id, entrada } → resultado, con el mismo motor del Copiloto IA.
// Una sola fuente de verdad: si se corrige una tabla en motor.ts, la web, el
// Copiloto y la app dan el mismo número.
import { CALCULADORAS, buscarCalculadora } from "@/lib/copiloto/motor"
import { excedido, json, opciones } from "@/lib/app-movil/cors"

export const OPTIONS = (req: Request) => opciones(req)

export async function GET(req: Request) {
  const lista = CALCULADORAS.map(({ id, nombre, maquina, resumen, campos }) => ({ id, nombre, maquina, resumen, campos }))
  return json(req, { calculadoras: lista }, 200, { "Cache-Control": "public, max-age=3600" })
}

export async function POST(req: Request) {
  if (excedido(req, "calc", 60)) return json(req, { message: "Demasiados cálculos. Espera un minuto." }, 429)
  let body: { id?: string; entrada?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return json(req, { message: "Datos inválidos." }, 400)
  }
  const calc = buscarCalculadora(String(body.id || ""))
  if (!calc) return json(req, { message: "Esa calculadora no existe." }, 404)
  const entrada = body.entrada && typeof body.entrada === "object" ? body.entrada : {}
  try {
    return json(req, { id: calc.id, resultado: calc.calcular(entrada) })
  } catch {
    return json(req, { message: "No se pudo calcular con esos datos. Revisa los campos." }, 400)
  }
}
