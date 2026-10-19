"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import {
  guardarPerfil,
  type CostosReferencia,
  type TallerPerfil,
} from "@/lib/cotizador/acciones"

type Campos = Partial<Record<keyof TallerPerfil, string>>

// Los campos numéricos se guardan como texto mientras se escriben: un input
// controlado con Number() no deja teclear "46." ni borrar el último dígito.
// La conversión va una sola vez, al enviar.
const NUMERICOS: (keyof TallerPerfil)[] = [
  "iva_pct",
  "vigencia_dias",
  "costo_hora_taller",
  "costo_hora_maquina",
  "costo_hora_operador",
  "margen_minimo",
  "margen_recomendado",
  "dias_entrega_default",
]

function aCampos(perfil: TallerPerfil | null): Campos {
  if (!perfil) return { pais: "México", moneda: "MXN", iva_pct: "16", folio_prefijo: "QT", vigencia_dias: "15" }
  const campos: Campos = {}
  for (const [clave, valor] of Object.entries(perfil)) {
    // id no es editable: el backend lo ignora, pero no hay por qué mandarlo.
    if (clave === "id" || valor === null || valor === undefined) continue
    campos[clave as keyof TallerPerfil] = String(valor)
  }
  return campos
}

export const FormPerfilTaller = ({
  perfil,
  referencia,
}: {
  perfil: TallerPerfil | null
  referencia: CostosReferencia
}) => {
  const router = useRouter()
  const [campos, setCampos] = useState<Campos>(() => aCampos(perfil))
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null)

  const esNuevo = !perfil

  const set = (clave: keyof TallerPerfil) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setCampos((previo) => ({ ...previo, [clave]: e.target.value }))
    setAviso(null)
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!campos.nombre_comercial?.trim()) {
      setAviso({ tipo: "error", texto: "El nombre de tu taller es obligatorio." })
      return
    }

    setGuardando(true)
    setAviso(null)

    const cuerpo: Record<string, unknown> = {}
    for (const [clave, valor] of Object.entries(campos)) {
      const k = clave as keyof TallerPerfil
      if (NUMERICOS.includes(k)) {
        // Un campo vacío se omite en vez de mandarse como 0: en los costos,
        // 0 significa "sin capturar" y el motor usa los de referencia, pero
        // mandar 0 explícito al margen sí lo pondría en cero.
        if (valor === "" || valor === undefined) continue
        const n = Number(valor)
        if (Number.isFinite(n)) cuerpo[clave] = n
        continue
      }
      cuerpo[clave] = valor
    }

    const res = await guardarPerfil(cuerpo)
    setGuardando(false)

    if (!res.ok) {
      setAviso({ tipo: "error", texto: res.mensaje })
      return
    }
    setAviso({ tipo: "ok", texto: esNuevo ? "Tu taller quedó dado de alta." : "Datos guardados." })
    // El panel y las cotizaciones leen el perfil en el servidor; sin refresh
    // seguirían mostrando los datos viejos.
    router.refresh()
  }

  return (
    <form onSubmit={enviar} className="mt-8 max-w-[860px] flex flex-col gap-10">
      <Bloque
        titulo="Identidad"
        nota="Esto es lo que ve tu cliente en la cotización."
      >
        <Campo etiqueta="Nombre de tu taller" requerido>
          <input {...entrada} value={campos.nombre_comercial || ""} onChange={set("nombre_comercial")} placeholder="Talleres Rivera CNC" />
        </Campo>
        <Campo etiqueta="Persona de contacto">
          <input {...entrada} value={campos.nombre_contacto || ""} onChange={set("nombre_contacto")} />
        </Campo>
        <Campo etiqueta="Razón social">
          <input {...entrada} value={campos.razon_social || ""} onChange={set("razon_social")} />
        </Campo>
        <Campo etiqueta="RFC">
          <input {...entrada} value={campos.rfc || ""} onChange={set("rfc")} />
        </Campo>
        <Campo etiqueta="Correo">
          <input {...entrada} type="email" value={campos.correo || ""} onChange={set("correo")} />
        </Campo>
        <Campo etiqueta="Teléfono">
          <input {...entrada} value={campos.telefono || ""} onChange={set("telefono")} />
        </Campo>
        <Campo etiqueta="WhatsApp" nota="Con lada, sin espacios.">
          <input {...entrada} value={campos.whatsapp || ""} onChange={set("whatsapp")} placeholder="522461217072" />
        </Campo>
        <Campo etiqueta="Sitio web">
          <input {...entrada} value={campos.sitio_web || ""} onChange={set("sitio_web")} />
        </Campo>
        <Campo etiqueta="Logo (URL)" nota="Aparece arriba del documento.">
          <input {...entrada} value={campos.logo_url || ""} onChange={set("logo_url")} />
        </Campo>
      </Bloque>

      <Bloque titulo="Dirección">
        <Campo etiqueta="Calle y número" ancho>
          <input {...entrada} value={campos.direccion || ""} onChange={set("direccion")} />
        </Campo>
        <Campo etiqueta="Ciudad">
          <input {...entrada} value={campos.ciudad || ""} onChange={set("ciudad")} />
        </Campo>
        <Campo etiqueta="Estado">
          <input {...entrada} value={campos.estado || ""} onChange={set("estado")} />
        </Campo>
        <Campo etiqueta="Código postal">
          <input {...entrada} value={campos.cp || ""} onChange={set("cp")} />
        </Campo>
        <Campo etiqueta="País">
          <input {...entrada} value={campos.pais || ""} onChange={set("pais")} />
        </Campo>
      </Bloque>

      <Bloque
        titulo="Tus costos por hora"
        nota="Esto es lo que vuelve tuyo el precio. Mientras lo dejes vacío se cotiza con valores de referencia y el margen que te muestre la calculadora no es el tuyo."
      >
        <Campo etiqueta="Costo hora de máquina">
          <input {...entrada} inputMode="decimal" value={campos.costo_hora_maquina || ""} onChange={set("costo_hora_maquina")} placeholder={`referencia: ${referencia.costoHoraMaquina}`} />
        </Campo>
        <Campo etiqueta="Costo hora de operador">
          <input {...entrada} inputMode="decimal" value={campos.costo_hora_operador || ""} onChange={set("costo_hora_operador")} placeholder={`referencia: ${referencia.costoHoraOperador}`} />
        </Campo>
        <Campo etiqueta="Costo hora de taller" nota="Renta, luz, administración: lo que cuesta tener el taller abierto una hora.">
          <input {...entrada} inputMode="decimal" value={campos.costo_hora_taller || ""} onChange={set("costo_hora_taller")} placeholder={`referencia: ${referencia.costoHoraTaller}`} />
        </Campo>
        <Campo etiqueta="Margen mínimo (%)">
          <input {...entrada} inputMode="decimal" value={campos.margen_minimo || ""} onChange={set("margen_minimo")} placeholder={`referencia: ${referencia.margenMinimo}`} />
        </Campo>
        <Campo etiqueta="Margen recomendado (%)" nota="El precio que la calculadora sugiere por defecto.">
          <input {...entrada} inputMode="decimal" value={campos.margen_recomendado || ""} onChange={set("margen_recomendado")} placeholder={`referencia: ${referencia.margenRecomendado}`} />
        </Campo>
      </Bloque>

      <Bloque titulo="Documento de cotización">
        <Campo etiqueta="Moneda">
          <select {...entrada} value={campos.moneda || "MXN"} onChange={set("moneda")}>
            <option value="MXN">Peso mexicano (MXN)</option>
            <option value="USD">Dólar (USD)</option>
          </select>
        </Campo>
        <Campo etiqueta="IVA (%)">
          <input {...entrada} inputMode="decimal" value={campos.iva_pct || ""} onChange={set("iva_pct")} placeholder={String(referencia.ivaPct)} />
        </Campo>
        <Campo etiqueta="Vigencia (días)" nota="Cuántos días vale el precio.">
          <input {...entrada} inputMode="numeric" value={campos.vigencia_dias || ""} onChange={set("vigencia_dias")} />
        </Campo>
        <Campo etiqueta="Prefijo de folio" nota={perfil ? `Tus folios salen como ${campos.folio_prefijo || "QT"}-2026-0001.` : undefined}>
          <input {...entrada} value={campos.folio_prefijo || ""} onChange={set("folio_prefijo")} placeholder="QT" />
        </Campo>
        <Campo etiqueta="Días de entrega por defecto">
          <input {...entrada} inputMode="numeric" value={campos.dias_entrega_default || ""} onChange={set("dias_entrega_default")} />
        </Campo>
        <Campo etiqueta="Condiciones de pago" ancho>
          <input {...entrada} value={campos.condiciones_pago_default || ""} onChange={set("condiciones_pago_default")} placeholder="50% anticipo, 50% contra entrega" />
        </Campo>
        <Campo etiqueta="Términos y condiciones" ancho nota="Van al pie de cada cotización.">
          <textarea {...entrada} rows={4} value={campos.terminos_estandar || ""} onChange={set("terminos_estandar")} />
        </Campo>
        <Campo etiqueta="Firma: nombre">
          <input {...entrada} value={campos.firma_nombre || ""} onChange={set("firma_nombre")} />
        </Campo>
        <Campo etiqueta="Firma: puesto">
          <input {...entrada} value={campos.firma_puesto || ""} onChange={set("firma_puesto")} />
        </Campo>
      </Bloque>

      <div className="flex flex-wrap items-center gap-4 border-t border-[#E7E4DC] pt-6">
        <button
          type="submit"
          disabled={guardando}
          className="bg-[#C2560A] hover:bg-[#A84A08] disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-[10px] text-[15px]"
        >
          {guardando ? "Guardando…" : esNuevo ? "Dar de alta mi taller" : "Guardar cambios"}
        </button>
        {aviso && (
          <p
            role="status"
            className={`text-[14px] font-medium ${aviso.tipo === "ok" ? "text-[#276B2B]" : "text-[#9B3225]"}`}
          >
            {aviso.texto}
          </p>
        )}
      </div>
    </form>
  )
}

