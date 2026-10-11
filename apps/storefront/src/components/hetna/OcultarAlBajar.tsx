"use client"

import { ReactNode, useEffect, useState } from "react"

// Solo en celular: oculta su contenido cuando el cliente baja por la página y
// lo vuelve a mostrar al regresar arriba. En computadora no hace nada.
export const OcultarAlBajar = ({ children }: { children: ReactNode }) => {
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

  return (
    <div
      className={`transition-[max-height] duration-200 ease-out md:max-h-none md:overflow-visible ${
        oculto ? "max-h-0 overflow-hidden" : "max-h-40"
      }`}
    >
      {children}
    </div>
  )
}
