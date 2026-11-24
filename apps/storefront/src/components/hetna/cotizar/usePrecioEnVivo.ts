"use client"

// Precio en vivo (/store/precio-instantaneo) mientras el cliente mueve medidas:
// espera a que deje de mover, descarta respuestas viejas y nunca se queda en
// "Calculando…". Lo usan el 2D Studio y el precio de las herramientas.
import { useEffect, useRef, useState } from "react"

import { type CotizarLeadInput, type PrecioEnVivo, precioEnVivo } from "@/lib/cotizar/acciones"

export type EntradaPrecioEnVivo = Omit<CotizarLeadInput, "email" | "nombre" | "telefono" | "ciudad" | "piezas_mes_estimado" | "rastreo" | "evento_id">

/** Pesos mexicanos; centavos sólo en montos chicos. */
export const pesos = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: n < 100 ? 2 : 0 })

export function usePrecioEnVivo(entrada: EntradaPrecioEnVivo | null, espera = 500): { precio: PrecioEnVivo | null; cargando: boolean } {
  const [precio, setPrecio] = useState<PrecioEnVivo | null>(null)
  const [cargando, setCargando] = useState(false)
  const turno = useRef(0)
  // el objeto cambia en cada render; lo que cuenta es su contenido
  const clave = entrada && entrada.ancho > 0 && entrada.largo > 0 && entrada.cantidad > 0 ? JSON.stringify(entrada) : ""

  useEffect(() => {
    const mio = ++turno.current // cualquier respuesta anterior ya no cuenta
    if (!clave) {
      setPrecio(null)
      setCargando(false)
      return
    }
    setCargando(true)
    const t = setTimeout(async () => {
      let r: PrecioEnVivo | null = null
      try {
        r = await precioEnVivo(JSON.parse(clave) as EntradaPrecioEnVivo)
      } catch {
        r = null
      }
      if (mio !== turno.current) return
      setPrecio(r)
      setCargando(false)
    }, espera)
    return () => clearTimeout(t)
  }, [clave, espera])

  return { precio, cargando }
}
