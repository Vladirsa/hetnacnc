"use client"

import { useRef, useState } from "react"

import { ligaWhatsApp } from "@/lib/hetna/empresa"
import { subirArchivo, type ArchivoGuardado } from "@/lib/subir-archivo"
import { registrarTaller } from "@/lib/talleres/registro"
import { SERVICIOS_SOLICITUD } from "@/lib/trabajos/servicios"

// Registro para unirse a la red de talleres. No es la cuenta del panel (ésa se
// crea en /seller): son los datos con los que HETNA conoce al taller y le
// manda solicitudes de su proceso. Los servicios usan los mismos nombres que
// las solicitudes de los clientes, porque así se comparan.
const SERVICIOS = SERVICIOS_SOLICITUD.filter((s) => s !== "Otro")
const MATERIALES = [
  "MDF", "Madera", "Triplay", "Acrílico", "Acero", "Acero inoxidable", "Aluminio", "Latón",
  "Nylon / Delrin", "PVC", "Foam", "Cuero", "Filamentos 3D", "Resina",
]
const CAPACIDAD = [
  "Piezas sueltas y prototipos",
  "Lotes de decenas de piezas",
  "Cientos de piezas por semana",
  "Miles de piezas al mes / producción continua",
]
const ESTADOS = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
  "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato", "Guerrero",
  "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla",
  "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas",
  "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
]
const FOTOS_MAX = 8
const EXT_FOTO = [".jpg", ".jpeg", ".png", ".webp", ".heic"]

const CAMPO =
  "h-11 w-full rounded-xl border border-[#E7E4DC] bg-white px-3 text-sm text-[#142033] outline-none focus:border-[#C2560A]"
const ETIQUETA = "mb-1 block text-[13px] font-semibold text-[#142033]"
const PASO = "flex items-center gap-2 text-[15px] font-extrabold text-[#142033]"
const NUM = "grid h-6 w-6 place-items-center rounded-full bg-[#142033] text-[12px] font-bold text-white"

type Foto = { id: string; nombre: string; avance: number; subida?: ArchivoGuardado; error?: string }

