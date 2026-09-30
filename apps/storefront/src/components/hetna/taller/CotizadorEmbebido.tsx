"use client"

import { useEffect, useRef, useState } from "react"

import { usarAltoLibre } from "../usarAltoLibre"

import { cargarEnCotizador } from "@/lib/generador/aCotizador"
import {
  tallerBorrar,
  tallerCargar,
  tallerEstado,
  tallerGuardarConfig,
  tallerRegistrar,
} from "@/lib/taller/acciones"

// Abre el Cotizador CNC como app a todo lo ancho, debajo del encabezado de la tienda.
// La app (public/hetna-cotizador/app.html) habla con la tienda por este puente:
// cargar/guardar la cuenta del taller, registrar cotizaciones y cambiar de pagina.

type Modo = "cuenta" | "demo"

declare global {
  interface Window {
    HETNA_PUENTE?: Record<string, unknown>
  }
}

export const CotizadorEmbebido = ({
  modo,
  locale,
  onCerrar,
}: {
  modo: Modo
  locale: string
  onCerrar?: () => void
}) => {
  const [listo, setListo] = useState(false)
  const cajaRef = usarAltoLibre<HTMLDivElement>()
  const marcoRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const aqui = `/${locale}/servicios/cotizador-cnc`
    window.HETNA_PUENTE = {
      modo,
      cargar: () => tallerCargar(),
      guardarConfig: (c: Record<string, unknown>) => tallerGuardarConfig(c),
      registrar: (p: Record<string, unknown>) => tallerRegistrar(p),
      estado: (id: string, e: string) => tallerEstado(id, e),
      borrar: (id: string) => tallerBorrar(id),
      whatsappHetna: "522461217072",
      irA: (destino: string) => {
        if (destino === "cerrar" && onCerrar) return onCerrar()
        const rutas: Record<string, string> = {
          tienda: `/${locale}`,
          registro: `/${locale}/register?volver=${encodeURIComponent(aqui)}`,
          entrar: `/${locale}/login?volver=${encodeURIComponent(aqui)}`,
          cuenta: `/${locale}/user`,
        }
        window.location.href = rutas[destino] || `/${locale}`
      },
    }
    setListo(true)
    return () => {
      delete window.HETNA_PUENTE
    }
  }, [modo, locale, onCerrar])

  return (
    <div ref={cajaRef} className="w-full bg-[#EEF0F3]" aria-label="Cotizador CNC">
      {listo && (
        <iframe
          ref={marcoRef}
          src="/hetna-cotizador/app.html?v=5"
          title="Cotizador CNC de HetNa"
          className="w-full h-full border-0 block"
          allow="clipboard-write; web-share"
          // si llega un archivo desde el Generador 2D y 3D, se carga solo
          onLoad={() => marcoRef.current && cargarEnCotizador(marcoRef.current)}
        />
      )}
    </div>
  )
}
