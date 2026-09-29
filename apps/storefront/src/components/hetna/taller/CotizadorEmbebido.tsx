"use client"

import { useEffect, useState } from "react"

import {
  tallerBorrar,
  tallerCargar,
  tallerEstado,
  tallerGuardarConfig,
  tallerRegistrar,
} from "@/lib/taller/acciones"

// Abre el Cotizador CNC a pantalla completa, como app, dentro de la pagina.
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
    const html = document.documentElement
    const antes = html.style.overflow
    html.style.overflow = "hidden"
    setListo(true)
    return () => {
      html.style.overflow = antes
      delete window.HETNA_PUENTE
    }
  }, [modo, locale, onCerrar])

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#142033]"
      role="dialog"
      aria-label="Cotizador CNC"
    >
      {listo && (
        <iframe
          src="/hetna-cotizador/app.html?v=3"
          title="Cotizador CNC de HetNa"
          className="w-full h-full border-0 block"
          allow="clipboard-write; web-share"
        />
      )}
    </div>
  )
}
