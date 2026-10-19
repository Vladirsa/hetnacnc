// Formato compartido entre las pantallas del cotizador. Va en su propio
// archivo porque acciones.ts es "use server" y de ahí sólo se pueden exportar
// funciones asíncronas.

import type { Cotizacion, ResumenPlan } from "./acciones"

export function dinero(monto: number | string, moneda = "MXN"): string {
  const n = Number(monto)
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda || "MXN",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0)
}

export function fechaCorta(valor: string | null | undefined): string {
  if (!valor) return "—"
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(d)
}

type Estatus = Cotizacion["estatus"]

export const ESTATUS_ETIQUETA: Record<Estatus, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  vista: "Vista por el cliente",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  vencida: "Vencida",
}

// Clases de Tailwind por estatus. "vista" se ve distinto de "enviada" a
// propósito: saber que el cliente ya la abrió es la señal que mueve al taller
// a dar seguimiento.
export const ESTATUS_CLASE: Record<Estatus, string> = {
  borrador: "bg-[#F1EFEA] text-[#6B6A63]",
  enviada: "bg-[#E8EEF7] text-[#2A4A7B]",
  vista: "bg-[#E6F2EF] text-[#1F6E5E]",
  aceptada: "bg-[#E4F1E4] text-[#276B2B]",
  rechazada: "bg-[#F7E9E7] text-[#9B3225]",
  vencida: "bg-[#F6EFE2] text-[#8A6316]",
}

export const PLAN_ETIQUETA: Record<ResumenPlan["plan"], string> = {
  gratis: "Gratis",
  prueba: "Prueba",
  taller: "Taller",
  pro: "Pro",
  industrial: "Industrial",
}

// Una frase para el estado del cupo, que es la pregunta real del taller:
// ¿puedo cotizar hoy sin que me cueste?
export function frasePlan(plan: ResumenPlan): string {
  if (plan.plan === "prueba") {
    return `Prueba, ${plan.prueba_dias} ${plan.prueba_dias === 1 ? "día" : "días"} restantes · cotizaciones sin límite`
  }
  if (plan.limite === null) {
    return "Cotizaciones sin límite"
  }
  const restantes = Math.max(0, plan.limite - plan.usadas)
  if (restantes === 0) {
    return `${plan.usadas} de ${plan.limite} este mes · las siguientes cuestan créditos`
  }
  return `${plan.usadas} de ${plan.limite} este mes · ${restantes} sin costo`
}
