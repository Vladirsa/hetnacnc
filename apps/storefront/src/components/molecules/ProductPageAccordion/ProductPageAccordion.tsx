"use client"

import { useEffect, useRef, useState } from "react"

// Un módulo de la ficha del producto.
//
// Antes eran cajas iguales con el título en mayúsculas chiquitas y un icono de
// menos: todas pesaban lo mismo y ninguna llamaba. Ahora cada una trae su
// distintivo de color, para que el ojo encuentre de un brinco lo que busca --
// la descripción, las medidas, el envío -- en vez de leer cuatro títulos
// iguales.
export const ProductPageAccordion = ({
  children,
  heading,
  icono = "📄",
  defaultOpen = true,
}: {
  children: React.ReactNode
  heading: string
  icono?: string
  defaultOpen?: boolean
}) => {
  const [abierto, setAbierto] = useState(defaultOpen)
  const [alto, setAlto] = useState<number | string>(defaultOpen ? "100%" : 0)
  const contenido = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (contenido.current) setAlto(contenido.current.scrollHeight || 0)
  }, [children])

  return (
    <section className="overflow-hidden rounded-[14px] border border-[#E7E4DC] bg-white">
      <button
        type="button"
        onClick={() => setAbierto((x) => !x)}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-[#FAF9F6]"
      >
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#FFF3EC] text-[15px]"
          >
            {icono}
          </span>
          <span className="text-[15px] font-bold text-[#1B1B18]">{heading}</span>
        </span>
        <span
          aria-hidden="true"
          className={`text-[18px] leading-none text-[#8A8780] transition-transform duration-200 ${
            abierto ? "rotate-180" : ""
          }`}
        >
          ⌄
        </span>
      </button>
      <div
        ref={contenido}
        className="overflow-hidden px-4 transition-all duration-300"
        style={{ maxHeight: abierto ? alto : 0 }}
      >
        <div className="pb-4 pt-1">{children}</div>
      </div>
    </section>
  )
}
