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

const ESTADOS = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
  "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato", "Guerrero",
  "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla",
  "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas",
  "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
]

const CAMPO =
  "h-11 w-full rounded-xl border border-[#E7E4DC] bg-white px-3 text-sm text-[#142033] outline-none focus:border-[#C2560A]"
const ETIQUETA = "mb-1 block text-[13px] font-semibold text-[#142033]"

export default function FormSolicitudTaller({
  taller,
  nombreTaller,
  servicioInicial,
}: {
  taller?: string
  nombreTaller?: string
  servicioInicial?: string
}) {
  const [estado, setEstado] = useState<"listo" | "enviando" | "ok" | "error">("listo")
  const [mensaje, setMensaje] = useState("")
  const [folio, setFolio] = useState("")

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const v = (k: string) => String(fd.get(k) || "").trim()
    setEstado("enviando")
    const r = await enviarSolicitudTaller({
      taller,
      abierta: !taller || fd.get("abierta") === "1",
      nombre: v("nombre"),
      email: v("email"),
      telefono: v("telefono"),
      ciudad: v("ciudad"),
      estado_mx: v("estado_mx"),
      medidas: v("medidas"),
      frecuencia: v("frecuencia"),
      presupuesto: v("presupuesto"),
      acepta_envio: v("acepta_envio"),
      servicio: v("servicio"),
      material: v("material"),
      cantidad: v("cantidad"),
      fecha: v("fecha"),
      descripcion: v("descripcion"),
      archivo_url: v("archivo_url"),
      sitio_web: v("sitio_web"),
    })
    if (r.ok) {
      setFolio(r.folio || "")
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
        {folio && <p className="mt-1 font-semibold text-[#C2560A]">Folio {folio}</p>}
        <p className="mx-auto mt-2 max-w-md text-[#6B675C]">
          Te enviamos un correo con una liga privada. Ahí verás las propuestas
          {nombreTaller ? ` de ${nombreTaller}` : " de los talleres"} conforme lleguen, las comparas y eliges la que más te convenga.
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
          <select id="servicio" name="servicio" className={CAMPO} defaultValue={servicioInicial && SERVICIOS.includes(servicioInicial) ? servicioInicial : ""}>
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
        <div>
          <label className={ETIQUETA} htmlFor="medidas">Medidas aproximadas</label>
          <input id="medidas" name="medidas" className={CAMPO} placeholder="Ej. 30 x 20 cm, espesor 6 mm" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="frecuencia">¿Cada cuánto lo necesitas?</label>
          <select id="frecuencia" name="frecuencia" className={CAMPO} defaultValue="">
            <option value="">Selecciona</option>
            <option>Una sola vez</option>
            <option>Cada mes</option>
            <option>Producción recurrente</option>
          </select>
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="presupuesto">Presupuesto aproximado (opcional)</label>
          <input id="presupuesto" name="presupuesto" className={CAMPO} placeholder="Ej. $3,000 MXN" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="acepta_envio">¿Aceptas envío por paquetería?</label>
          <select id="acepta_envio" name="acepta_envio" className={CAMPO} defaultValue="Sí">
            <option>Sí</option>
            <option value="No">No, prefiero recoger o que me lo entreguen</option>
          </select>
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
        <div>
          <label className={ETIQUETA} htmlFor="estado_mx">Estado</label>
          <select id="estado_mx" name="estado_mx" className={CAMPO} defaultValue="">
            <option value="">Selecciona</option>
            {ESTADOS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        {taller && (
          <label className="flex items-start gap-2 text-sm text-[#40403A] sm:col-span-2">
            <input type="checkbox" name="abierta" value="1" className="mt-1 accent-[#C2560A]" />
            También quiero recibir propuestas de otros talleres de la red para comparar.
          </label>
        )}
        <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={estado === "enviando"}
          className="rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {estado === "enviando" ? "Enviando…" : taller ? "Solicitar cotización" : "Pedir propuestas a los talleres"}
        </button>
        <span className="text-xs text-[#6B675C]">
          Tus datos de contacto solo los ve HETNA. Los talleres reciben la descripción del trabajo, no tu correo ni tu teléfono.
        </span>
      </div>
      {estado === "error" && <p className="mt-3 text-sm text-[#B3261E]">{mensaje}</p>}
    </form>
  )
}
