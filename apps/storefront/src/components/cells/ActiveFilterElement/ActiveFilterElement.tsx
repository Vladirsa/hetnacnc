"use client"
import { Chip } from "@/components/atoms/Chip/Chip"
import useFilters from "@/hooks/useFilters"
import { CloseIcon } from "@/icons"

const filtersLabels = {
  category: "Categoría",
  brand: "Marca",
  min_price: "Precio mínimo",
  max_price: "Precio máximo",
  disponible: "Existencia",
  color: "Color",
  size: "Medida",
  query: "Búsqueda",
  condition: "Estado",
  rating: "Calificación",
}

// "tipo-de-control" -> "Tipo de control" cuando no hay nombre del atributo
export const nombreLegible = (clave: string) => {
  const t = clave.replace(/[-_]+/g, " ").trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export const ActiveFilterElement = ({
  filter,
  nombres,
}: {
  filter: string[]
  nombres?: Record<string, string>
}) => {
  const { updateFilters } = useFilters(filter[0])

  const activeFilters = filter[1].split(",")

  const removeFilterHandler = (filter: string) => {
    updateFilters(filter)
  }

  return (
    <div className="flex gap-2 items-center mb-4">
      <span className="label-md hidden md:inline-block">
        {nombres?.[filter[0]] ??
          filtersLabels[filter[0] as keyof typeof filtersLabels] ??
          nombreLegible(filter[0])}
        :
      </span>
      {activeFilters.map((element) => {
        const Element = () => {
          return (
            <span className="flex gap-2 items-center cursor-default whitespace-nowrap">
              {filter[0] === "disponible" ? "Sólo con existencia" : element}{" "}
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
