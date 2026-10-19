// Etiquetas y colores de los escaneos. Aparte de acciones.ts porque de un
// archivo "use server" sólo se pueden exportar funciones asíncronas.

import type { Escaneo } from "./acciones"

type Estatus = Escaneo["estatus"]

export const ESTATUS_ETIQUETA: Record<Estatus, string> = {
  pendiente: "En cola",
  procesando: "Procesando",
  listo: "Listo",
  fallido: "Falló",
}

export const ESTATUS_CLASE: Record<Estatus, string> = {
  pendiente: "bg-[#F1EFEA] text-[#6B6A63]",
  procesando: "bg-[#E8EEF7] text-[#2A4A7B]",
  listo: "bg-[#E4F1E4] text-[#276B2B]",
  fallido: "bg-[#F7E9E7] text-[#9B3225]",
}

export const MODO_ETIQUETA: Record<Escaneo["modo"], string> = {
  preview: "Vista previa",
  scan: "Escaneo profesional",
}

export function fechaHora(valor: string | null | undefined): string {
  if (!valor) return "—"
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(d)
}

export function miles(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—"
  return new Intl.NumberFormat("es-MX").format(n)
}
