"use client"

import { T } from "@/components/hetna/i18n/Idioma"
import { LIMITE_COTIZACIONES_GRATIS } from "@/lib/hetna/app-taller"
import { useState, type FormEvent } from "react"

import { activarCotizador, reenviarConfirmacionCotizador } from "@/lib/cotizador/vinculo"

// Una sola cuenta: el Cotizador se activa con la cuenta de la tienda, sin otra
// contraseña. Ver app/[locale]/(main)/cotizador/activar/page.tsx.
type Props = {
  modo: "activar" | "confirmar" | "error"
  correo: string
  taller: string
  telefono: string
}

const caja = "mx-auto max-w-xl rounded-[18px] border border-[#E7E4DC] bg-white p-6"
const boton =
  "inline-flex items-center justify-center rounded-[10px] bg-[#C2560A] px-5 py-3 text-[15px] font-semibold text-white hover:bg-[#A84A08] disabled:opacity-60"
const campo =
  "mt-1 w-full rounded-[10px] border border-[#E7E4DC] bg-[#FAF9F6] px-4 py-3 text-[15px] text-[#1B1B18] focus:border-[#C2560A] focus:outline-none"

export function ActivarCotizador({ modo, correo, taller: tallerInicial, telefono: telInicial }: Props) {
  const [taller, setTaller] = useState(tallerInicial)
  const [telefono, setTelefono] = useState(telInicial)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState("")
  const [reenviado, setReenviado] = useState(false)

  if (modo === "confirmar") {
    return (
      <section className={caja}>
        <p className="m-0 text-[40px] leading-none" aria-hidden="true">📧</p>
        <h1 className="m-0 mt-3 text-[22px] font-bold text-[#142033]"><T>Confirma tu correo para usar el Cotizador</T></h1>
        <p className="m-0 mt-2 text-[15px] leading-relaxed text-[#40403A]">
          <T>Te mandamos una liga a</T> <b>{correo}</b><T>. Ábrela y después vuelve a presionar</T> <b><T>Cotizador</T></b><T>: entras con esta misma
          cuenta, sin otra contraseña. Si no llega en unos minutos, revisa spam o promociones.</T>
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href="/api/app/entrar-cotizador" className={boton}>
            <T>Ya la abrí, entrar</T>
          </a>
          <button
            type="button"
            disabled={reenviado}
            onClick={async () => {
              await reenviarConfirmacionCotizador()
              setReenviado(true)
            }}
            className="rounded-[10px] border border-[#E7E4DC] px-5 py-3 text-[15px] font-semibold text-[#1B1B18] hover:border-[#C2560A] disabled:opacity-70"
          >
            {reenviado ? "Listo, te la volvimos a mandar" : "Volver a mandar la liga"}
          </button>
        </div>
      </section>
    )
  }

  if (modo === "error") {
    return (
      <section className={caja}>
        <h1 className="m-0 text-[22px] font-bold text-[#142033]"><T>No pudimos abrir el Cotizador</T></h1>
        <p className="m-0 mt-2 text-[15px] text-[#40403A]"><T>Intenta de nuevo en un momento.</T></p>
        <a href="/api/app/entrar-cotizador" className={`${boton} mt-5`}>
          <T>Intentar de nuevo</T>
        </a>
      </section>
    )
  }

  const activar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Lo que haya rellenado el navegador sin avisar
    const f = new FormData(e.currentTarget)
    const nombre = String(f.get("taller") || taller).trim()
    const tel = String(f.get("telefono") || telefono).trim()
    if (nombre.length < 2) {
      setError("Escribe el nombre de tu taller.")
      return
    }
    setTrabajando(true)
    setError("")
    const r = await activarCotizador({ taller: nombre, telefono: tel })
    if (r.url) {
      window.location.href = r.url
      return
    }
    setTrabajando(false)
    setError(r.error || "No se pudo activar. Intenta de nuevo.")
  }

  return (
    <section className={caja}>
      <h1 className="m-0 text-[24px] font-bold text-[#142033]"><T>Activa tu Cotizador</T></h1>
      <p className="m-0 mt-2 text-[15px] leading-relaxed text-[#40403A]">
        <T>Con tu misma cuenta de HETNA CNC (</T><b>{correo}</b><T>), sin otra contraseña. Tienes</T> <b><T>14 días con todo abierto</T></b><T>, sin
        tarjeta. Después sigues gratis con</T> {LIMITE_COTIZACIONES_GRATIS} <T>cotizaciones al mes o eliges un plan.</T>
      </p>
      <form onSubmit={activar} noValidate className="mt-5 space-y-4">
        <label className="block text-[14px] font-semibold text-[#142033]">
          <T>Nombre de tu taller o negocio</T>
          <input
            name="taller"
            value={taller}
            onChange={(e) => setTaller(e.target.value)}
            placeholder="Ej. Router CNC Apizaco"
            maxLength={80}
            autoComplete="organization"
            className={campo}
          />
        </label>
        <label className="block text-[14px] font-semibold text-[#142033]">
          <T>Teléfono o WhatsApp</T> <span className="font-normal text-[#6B6A63]"><T>(sale en tus cotizaciones)</T></span>
          <input
            name="telefono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+52 246 123 4567"
            maxLength={30}
            inputMode="tel"
            autoComplete="tel"
            className={campo}
          />
        </label>
        {error && <p className="m-0 text-[14px] font-semibold text-[#9B3225]">{error}</p>}
        <button type="submit" disabled={trabajando} className={`${boton} w-full`}>
          {trabajando ? "Activando…" : "Activar y entrar al Cotizador"}
        </button>
      </form>
      <p className="m-0 mt-4 text-[13px] leading-relaxed text-[#6B6A63]">
        <T>¿Ya tienes un taller en el Cotizador con</T> <b><T>otro correo</T></b><T>? Vincúlalo desde</T>{" "}
        <a href="/mx/user" className="font-semibold text-[#C2560A] underline">
          <T>Mi cuenta</T>
        </a>{" "}
        <T>con un código y entras igual, sin otra contraseña.</T>
      </p>
    </section>
  )
}
