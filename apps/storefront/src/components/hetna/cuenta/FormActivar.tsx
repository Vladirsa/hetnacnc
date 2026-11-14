"use client"

// Formulario de «Activar mi cuenta»: el correo viene de la liga y no se puede
// cambiar; sólo pide la contraseña (nombre y WhatsApp ya vienen llenos).
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
        <h1 className="mt-2 text-2xl font-extrabold text-[#142033]">Último paso: confirma tu correo</h1>
        <p className="mt-2 text-[#40403A]">
          Tu cuenta y tu número de afiliado <b>{datos.numero}</b> ya quedaron. Te mandamos una liga a <b>{datos.email}</b>:
          ábrela y listo. Revisa también spam o promociones.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="rounded-2xl border border-[#E7E4DC] bg-white p-6">
      <input type="hidden" name="t" value={t} />
      <p className="text-xs font-bold uppercase tracking-[.12em] text-[#9A4A06]">Tu número de afiliado</p>
      <p className="text-3xl font-extrabold tracking-wide text-[#142033]">{datos.numero}</p>
      <h1 className="mt-4 text-2xl font-extrabold text-[#142033]">Activa tu cuenta</h1>
      <p className="mt-1 text-sm text-[#6B675C]">Sólo elige tu contraseña. Lo demás ya lo tenemos.</p>

      <label className="mt-5 block text-sm font-semibold text-[#142033]">
        Correo
        <input value={datos.email} readOnly className={`${CAMPO} mt-1 bg-[#F3F1EA] text-[#6B675C]`} />
      </label>
      <label className="mt-3 block text-sm font-semibold text-[#142033]">
        Elige tu contraseña
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
        <summary className="cursor-pointer font-semibold text-[#6B675C]">Revisar mi nombre y WhatsApp</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input name="first_name" defaultValue={datos.first_name} placeholder="Nombre" className={CAMPO} autoComplete="given-name" />
          <input name="last_name" defaultValue={datos.last_name} placeholder="Apellidos" className={CAMPO} autoComplete="family-name" />
          <input name="phone" defaultValue={datos.telefono} placeholder="WhatsApp" className={`${CAMPO} sm:col-span-2`} autoComplete="tel" />
        </div>
      </details>

      {estado === "error" && <p className="mt-3 text-sm font-semibold text-[#B42318]">{mensaje}</p>}

      <button
        type="submit"
        disabled={estado === "enviando" || estado === "ok"}
        className="mt-5 w-full rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white hover:brightness-110 disabled:opacity-60"
      >
        {estado === "enviando" || estado === "ok" ? "Activando…" : "Activar mi cuenta"}
      </button>

      <ul className="mt-5 space-y-1.5 text-[13px] text-[#40403A]">
        <li>✓ Tus solicitudes, propuestas y pedidos en un solo lugar.</li>
        <li>🎁 $100 de descuento en tu primera compra de $800 o más (cupón BIENVENIDA).</li>
        <li>🛠️ ¿Tienes taller? Después puedes registrarlo y probar 14 días el Cotizador CNC.</li>
      </ul>
      <p className="mt-4 text-[11.5px] text-[#6B675C]">
        Al activar aceptas los{" "}
        <a href="/mx/terminos-y-condiciones" className="underline">términos</a> y el{" "}
        <a href="/mx/aviso-de-privacidad" className="underline">aviso de privacidad</a>.
      </p>
    </form>
  )
}
