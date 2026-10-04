"use client"

import { Button, Chip } from "@/components/atoms"
import { Accordion, FilterCheckboxOption, Modal } from "@/components/molecules"
import useFilters from "@/hooks/useFilters"
import useUpdateSearchParams from "@/hooks/useUpdateSearchParams"
import { cn } from "@/lib/utils"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import React, { useEffect, useState } from "react"
import { ProductListingActiveFilters } from "../ProductListingActiveFilters/ProductListingActiveFilters"
import useGetAllSearchParams from "@/hooks/useGetAllSearchParams"
import type { SearchFacets } from "@/lib/data/products"

export type FacetModel = {
  value: string
  count: number
}

// "tipo-de-maquina" -> "Tipo de maquina" cuando el atributo no trae nombre
const humanizar = (clave: string) => {
  const texto = clave.replace(/[-_]+/g, " ").trim()
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export const ProductSearchSidebar = ({ facets }: { facets: SearchFacets }) => {
  const [isMobile, setIsMobile] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const { allSearchParams, count } = useGetAllSearchParams()

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const attributeEntries = Object.entries(facets.attributes || {})

  const filtros = (
    <>
      <AvailabilityFilter />
      <PriceFilter
        defaultOpen={Boolean(allSearchParams.min_price || allSearchParams.max_price)}
      />
      {attributeEntries.map(([key, items]) => (
        <AttributeFilter
          key={key}
          attributeKey={key}
          label={facets.names?.[key] || humanizar(key)}
          items={items}
          defaultOpen={Boolean(allSearchParams[key])}
        />
      ))}
    </>
  )

  return isMobile ? (
    <>
      <Button onClick={() => setIsOpen(true)} className="w-full uppercase mb-4">
        {count > 0 ? `Filtros (${count})` : "Filtros"}
      </Button>
      {isOpen && (
        <Modal heading="Filtros" onClose={() => setIsOpen(false)}>
          <div className="px-4">
            <ProductListingActiveFilters />
            {filtros}
            <div className="sticky bottom-0 bg-primary pt-3 pb-4">
              <Button onClick={() => setIsOpen(false)} className="w-full uppercase">
                Ver resultados
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  ) : (
    <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-4 shadow-[0_1px_3px_rgba(27,27,24,0.04)]">
      <div className="flex items-center justify-between pb-2">
        <h2 className="font-display text-[16px] font-semibold uppercase tracking-wide m-0 text-[#142033]">
          Filtros
        </h2>
        <ClearAll visible={count > 0} />
      </div>
      {filtros}
    </div>
  )
}

function ClearAll({ visible }: { visible: boolean }) {
  const { clearAllFilters } = useFilters("")
  if (!visible) return null
  return (
    <button
      type="button"
      onClick={clearAllFilters}
      className="text-[13px] font-semibold text-[#B34D07] hover:underline"
    >
      Limpiar todo
    </button>
  )
}

function AvailabilityFilter() {
  const updateSearchParams = useUpdateSearchParams()
  const searchParams = useSearchParams()
  const activo = searchParams.get("disponible") === "1"

  return (
    <Accordion heading="Disponibilidad" defaultOpen>
      <div className="px-4 mb-4">
        <FilterCheckboxOption
          checked={activo}
          onCheck={() => updateSearchParams("disponible", activo ? null : "1")}
          label="Solo con precio y disponibles"
        />
      </div>
    </Accordion>
  )
}

function AttributeFilter({
  attributeKey,
  label,
  items,
  defaultOpen = true,
}: {
  attributeKey: string
  label: string
  items: FacetModel[]
  defaultOpen?: boolean
}) {
  const { updateFilters, isFilterActive } = useFilters(attributeKey)

  const selectHandler = (option: string) => {
    updateFilters(option)
  }

  if (attributeKey === "size") {
    return (
      <Accordion heading={label} defaultOpen={defaultOpen}>
        <ul className="grid grid-cols-4 mt-2 gap-2">
          {(items || []).map(({ value }) => (
            <li key={value} className="mb-4">
              <Chip
                selected={isFilterActive(value)}
                onSelect={() => selectHandler(value)}
                value={value}
                className="w-full !justify-center !py-2 !font-normal"
              />
            </li>
          ))}
        </ul>
      </Accordion>
    )
  }

  if (attributeKey === "color") {
    return (
      <Accordion heading={label} defaultOpen={defaultOpen}>
        <ul className="px-4">
          {(items || []).map(({ value, count }) => (
            <li key={value} className="mb-4 flex items-center justify-between">
              <FilterCheckboxOption
                checked={isFilterActive(value)}
                disabled={count === 0}
                onCheck={selectHandler}
                label={value}
              />
              <div
                style={{ backgroundColor: value.toLowerCase() }}
                className={cn(
                  "w-5 h-5 border border-primary rounded-xs",
                  !value && "opacity-30"
                )}
              />
            </li>
          ))}
        </ul>
      </Accordion>
    )
  }

  return (
    <Accordion heading={label} defaultOpen={defaultOpen}>
      <ul className="px-4">
        {(items || []).map(({ value, count }) => (
          <li key={value} className="mb-4">
            <FilterCheckboxOption
              checked={isFilterActive(value)}
              disabled={count === 0}
              onCheck={selectHandler}
              label={value}
            />
          </li>
        ))}
      </ul>
    </Accordion>
  )
}

function PriceFilter({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [min, setMin] = useState("")
  const [max, setMax] = useState("")

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    setMin(searchParams.get("min_price") || "")
    setMax(searchParams.get("max_price") || "")
  }, [searchParams])

  // Un solo push a la URL con los dos valores (antes cada campo hacía el suyo)
  const aplicar = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    const minimo = Number(min)
    const maximo = Number(max)
    if (min && Number.isFinite(minimo) && minimo >= 0) params.set("min_price", String(minimo))
    else params.delete("min_price")
    if (max && Number.isFinite(maximo) && maximo >= 0) params.set("max_price", String(maximo))
    else params.delete("max_price")
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const invalido = Boolean(min && max && Number(min) > Number(max))

  return (
    <Accordion heading="Precio (MXN)" defaultOpen={defaultOpen}>
      <form onSubmit={aplicar} className="px-4 mb-4">
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Mín"
            aria-label="Precio mínimo"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="no-arrows-number-input w-full min-w-0 rounded-[8px] border border-[#D9D5C9] px-3 py-2 text-[14px]"
          />
          <span className="text-[#6B6A63]" aria-hidden="true">–</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Máx"
            aria-label="Precio máximo"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="no-arrows-number-input w-full min-w-0 rounded-[8px] border border-[#D9D5C9] px-3 py-2 text-[14px]"
          />
        </div>
        {invalido && (
          <p className="m-0 mt-2 text-[12.5px] text-[#B3261E]">El mínimo no puede ser mayor que el máximo.</p>
        )}
        <button
          type="submit"
          disabled={invalido}
          className="mt-3 w-full rounded-[8px] bg-[#142033] px-3 py-2 text-[13.5px] font-semibold uppercase tracking-wide text-white transition hover:bg-[#1d3050] disabled:opacity-40"
        >
          Aplicar
        </button>
      </form>
    </Accordion>
  )
}
