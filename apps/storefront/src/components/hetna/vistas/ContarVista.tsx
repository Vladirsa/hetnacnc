"use client"

import { useEffect, useRef } from "react"

// Avisa al backend que se abrió esta ficha. No dibuja nada.
//
// Va en el cliente y no en el servidor a propósito: el render del servidor se
// cachea, así que contar ahí daría una vista por cada regeneración de caché y
// ninguna por las demás. Desde el navegador se cuenta una por apertura real.
//
// El `ref` evita contar dos veces en desarrollo, donde React monta cada efecto
// dos veces para destapar errores. Sin él, cada ficha valdría dos.
//
// Si la petición falla, no pasa nada: la ficha ya está pintada y una estadística
// perdida no es un problema del cliente.
export const ContarVista = ({
  productId,
  sellerId,
}: {
  productId: string
  sellerId?: string | null
}) => {
  const contado = useRef(false)

  useEffect(() => {
    if (!productId || contado.current) return
    contado.current = true

    const cuerpo = JSON.stringify({
      product_id: productId,
      ...(sellerId ? { seller_id: sellerId } : {}),
    })

    fetch("/api/vistas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: cuerpo,
      // No hay nada que esperar: que salga y ya.
      keepalive: true,
    }).catch(() => {})
  }, [productId, sellerId])

  return null
}