const entrada = {
  className:
    "w-full rounded-[10px] border border-[#E7E4DC] bg-white px-3.5 py-2.5 text-[15px] text-[#1B1B18] outline-none focus:border-[#C2560A]",
}

const Bloque = ({
  titulo,
  nota,
  children,
}: {
  titulo: string
  nota?: string
  children: React.ReactNode
}) => (
  <fieldset className="border-0 p-0 m-0">
    <legend className="text-[18px] font-bold text-[#1B1B18] p-0">{titulo}</legend>
    {nota && <p className="mt-1.5 text-[14px] text-[#6B6A63] leading-relaxed max-w-[640px]">{nota}</p>}
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">{children}</div>
  </fieldset>
)

const Campo = ({
  etiqueta,
  nota,
  requerido,
  ancho,
  children,
}: {
  etiqueta: string
  nota?: string
  requerido?: boolean
  ancho?: boolean
  children: React.ReactNode
}) => (
  <label className={`flex flex-col gap-1.5 ${ancho ? "sm:col-span-2" : ""}`}>
    <span className="text-[13px] font-semibold text-[#4A4943]">
      {etiqueta}
      {requerido && <span className="text-[#C2560A]"> *</span>}
    </span>
    {children}
    {nota && <span className="text-[12px] text-[#6B6A63] leading-snug">{nota}</span>}
  </label>
)
