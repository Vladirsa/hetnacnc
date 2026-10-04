"use client"
import { Chip } from "@/components/atoms"
import useFilters from "@/hooks/useFilters"
import { CloseIcon } from "@/icons"

const filtersLabels = {
  category: "Category",
  brand: "Marca",
  min_price: "Precio mín.",
  max_price: "Precio máx.",
  disponible: "Disponibilidad",
  color: "Color",
  size: "Size",
  query: "Búsqueda",
  condition: "Condition",
  rating: "Rating",
}

export const ActiveFilterElement = ({ filter }: { filter: string[] }) => {
  const { updateFilters } = useFilters(filter[0])

  const activeFilters = filter[1].split(",")

  const textoDe = (valor: string) => {
    if (filter[0] === "disponible") return "Solo disponibles"
    if (filter[0] === "min_price" || filter[0] === "max_price") return `$${valor} MXN`
    return valor
  }

  const removeFilterHandler = (filter: string) => {
    updateFilters(filter)
  }

  return (
    <div className="flex gap-2 items-center mb-4">
      <span className="label-md hidden md:inline-block">
        {filtersLabels[filter[0] as keyof typeof filtersLabels] ??
          filter[0].charAt(0).toUpperCase() + filter[0].slice(1)}
        :
      </span>
      {activeFilters.map((element) => {
        const Element = () => {
          return (
            <span className="flex gap-2 items-center cursor-default whitespace-nowrap">
              {textoDe(element)}{" "}
              <span onClick={() => removeFilterHandler(element)}>
                <CloseIcon size={16} className="cursor-pointer" />
              </span>
            </span>
          )
        }
        return <Chip key={element} value={<Element />} />
      })}
    </div>
  )
}
