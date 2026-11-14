// Calculadora CNC para la app del taller.
// GET  → lista de calculadoras con sus campos (la app arma el formulario con esto).
// POST → { id, entrada } → resultado, con el motor de calculadoras (lib/copiloto/motor).
// Una sola fuente de verdad: si se corrige una tabla en motor.ts, la app de
// Flutter y la Calculadora CNC de la web dan el mismo número.
//
// El asistente de IA para talleres (backend, lib/ia-fabricacion.ts) usa esta
// misma ruta: GET ?ia=1 da cada calculadora como herramienta de Claude, y el
// POST con "ia": true pasa la entrada por ejecutar(), que valida y acota lo
// que escribió la IA. Las cuentas siempre las hace este motor, nunca la IA.
import { CALCULADORAS, buscarCalculadora, ejecutar, herramientasIA } from "@/lib/copiloto/motor"
import { excedido, json, opciones } from "@/lib/app-movil/cors"

export const OPTIONS = (req: Request) => opciones(req)

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("ia") === "1") {
    return json(req, { herramientas: herramientasIA() }, 200, { "Cache-Control": "public, max-age=3600" })
  }
  const lista = CALCULADORAS.map(({ id, nombre, maquina, resumen, campos }) => ({ id, nombre, maquina, resumen, campos }))
  return json(req, { calculadoras: lista }, 200, { "Cache-Control": "public, max-age=3600" })
}

export async function POST(req: Request) {
  if (excedido(req, "calc", 60)) return json(req, { message: "Demasiados cálculos. Espera un minuto." }, 429)
  let body: { id?: string; entrada?: Record<string, unknown>; ia?: boolean }
  try {
    body = await req.json()
  } catch {
    return json(req, { message: "Datos inválidos." }, 400)
  }
  const calc = buscarCalculadora(String(body.id || ""))
  if (!calc) return json(req, { message: "Esa calculadora no existe." }, 404)
  const entrada = body.entrada && typeof body.entrada === "object" ? body.entrada : {}
  try {
    return json(req, { id: calc.id, resultado: body.ia === true ? ejecutar(calc.id, entrada) : calc.calcular(entrada) })
  } catch {
    return json(req, { message: "No se pudo calcular con esos datos. Revisa los campos." }, 400)
  }
}