function Chips({ opciones, elegidas, alCambiar }: { opciones: string[]; elegidas: string[]; alCambiar: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map((o) => {
        const activa = elegidas.includes(o)
        return (
          <button
            key={o}
            type="button"
            aria-pressed={activa}
            onClick={() => alCambiar(activa ? elegidas.filter((x) => x !== o) : [...elegidas, o])}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              activa ? "border-[#C2560A] bg-[#FDEEE1] font-semibold text-[#B34D07]" : "border-[#E7E4DC] bg-white text-[#2B2A26] hover:border-[#C2560A]"
            }`}
          >
            {activa ? "✓ " : ""}
            {o}
          </button>
        )
      })}
    </div>
  )
}

export default function FormRegistroTaller() {
  const [servicios, setServicios] = useState<string[]>([])
  const [materiales, setMateriales] = useState<string[]>([])
  const [fotos, setFotos] = useState<Foto[]>([])
  const [estado, setEstado] = useState<"listo" | "enviando" | "ok" | "error">("listo")
  const [mensaje, setMensaje] = useState("")
  const [panel, setPanel] = useState("/seller")
  const entrada = useRef<HTMLInputElement>(null)
  const subiendo = fotos.some((f) => !f.subida && !f.error)

  const elegirFotos = (lista: FileList | null) => {
    if (!lista) return
    const libres = FOTOS_MAX - fotos.filter((f) => !f.error).length
    for (const archivo of Array.from(lista).slice(0, Math.max(0, libres))) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const ext = "." + (archivo.name.split(".").pop() || "").toLowerCase()
      if (!EXT_FOTO.includes(ext) || archivo.size > 15 * 1024 * 1024) {
        setFotos((xs) => [...xs, { id, nombre: archivo.name, avance: 0, error: "Sube fotos JPG, PNG o WEBP de hasta 15 MB." }])
        continue
      }
      setFotos((xs) => [...xs, { id, nombre: archivo.name, avance: 0 }])
      const poner = (c: Partial<Foto>) => setFotos((xs) => xs.map((f) => (f.id === id ? { ...f, ...c } : f)))
      subirArchivo(archivo, (n) => poner({ avance: n }), "taller")
        .then((subida) => poner({ subida, avance: 100 }))
        .catch((e: Error) => poner({ error: e.message }))
    }
    if (entrada.current) entrada.current.value = ""
  }

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (subiendo) {
      setEstado("error")
      setMensaje("Espera a que terminen de subir tus fotos.")
      return
    }
    if (!servicios.length) {
      setEstado("error")
      setMensaje("Elige al menos un servicio que ofreces: así te llegan las solicitudes de tu proceso.")
      return
    }
    const fd = new FormData(e.currentTarget)
    const v = (k: string) => String(fd.get(k) || "").trim()
    setEstado("enviando")
    const r = await registrarTaller({
      nombre_taller: v("nombre_taller"),
      contacto: v("contacto"),
      email: v("email"),
      whatsapp: v("whatsapp"),
      ciudad: v("ciudad"),
      estado_mx: v("estado_mx"),
      servicios,
      materiales,
      maquinas: v("maquinas"),
      capacidad: v("capacidad"),
      portafolio: v("portafolio"),
      comentarios: v("comentarios"),
      fotos: fotos.flatMap((f) => (f.subida ? [{ clave: f.subida.clave, nombre: f.subida.nombre }] : [])),
      sitio_web: v("sitio_web"),
    })
    if (r.ok) {
      setPanel(r.panel)
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
        <h3 className="mt-2 text-xl font-extrabold text-[#142033]">¡Recibimos tu registro!</h3>
        <p className="mx-auto mt-2 max-w-md text-[#6B675C]">
          Te mandamos un correo de bienvenida. <strong className="text-[#142033]">Tu siguiente paso:</strong> crea tu cuenta en el
          panel de talleres con el mismo correo y completa tu perfil. Con eso empiezas a recibir solicitudes.
        </p>
        <a href={panel} className="mt-5 inline-flex rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110">
          Crear mi cuenta de taller
        </a>
        <p className="mt-3 text-xs text-[#6B675C]">
          ¿Dudas?{" "}
          <a href={ligaWhatsApp("Hola HETNA, acabo de registrar mi taller y tengo una duda")} target="_blank" rel="noreferrer" className="font-semibold text-[#1FA855]">
            Escríbenos por WhatsApp
          </a>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="grid gap-7 rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-7">
      <fieldset className="grid gap-3">
        <legend className={PASO}>
          <span className={NUM}>1</span> Tu taller
        </legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={ETIQUETA} htmlFor="nombre_taller">Nombre del taller *</label>
            <input id="nombre_taller" name="nombre_taller" required maxLength={120} className={CAMPO} />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="contacto">Tu nombre</label>
            <input id="contacto" name="contacto" maxLength={120} className={CAMPO} autoComplete="name" />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="ciudad">Ciudad</label>
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
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className={PASO}>
          <span className={NUM}>2</span> Qué haces
        </legend>
        <div className="mt-3">
          <p className={ETIQUETA}>Servicios que ofreces *</p>
          <Chips opciones={SERVICIOS} elegidas={servicios} alCambiar={setServicios} />
        </div>
        <div>
          <p className={ETIQUETA}>Materiales que trabajas</p>
          <Chips opciones={MATERIALES} elegidas={materiales} alCambiar={setMateriales} />
          <p className="mt-1 text-xs text-[#6B675C]">Te avisamos primero de las solicitudes de los materiales que marques.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={ETIQUETA} htmlFor="maquinas">Máquinas</label>
            <textarea
              id="maquinas"
              name="maquinas"
              rows={3}
              maxLength={1500}
              placeholder="Ej. Router 122 × 244 cm, láser CO2 100 W 130 × 90, plasma 150 × 300"
              className="w-full rounded-xl border border-[#E7E4DC] bg-white p-3 text-sm text-[#142033] outline-none focus:border-[#C2560A]"
            />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="capacidad">¿Cuánto puedes producir?</label>
            <select id="capacidad" name="capacidad" className={CAMPO} defaultValue="">
              <option value="">Selecciona</option>
              {CAPACIDAD.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className={PASO}>
          <span className={NUM}>3</span> Tu trabajo
        </legend>
        <div className="mt-3 grid gap-2">
          <label
            htmlFor="fotos"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              elegirFotos(e.dataTransfer.files)
            }}
            className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#D9D5CA] bg-[#FAF9F6] px-4 py-5 text-center hover:border-[#C2560A]"
          >
            <span className="text-sm font-bold text-[#142033]">Sube fotos de trabajos que has hecho</span>
            <span className="text-xs text-[#6B675C]">Hasta {FOTOS_MAX} fotos · las piezas reales convencen más que cualquier texto</span>
            <span className="mt-2 rounded-lg bg-[#142033] px-4 py-2 text-xs font-semibold text-white">Elegir fotos</span>
          </label>
          <input
            ref={entrada}
            id="fotos"
            type="file"
            multiple
            accept={EXT_FOTO.join(",")}
            className="sr-only"
            onChange={(e) => elegirFotos(e.target.files)}
          />
          {fotos.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {fotos.map((f) => (
                <li key={f.id} className="flex items-center gap-3 rounded-xl border border-[#E7E4DC] px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-[#142033]">{f.nombre}</span>
                    {f.error ? (
                      <span className="block text-xs text-[#B3261E]">{f.error}</span>
                    ) : f.subida ? (
                      <span className="block text-xs text-[#2E7D32]">Lista</span>
                    ) : (
                      <span className="mt-1 block h-1.5 overflow-hidden rounded bg-[#E7E4DC]">
                        <span className="block h-full bg-[#C2560A] transition-all" style={{ width: `${f.avance}%` }} />
                      </span>
                    )}
                  </span>
                  <button type="button" onClick={() => setFotos((xs) => xs.filter((x) => x.id !== f.id))} className="text-xs font-semibold text-[#6B675C] hover:text-[#B3261E]">
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="portafolio">¿Tienes Facebook, Instagram o página? Pega la liga (opcional)</label>
          <input id="portafolio" name="portafolio" className={CAMPO} placeholder="facebook.com/mitaller" />
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className={PASO}>
          <span className={NUM}>4</span> Contacto
        </legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={ETIQUETA} htmlFor="whatsapp">WhatsApp *</label>
            <input id="whatsapp" name="whatsapp" type="tel" required className={CAMPO} autoComplete="tel" placeholder="10 dígitos" />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="email">Correo *</label>
            <input id="email" name="email" type="email" required className={CAMPO} autoComplete="email" />
            <span className="mt-1 block text-xs text-[#6B675C]">Usa el mismo al crear tu cuenta del panel.</span>
          </div>
          <div className="sm:col-span-2">
            <label className={ETIQUETA} htmlFor="comentarios">Algo más que debamos saber (opcional)</label>
            <textarea
              id="comentarios"
              name="comentarios"
              rows={2}
              maxLength={1500}
              placeholder="Ej. Hacemos entregas en Guadalajara y zona metropolitana; tenemos pintura electrostática"
              className="w-full rounded-xl border border-[#E7E4DC] bg-white p-3 text-sm text-[#142033] outline-none focus:border-[#C2560A]"
            />
          </div>
          <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={estado === "enviando" || subiendo}
          className="rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {estado === "enviando" ? "Enviando…" : subiendo ? "Subiendo fotos…" : "Registrar mi taller"}
        </button>
        <span className="text-xs text-[#6B675C]">Es gratis. Tu WhatsApp y correo no se muestran a los clientes.</span>
      </div>
      {estado === "error" && <p className="text-sm text-[#B3261E]">{mensaje}</p>}
    </form>
  )
}
