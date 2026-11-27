// "Lo más importante" (pedido del dueño, 15 nov 2026: características de uso
// como en Amazon o Mercado Libre). Toma la primera lista de la descripción
// del producto (la que el vendedor escribió como "Qué incluye" o
// "Características") y la pone arriba, en un cuadro que se lee de un vistazo.
// Si la descripción no trae lista, no se muestra nada.

import { TS } from "@/i18n/TS"
const limpiar = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()

/** Viñetas de la primera lista de la descripción (máximo 8). */
export function caracteristicasDe(descripcion?: string | null): string[] {
  const m = String(descripcion || "").match(/<ul[^>]*>([\s\S]*?)<\/ul>/i)
  if (!m) return []
  return [...m[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((x) => limpiar(x[1]))
    .filter((t) => t.length > 1 && t.length < 200)
    .slice(0, 8)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
}

export const LoMasImportante = ({ descripcion }: { descripcion?: string | null }) => {
  const lista = caracteristicasDe(descripcion)
  if (!lista.length) return null
  return (
    <section className="overflow-hidden rounded-[14px] border border-[#F2DCC8] bg-white" data-testid="lo-mas-importante">
      <h2 className="m-0 bg-gradient-to-r from-[#142033] to-[#1E3250] px-4 py-2.5 text-[15px] font-bold text-white">
        <TS>Lo más importante</TS>
      </h2>
      <ul className="m-0 grid list-none gap-2 p-4 sm:grid-cols-2">
        {lista.map((t) => (
          <li key={t} className="flex items-start gap-2 text-[14.5px] leading-snug text-[#2E2D29]">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E8F5EC] text-[12px] font-bold text-[#17803F]" aria-hidden="true">
              ✓
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
