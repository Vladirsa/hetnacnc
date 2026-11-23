// De dónde vino el cliente que mandó la solicitud (anuncio, correo, Google…):
// el navegador recuerda la última liga con utm_* / gclid / fbclid
// (storefront lib/hetna/origen-visita.ts) y la manda con la solicitud. Aquí se limpia
// y se agrupa para el tablero de estrategia ("Campañas").

export type OrigenVisita = { fuente: string; medio: string; campana: string; contenido: string }

const limpio = (v: unknown, max: number) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\w.\-+ ]/g, "")
    .slice(0, max)

/** Valida lo que mandó el navegador. Sin fuente ni campaña → null. Pura. */
export function limpiarOrigen(v: unknown): OrigenVisita | null {
  if (!v || typeof v !== "object") return null
  const o = v as Record<string, unknown>
  const r = { fuente: limpio(o.fuente, 40), medio: limpio(o.medio, 40), campana: limpio(o.campana, 80), contenido: limpio(o.contenido, 80) }
  return r.fuente || r.campana ? r : null
}

/** Registros de taller por fuente y campaña (de más a menos). Pura. */
export function agruparRegistros(regs: { datos?: any }[]) {
  const m = new Map<string, { fuente: string; campana: string; registros: number }>()
  for (const r of regs) {
    const o = limpiarOrigen(r.datos?.origen)
    const fuente = o?.fuente || "directo"
    const campana = o?.campana || ""
    const k = `${fuente}|${campana}`
    const e = m.get(k) || { fuente, campana, registros: 0 }
    e.registros++
    m.set(k, e)
  }
  return [...m.values()].sort((a, b) => b.registros - a.registros)
}

/** Solicitudes por campaña (de la más a la menos), con cuántas eligieron propuesta. Pura. */
export function agruparOrigenes(sols: { trabajo?: any; propuesta_elegida?: string | null }[]) {
  const m = new Map<string, { fuente: string; campana: string; solicitudes: number; con_propuesta_elegida: number }>()
  for (const s of sols) {
    const o = limpiarOrigen(s.trabajo?.origen)
    const fuente = o?.fuente || "directo"
    const campana = o?.campana || ""
    const k = `${fuente}|${campana}`
    const e = m.get(k) || { fuente, campana, solicitudes: 0, con_propuesta_elegida: 0 }
    e.solicitudes++
    if (s.propuesta_elegida) e.con_propuesta_elegida++
    m.set(k, e)
  }
  return [...m.values()].sort((a, b) => b.solicitudes - a.solicitudes)
}
