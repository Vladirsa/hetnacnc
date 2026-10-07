"use client"

import { useState } from "react"

import { enviarSolicitudTaller } from "@/lib/cotizar/solicitud-taller"

const SERVICIOS = [
  "Corte CNC",
  "Corte láser",
  "Corte plasma",
  "Grabado",
  "Fresado de madera",
  "Fresado de metal",
  "Maquinado",
  "Impresión 3D",
  "Diseño CAD/CAM",
  "Otro",
]

const CAMPO =
  "h-11 w-full rounded-xl border border-[#E7E4DC] bg-white px-3 text-sm text-[#142033] outline-none focus:border-[#C2560A]"
const ETIQUETA = "mb-1 block text-[13px] font-semibold text-[#142033]"

export default function FormSolicitudTaller({
  taller,
  nombreTaller,
}: {
  taller?: string
  nombreTaller?: string
}) {
  const [estado, setEstado] = useState<"listo" | "enviando" | "ok" | "error">("listo")
  const [mensaje, setMensaje] = useState("")

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const v = (k: string) => String(fd.get(k) || "").trim()
    setEstado("enviando")
    const r = await enviarSolicitudTaller({
      taller,
      nombre: v("nombre"),
      email: v("email"),
      telefono: v("telefono"),
      ciudad: v("ciudad"),
      servicio: v("servicio"),
      material: v("material"),
      cantidad: v("cantidad"),
      fecha: v("fecha"),
      descripcion: v("descripcion"),
      archivo_url: v("archivo_url"),
      sitio_web: v("sitio_web"),
    })
    if (r.ok) {
      setEstado("ok")
    } else {
      setEstado("error")
      setMensaje(r.mensaje)
    }
  }

  if (estado === "ok") {
    return (
      <div className="rounded-2xl border border-[#E7E4DC] bg-white p-8 text-center">
        <p className="text-2xl">✓</p>
        <h3 className="mt-2 text-xl font-extrabold text-[#142033]">Recibimos tu solicitud</h3>
        <p className="mx-auto mt-2 max-w-md text-[#6B675C]">
          Te enviamos una confirmación por correo. Te haremos llegar la cotización
          {nombreTaller ? ` de ${nombreTaller}` : ""} a ese mismo correo.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-7">
      {nombreTaller && (
        <p className="mb-4 rounded-xl bg-[#F3F1EA] px-4 py-3 text-sm text-[#40403A]">
          Cotizando con <strong className="text-[#142033]">{nombreTaller}</strong>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={ETIQUETA} htmlFor="descripcion">¿Qué necesitas fabricar? *</label>
          <textarea
            id="descripcion"
            name="descripcion"
            required
            minLength={10}
            maxLength={3000}
            rows={4}
            placeholder="Ej. 50 letreros de MDF de 30 x 20 cm con grabado del logo"
            className="w-full rounded-xl border border-[#E7E4DC] bg-white p-3 text-sm text-[#142033] outline-none focus:border-[#C2560A]"
          />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="servicio">Servicio</label>
          <select id="servicio" name="servicio" className={CAMPO} defaultValue="">
            <option value="">Selecciona</option>
            {SERVICIOS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="material">Material</label>
          <input id="material" name="material" className={CAMPO} placeholder="MDF 6 mm, acrílico, aluminio…" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="cantidad">Cantidad</label>
          <input id="cantidad" name="cantidad" className={CAMPO} placeholder="Ej. 50 piezas" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="fecha">¿Para cuándo lo necesitas?</label>
          <input id="fecha" name="fecha" type="date" className={CAMPO} />
        </div>
        <div className="sm:col-span-2">
          <label className={ETIQUETA} htmlFor="archivo_url">Liga a tus archivos (opcional)</label>
          <input
            id="archivo_url"
            name="archivo_url"
            type="url"
            className={CAMPO}
            placeholder="Google Drive, Dropbox o WeTransfer con tu DXF, STL o STEP"
          />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="nombre">Tu nombre</label>
          <input id="nombre" name="nombre" className={CAMPO} autoComplete="name" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="email">Correo *</label>
          <input id="email" name="email" type="email" required className={CAMPO} autoComplete="email" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="telefono">Teléfono</label>
          <input id="telefono" name="telefono" type="tel" className={CAMPO} autoComplete="tel" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="ciudad">Ciudad de entrega</label>
          <input id="ciudad" name="ciudad" className={CAMPO} autoComplete="address-level2" />
        </div>
        <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={estado === "enviando"}
          className="rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {estado === "enviando" ? "Enviando…" : "Solicitar cotización"}
        </button>
        <span className="text-xs text-[#6B675C]">
          Tus datos de contacto solo los ve HETNA. El taller recibe la descripción del trabajo.
        </span>
      </div>
      {estado === "error" && <p className="mt-3 text-sm text-[#B3261E]">{mensaje}</p>}
    </form>
  )
}
