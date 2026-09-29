"use client"

import { useEffect, useRef } from "react"

// Para herramientas tipo app (Cotizador, Copiloto) que van DEBAJO del encabezado
// de la tienda: ocupan todo el alto que queda libre de la pantalla, sin tapar el encabezado.
export const usarAltoLibre = <T extends HTMLElement>() => {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const html = document.documentElement
    const antes = html.style.overflow
    const ajustar = () => {
      const arriba = el.getBoundingClientRect().top + window.scrollY
      el.style.height = `${Math.max(420, window.innerHeight - arriba)}px`
    }
    window.scrollTo(0, 0)
    html.style.overflow = "hidden"
    ajustar()
    window.addEventListener("resize", ajustar)
    const t = window.setTimeout(ajustar, 300) // por si el encabezado termina de cargar despues
    return () => {
      html.style.overflow = antes
      window.removeEventListener("resize", ajustar)
      window.clearTimeout(t)
    }
  }, [])
  return ref
}
