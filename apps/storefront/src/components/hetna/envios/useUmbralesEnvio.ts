"use client"

import { useEffect, useRef, useState } from "react"

import {
  umbralesDeEnvioGratis,
  type UmbralDeTaller,
} from "@/lib/envios/envio-gratis"

// Los umbrales de envío gratis de los talleres que hay en el carrito. Se piden
// una vez por juego de talleres: subirle la cantidad a un renglón no cambia
// quién lo vende, así que no tiene por qué costar otra llamada.
export const useUmbralesEnvio = (sellerIds: string[]) => {
  const [umbrales, setUmbrales] = useState<Record<string, UmbralDeTaller>>({})
  const pedido = useRef<string>("")

  // La llave es el juego de talleres, ordenado: así "A,B" y "B,A" no cuentan
  // como dos juegos distintos.
  const llave = [...new Set(sellerIds.filter(Boolean))].sort().join(",")

  useEffect(() => {
    if (!llave || pedido.current === llave) return
    pedido.current = llave

    let vivo = true
    umbralesDeEnvioGratis(llave.split(","))
      .then((datos) => {
        if (vivo) setUmbrales(datos)
      })
      .catch(() => {
        // El carrito no depende de esto para funcionar.
      })

    return () => {
      vivo = false
    }
  }, [llave])

  return umbrales
}
