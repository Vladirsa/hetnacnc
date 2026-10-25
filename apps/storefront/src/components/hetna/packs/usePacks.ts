"use client"

import { useEffect, useRef, useState } from "react"

import { packsDeTalleres, type Pack } from "@/lib/packs/acciones"

// Los packs de los talleres que hay en el carrito. Una sola petición por juego
// de talleres: cambiar una cantidad no cambia quién vende, así que no tiene por
// qué costar otra llamada.
export const usePacks = (sellerIds: string[]) => {
  const [packs, setPacks] = useState<Pack[]>([])
  const pedido = useRef<string>("")

  const llave = [...new Set(sellerIds.filter(Boolean))].sort().join(",")

  useEffect(() => {
    if (!llave || pedido.current === llave) return
    pedido.current = llave

    let vivo = true
    packsDeTalleres(llave.split(","))
      .then((datos) => {
        if (vivo) setPacks(datos)
      })
      .catch(() => {
        // El carrito no depende de esto para funcionar.
      })

    return () => {
      vivo = false
    }
  }, [llave])

  return packs
}
