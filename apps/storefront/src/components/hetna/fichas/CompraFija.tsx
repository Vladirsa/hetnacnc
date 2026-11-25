"use client"

// Columna de compra que se queda a la vista al bajar por la ficha (opción A,
// elegida por Vlado el 25 nov 2026: descripción bajo la foto y la compra fija
// a la derecha, sin huecos).
//
// Si la columna cabe en la pantalla, se queda pegada arriba. Si es más alta
// que la pantalla, primero se recorre normal hasta que se ve su final y ahí
// se queda (el "top" negativo lo permite): así nunca se esconden el precio,
// los talleres ni el botón de comprar. En celular no hace nada (lg:).
import { useEffect, useRef, useState } from "react"

const MARGEN = 16

export function CompraFija({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const caja = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(MARGEN)

  useEffect(() => {
    const el = caja.current
    if (!el) return
    // El encabezado del sitio también se queda pegado arriba: se deja su alto libre
    const medir = () => {
      const enc = (document.querySelector('[data-testid="header"]') as HTMLElement | null)?.offsetHeight || 0
      setTop(Math.min(enc + MARGEN, window.innerHeight - el.offsetHeight - MARGEN))
    }
    medir()
    const obs = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null
    obs?.observe(el)
    window.addEventListener("resize", medir)
    return () => {
      obs?.disconnect()
      window.removeEventListener("resize", medir)
    }
  }, [])

  return (
    <div ref={caja} className={`lg:sticky ${className}`} style={{ top }}>
      {children}
    </div>
  )
}
