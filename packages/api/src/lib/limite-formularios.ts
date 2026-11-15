// Límite para formularios públicos que mandan correos (auditoría Thermos, 15 nov
// 2026): /store/quote-leads y /store/solicitudes-taller no piden sesión, y un
// script podía hacer que HETNA mandara miles de correos a direcciones ajenas
// (se daña la reputación del dominio y se agota la cuota de Resend).
//
// No se limita por IP: la tienda llama a estas rutas desde su servidor (server
// actions), así que todos los visitantes llegan con la misma IP y un límite por
// IP bloquearía el formulario para todo el sitio. En su lugar, en memoria (el
// API corre en un solo proceso):
//   - por correo de destino, sólo sin sesión (con sesión, el correo es el suyo);
//   - un tope total por hora para envíos sin sesión, que frena un envío masivo.
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

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

export function limitarFormulario(opc: { nombre: string; porCorreoHora: number; totalHora: number }) {
  const porCorreo = contador()
  const total = contador()
  return (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    if ((req as any).auth_context?.actor_id) return next()
    const correo = String(((req.body || {}) as { email?: unknown }).email || "").trim().toLowerCase()
    if (correo && !porCorreo(`${opc.nombre}:${correo}`, opc.porCorreoHora)) {
      res.status(429).json({ message: "Ya recibimos varias solicitudes con ese correo en la última hora. Intenta más tarde o entra a tu cuenta." })
      return
    }
    if (!total(opc.nombre, opc.totalHora)) {
      res.status(429).json({ message: "Estamos recibiendo muchas solicitudes. Intenta de nuevo en unos minutos o escríbenos por WhatsApp." })
      return
    }
    next()
  }
}
