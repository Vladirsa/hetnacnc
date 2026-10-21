// Envíos HETNA para la app del taller.
// GET  ?cp=90300          → estado, municipio y colonias del código postal
// POST { cp_origen, colonia_origen, cp_destino, colonia_destino, tipo, peso, largo, ancho, alto }
//                          → paqueterías con el precio HETNA (margen ya incluido)
// Pasa por aquí para que la app no necesite la llave pública de Medusa ni la
// dirección interna del backend.
import { excedido, json, opciones } from "@/lib/app-movil/cors"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PK = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string

const backend = async (ruta: string, init: RequestInit = {}, ip = "") => {
  const res = await fetch(`${BACKEND}${ruta}`, {
    ...init,
    headers: { "Content-Type": "application/json", "x-publishable-api-key": PK, ...(ip ? { "x-forwarded-for": ip } : {}) },
    cache: "no-store",
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

export const OPTIONS = (req: Request) => opciones(req)

export async function GET(req: Request) {
  const cp = new URL(req.url).searchParams.get("cp") || ""
  if (!/^\d{5}$/.test(cp)) return json(req, { message: "El código postal debe tener 5 dígitos." }, 400)
  try {
    const { status, body } = await backend(`/store/envios/cp/${cp}`)
    return json(req, body, status, status === 200 ? { "Cache-Control": "public, max-age=86400" } : {})
  } catch {
    return json(req, { message: "No pudimos consultar el código postal." }, 502)
  }
}

export async function POST(req: Request) {
  if (excedido(req, "envio", 12)) return json(req, { message: "Demasiadas cotizaciones. Espera un minuto." }, 429)
  let datos: unknown
  try {
    datos = await req.json()
  } catch {
    return json(req, { message: "Datos inválidos." }, 400)
  }
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    const { status, body } = await backend("/store/envios/cotizar", { method: "POST", body: JSON.stringify(datos) }, ip)
    return json(req, body, status)
  } catch {
    return json(req, { message: "No pudimos cotizar el envío. Intenta de nuevo." }, 502)
  }
}
