// Límite para formularios públicos que mandan correos (auditoría Thermos, 15 nov
// 2026): /store/quote-leads y /store/solicitudes-taller no piden sesión, y un
// script podía hacer que HETNA mandara miles de correos a direcciones ajenas
// (se daña la reputación del dominio y se agota la cuota de Resend).
//
// Dos límites en memoria (el API corre en un solo proceso): por IP y por correo
// de destino. Con sesión de cliente no se limita por IP.
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ipCliente } from "./ip-cliente"

const HORA = 3600_000

function contador() {
  const visitas = new Map<string, number[]>()
  return (clave: string, max: number): boolean => {
    const ahora = Date.now()
    const lista = (visitas.get(clave) || []).filter((t) => ahora - t < HORA)
    if (lista.length >= max) {
      visitas.set(clave, lista)
      return false
    }
    lista.push(ahora)
    visitas.set(clave, lista)
    if (visitas.size > 5000) {
      for (const [k, v] of visitas) if (!v.some((t) => ahora - t < HORA)) visitas.delete(k)
    }
    return true
  }
}

export function limitarFormulario(opc: { porIpHora: number; porCorreoHora: number; nombre: string }) {
  const porIp = contador()
  const porCorreo = contador()
  return (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const conSesion = !!(req as any).auth_context?.actor_id
    if (!conSesion && !porIp(`${opc.nombre}:${ipCliente(req as any)}`, opc.porIpHora)) {
      res.status(429).json({ message: "Mandaste muchas solicitudes seguidas. Intenta de nuevo en un rato o escríbenos por WhatsApp." })
      return
    }
    const correo = String(((req.body || {}) as { email?: unknown }).email || "").trim().toLowerCase()
    if (correo && !porCorreo(`${opc.nombre}:${correo}`, opc.porCorreoHora)) {
      res.status(429).json({ message: "Ya recibimos varias solicitudes con ese correo en la última hora. Intenta más tarde." })
      return
    }
    next()
  }
}
