"use client"

// "Mándamelo por correo" en las herramientas del Estudio: quien diseña algo y
// se iría sin dejar contacto se manda su archivo (si es gratis y cabe) y el
// precio aprox. de fabricarlo. Con su permiso le llega un recordatorio a los
// 2 y 7 días (Reactivador de estimados, en el servidor).
import { T } from "@/components/hetna/i18n/Idioma"
import { useState } from "react"

import { type DisenoCorreoInput, mandarDisenoCorreo } from "@/lib/generador/correo"
import { avisarUso } from "@/lib/generador/uso"

/** Tope del DXF que viaja en el correo (igual que DXF_MAX del servidor). */
const DXF_MAX = 700_000

export function MandarDisenoCorreo({
  herramienta,
  archivo,
  servicio,
  dxf,
  precio,
  oscuro = true,
}: {
  herramienta: string
  archivo: string
  servicio?: string
  /** el DXF del diseño; si no viene (descarga de pago, 3D) el correo lleva sólo el precio y la liga */
  dxf?: () => string | null
  precio?: DisenoCorreoInput["precio"]
  oscuro?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [estado, setEstado] = useState<"" | "enviando" | "listo" | "error">("")
  const [mensaje, setMensaje] = useState("")
  const [sinArchivo, setSinArchivo] = useState(false)
  const texto = oscuro ? "text-[#C9D2DF]" : "text-[#40403A]"

  if (estado === "listo")
    return (
      <p className={`m-0 mt-2 rounded-[8px] px-3 py-2 text-[12.5px] ${oscuro ? "bg-[#12301F] text-[#9BE3B8]" : "bg-[#EEF7F0] text-[#17633A]"}`}>
        <T>✓ Listo, revisa tu correo</T><T>{sinArchivo ? " (el archivo es grande: descárgalo desde aquí)" : ""}</T>.
      </p>
    )
  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className={`mt-2 text-[12.5px] font-semibold underline decoration-dotted hover:text-[#C2560A] ${texto}`}>
        <T>✉️ Mándamelo por correo</T><T>{dxf ? " (archivo y precio)" : ""}</T>
      </button>
    )

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setEstado("enviando")
    let archivoDxf = dxf ? dxf() : null
    if (archivoDxf && archivoDxf.length > DXF_MAX) archivoDxf = null
    setSinArchivo(!!dxf && !archivoDxf)
    const r = await mandarDisenoCorreo({
      email: String(fd.get("email") || ""),
      acepta: fd.get("acepta") === "1",
      sitio_web: String(fd.get("sitio_web") || ""),
      herramienta,
      archivo,
      servicio,
      dxf: archivoDxf,
      precio: precio || null,
    })
    if (!r.ok) {
      setEstado("error")
      setMensaje(r.mensaje)
      return
    }
    avisarUso("correo")
    setEstado("listo")
  }

  return (
    <form onSubmit={enviar} className={`mt-2 grid gap-2 rounded-[10px] p-3 ${oscuro ? "bg-[#121923]" : "border border-[#E7E4DC] bg-white"}`}>
      <input
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="Tu correo"
        aria-label="Tu correo"
        className={`rounded-[8px] px-3 py-2 text-[14px] outline-none ${oscuro ? "border border-[#2A3546] bg-[#0D1015] text-white focus:border-[#C2560A]" : "border border-[#D9D5CA] text-[#1B1B18]"}`}
      />
      <input name="sitio_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className={`flex items-start gap-2 text-[11.5px] ${texto}`}>
        <input type="checkbox" name="acepta" value="1" required className="mt-0.5 accent-[#C2560A]" />
        <span><T>Mándame mi diseño y un recordatorio en unos días para fabricarlo. Puedo darme de baja cuando quiera.</T></span>
      </label>
      {estado === "error" && <p className="m-0 text-[12px] text-[#F28B82]"><T>{mensaje}</T></p>}
      <button type="submit" disabled={estado === "enviando"} className="justify-self-start rounded-[8px] bg-[#C2560A] px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-60">
        <T>{estado === "enviando" ? "Enviando…" : "Mandar a mi correo"}</T>
      </button>
    </form>
  )
}
