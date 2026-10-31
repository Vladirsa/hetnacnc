"use client"

import { useEffect, useState } from "react"

import {
  estadoVinculoCotizador,
  pedirCodigoCotizador,
  quitarVinculoCotizador,
  type EstadoVinculo,
} from "@/lib/cotizador/vinculo"

// "Mi cuenta": vincula esta cuenta con el taller del Cotizador (la app).
// Ya vinculadas, el botón Cotizador entra sin volver a escribir la contraseña
// y el plan del Cotizador cuenta en la tienda (archivos gratis sin límite).
const NOMBRE_PLAN: Record<string, string> = {
  gratis: "Gratis",
  prueba: "Prueba con todo abierto",
  taller: "Taller",
  pro: "Pro",
  industrial: "Industrial",
  master: "HETNA",
}

export function VincularCotizador() {
  const [estado, setEstado] = useState<EstadoVinculo | null | undefined>(undefined)
  const [codigo, setCodigo] = useState<{ codigo: string; expira: string } | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState("")

  const cargar = async () => setEstado(await estadoVinculoCotizador())
  useEffect(() => {
    void cargar()
  }, [])

  // Mientras hay código a la vista, se revisa cada 5 s si ya se usó en la app
  useEffect(() => {
    if (!codigo) return
    const id = setInterval(async () => {
      const e = await estadoVinculoCotizador()
      if (e?.vinculado) {
        setEstado(e)
        setCodigo(null)
      }
      if (new Date(codigo.expira).getTime() < Date.now()) setCodigo(null)
    }, 5000)
    return () => clearInterval(id)
  }, [codigo])

  const pedir = async () => {
    setTrabajando(true)
    setError("")
    const c = await pedirCodigoCotizador()
    setTrabajando(false)
    if (c) setCodigo(c)
    else setError("No se pudo generar el código. Intenta de nuevo.")
  }

  const quitar = async () => {
    if (!window.confirm("¿Desvincular tu taller del Cotizador? Podrás volver a vincularlo cuando quieras.")) return
    setTrabajando(true)
    await quitarVinculoCotizador()
    setTrabajando(false)
    await cargar()
  }

  if (estado === undefined || estado === null) return null

  return (
    <section className="rounded-[18px] border border-[#E7E4DC] bg-white p-5" aria-label="Cotizador para talleres">
      <h2 className="m-0 text-[17px] font-bold text-[#142033]">Cotizador para talleres</h2>
      {estado.vinculado ? (
        <>
          <p className="m-0 mt-1 text-[14px] text-[#6B6A63]">
            Tu cuenta está vinculada con <b className="text-[#1B1B18]">{estado.taller}</b> · plan{" "}
            <b className="text-[#1B1B18]">{NOMBRE_PLAN[estado.plan] || estado.plan}</b>. El botón Cotizador entra directo, sin
            volver a escribir tu contraseña.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/api/app/entrar-cotizador"
              className="rounded-[10px] bg-[#C2560A] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#A84A08]"
            >
              Abrir el Cotizador
            </a>
            <button
              type="button"
              onClick={() => void quitar()}
              disabled={trabajando}
              className="rounded-[10px] border border-[#E7E4DC] px-4 py-2 text-[14px] font-semibold text-[#6B6A63] hover:border-[#9B3225] hover:text-[#9B3225]"
            >
              Desvincular
            </button>
          </div>
        </>
      ) : codigo ? (
        <>
          <p className="m-0 mt-1 text-[14px] text-[#6B6A63]">
            Abre la app del Cotizador con tu cuenta de administrador del taller, entra a <b>Configuración → Cuenta de hetnacnc.com</b> y
            escribe este código:
          </p>
          <p className="m-0 mt-3 font-mono text-[34px] font-extrabold tracking-[0.25em] text-[#142033]">{codigo.codigo}</p>
          <p className="m-0 mt-1 text-[12.5px] text-[#6B6A63]">
            Vence a las{" "}
            {new Date(codigo.expira).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" })}. Esta página se actualiza sola
            cuando lo escribas.
          </p>
        </>
      ) : (
        <>
          <p className="m-0 mt-1 text-[14px] text-[#6B6A63]">
            Usa el Cotizador con esta misma cuenta, sin otra contraseña: 14 días con todo abierto y después gratis con 5
            cotizaciones al mes. Si ya tienes un taller en el Cotizador con este correo, se une solo.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/api/app/entrar-cotizador"
              className="rounded-[10px] bg-[#C2560A] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#A84A08]"
            >
              Activar mi Cotizador
            </a>
            <button
              type="button"
              onClick={() => void pedir()}
              disabled={trabajando}
              className="rounded-[10px] border border-[#E7E4DC] px-4 py-2 text-[14px] font-semibold text-[#1B1B18] hover:border-[#C2560A] disabled:opacity-60"
            >
              {trabajando ? "Generando…" : "Mi taller usa otro correo"}
            </button>
          </div>
          {error && <p className="m-0 mt-2 text-[13px] font-semibold text-[#9B3225]">{error}</p>}
        </>
      )}
    </section>
  )
}
