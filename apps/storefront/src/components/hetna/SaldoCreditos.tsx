"use client"

// Saldo de créditos en el encabezado, junto a la moneda. Lleva a Mis créditos
// para ver movimientos o recargar.
//
// Se pide desde el navegador cuando la página ya está en pantalla, no al
// dibujar el encabezado en el servidor: así no hace más lenta ninguna página.
// El encabezado vive en el layout y no se vuelve a montar al navegar, por eso
// el saldo se refresca al cambiar de página (como mucho cada 15 s) y al volver
// a la pestaña, por ejemplo después de pagar una recarga.
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { saldoBreve } from "@/lib/creditos/acciones"

const Moneda = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.6 0-2.7.8-2.7 2s1.1 1.6 2.7 2 2.7.9 2.7 2.1-1.1 1.9-2.7 1.9c-1.2 0-2.2-.5-2.7-1.3M12 6.5v1.5M12 16v1.5" />
  </svg>
)

const CADA_MS = 15_000

export function SaldoCreditos({ isLoggedIn, oscuro = false }: { isLoggedIn: boolean; oscuro?: boolean }) {
  const [dato, setDato] = useState<{ saldo: number; ilimitado: boolean } | null | undefined>(undefined)
  const ultima = useRef(0)
  const ruta = usePathname()

  const cargar = useCallback(async (forzar = false) => {
    if (!forzar && Date.now() - ultima.current < CADA_MS) return
    ultima.current = Date.now()
    setDato(await saldoBreve())
  }, [])

  useEffect(() => {
    if (!isLoggedIn) return
    // En Mis créditos (y al regresar de pagar) siempre se pide de nuevo
    cargar(Boolean(ruta?.includes("/user/creditos")))
  }, [isLoggedIn, ruta, cargar])

  useEffect(() => {
    if (!isLoggedIn) return
    const alVolver = () => document.visibilityState === "visible" && cargar(true)
    document.addEventListener("visibilitychange", alVolver)
    return () => document.removeEventListener("visibilitychange", alVolver)
  }, [isLoggedIn, cargar])

  if (!isLoggedIn || dato === null) return null

  const saldo = dato?.saldo
  const ilimitado = dato?.ilimitado === true
  const texto = dato === undefined ? "…" : ilimitado ? "∞" : dato.saldo.toLocaleString("es-MX")
  const etiqueta =
    dato === undefined
      ? "Cargando tus créditos"
      : ilimitado
        ? "Créditos ilimitados"
        : `${texto} ${saldo === 1 ? "crédito disponible" : "créditos disponibles"}. Ver o recargar`

  return (
    <LocalizedClientLink
      href="/user/creditos"
      aria-label={etiqueta}
      title={ilimitado ? "Cuenta de HETNA: créditos ilimitados." : "Tus créditos para el escaneo 3D y el cotizador. Toca para ver movimientos o recargar."}
      className={
        oscuro
          ? "inline-flex items-center gap-1.5 rounded-full border border-[#2C3D58] bg-white/5 px-2.5 py-0.5 font-semibold text-white hover:border-[#F5B47E] hover:text-[#F5B47E]"
          : "inline-flex items-center gap-1 rounded-full border border-[#F0C9A4] bg-[#FDEEE1] px-2 py-1 text-[12px] font-bold text-[#8A3D06]"
      }
    >
      <span className={oscuro ? "text-[#F5B47E]" : "text-[#C2560A]"}>
        <Moneda size={oscuro ? 13 : 14} />
      </span>
      <span className="tabular-nums">{texto}</span>
      {oscuro && (
        <span className="font-normal text-[#C9D2E0]">
          {ilimitado ? "créditos ilimitados" : saldo === 1 ? "crédito" : "créditos"}
          {!ilimitado && saldo === 0 && <span className="text-[#F5B47E]"> · Recargar</span>}
        </span>
      )}
    </LocalizedClientLink>
  )
}
