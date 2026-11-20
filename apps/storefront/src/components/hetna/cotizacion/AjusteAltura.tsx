"use client"

import { useEffect } from "react"

// Dentro del widget: le avisa a la página que lo contiene (widget/cotizador.js)
// cuánto mide, para que el iframe crezca sin barras de desplazamiento.
export function AjusteAltura({ slug }: { slug: string }) {
  useEffect(() => {
    if (window.parent === window) return
    let ultimo = 0
    const avisar = () => {
      const alto = Math.ceil(document.documentElement.scrollHeight)
      if (alto === ultimo) return
      ultimo = alto
      window.parent.postMessage({ hetna: "alto", slug, alto }, "*")
    }
    const ro = new ResizeObserver(avisar)
    ro.observe(document.body)
    avisar()
    return () => ro.disconnect()
  }, [slug])
  return null
}
