"use client"

// Licitación de suministro (Licitaciones 3.0, Fase 2): el cliente pide
// material, herramientas o insumos y los PROVEEDORES de HETNA le cotizan.
// Usa el mismo motor que la fabricación (privacidad, propuestas, comparación).
import { useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { enviarSolicitudTaller } from "@/lib/cotizar/solicitud-taller"

import { PrivacidadSolicitud } from "./PrivacidadSolicitud"

const CATEGORIAS = ["Lámina y placa metálica", "MDF, triplay y madera", "Acrílico y plásticos", "Fresas y herramientas de corte", "Refacciones y consumibles", "Máquina CNC", "Otro"]
const ESTADOS = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua", "Ciudad de México", "Coahuila", "Colima",
  "Durango", "Estado de México", "Guanajuato", "Guerrero", "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca",
  "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
]
const CAMPO = "w-full rounded-xl border border-[#E7E4DC] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#C2560A]"
const ETIQUETA = "mb-1 block text-[13px] font-semibold text-[#142033]"

export default function FormSuministro() {
  const [estado, setEstado] = useState<"listo" | "enviando" | "ok" | "error">("listo")
  const [mensaje, setMensaje] = useState("")
  const [folio, setFolio] = useState("")
  const [estadoMx, setEstadoMx] = useState("")

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const v = (k: string) => String(fd.get(k) || "").trim()
    setEstado("enviando")
    const r = await enviarSolicitudTaller({
      tipo: "suministro",
      abierta: true,
      servicio: v("categoria"),
      necesidad: "Comprar material o insumos",
      material: v("producto"),
      marca: v("marca"),
      cantidad: v("cantidad"),
      unidad: v("unidad"),
      medidas: v("especificacion"),
      frecuencia: v("frecuencia"),
      fecha: v("fecha"),
      presupuesto: v("presupuesto"),
      ciudad: v("ciudad"),
      estado_mx: estadoMx,
      cp: v("cp"),
      acepta_envio: v("acepta_envio"),
      descripcion: v("descripcion") || `${v("cantidad")} ${v("unidad")} de ${v("producto")}`.trim(),
      nombre: v("nombre"),
      empresa: v("empresa"),
      email: v("email"),
      whatsapp: v("whatsapp"),
      modalidad: v("modalidad"),
      solo_verificados: v("solo_verificados") === "1",
      privacidad: v("privacidad"),
      difundir_redes: v("difundir_redes") === "1",
      invitados: v("invitados"),
      sitio_web: v("sitio_web"),
    })
    if (r.ok) {
      setFolio(r.folio || "")
      setEstado("ok")
    } else {
      setMensaje(r.mensaje)
      setEstado("error")
    }
  }

  if (estado === "ok") {
    return (
      <div className="rounded-2xl border border-[#1E7B3A]/30 bg-[#EEF6F0] p-6">
        <p className="text-lg font-extrabold text-[#142033]">¡Listo! Tu solicitud {folio} ya va para los proveedores.</p>
        <p className="mt-2 text-sm text-[#40403A]">Te llega un correo con la liga para comparar las cotizaciones y elegir. Revisa también spam.</p>
        <LocalizedClientLink href="/cotizar/suministro" className="mt-4 inline-block font-semibold text-[#C2560A] underline">
          Pedir otro material
        </LocalizedClientLink>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="grid gap-5 rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={ETIQUETA} htmlFor="categoria">Tipo de producto</label>
          <select id="categoria" name="categoria" className={CAMPO} defaultValue={CATEGORIAS[0]}>
            {CATEGORIAS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="producto">¿Qué necesitas? *</label>
          <input id="producto" name="producto" required className={CAMPO} placeholder="Ej. Lámina de aluminio 5052 cal. 14" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="cantidad">Cantidad *</label>
          <input id="cantidad" name="cantidad" required className={CAMPO} placeholder="Ej. 20" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="unidad">Unidad</label>
          <select id="unidad" name="unidad" className={CAMPO} defaultValue="piezas">
            {["piezas", "hojas", "metros", "kilos", "cajas", "litros", "juegos"].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={ETIQUETA} htmlFor="especificacion">Especificación (medidas, espesor, diámetro…)</label>
          <input id="especificacion" name="especificacion" className={CAMPO} placeholder="Ej. 1220 x 2440 mm, 1.9 mm de espesor" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="marca">Marca preferida (opcional)</label>
          <input id="marca" name="marca" className={CAMPO} placeholder="Ej. Onsrud, Amana, cualquiera" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="frecuencia">¿Cada cuándo?</label>
          <select id="frecuencia" name="frecuencia" className={CAMPO} defaultValue="Una sola vez">
            {["Una sola vez", "Cada semana", "Cada mes", "Cada trimestre"].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="fecha">¿Para cuándo?</label>
          <input id="fecha" name="fecha" className={CAMPO} placeholder="Ej. esta semana" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="presupuesto">Presupuesto aproximado (opcional)</label>
          <input id="presupuesto" name="presupuesto" className={CAMPO} placeholder="Ej. $8,000 MXN" />
        </div>
        <div className="sm:col-span-2">
          <label className={ETIQUETA} htmlFor="descripcion">Detalles (opcional)</label>
          <textarea id="descripcion" name="descripcion" rows={3} className={CAMPO} placeholder="Acabado, certificado de material, factura, etc." />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={ETIQUETA} htmlFor="ciudad">Ciudad de entrega</label>
          <input id="ciudad" name="ciudad" className={CAMPO} />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="estado_mx">Estado</label>
          <select id="estado_mx" className={CAMPO} value={estadoMx} onChange={(e) => setEstadoMx(e.target.value)}>
            <option value="">Selecciona</option>
            {ESTADOS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="cp">Código postal</label>
          <input id="cp" name="cp" inputMode="numeric" className={CAMPO} />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="acepta_envio">¿Envío por paquetería?</label>
          <select id="acepta_envio" name="acepta_envio" className={CAMPO} defaultValue="Sí">
            <option>Sí</option>
            <option value="No">No, paso a recoger</option>
          </select>
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="nombre">Tu nombre</label>
          <input id="nombre" name="nombre" className={CAMPO} autoComplete="name" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="empresa">Empresa (opcional)</label>
          <input id="empresa" name="empresa" className={CAMPO} autoComplete="organization" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="email">Correo *</label>
          <input id="email" name="email" type="email" required className={CAMPO} autoComplete="email" />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="whatsapp">WhatsApp</label>
          <input id="whatsapp" name="whatsapp" type="tel" className={CAMPO} placeholder="10 dígitos" />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[15px] font-extrabold text-[#142033]">Privacidad: tú decides qué se ve</p>
        <PrivacidadSolicitud dirigida={false} estado={estadoMx} />
      </div>
      <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={estado === "enviando"} className="rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110 disabled:opacity-60">
          {estado === "enviando" ? "Enviando…" : "Pedir cotizaciones a proveedores"}
        </button>
        <span className="text-xs text-[#6B675C]">Gratis y sin compromiso. Tus datos los ve sólo HETNA, salvo lo que tú autorices.</span>
      </div>
      {estado === "error" && <p className="text-sm text-[#B3261E]">{mensaje}</p>}
    </form>
  )
}
