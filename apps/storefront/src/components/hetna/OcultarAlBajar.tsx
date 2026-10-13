"use client"

import { ReactNode, useEffect, useState } from "react"

// Oculta su contenido cuando el cliente baja por la página y lo vuelve a
// mostrar al regresar arriba.
// - Por defecto solo actúa en celular (en computadora no hace nada).
// - Con tambienEscritorio también actúa en computadora: así el encabezado
//   se queda delgado y fijo (solo logo, buscador y botones) al hacer scroll.
export const OcultarAlBajar = ({
  children,
  tambienEscritorio = false,
}: {
  children: ReactNode
  tambienEscritorio?: boolean
}) => {
  const [oculto, setOculto] = useState(false)

  useEffect(() => {
    let cuadro = 0
    const revisar = () => {
      cancelAnimationFrame(cuadro)
      cuadro = requestAnimationFrame(() => {
        const y = window.scrollY
        // Margen para que no parpadee: se oculta pasando 80px y regresa casi hasta arriba
        setOculto((prev) => (prev ? y > 10 : y > 80))
      })
    }
    revisar()
    window.addEventListener("scroll", revisar, { passive: true })
    return () => {
      cancelAnimationFrame(cuadro)
      window.removeEventListener("scroll", revisar)
    }
  }, [])

  const soloCelular = tambienEscritorio ? "" : "md:max-h-none md:overflow-visible"

  return (
    <div
      className={`transition-[max-height] duration-200 ease-out ${soloCelular} ${
        oculto ? "max-h-0 overflow-hidden" : "max-h-40"
      }`}
    >
      {children}
    </div>
  )
}
