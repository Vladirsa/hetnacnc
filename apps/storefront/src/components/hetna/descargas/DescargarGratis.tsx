"use client"

import { useEffect, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import {
  descargarArchivoGratis,
  miCupoDeDescargas,
  type EstadoDescargas,
} from "@/lib/descargas/acciones"

// Va en lugar del precio y los botones de compra cuando el archivo es gratis.
//
// Dice siempre cuántos le quedan: un cupo que sólo aparece cuando se acaba se
// siente como trampa. Y cuando se acaba, dice cuándo se libera el siguiente y
// que con un plan del Cotizador no hay límite -- es el único lugar donde ese
// beneficio se explica solo.
const fecha = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(new Date(iso))

export function DescargarGratis({ productId }: { productId: string }) {
  // undefined = todavía no se sabe; null = sin sesión.
  const [estado, setEstado] = useState<EstadoDescargas | null | undefined>(undefined)
  const [bajando, setBajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sinSesion, setSinSesion] = useState(false)

  useEffect(() => {
    let vivo = true
    miCupoDeDescargas().then((e) => {
      if (vivo) setEstado(e)
    })
    return () => {
      vivo = false
    }
  }, [])

  const descargar = async () => {
    setBajando(true)
    setError(null)
    const r = await descargarArchivoGratis(productId)
    setBajando(false)
    if (r.ok) {
      setEstado(r.estado)
      // La liga es de B2 y trae el nombre del archivo: el navegador la baja
      // sin salir de la ficha.
      window.location.href = r.url
      return
    }
    if (r.noAutenticado) setSinSesion(true)
    if (r.estado) setEstado(r.estado)
    setError(r.mensaje)
  }

  const sinCupo = !!estado && !estado.ilimitado && (estado.restantes ?? 0) <= 0
  const pedirCuenta = estado === null || sinSesion

  return (
    <div data-testid="descarga-gratis">
      <div className="mt-4 rounded-[12px] bg-[#EEF6EE] px-4 py-3">
        <span className="text-[30px] font-bold leading-none text-[#1F5A2B]">Gratis</span>
        <p className="mt-1 text-[13px] text-[#44433D]">
          {estado?.ilimitado
            ? "Con tu plan del Cotizador bajas todos los archivos gratis que quieras."
            : estado
              ? `Te ${estado.restantes === 1 ? "queda 1 descarga" : `quedan ${estado.restantes} descargas`} gratis de ${estado.limite} esta semana.`
              : "Con tu cuenta gratis bajas hasta 20 archivos gratis por semana."}
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {pedirCuenta ? (
          <>
            <LocalizedClientLink
              href="/login"
              className="w-full rounded-sm bg-[#C2560A] py-3.5 text-center text-[16px] font-bold text-white hover:bg-[#A84A08]"
            >
              Entrar para descargar
            </LocalizedClientLink>
            <p className="text-center text-[13px] text-[#6B6A63]">
              ¿No tienes cuenta? Es gratis y es la misma de la tienda.
            </p>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void descargar()}
            disabled={bajando || sinCupo || estado === undefined}
            className="w-full rounded-sm bg-[#C2560A] py-3.5 text-[16px] font-bold text-white hover:bg-[#A84A08] disabled:bg-[#D9D5CC]"
            data-testid="descarga-gratis-boton"
          >
            {bajando ? "Preparando tu archivo…" : sinCupo ? "Ya usaste tus descargas de la semana" : "Descargar gratis"}
          </button>
        )}

        {sinCupo && estado?.proxima_liberacion && (
          <p className="text-[13px] text-[#44433D]">
            La siguiente se libera el {fecha(estado.proxima_liberacion)}. Con un{" "}
            <LocalizedClientLink href="/servicios/cotizador-cnc" className="font-semibold text-[#B34D07] hover:underline">
              plan del Cotizador
            </LocalizedClientLink>{" "}
            no hay límite.
          </p>
        )}

        {error && !sinCupo && <p className="text-[13px] font-semibold text-[#9B3225]">{error}</p>}
      </div>
    </div>
  )
}
