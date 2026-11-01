import type { Course } from "@/lib/data/courses"

export const NIVEL: Record<string, string> = {
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
}

export const precioTexto = (c: Pick<Course, "precio">) => {
  const p = c.precio
  if (!p || p.gratis) return "Gratis"
  return `$${p.mxn.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN`
}

export const duracionTexto = (seg?: number | null) => {
  const s = Number(seg) || 0
  if (!s) return null
  const min = Math.round(s / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
