import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { SkydropxClient } from "../../../../modules/skydropx/client"

// Cotizador público de Envíos HETNA: todas las paqueterías disponibles con el margen de HETNA.
type Body = { cp_origen?: string; cp_destino?: string; peso?: number | string; largo?: number | string; ancho?: number | string; alto?: number | string }

const LIMITE = 12 // cotizaciones por minuto por IP
const visitas = new Map<string, number[]>()
let cliente: SkydropxClient | null = null

const num = (v: unknown, min: number, max: number) => {
  const n = Number(String(v ?? "").replace(",", "."))
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

export const POST = async (req: MedusaRequest<Body>, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim()
  const ahora = Date.now()
  const lista = (visitas.get(ip) || []).filter((t) => ahora - t < 60_000)
  if (lista.length >= LIMITE) return res.status(429).json({ message: "Demasiadas cotizaciones. Espera un minuto." })
  lista.push(ahora)
  visitas.set(ip, lista)

  const b = (req.body || {}) as Body
  const cpO = String(b.cp_origen || "").trim()
  const cpD = String(b.cp_destino || "").trim()
  if (!/^\d{5}$/.test(cpO) || !/^\d{5}$/.test(cpD)) return res.status(400).json({ message: "Escribe códigos postales de 5 dígitos." })
  const peso = num(b.peso, 0.1, 70)
  const largo = num(b.largo, 1, 200)
  const ancho = num(b.ancho, 1, 200)
  const alto = num(b.alto, 1, 200)
  if (!peso || !largo || !ancho || !alto) return res.status(400).json({ message: "Revisa el peso (0.1 a 70 kg) y las medidas (1 a 200 cm)." })

  const id = process.env.SKYDROPX_CLIENT_ID
  const secreto = process.env.SKYDROPX_CLIENT_SECRET
  if (!id || !secreto) return res.status(503).json({ message: "El cotizador de envíos no está disponible por ahora." })
  cliente = cliente || new SkydropxClient({ clientId: id, clientSecret: secreto, sandbox: process.env.SKYDROPX_SANDBOX === "true" })

  // Peso volumétrico (largo × ancho × alto / 5000): las paqueterías cobran el mayor.
  const volumetrico = Math.round(((largo * ancho * alto) / 5000) * 10) / 10
  const margen = Number(process.env.ENVIO_MARGEN_PCT ?? process.env.SKYDROPX_MARGEN_PCT ?? 4)
  const minimo = Number(process.env.ENVIO_TARIFA_MINIMA || 20)
  const permitidas = (process.env.ENVIO_PAQUETERIAS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)

  try {
    const cot: any = await cliente.cotizar({ cp: cpO }, { cp: cpD }, { largo, ancho, alto, peso })
    const vistos = new Set<string>()
    const opciones = (cot.rates || [])
      .filter((x: any) => {
        const nombre = `${x.provider_display_name} ${x.provider_service_name}`.toLowerCase()
        if (permitidas.length && !permitidas.some((p) => nombre.includes(p))) return false
        return x.success === true && Number(x.total) >= minimo && !/sin recolecci|ltl|plataforma|punto/.test(nombre)
      })
      .map((x: any) => ({
        paqueteria: x.provider_display_name,
        servicio: x.provider_service_name,
        dias: x.days ?? null,
        precio: Math.ceil(Number(x.total) * (1 + margen / 100)),
      }))
      .sort((a: any, z: any) => a.precio - z.precio)
      .filter((o: any) => {
        const k = `${o.paqueteria}|${o.servicio}`
        if (vistos.has(k)) return false
        vistos.add(k)
        return true
      })
      .slice(0, 8)
    if (!opciones.length) return res.json({ opciones: [], volumetrico, message: "No hay paqueterías disponibles para esa ruta." })
    return res.json({ opciones, volumetrico, peso_cobrado: Math.max(peso, volumetrico) })
  } catch (e) {
    logger.warn(`[envios] cotizar falló: ${(e as Error).message}`)
    return res.status(502).json({ message: "No pudimos cotizar en este momento. Intenta de nuevo en unos minutos." })
  }
}
