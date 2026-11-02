"use client"

import { Button } from "@/components/atoms/Button/Button"
import { Chip } from "@/components/atoms/Chip/Chip"
import { Input } from "@/components/atoms/Input/Input"
import { Accordion } from "@/components/molecules/Accordion/Accordion"
import { FilterCheckboxOption } from "@/components/molecules/FilterCheckboxOption/FilterCheckboxOption"
import { Modal } from "@/components/molecules/Modal/Modal"
import useFilters from "@/hooks/useFilters"
import useUpdateSearchParams from "@/hooks/useUpdateSearchParams"
import { cn } from "@/lib/utils"
import { useSearchParams } from "next/navigation"
import React, { useEffect, useState } from "react"
import { ProductListingActiveFilters } from "../ProductListingActiveFilters/ProductListingActiveFilters"
import useGetAllSearchParams from "@/hooks/useGetAllSearchParams"
import type { SearchFacets } from "@/lib/data/products"
import { OrdenDisponibilidad } from "@/components/cells/OrdenDisponibilidad/OrdenDisponibilidad"
import { nombreLegible } from "@/components/cells/ActiveFilterElement/ActiveFilterElement"

export type FacetModel = {
  value: string
  count: number
}

export const ProductSearchSidebar = ({ facets }: { facets: SearchFacets }) => {
  const [isMobile, setIsMobile] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const { allSearchParams } = useGetAllSearchParams()

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const attributeEntries = Object.entries(facets.attributes || {})

  const renderAttributeFilters = () =>
    attributeEntries.map(([key, items]) => (
      <AttributeFilter
        key={key}
        attributeKey={key}
        nombre={facets.nombres?.[key]}
        items={items}
        defaultOpen={Boolean(allSearchParams[key])}
      />
    ))

  return isMobile ? (
    <>
      <Button onClick={() => setIsOpen(true)} className="w-full uppercase mb-4">
        Filtros
      </Button>
      {isOpen && (
        <Modal heading="Filtros" onClose={() => setIsOpen(false)}>
          <div className="px-4">
            <ProductListingActiveFilters nombres={facets.nombres} />
            {/* Precio y existencia se filtran después de la consulta:
                lib/helpers/filtrar-listado.ts y searchProducts. */}
            <OrdenDisponibilidad />
            <PriceFilter
              defaultOpen={Boolean(
                allSearchParams.min_price || allSearchParams.max_price
              )}
            />
            {renderAttributeFilters()}
          </div>
        </Modal>
      )}
    </>
  ) : (
    <div>
      {/* Precio y existencia se filtran después de la consulta:
          lib/helpers/filtrar-listado.ts y searchProducts. */}
      <OrdenDisponibilidad />
      <PriceFilter />
      {renderAttributeFilters()}
    </div>
  )
}

function AttributeFilter({
  attributeKey,
  nombre,
  items,
  defaultOpen = true,
}: {
  attributeKey: string
  nombre?: string
  items: FacetModel[]
  defaultOpen?: boolean
}) {
  const { updateFilters, isFilterActive } = useFilters(attributeKey)

  const selectHandler = (option: string) => {
    updateFilters(option)
  }

  // El nombre que se le puso al atributo en el panel; si no hay, el código legible
  const heading = nombre || nombreLegible(attributeKey)

  if (attributeKey === "size") {
    return (
      <Accordion heading={heading} defaultOpen={defaultOpen}>
        <ul className="grid grid-cols-4 mt-2 gap-2">
          {(items || []).map(({ value, count }) => (
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
      <Accordion heading={heading} defaultOpen={defaultOpen}>
        <ul className="px-4">
          {(items || []).map(({ value, count }) => (
            <li
              key={value}
              className="mb-4 flex items-center justify-between"
            >
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
    <Accordion heading={heading} defaultOpen={defaultOpen}>
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

function PriceFilter({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const [min, setMin] = useState("")
  const [max, setMax] = useState("")

  const updateSearchParams = useUpdateSearchParams()
  const searchParams = useSearchParams()

  useEffect(() => {
    setMin(searchParams.get("min_price") || "")
    setMax(searchParams.get("max_price") || "")
  }, [searchParams])

  const updateMinPriceHandler = (
    e: React.FormEvent<HTMLFormElement> | React.FocusEvent<HTMLInputElement>
  ) => {
    e.preventDefault()
    updateSearchParams("min_price", min)
  }

  const updateMaxPriceHandler = (
    e: React.FormEvent<HTMLFormElement> | React.FocusEvent<HTMLInputElement>
  ) => {
    e.preventDefault()
    updateSearchParams("max_price", max)
  }
  return (
    <Accordion heading="Precio" defaultOpen={defaultOpen}>
      <div className="flex gap-2 mb-4">
        <form method="POST" onSubmit={updateMinPriceHandler}>
          <Input
            placeholder="Mín"
            onChange={(e) => setMin(e.target.value)}
            value={min}
            onBlur={(e) => {
              setTimeout(() => {
                updateMinPriceHandler(e)
              }, 500)
            }}
            type="number"
            className="no-arrows-number-input"
          />
          <input type="submit" className="hidden" />
        </form>
        <form method="POST" onSubmit={updateMaxPriceHandler}>
          <Input
            placeholder="Máx"
            onChange={(e) => setMax(e.target.value)}
            onBlur={(e) => {
              setTimeout(() => {
                updateMaxPriceHandler(e)
              }, 500)
            }}
            value={max}
            type="number"
            className="no-arrows-number-input"
          />
          <input type="submit" className="hidden" />
        </form>
      </div>
    </Accordion>
  )
}
