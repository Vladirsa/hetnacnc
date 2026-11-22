"use client"

import { ReactNode, useEffect, useRef, useState } from "react"

// Oculta su contenido cuando el cliente baja por la página y lo vuelve a
// mostrar al regresar arriba.
// - Por defecto solo actúa en celular (en computadora no hace nada).
// - Con tambienEscritorio también actúa en computadora: así el encabezado
//   se queda delgado y fijo (solo logo, buscador y botones) al hacer scroll.
//
// Parpadeo (video de Vlado, 21 nov 2026): el encabezado se encogía y se
// estiraba sin parar, y la página brincaba. Al ocultarse, el encabezado mide
// menos y el navegador corrige el scroll para que el contenido no se mueva
// ("scroll anchoring"): le resta lo que se ocultó. Con el umbral fijo de 80 px,
// esa resta lo regresaba abajo de 10 px, se volvía a mostrar, el navegador le
// sumaba lo mismo, pasaba otra vez de 80... y así en bucle.
// Ahora el umbral para ocultar es lo que se oculta (todas las franjas juntas)
// más 80 px: después de la corrección queda arriba de 10 px y no regresa.
const alturas = new Map<number, number>()
let siguienteId = 0
const ocultable = () => {
  let total = 0
  alturas.forEach((h) => (total += h))
  return total
}

export const OcultarAlBajar = ({
  children,
  tambienEscritorio = false,
}: {
  children: ReactNode
  tambienEscritorio?: boolean
}) => {
  const [oculto, setOculto] = useState(false)
  const contenido = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = siguienteId++
    // Lo que mide esta franja cuando se ve; sólo cuenta si de verdad se oculta
    // (en computadora, la que no es tambienEscritorio se queda siempre)
    const medir = () => {
      const el = contenido.current
      const seOculta = tambienEscritorio || window.innerWidth < 768
      alturas.set(id, el && seOculta ? el.scrollHeight : 0)
    }
    medir()
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null
    if (ro && contenido.current) ro.observe(contenido.current)
    window.addEventListener("resize", medir)

    let cuadro = 0
    const revisar = () => {
      cancelAnimationFrame(cuadro)
      cuadro = requestAnimationFrame(() => {
        const y = window.scrollY
        const umbral = ocultable() + 80
        // Se oculta pasando el umbral y regresa casi hasta arriba
        setOculto((prev) => (prev ? y > 10 : y > umbral))
      })
    }
    revisar()
    window.addEventListener("scroll", revisar, { passive: true })
    return () => {
      cancelAnimationFrame(cuadro)
      window.removeEventListener("scroll", revisar)
      window.removeEventListener("resize", medir)
      ro?.disconnect()
      alturas.delete(id)
    }
  }, [tambienEscritorio])

  const soloCelular = tambienEscritorio ? "" : "md:max-h-none md:overflow-visible"

  return (
    <div
      className={`transition-[max-height] duration-200 ease-out ${soloCelular} ${
        oculto ? "max-h-0 overflow-hidden" : "max-h-40"
      }`}
    >
      <div ref={contenido}>{children}</div>
    </div>
  )
}
