// Piezas de la tienda (/mx/tienda) que sirven igual en servidor y navegador.
import { T } from "@/components/hetna/i18n/Idioma"
import type { ComoSeCompra } from "@/lib/hetna/tienda"

export const C = {
  fondo: "#E9ECEF", // gris acero claro
  carbon: "#1E2329",
  gris: "#5B6370",
  borde: "#D4D9DF",
  naranja: "#E85D04",
  naranjaOscuro: "#C24E03",
}

export const mxn = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)

/** "Desde $30", "Desde $0 · hay gratis" o "Precio por cotización". */
export function textoDesde(desde: number | null) {
  if (desde == null) return "Precio por cotización"
  if (desde === 0) return "Desde $0 · hay gratis"
  return `Desde ${mxn(desde)}`
}

export function textoConteo(n: number, como: ComoSeCompra | "cotizacion") {
  if (como === "servicio") return `${n} ${n === 1 ? "servicio" : "servicios"}`
  if (como === "creditos") return `${n} ${n === 1 ? "paquete" : "paquetes"}`
  return `${n} ${n === 1 ? "producto" : "productos"}`
}

const ETIQUETAS: Record<string, { texto: string; clase: string }> = {
  descarga: { texto: "Descarga inmediata", clase: "bg-[#1E2329] text-white" },
  servicio: { texto: "Servicio", clase: "bg-white text-[#1E2329] ring-1 ring-[#1E2329]" },
  fisico: { texto: "Producto físico", clase: "bg-white text-[#1E2329] ring-1 ring-[#1E2329]" },
  creditos: { texto: "Compra en línea", clase: "bg-white text-[#1E2329] ring-1 ring-[#1E2329]" },
  cotizacion: { texto: "Cotización", clase: "bg-[#E85D04] text-white" },
  talleres: { texto: "Para talleres", clase: "bg-[#1E2329] text-white" },
  directorio: { texto: "Directorio", clase: "bg-white text-[#1E2329] ring-1 ring-[#1E2329]" },
  proximamente: { texto: "Próximamente", clase: "bg-[#FFF4EC] text-[#A84303] ring-1 ring-[#F3C9A8]" },
}

export function Etiqueta({ tipo }: { tipo: keyof typeof ETIQUETAS | string }) {
  const e = ETIQUETAS[tipo] || ETIQUETAS.servicio
  return <span className={`inline-flex items-center rounded px-2 py-1 text-[11px] font-bold uppercase tracking-[0.06em] ${e.clase}`}><T>{e.texto}</T></span>
}

// Patrones de fondo (SVG en línea) para las tarjetas sin foto
const SVG: Record<string, string> = {
  hex: `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='48.5' viewBox='0 0 28 48.5'><path d='M14 0l14 8.08v16.17L14 32.33 0 24.25V8.08zM14 32.33v16.17' fill='none' stroke='%23F0A06B' stroke-width='1.4'/></svg>`,
  rejilla: `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><path d='M24 0H0v24' fill='none' stroke='%239AA3AE' stroke-width='1'/></svg>`,
  puntos: `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><circle cx='2' cy='2' r='1.6' fill='%23F0A06B'/></svg>`,
  lineas: `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14'><path d='M-2 16L16 -2' stroke='%239AA3AE' stroke-width='1.2'/></svg>`,
}

export function Patron({ tipo, oscuro = false, children }: { tipo: string; oscuro?: boolean; children?: React.ReactNode }) {
  return (
    <div
      className={`relative h-full w-full ${oscuro ? "bg-[#1E2329]" : "bg-[#F4F5F7]"}`}
      style={{ backgroundImage: `url("data:image/svg+xml,${SVG[tipo] || SVG.rejilla}")` }}
      aria-hidden="true"
    >
      {children}
    </div>
  )
}

export const BTN =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-[#E85D04] px-4 text-[15px] font-semibold text-white hover:bg-[#C24E03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
export const BTN2 =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-[#1E2329] bg-white px-4 text-[15px] font-semibold text-[#1E2329] hover:bg-[#1E2329] hover:text-white"
