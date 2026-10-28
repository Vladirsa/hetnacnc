// Trabajos abiertos de la licitación, contra /store/trabajos-abiertos.
//
// Es público a propósito: es el tablero donde el cliente ve que hay
// movimiento y el taller ve trabajo esperando su precio. El backend ya quita
// nombre, correo, teléfono, archivo y presupuesto; aquí no llega nada privado.

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

const cabeceras = () => ({
  "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
})

export type TrabajoPublico = {
  folio: string
  estado: "abierta" | "asignada" | "cerrada"
  servicio: string
  material: string
  cantidad: string
  medidas: string
  fecha: string
  frecuencia: string
  ciudad: string
  estado_mx: string
  acepta_envio: string
  descripcion: string
  creada: string
  cierra_en: string | null
  propuestas: number
}

export async function trabajosAbiertos(filtros: {
  servicio?: string
  estado_mx?: string
  limit?: number
  offset?: number
} = {}): Promise<{ trabajos: TrabajoPublico[]; total: number }> {
  const q = new URLSearchParams()
  if (filtros.servicio) q.set("servicio", filtros.servicio)
  if (filtros.estado_mx) q.set("estado_mx", filtros.estado_mx)
  if (filtros.limit) q.set("limit", String(filtros.limit))
  if (filtros.offset) q.set("offset", String(filtros.offset))
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/trabajos-abiertos?${q}`, {
      headers: cabeceras(),
      next: { revalidate: 120 },
    })
    if (!res.ok) return { trabajos: [], total: 0 }
    return (await res.json()) as { trabajos: TrabajoPublico[]; total: number }
  } catch {
    // Sin tablero la página de servicios se sigue leyendo; sólo no sale el bloque.
    return { trabajos: [], total: 0 }
  }
}

export async function trabajoPorFolio(folio: string): Promise<TrabajoPublico | null> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/trabajos-abiertos/${encodeURIComponent(folio)}`, {
      headers: cabeceras(),
      next: { revalidate: 120 },
    })
    if (!res.ok) return null
    return ((await res.json()) as { trabajo: TrabajoPublico }).trabajo
  } catch {
    return null
  }
}

// "HET-00012" -> "Corte láser · MDF 6 mm" o, sin datos, el folio.
export const tituloTrabajo = (t: TrabajoPublico) =>
  [t.servicio && t.servicio !== "Otro" ? t.servicio : "", t.material].filter(Boolean).join(" · ") ||
  "Trabajo de fabricación CNC"

export const lugarTrabajo = (t: TrabajoPublico) => [t.ciudad, t.estado_mx].filter(Boolean).join(", ")

// Días que le quedan para recibir propuestas; 0 si cierra hoy.
export const diasRestantes = (t: TrabajoPublico) =>
  t.cierra_en ? Math.max(0, Math.ceil((new Date(t.cierra_en).getTime() - Date.now()) / 86_400_000)) : null
