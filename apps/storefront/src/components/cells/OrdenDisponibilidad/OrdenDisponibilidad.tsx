"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Accordion } from "@/components/molecules/Accordion/Accordion"

// Ordenar el listado y mostrar sólo lo que tiene existencia. Escribe sortBy y
// disponible=1 en la URL (lib/helpers/filtrar-listado.ts) y regresa a la página 1.
const OPCIONES = [
  { valor: "created_at", texto: "Más recientes" },
  { valor: "price_asc", texto: "Precio: menor a mayor" },
  { valor: "price_desc", texto: "Precio: mayor a menor" },
]

export const OrdenDisponibilidad = () => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const cambiar = (campo: string, valor: string | null) => {
    const p = new URLSearchParams(searchParams.toString())
    if (valor) p.set(campo, valor)
    else p.delete(campo)
    p.delete("page")
    const q = p.toString()
    router.push(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }

  const orden = searchParams.get("sortBy") || "created_at"
  const disponible = searchParams.get("disponible") === "1"
  const licencia = searchParams.get("licencia") || ""

  return (
    <Accordion heading="Ordenar, existencia y licencia" data-testid="filter-orden">
      <div className="flex flex-col gap-3 mb-4">
        <select
          value={orden}
          onChange={(e) => cambiar("sortBy", e.target.value === "created_at" ? null : e.target.value)}
          className="w-full rounded-sm border border-primary bg-component px-3 py-2 text-md"
          aria-label="Ordenar productos"
          data-testid="filter-orden-select"
        >
          {OPCIONES.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-md cursor-pointer">
          <input
            type="checkbox"
            checked={disponible}
            onChange={(e) => cambiar("disponible", e.target.checked ? "1" : null)}
            data-testid="filter-disponible"
          />
          Sólo con existencia
        </label>
        {/* Licencia de diseños: qué puedes hacer con el archivo (lib/hetna/licencias) */}
        <label className="flex flex-col gap-1 text-md">
          <span>Licencia del diseño</span>
          <select
            value={licencia}
            onChange={(e) => cambiar("licencia", e.target.value || null)}
            className="w-full rounded-sm border border-primary bg-component px-3 py-2 text-md"
            data-testid="filter-licencia"
          >
            <option value="">Cualquiera</option>
            <option value="personal">Personal (uso propio)</option>
            <option value="comercial">Para vender piezas</option>
            <option value="comercial_ampliada">Producción sin límite</option>
          </select>
        </label>
      </div>
    </Accordion>
  )
}
