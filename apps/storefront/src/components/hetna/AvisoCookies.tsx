"use client"

import { useEffect, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import {
  EVENTO_ABRIR_PREFERENCIAS,
  guardarConsentimiento,
  leerConsentimiento,
  senalNoRastrear,
} from "@/lib/hetna/consentimiento"

// Aviso de cookies. Sale abajo la primera vez y cada que alguien pulsa
// "Preferencias de cookies". Mientras no se acepte, Google Analytics sólo
// cuenta visitas sin cookies (modo de consentimiento) y no se cargan Meta
// Pixel ni Clarity (ver components/analytics/Analytics.tsx).
export function AvisoCookies() {
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    // Con Global Privacy Control / Do Not Track ya dijo que no: no se le pregunta
    if (!leerConsentimiento() && !senalNoRastrear()) setAbierto(true)
    const abrir = () => setAbierto(true)
    window.addEventListener(EVENTO_ABRIR_PREFERENCIAS, abrir)
    return () => window.removeEventListener(EVENTO_ABRIR_PREFERENCIAS, abrir)
  }, [])

  if (!abierto) return null

  const elegir = (v: "todas" | "necesarias") => {
    const antes = leerConsentimiento()
    guardarConsentimiento(v)
    setAbierto(false)
    // Si retira un permiso que ya había dado, se recarga para descargar los scripts de rastreo
    if (antes === "todas" && v === "necesarias") location.reload()
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-16 z-[60] px-3 md:bottom-4"
      data-testid="aviso-cookies"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2 rounded-xl border border-[#E7E4DC] bg-white px-3 py-2.5 text-[#1B1B18] shadow-xl sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-3">
        {/* Texto corto a propósito: en celular el aviso no debe tapar la portada
            ni ser lo más grande de la pantalla (Google lo mide como el contenido principal). */}
        <p className="text-[13px] leading-snug sm:text-sm">
          Usamos cookies para que el sitio funcione y, con tu permiso, para estadísticas y anuncios.{" "}
          <LocalizedClientLink href="/aviso-de-privacidad#cookies" className="font-semibold text-[#B34D07] underline">
            Más información
          </LocalizedClientLink>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => elegir("necesarias")}
            className="min-h-[40px] flex-1 rounded-lg border border-[#142033] px-3 text-sm font-semibold text-[#142033] sm:flex-none"
          >
            Solo necesarias
          </button>
          <button
            type="button"
            onClick={() => elegir("todas")}
            className="min-h-[40px] flex-1 rounded-lg bg-[#C2560A] px-3 text-sm font-semibold text-white sm:flex-none"
          >
            Aceptar todas
          </button>
        </div>
      </div>
    </div>
  )
}

// Botón para volver a abrir el aviso (pie de página y aviso de privacidad)
export function BotonPreferenciasCookies({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_PREFERENCIAS))}
    >
      Preferencias de cookies
    </button>
  )
}
