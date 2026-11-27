"use client"

// Formulario de «Activar mi cuenta»: el correo viene de la liga y no se puede
// cambiar; sólo pide la contraseña (nombre y WhatsApp ya vienen llenos).
import { T } from "@/components/hetna/i18n/Idioma"
import { useState } from "react"

import { type DatosActivacion, activarCuenta } from "@/lib/data/customer"

const CAMPO =
  "h-11 w-full rounded-xl border border-[#E7E4DC] bg-white px-3 text-[15px] text-[#142033] outline-none focus:border-[#C2560A]"

export function FormActivar({ t, datos }: { t: string; datos: DatosActivacion }) {
  const [estado, setEstado] = useState<"listo" | "enviando" | "error" | "verificar" | "ok">("listo")
  const [mensaje, setMensaje] = useState("")
  const [ver, setVer] = useState(false)

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setEstado("enviando")
    const r = await activarCuenta(new FormData(e.currentTarget))
    if (r.ok) {
      setEstado("ok")
      window.location.href = "/mx/user?bienvenida=1"
    } else if (r.verificar) {
      setEstado("verificar")
    } else {
      setEstado("error")
      setMensaje(r.mensaje)
    }
  }

  if (estado === "verificar") {
    return (
      <div className="rounded-2xl border border-[#E7E4DC] bg-white p-6 text-center">
        <p className="text-3xl">📬</p>
        <h1 className="mt-2 text-2xl font-extrabold text-[#142033]"><T>Último paso: confirma tu correo</T></h1>
        <p className="mt-2 text-[#40403A]">
          <T>Tu cuenta y tu número de afiliado</T> <b>{datos.numero}</b> <T>ya quedaron. Te mandamos una liga a</T> <b>{datos.email}</b><T>:
          ábrela y listo. Revisa también spam o promociones.</T>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="rounded-2xl border border-[#E7E4DC] bg-white p-6">
      <input type="hidden" name="t" value={t} />
      <p className="text-xs font-bold uppercase tracking-[.12em] text-[#9A4A06]"><T>Tu número de afiliado</T></p>
      <p className="text-3xl font-extrabold tracking-wide text-[#142033]">{datos.numero}</p>
      <h1 className="mt-4 text-2xl font-extrabold text-[#142033]"><T>Activa tu cuenta</T></h1>
      <p className="mt-1 text-sm text-[#6B675C]"><T>Sólo elige tu contraseña. Lo demás ya lo tenemos.</T></p>

      <label className="mt-5 block text-sm font-semibold text-[#142033]">
        <T>Correo</T>
        <input value={datos.email} readOnly className={`${CAMPO} mt-1 bg-[#F3F1EA] text-[#6B675C]`} />
      </label>
      <label className="mt-3 block text-sm font-semibold text-[#142033]">
        <T>Elige tu contraseña</T>
        <span className="relative mt-1 block">
          <input
            name="password"
            type={ver ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            autoFocus
            placeholder="Mínimo 8 caracteres"
            className={`${CAMPO} pr-20`}
          />
          <button
            type="button"
            onClick={() => setVer((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-[#6B675C] hover:bg-[#F3F1EA]"
          >
            {ver ? "Ocultar" : "Ver"}
          </button>
        </span>
      </label>
      <details className="mt-3 text-sm text-[#40403A]">
        <summary className="cursor-pointer font-semibold text-[#6B675C]"><T>Revisar mi nombre y WhatsApp</T></summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input name="first_name" defaultValue={datos.first_name} placeholder="Nombre" required className={CAMPO} autoComplete="given-name" />
          <input name="last_name" defaultValue={datos.last_name} placeholder="Apellidos" required className={CAMPO} autoComplete="family-name" />
          <input name="phone" defaultValue={datos.telefono} placeholder="WhatsApp" className={`${CAMPO} sm:col-span-2`} autoComplete="tel" />
        </div>
      </details>

      {estado === "error" && <p className="mt-3 text-sm font-semibold text-[#B42318]"><T>{mensaje}</T></p>}

      <button
        type="submit"
        disabled={estado === "enviando" || estado === "ok"}
        className="mt-5 w-full rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white hover:brightness-110 disabled:opacity-60"
      >
        {estado === "enviando" || estado === "ok" ? "Activando…" : "Activar mi cuenta"}
      </button>

      <ul className="mt-5 space-y-1.5 text-[13px] text-[#40403A]">
        <li><T>✓ Tus solicitudes, propuestas y pedidos en un solo lugar.</T></li>
        <li><T>🎁 $100 de descuento en tu primera compra de $800 o más (cupón BIENVENIDA).</T></li>
        <li><T>🛠️ ¿Tienes taller? Después puedes registrarlo y probar 14 días el Cotizador CNC.</T></li>
      </ul>
      <p className="mt-4 text-[11.5px] text-[#6B675C]">
        <T>Al activar aceptas los</T>{" "}
        <a href="/mx/terminos-y-condiciones" className="underline"><T>términos</T></a> <T>y el</T>{" "}
        <a href="/mx/aviso-de-privacidad" className="underline"><T>aviso de privacidad</T></a>.
      </p>
    </form>
  )
}
