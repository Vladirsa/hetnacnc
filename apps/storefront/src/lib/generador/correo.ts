"use server"

// "Mándamelo por correo" de las herramientas del Estudio: llama al backend
// (POST /store/herramienta-correo), que manda el archivo y el precio y deja el
// seguimiento de 2 y 7 días al Reactivador de estimados.
import { cabeceraIpCliente } from "@/lib/seguridad/ip-firmada"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type DisenoCorreoInput = {
  email: string
  acepta: boolean
  sitio_web?: string
  herramienta: string
  archivo: string
  servicio?: string
  dxf?: string | null
  precio?: { servicio: string; material?: string; calibre?: string; ancho: number; largo: number; cantidad: number; corte_mm?: number; perforaciones?: number } | null
}

export async function mandarDisenoCorreo(input: DisenoCorreoInput): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/herramienta-correo`, {
      method: "POST",
      // con la IP del visitante firmada: los topes por IP del API la necesitan
      headers: { "Content-Type": "application/json", "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string, ...(await cabeceraIpCliente()) },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      return { ok: false, mensaje: b.message || "No pudimos mandar el correo. Intenta de nuevo." }
    }
    return { ok: true }
  } catch {
    return { ok: false, mensaje: "No pudimos mandar el correo. Intenta de nuevo." }
  }
}
