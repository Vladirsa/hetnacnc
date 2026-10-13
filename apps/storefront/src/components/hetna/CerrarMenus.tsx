"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

// Cierra los menus del celular y quita el foco al navegar a otra pagina.
export const CerrarMenus = () => {
  const ruta = usePathname()
  useEffect(() => {
    document
      .querySelectorAll<HTMLInputElement>("input[data-menu-movil]")
      .forEach((i) => {
        i.checked = false
      })
    ;(document.activeElement as HTMLElement | null)?.blur?.()
  }, [ruta])
  return null
}
