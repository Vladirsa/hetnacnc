"use client"

import { useEffect, useRef, useState } from "react"

import {
  ACABADOS,
  EXTENSIONES_ARCHIVO,
  MAX_ARCHIVOS,
  MAX_MB_ARCHIVO,
  NECESIDADES,
  TIENE_ARCHIVO,
} from "@/lib/fabricacion/opciones"
import { type ArchivoSubido, enviarSolicitudTaller } from "@/lib/cotizar/solicitud-taller"
import { ligaWhatsApp } from "@/lib/hetna/empresa"
import { tomarArchivoParaFabricar } from "@/lib/generador/aCotizador"
import { subirArchivo } from "@/lib/subir-archivo"
import { SERVICIOS_SOLICITUD } from "@/lib/trabajos/servicios"

const SERVICIOS = SERVICIOS_SOLICITUD

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
const PASO = "flex items-center gap-2 text-[15px] font-extrabold text-[#142033]"
const NUM = "grid h-6 w-6 place-items-center rounded-full bg-[#142033] text-[12px] font-bold text-white"

// Un archivo en la lista: subiendo (con avance), listo (con su clave) o con error.
type Pendiente = {
  id: string
  nombre: string
  tamano: number
  avance: number
  subido?: ArchivoSubido
  error?: string
}

// Datos que llegan ya llenos desde una herramienta de Diseñar (botón
// "Fabrícamelo"): el archivo generado se sube solo y los campos vienen puestos.
export type Prellenado = {
  pieza: string // nombre de la pieza, p. ej. "Caja con bisagras de armario"
  medidas?: string
  material?: string
  archivo?: string // ruta relativa (/mx/disenar/...) de donde bajar el DXF
  nombreArchivo?: string
  proceso?: string // "Corte láser", "Router CNC"…
}

