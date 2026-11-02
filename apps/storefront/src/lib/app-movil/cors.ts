// API para la app del taller (Cotizador HETNA en Android y en web).
//
// La app nativa no tiene CORS; la versión web vive en hetnacnc.com/cotizador
// (mismo origen). Estos encabezados sirven para probarla desde localhost o desde
// un subdominio como app.hetnacnc.com. Orígenes extra: APP_CORS="https://a,https://b".
import { NextResponse } from "next/server"
import { ipDe } from "@/lib/seguridad/ip-cliente"

const BASE = ["https://hetnacnc.com", "https://www.hetnacnc.com", "http://localhost:8080", "http://localhost:5000"]
const permitidos = () => [...BASE, ...(process.env.APP_CORS || "").split(",").map((x) => x.trim()).filter(Boolean)]

export function cors(req: Request) {
  const origen = req.headers.get("origin") || ""
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }
  if (permitidos().includes(origen)) h["Access-Control-Allow-Origin"] = origen
  return h
}

export const opciones = (req: Request) => new NextResponse(null, { status: 204, headers: cors(req) })

export const json = (req: Request, body: unknown, status = 200, extra: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...cors(req), ...extra } })

// Límite sencillo por IP (en memoria; se reinicia con el proceso, suficiente para frenar abusos).
const visitas = new Map<string, number[]>()
export function excedido(req: Request, clave: string, porMinuto: number) {
  const ip = ipDe(req.headers) || "local"
  const k = `${clave}:${ip}`
  const ahora = Date.now()
  const lista = (visitas.get(k) || []).filter((t) => ahora - t < 60_000)
  if (lista.length >= porMinuto) return true
  lista.push(ahora)
  visitas.set(k, lista)
  return false
}
