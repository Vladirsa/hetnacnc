"use client"

import { useEffect, useRef, useState } from "react"

import { usarAltoLibre } from "../usarAltoLibre"

import { cargarEnCotizador } from "@/lib/generador/aCotizador"

// Abre el Cotizador CNC rápido (public/hetna-cotizador/app.html) a todo lo
// ancho, debajo del encabezado de la tienda. Sólo en modo demostración: calcula
// en el navegador y no guarda nada. El modo "cuenta" (guardaba en el esquema
// viejo taller.*) se retiró: las cotizaciones de los talleres viven en la app
// del Cotizador (Supabase). Si alguien quiere guardar, el modal de la app lo
// manda a registrarse.

type Modo = "demo"

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
      whatsappHetna: "522217076014",
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
          src="/hetna-cotizador/app.html?v=8"
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