const pesoLegible = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`)

export default function FormSolicitudTaller({
  taller,
  nombreTaller,
  servicioInicial,
  necesidadInicial,
  prellenado,
}: {
  taller?: string
  nombreTaller?: string
  servicioInicial?: string
  necesidadInicial?: string
  prellenado?: Prellenado
}) {
  const [estado, setEstado] = useState<"listo" | "enviando" | "ok" | "error">("listo")
  const [mensaje, setMensaje] = useState("")
  const [folio, setFolio] = useState("")
  // Resumen para el mensaje de WhatsApp de después: la solicitud ya quedó
  // registrada con todos sus datos, el WhatsApp sólo la acompaña.
  const [resumen, setResumen] = useState("")
  const [necesidad, setNecesidad] = useState<string>(
    NECESIDADES.some((n) => n.valor === necesidadInicial) ? necesidadInicial! : prellenado ? "Cortar piezas" : ""
  )
  const [tieneArchivo, setTieneArchivo] = useState<string>(prellenado ? "Tengo archivo profesional" : "")
  const [archivos, setArchivos] = useState<Pendiente[]>([])
  const entrada = useRef<HTMLInputElement>(null)
  const archivoPrellenado = useRef(false)

  // El archivo que generó la herramienta se baja y se sube como si el
  // cliente lo hubiera elegido (sólo rutas de este sitio, nunca externas).
  useEffect(() => {
    if (!prellenado || archivoPrellenado.current) return
    // Generadores que calculan en el navegador: dejan el archivo en sessionStorage
    const guardado = tomarArchivoParaFabricar()
    if (guardado) {
      archivoPrellenado.current = true
      elegirArchivos([guardado])
      return
    }
    const ruta = prellenado.archivo
    if (!ruta || !ruta.startsWith("/") || ruta.startsWith("//")) return
    archivoPrellenado.current = true
    const nombre = prellenado?.nombreArchivo || `hetna-${(prellenado?.pieza || "pieza").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.dxf`
    fetch(ruta)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("no se pudo bajar"))))
      .then((b) => elegirArchivos([new File([b], nombre, { type: b.type || "application/dxf" })] as unknown as FileList))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prellenado])

  const opcionArchivo = TIENE_ARCHIVO.find((t) => t.valor === tieneArchivo)
  const subiendo = archivos.some((a) => !a.subido && !a.error)

  const elegirArchivos = (lista: FileList | File[] | null) => {
    if (!lista) return
    const libres = MAX_ARCHIVOS - archivos.filter((a) => !a.error).length
    const nuevos = Array.from(lista).slice(0, Math.max(0, libres))
    for (const f of nuevos) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const ext = "." + (f.name.split(".").pop() || "").toLowerCase()
      const base: Pendiente = { id, nombre: f.name, tamano: f.size, avance: 0 }
      if (!EXTENSIONES_ARCHIVO.includes(ext)) {
        setArchivos((xs) => [...xs, { ...base, error: "Ese tipo de archivo no se acepta." }])
        continue
      }
      if (f.size > MAX_MB_ARCHIVO * 1024 * 1024) {
        setArchivos((xs) => [...xs, { ...base, error: `Pesa más de ${MAX_MB_ARCHIVO} MB.` }])
        continue
      }
      setArchivos((xs) => [...xs, base])
      const poner = (cambio: Partial<Pendiente>) =>
        setArchivos((xs) => xs.map((a) => (a.id === id ? { ...a, ...cambio } : a)))
      subirArchivo(f, (n) => poner({ avance: n }))
        .then((subido) => poner({ subido, avance: 100 }))
        .catch((e: Error) => poner({ error: e.message }))
    }
    if (entrada.current) entrada.current.value = ""
  }

  const quitar = (id: string) => setArchivos((xs) => xs.filter((a) => a.id !== id))

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (subiendo) {
      setEstado("error")
      setMensaje("Espera a que terminen de subir tus archivos.")
      return
    }
    const fd = new FormData(e.currentTarget)
    const v = (k: string) => String(fd.get(k) || "").trim()
    setEstado("enviando")
    const r = await enviarSolicitudTaller({
      taller,
      abierta: !taller || fd.get("abierta") === "1",
      necesidad,
      tiene_archivo: tieneArchivo,
      archivos: archivos.flatMap((a) => (a.subido ? [a.subido] : [])),
      nombre: v("nombre"),
      email: v("email"),
      whatsapp: v("whatsapp"),
      ciudad: v("ciudad"),
      estado_mx: v("estado_mx"),
      medidas: v("medidas"),
      acabado: v("acabado"),
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
      setResumen(
        [necesidad, v("cantidad") && `${v("cantidad")}`, v("material") && `en ${v("material")}`, v("ciudad") || v("estado_mx")]
          .filter(Boolean)
          .join(", ")
      )
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
        <ol className="mx-auto mt-5 grid max-w-md gap-2 text-left text-sm text-[#40403A]">
          <li><strong className="text-[#142033]">1.</strong> Los talleres que hacen ese trabajo la reciben y te mandan precio y tiempo.</li>
          <li><strong className="text-[#142033]">2.</strong> Si a un taller le falta un dato, te escribimos por correo o WhatsApp.</li>
          <li><strong className="text-[#142033]">3.</strong> Eliges, pagas dentro de HETNA y el taller empieza a producir.</li>
        </ol>
        <a
          href={ligaWhatsApp(
            `Hola HETNA, acabo de enviar la solicitud ${folio || ""}${resumen ? ` (${resumen})` : ""}. Quiero darle seguimiento.`
          )}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#1FA855] px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
        >
          Darle seguimiento por WhatsApp
        </a>
        <p className="mt-2 text-xs text-[#6B675C]">Opcional: tu solicitud ya quedó registrada con todos sus datos.</p>
      </div>
    )
  }

  const chip = (activo: boolean) =>
    `rounded-xl border px-3 py-2.5 text-left transition ${
      activo ? "border-[#C2560A] bg-[#FDEEE1] ring-1 ring-[#C2560A]" : "border-[#E7E4DC] bg-white hover:border-[#C2560A]"
    }`

  return (
    <form onSubmit={enviar} className="grid gap-7 rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-7">
      {nombreTaller && (
        <p className="rounded-xl bg-[#F3F1EA] px-4 py-3 text-sm text-[#40403A]">
          Cotizando con <strong className="text-[#142033]">{nombreTaller}</strong>
        </p>
      )}
      {prellenado && (
        <div className="rounded-xl border-2 border-[#19B374] bg-[#E7F5EC] px-4 py-3 text-sm text-[#0F5F36]">
          <strong className="text-[#0F7A4A]">Tu diseño ya viene cargado:</strong> {prellenado.pieza}
          {prellenado.medidas ? ` · ${prellenado.medidas}` : ""}
          {prellenado.material ? ` · ${prellenado.material}` : ""}. Revisa la cantidad, pon tu ciudad y envía: los talleres reciben el archivo tal cual lo generaste.
        </div>
      )}

      {/* 1. Qué necesitas */}
      <fieldset className="grid gap-3">
        <legend className={PASO}>
          <span className={NUM}>1</span> ¿Qué tipo de proyecto es?
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {NECESIDADES.map((n) => (
            <button
              type="button"
              key={n.valor}
              aria-pressed={necesidad === n.valor}
              onClick={() => setNecesidad(necesidad === n.valor ? "" : n.valor)}
              className={chip(necesidad === n.valor)}
            >
              <span className="block text-sm font-bold text-[#142033]">{n.valor}</span>
              <span className="block text-xs text-[#6B675C]">{n.detalle}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* 2. Archivo */}
      <fieldset className="grid gap-3">
        <legend className={PASO}>
          <span className={NUM}>2</span> ¿Tienes archivo o diseño?
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {TIENE_ARCHIVO.map((t) => (
            <button
              type="button"
              key={t.valor}
              aria-pressed={tieneArchivo === t.valor}
              onClick={() => setTieneArchivo(tieneArchivo === t.valor ? "" : t.valor)}
              className={chip(tieneArchivo === t.valor)}
            >
              <span className="block text-sm font-bold text-[#142033]">{t.valor}</span>
              <span className="block text-xs text-[#6B675C]">{t.detalle}</span>
            </button>
          ))}
        </div>

        {opcionArchivo && !opcionArchivo.pideArchivo && (
          <p className="rounded-xl bg-[#F3F1EA] px-4 py-3 text-sm text-[#40403A]">
            Sin problema. Descríbela lo mejor que puedas abajo (para qué sirve, medidas, dónde va).
            Los talleres que también diseñan te cotizan el diseño junto con la fabricación.
          </p>
        )}

        {(!opcionArchivo || opcionArchivo.pideArchivo) && (
          <div className="grid gap-2">
            <label
              htmlFor="archivos"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                elegirArchivos(e.dataTransfer.files)
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#D9D5CA] bg-[#FAF9F6] px-4 py-6 text-center hover:border-[#C2560A]"
            >
              <span className="text-sm font-bold text-[#142033]">Sube tu archivo o fotos</span>
              <span className="text-xs text-[#6B675C]">
                DXF, DWG, SVG, AI, PDF, STL, STEP, fotos o ZIP · hasta {MAX_ARCHIVOS} archivos de {MAX_MB_ARCHIVO} MB
              </span>
              <span className="mt-2 rounded-lg bg-[#142033] px-4 py-2 text-xs font-semibold text-white">Elegir archivos</span>
            </label>
            <input
              ref={entrada}
              id="archivos"
              type="file"
              multiple
              accept={EXTENSIONES_ARCHIVO.join(",")}
              className="sr-only"
              onChange={(e) => elegirArchivos(e.target.files)}
            />
            {archivos.length > 0 && (
              <ul className="grid gap-2">
                {archivos.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-xl border border-[#E7E4DC] px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-[#142033]">{a.nombre}</span>
                      {a.error ? (
                        <span className="block text-xs text-[#B3261E]">{a.error}</span>
                      ) : a.subido ? (
                        <span className="block text-xs text-[#2E7D32]">Listo · {pesoLegible(a.tamano)}</span>
                      ) : (
                        <span className="mt-1 block h-1.5 overflow-hidden rounded bg-[#E7E4DC]">
                          <span className="block h-full bg-[#C2560A] transition-all" style={{ width: `${a.avance}%` }} />
                        </span>
                      )}
                    </span>
                    <button type="button" onClick={() => quitar(a.id)} className="text-xs font-semibold text-[#6B675C] hover:text-[#B3261E]">
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-[#6B675C]">
              Tus archivos se guardan privados: sólo los ven los talleres registrados que cotizan tu trabajo.
            </p>
          </div>
        )}
      </fieldset>

      {/* 3. Detalles */}
      <fieldset className="grid gap-3">
        <legend className={PASO}>
          <span className={NUM}>3</span> Detalles de la pieza
        </legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={ETIQUETA} htmlFor="descripcion">Comentarios: describe tu pieza o proyecto *</label>
            <textarea
              id="descripcion"
              name="descripcion"
              required
              minLength={10}
              maxLength={3000}
              rows={4}
              placeholder="Ej. 50 letreros de MDF de 30 x 20 cm con el logo grabado, para la entrada de una tienda"
              defaultValue={
                prellenado
                  ? `Pieza diseñada con las herramientas de HETNA: ${prellenado.pieza}${prellenado.medidas ? `, ${prellenado.medidas}` : ""}${prellenado.material ? `, en ${prellenado.material}` : ""}. El archivo de corte va adjunto; sólo necesito que la corten.`
                  : undefined
              }
              className="w-full rounded-xl border border-[#E7E4DC] bg-white p-3 text-sm text-[#142033] outline-none focus:border-[#C2560A]"
            />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="material">Material</label>
            <input id="material" name="material" className={CAMPO} placeholder="MDF 6 mm, acrílico, acero, aluminio…" defaultValue={prellenado?.material} />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="cantidad">Cantidad</label>
            <input id="cantidad" name="cantidad" className={CAMPO} placeholder="Ej. 1 pieza, 50 piezas" defaultValue={prellenado ? "1 pieza" : undefined} />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="medidas">Medidas aproximadas</label>
            <input id="medidas" name="medidas" className={CAMPO} placeholder="Ej. 30 x 20 cm, espesor 6 mm" defaultValue={prellenado?.medidas} />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="acabado">Acabado</label>
            <select id="acabado" name="acabado" className={CAMPO} defaultValue="">
              <option value="">Selecciona</option>
              {ACABADOS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="fecha">¿Para cuándo lo necesitas?</label>
            <input id="fecha" name="fecha" type="date" className={CAMPO} />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="servicio">Proceso (si lo sabes)</label>
            <select
              id="servicio"
              name="servicio"
              className={CAMPO}
              defaultValue={servicioInicial && SERVICIOS.includes(servicioInicial) ? servicioInicial : prellenado?.proceso && SERVICIOS.includes(prellenado.proceso) ? prellenado.proceso : ""}
            >
              <option value="">No sé, que me recomienden</option>
              {SERVICIOS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
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
          <div className="sm:col-span-2">
            <label className={ETIQUETA} htmlFor="archivo_url">¿Tus archivos están en la nube? Pega la liga (opcional)</label>
            <input
              id="archivo_url"
              name="archivo_url"
              type="url"
              className={CAMPO}
              placeholder="Google Drive, Dropbox o WeTransfer"
            />
          </div>
        </div>
      </fieldset>

      {/* 4. Entrega y contacto */}
      <fieldset className="grid gap-3">
        <legend className={PASO}>
          <span className={NUM}>4</span> Entrega y contacto
        </legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
          <div>
            <label className={ETIQUETA} htmlFor="acepta_envio">¿Aceptas envío por paquetería?</label>
            <select id="acepta_envio" name="acepta_envio" className={CAMPO} defaultValue="Sí">
              <option>Sí</option>
              <option value="No">No, prefiero recoger o que me lo entreguen</option>
            </select>
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="nombre">Tu nombre</label>
            <input id="nombre" name="nombre" className={CAMPO} autoComplete="name" />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="email">Correo *</label>
            <input id="email" name="email" type="email" required className={CAMPO} autoComplete="email" />
            <span className="mt-1 block text-xs text-[#6B675C]">Ahí te llega la liga para ver y comparar propuestas.</span>
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="whatsapp">WhatsApp</label>
            <input id="whatsapp" name="whatsapp" type="tel" className={CAMPO} autoComplete="tel" placeholder="10 dígitos" />
            <span className="mt-1 block text-xs text-[#6B675C]">Para avisarte más rápido si falta algún dato.</span>
          </div>
          {taller && (
            <label className="flex items-start gap-2 text-sm text-[#40403A] sm:col-span-2">
              <input type="checkbox" name="abierta" value="1" className="mt-1 accent-[#C2560A]" />
              También quiero recibir propuestas de otros talleres de la red para comparar.
            </label>
          )}
          <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={estado === "enviando" || subiendo}
          className="rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {estado === "enviando"
            ? "Enviando…"
            : subiendo
              ? "Subiendo archivos…"
              : taller
                ? "Solicitar cotización"
                : "Enviar y recibir propuestas"}
        </button>
        <span className="text-xs text-[#6B675C]">
          Es gratis y sin compromiso. Tu correo y WhatsApp sólo los ve HETNA: los talleres reciben la descripción del trabajo, no tus datos.
        </span>
      </div>
      {estado === "error" && <p className="text-sm text-[#B3261E]">{mensaje}</p>}
    </form>
  )
}
