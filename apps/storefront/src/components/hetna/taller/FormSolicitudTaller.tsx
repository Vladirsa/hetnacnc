"use client"

import { T } from "@/components/hetna/i18n/Idioma"
import { EVENTO as EVENTO_UBICACION } from "@/lib/ubicacion/useUbicacion"
import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"

import { PrivacidadSolicitud } from "./PrivacidadSolicitud"
import { TarjetaAfiliacion } from "@/components/hetna/cuenta/TarjetaAfiliacion"

import type { GeoCad } from "@/lib/cotizador/archivo-cad"
import { procesoDe } from "@/lib/cotizador/revision-archivo"
import { RevisionArchivo } from "@/components/hetna/cotizar/RevisionArchivo"
import { LeerFotoIA } from "./LeerFotoIA"
import type { LecturaFoto } from "@/lib/cotizar/acciones"

import {
  ACABADOS,
  TOLERANCIAS,
  EXTENSIONES_ARCHIVO,
  MAX_ARCHIVOS,
  MAX_MB_ARCHIVO,
  NECESIDADES,
  TIENE_ARCHIVO,
} from "@/lib/fabricacion/opciones"
import { type AfiliacionNueva, type ArchivoSubido, enviarSolicitudTaller } from "@/lib/cotizar/solicitud-taller"
import { trackSolicitudFabricacion } from "@/lib/analytics/events"
import { permiteRastreo } from "@/lib/hetna/consentimiento"
import { leerOrigen } from "@/lib/hetna/origen-visita"
import { haySesionCliente } from "@/lib/data/customer"
import { buscarCP } from "@/lib/envios/cotizar"
import { ligaWhatsApp } from "@/lib/hetna/empresa"
import { tomarArchivoGrandeParaFabricar, tomarArchivoParaFabricar, tomarArchivosParaFabricar } from "@/lib/generador/aCotizador"
import { type MedidaPieza, leerCantidad, medirArchivo } from "@/lib/hetna/estimado"
import { subirArchivo } from "@/lib/subir-archivo"
import { DIAS_CONSERVACION_ARCHIVOS, PLAZO_PRIMERA_RESPUESTA } from "@/lib/hetna/promesas"
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
// El visor carga three.js sólo cuando hay un modelo 3D que mostrar
const VisorCad = dynamic(() => import("@/components/hetna/visor/VisorCad").then((m) => m.VisorCad), { ssr: false })

type Pendiente = {
  id: string
  nombre: string
  tamano: number
  avance: number
  subido?: ArchivoSubido
  error?: string
  // Lo que se leyó del archivo en el navegador (DXF, SVG, STL u OBJ)
  geo?: string
  // Plano o modelo leído en el navegador, para el visor
  cad?: GeoCad
  verCad?: boolean
  // El cliente decide: lo ve cualquier taller que pueda cotizar o sólo el que elija
  soloElegido?: boolean
}

// Datos que llegan ya llenos desde una herramienta de Diseñar (botón
// "Fabrícamelo"): el archivo generado se sube solo y los campos vienen puestos.
export type Prellenado = {
  pieza: string // nombre de la pieza, p. ej. "Caja con bisagras de armario"
  medidas?: string
  material?: string
  archivo?: string // ruta relativa (/mx/disenar/...) de donde bajar el DXF
  nombreArchivo?: string
  // "producto": viene de "Fabrícalo con un taller" en la ficha de un diseño de la tienda
  desde?: string
  proceso?: string // "Corte láser", "Router CNC"…
  // Desde el estimador del cliente (/user/cotizar): el archivo ya está en el
  // bucket (no se vuelve a subir), la cantidad y la descripción vienen puestas
  // y el archivo no se baja de ninguna ruta.
  archivos?: (ArchivoSubido & { geo?: string })[]
  cantidad?: string
  descripcion?: string
  // "Repetir pedido" desde Mis piezas: folio de la solicitud original
  repiteFolio?: string
}

const pesoLegible = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`)

export default function FormSolicitudTaller({
  taller,
  nombreTaller,
  servicioInicial,
  necesidadInicial,
  descripcionInicial,
  prellenado,
  alEnviar,
}: {
  taller?: string
  nombreTaller?: string
  servicioInicial?: string
  necesidadInicial?: string
  /** Texto con el que empieza "Comentarios" (p. ej. lo que se buscó en la tienda sin resultados). */
  descripcionInicial?: string
  prellenado?: Prellenado
  /** Se llama cuando la solicitud quedó registrada (p. ej. el directorio avisa a la empresa). */
  alEnviar?: (d: { folio: string; servicio: string; material: string; cantidad: string; ciudad: string; estado_mx: string }) => void
}) {
  const [estado, setEstado] = useState<"listo" | "enviando" | "ok" | "error">("listo")
  const [mensaje, setMensaje] = useState("")
  const [folio, setFolio] = useState("")
  const [eligeHetna, setEligeHetna] = useState(false)
  // Alta rápida con número de afiliado: sólo se ofrece sin sesión
  const [conSesion, setConSesion] = useState(true)
  const [crearCuenta, setCrearCuenta] = useState(true)
  const [afiliacion, setAfiliacion] = useState<AfiliacionNueva | null>(null)
  useEffect(() => {
    haySesionCliente().then(setConSesion).catch(() => setConSesion(false))
  }, [])
  // Resumen para el mensaje de WhatsApp de después: la solicitud ya quedó
  // registrada con todos sus datos, el WhatsApp sólo la acompaña.
  const [resumen, setResumen] = useState("")
  const [necesidad, setNecesidad] = useState<string>(
    NECESIDADES.some((n) => n.valor === necesidadInicial)
      ? necesidadInicial!
      : // Un modelo para imprimir en 3D no se «corta»: sale como pieza terminada
        prellenado?.proceso === "Impresión 3D"
        ? "Pieza terminada"
        : prellenado
          ? "Cortar piezas"
          : ""
  )
  const [tieneArchivo, setTieneArchivo] = useState<string>(prellenado ? "Tengo archivo profesional" : "")
  const [archivos, setArchivos] = useState<Pendiente[]>(() =>
    (prellenado?.archivos || []).map((a, i) => ({ id: `ini-${i}`, nombre: a.nombre, tamano: a.tamano, avance: 100, subido: a, geo: a.geo }))
  )
  const entrada = useRef<HTMLInputElement>(null)
  // Proceso elegido en el formulario (para la revisión del archivo: el agujero
  // mínimo no es igual en láser, router o plasma)
  const procesoElegido = () =>
    (typeof document !== "undefined" ? (document.getElementById("servicio") as HTMLSelectElement | null)?.value : "") || servicioInicial || prellenado?.proceso || ""
  const medidasRef = useRef<HTMLInputElement>(null)
  const archivoPrellenado = useRef(false)
  const [cp, setCp] = useState("")
  const [ciudad, setCiudad] = useState("")
  const [estadoMx, setEstadoMx] = useState("")
  const [avisoCp, setAvisoCp] = useState("")
  // Con taller elegido: ¿también quiere propuestas de otros? (si no, es privada)
  const [abiertaOtros, setAbiertaOtros] = useState(false)
  // Medidas de la pieza (área y metros de corte) para el estimado por taller
  // de TalleresCerca; se avisan por el evento "hetna:pieza" junto con la cantidad.
  const medida = useRef<MedidaPieza | null>(null)
  const cantidadRef = useRef<HTMLInputElement>(null)
  const avisarPieza = (cantidadTexto?: string) => {
    const cantidad = leerCantidad(cantidadTexto ?? cantidadRef.current?.value ?? "1")
    window.dispatchEvent(new CustomEvent("hetna:pieza", { detail: { medida: medida.current, cantidad } }))
  }
  const medir = (f: File) =>
    medirArchivo(f).then((m) => {
      medida.current = m
      avisarPieza()
    })

  // Con el código postal se llenan ciudad y estado, y se avisa a la lista de
  // "talleres cerca de ti" (TalleresCerca) para que se ordene por cercanía.
  const cambiarCp = async (v: string) => {
    const limpio = v.replace(/\D/g, "").slice(0, 5)
    setCp(limpio)
    setAvisoCp("")
    if (limpio.length !== 5) return
    const r = await buscarCP(limpio)
    if (!r.ok) {
      setAvisoCp(r.mensaje)
      return
    }
    const municipio = r.info.municipio || r.info.ciudad
    setCiudad(municipio)
    setEstadoMx(r.info.estado)
    window.dispatchEvent(new CustomEvent(EVENTO_UBICACION, { detail: { cp: limpio, municipio, estado: r.info.estado } }))
  }

  // El archivo que generó la herramienta se baja y se sube como si el
  // cliente lo hubiera elegido (sólo rutas de este sitio, nunca externas).
  useEffect(() => {
    if (!prellenado || archivoPrellenado.current || prellenado.archivos?.length) return
    // Generadores que calculan en el navegador: dejan el archivo en sessionStorage
    const guardado = tomarArchivoParaFabricar()
    if (guardado) {
      archivoPrellenado.current = true
      elegirArchivos([guardado])
      medir(guardado)
      return
    }
    // Los grandes (STL de litofanías y relieves) y los proyectos con varios
    // archivos (piezas, ZIP y planos del Cotizador) llegan por IndexedDB
    if (prellenado.pieza && !prellenado.archivo) {
      archivoPrellenado.current = true
      tomarArchivosParaFabricar().then(async (varios) => {
        if (varios.length) {
          elegirArchivos(varios)
          const medible = varios.find((f) => /\.(dxf|svg|stl|obj)$/i.test(f.name))
          if (varios.length === 1 && medible) medir(medible)
          return
        }
        const g = await tomarArchivoGrandeParaFabricar()
        if (!g) return
        elegirArchivos([g])
        medir(g)
      })
      return
    }
    const ruta = prellenado.archivo
    if (!ruta || !ruta.startsWith("/") || ruta.startsWith("//")) return
    archivoPrellenado.current = true
    const nombre = prellenado?.nombreArchivo || `hetna-${(prellenado?.pieza || "pieza").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.dxf`
    fetch(ruta)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("no se pudo bajar"))))
      .then((b) => {
        const f = new File([b], nombre, { type: b.type || "application/dxf" })
        elegirArchivos([f])
        medir(f)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prellenado])

  const opcionArchivo = TIENE_ARCHIVO.find((t) => t.valor === tieneArchivo)
  const subiendo = archivos.some((a) => !a.subido && !a.error)

  // La IA leyó una foto o un boceto: llena los campos (el cliente los revisa).
  // Sólo pisa un campo si está vacío, menos la descripción, que se completa.
  const llenarDesdeFoto = (l: LecturaFoto) => {
    const poner = (id: string, valor: string | null | undefined, siempre = false) => {
      const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
      if (!el || !valor) return
      if (!siempre && el.value.trim()) return
      el.value = valor
    }
    const desc = document.getElementById("descripcion") as HTMLTextAreaElement | null
    if (desc) {
      const ia = `${l.pieza}. ${l.descripcion}`.trim()
      desc.value = desc.value.trim() ? `${desc.value.trim()}\n\n${ia}` : ia
    }
    poner("material", l.material)
    poner("medidas", l.medidas ? `${l.medidas}${l.medidas_aproximadas ? " (aprox.)" : ""}` : null)
    poner("cantidad", l.cantidad)
    if (l.proceso && SERVICIOS.includes(l.proceso as (typeof SERVICIOS)[number])) poner("servicio", l.proceso)
    if (l.acabado && ACABADOS.includes(l.acabado)) poner("acabado", l.acabado)
    if (!tieneArchivo) setTieneArchivo("Tengo boceto o foto")
  }

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
      // Vista previa de medidas: se lee aquí mismo, sin mandar nada.
      if (/\.(dxf|svg|stl|obj|step|stp)$/i.test(f.name)) {
        Promise.all([import("@/lib/cotizador/archivo-cad"), import("@/lib/cotizador/revision-archivo")])
          .then(async ([{ leerArchivoCad }, rev]) => ({ g: await leerArchivoCad(f), rev }))
          .then(({ g, rev }) => {
            if (!g || !(g.largo > 0)) return
            const mm = (n: number) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString("es-MX")
            const lam = g.lamina?.esLamina ? g.lamina : null
            const texto = lam
              ? `Lámina de ${mm(lam.espesor)} mm · ${lam.dobleces.length} ${lam.dobleces.length === 1 ? "doblez" : "dobleces"}${lam.radioInteriorMin != null ? ` (radio int. ${mm(lam.radioInteriorMin)} mm)` : ""} · extendida ${mm(lam.areaPlana / 100)} cm² · ${(lam.corte / 1000).toLocaleString("es-MX", { maximumFractionDigits: 2 })} m de corte${lam.barrenos ? ` · ${lam.barrenos} barrenos` : ""} · ${mm(g.largo)} × ${mm(g.ancho)} × ${mm(g.alto)} mm`
              : g.tipo === "3d"
                ? `${mm(g.largo)} × ${mm(g.ancho)} × ${mm(g.alto)} mm${g.volumen_cm3 ? ` · ${mm(g.volumen_cm3)} cm³` : ""}`
                : `${mm(g.largo)} × ${mm(g.ancho)} mm · ${(g.corte_mm / 1000).toLocaleString("es-MX", { maximumFractionDigits: 2 })} m de corte` +
                  (g.perforaciones ? ` · ${g.perforaciones} perforaciones` : "")
            // La revisión automática del archivo viaja con las medidas: así el
            // taller ve de una vez si el archivo trae contornos abiertos, textos...
            const malos = rev.puntosRevision(g, { proceso: rev.procesoDe(procesoElegido()) }).filter((p) => p.nivel !== "ok")
            const conRevision = malos.length ? `${texto} · revisión: ${rev.resumenRevision(malos)}` : `${texto} · archivo revisado sin problemas`
            poner({ geo: conRevision, cad: g, verCad: true })
            const campo = medidasRef.current
            if (campo && !campo.value.trim()) campo.value = g.tipo === "3d" ? `${mm(g.largo)} × ${mm(g.ancho)} × ${mm(g.alto)} mm` : `${mm(g.largo)} × ${mm(g.ancho)} mm`
          })
          .catch(() => {})
      }
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
    const rastreo = permiteRastreo()
    const r = await enviarSolicitudTaller({
      rastreo,
      origen: leerOrigen(),
      crear_cuenta: !conSesion && crearCuenta,
      taller,
      abierta: !taller || abiertaOtros,
      necesidad,
      tiene_archivo: tieneArchivo,
      archivos: archivos.flatMap((a) => (a.subido ? [{ ...a.subido, ...(a.soloElegido ? { solo_elegido: true } : {}) }] : [])),
      nombre: v("nombre"),
      email: v("email"),
      whatsapp: v("whatsapp"),
      ciudad: v("ciudad"),
      estado_mx: v("estado_mx"),
      cp,
      medidas: v("medidas"),
      acabado: v("acabado"),
      tolerancia: v("tolerancia"),
      orden_compra: v("orden_compra") || undefined,
      con_factura: fd.get("con_factura") === "1",
      hetna_elige: fd.get("hetna_elige") === "1",
      tope_precio: v("tope_precio") || undefined,
      repite_folio: prellenado?.repiteFolio || undefined,
      // Medidas leídas de los archivos en el navegador
      medidas_archivo: archivos
        .filter((a) => a.geo && a.subido)
        .map((a) => `${a.nombre}: ${a.geo}`)
        .join(" | ")
        .slice(0, 400),
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
      // Licitaciones 3.0: privacidad y modalidad (PrivacidadSolicitud)
      empresa: v("empresa"),
      modalidad: v("modalidad"),
      solo_verificados: v("solo_verificados") === "1",
      privacidad: v("privacidad"),
      difundir_redes: v("difundir_redes") !== "0",
      invitados: v("invitados"),
    })
    if (r.ok) {
      if (rastreo) trackSolicitudFabricacion(r.folio || "", v("servicio") || necesidad)
      alEnviar?.({
        folio: r.folio || "",
        servicio: v("servicio") || necesidad,
        material: v("material"),
        cantidad: v("cantidad"),
        ciudad: v("ciudad"),
        estado_mx: v("estado_mx"),
      })
      setFolio(r.folio || "")
      setAfiliacion(r.afiliacion || null)
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
        <h3 className="mt-2 text-xl font-extrabold text-[#142033]"><T>Recibimos tu solicitud</T></h3>
        {folio && <p className="mt-1 font-semibold text-[#C2560A]"><T>Folio</T> <T>{folio}</T></p>}
        {afiliacion && <TarjetaAfiliacion afiliacion={afiliacion} />}
        <p className="mx-auto mt-2 max-w-md text-[#6B675C]">
          <T>Te enviamos un correo con una liga privada. Ahí verás las propuestas</T>
          <T>{nombreTaller ? ` de ${nombreTaller}` : " de los talleres"}</T> <T>conforme lleguen, las comparas y eliges la que más te convenga.</T>
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-[#17633A]"><T>Te respondemos en</T> {PLAZO_PRIMERA_RESPUESTA}.</p>
        <ol className="mx-auto mt-5 grid max-w-md gap-2 text-left text-sm text-[#40403A]">
          <li><strong className="text-[#142033]">1.</strong> <T>Los talleres que hacen ese trabajo la reciben y te mandan precio y tiempo.</T></li>
          <li><strong className="text-[#142033]">2.</strong> <T>Si a un taller le falta un dato, te escribimos por correo o WhatsApp.</T></li>
          <li><strong className="text-[#142033]">3.</strong> <T>Eliges, pagas dentro de HETNA y el taller empieza a producir.</T></li>
        </ol>
        <a
          href={ligaWhatsApp(
            `Hola HETNA, acabo de enviar la solicitud ${folio || ""}${resumen ? ` (${resumen})` : ""}. Quiero darle seguimiento.`
          )}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#1FA855] px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
        >
          <T>Darle seguimiento por WhatsApp</T>
        </a>
        <p className="mt-2 text-xs text-[#6B675C]"><T>Opcional: tu solicitud ya quedó registrada con todos sus datos.</T></p>
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
          <T>Cotizando con</T> <strong className="text-[#142033]"><T>{nombreTaller}</T></strong>
        </p>
      )}
      {prellenado?.desde === "producto" && !prellenado.archivos?.length && (
        <div className="rounded-xl border-2 border-[#19B374] bg-[#E7F5EC] px-4 py-3 text-sm text-[#0F5F36]">
          <strong className="text-[#0F7A4A]"><T>Diseño de la tienda:</T></strong> <T>{prellenado.pieza}</T>
          <T>{prellenado.medidas ? ` · ${prellenado.medidas}` : ""}</T>
          <T>{prellenado.material ? ` · ${prellenado.material}` : ""}</T><T>. Si ya compraste el archivo, súbelo abajo; si no, el taller lo verá en la tienda y lo
          incluirá en su propuesta. Revisa la cantidad, pon tu ciudad y envía.</T>
        </div>
      )}
      {prellenado && !(prellenado.desde === "producto" && !prellenado.archivos?.length) && (
        <div className="rounded-xl border-2 border-[#19B374] bg-[#E7F5EC] px-4 py-3 text-sm text-[#0F5F36]">
          <strong className="text-[#0F7A4A]"><T>{prellenado.archivos?.length ? "Tu archivo ya viene cargado:" : "Tu diseño ya viene cargado:"}</T></strong> <T>{prellenado.pieza}</T>
          <T>{prellenado.medidas ? ` · ${prellenado.medidas}` : ""}</T>
          <T>{prellenado.material ? ` · ${prellenado.material}` : ""}</T><T>. Revisa la cantidad, pon tu ciudad y envía: los talleres reciben el archivo tal cual</T> <T>{prellenado.archivos?.length ? "lo subiste" : "lo generaste"}</T>.
        </div>
      )}

      {/* 1. Qué necesitas */}
      <fieldset className="grid gap-3">
        <legend className={PASO}>
          <span className={NUM}>1</span> <T>¿Qué tipo de proyecto es?</T>
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
              <span className="block text-sm font-bold text-[#142033]"><T>{n.valor}</T></span>
              <span className="block text-xs text-[#6B675C]"><T>{n.detalle}</T></span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* 2. Archivo */}
      <fieldset className="grid gap-3">
        <legend className={PASO}>
          <span className={NUM}>2</span> <T>¿Tienes archivo o diseño?</T>
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
              <span className="block text-sm font-bold text-[#142033]"><T>{t.valor}</T></span>
              <span className="block text-xs text-[#6B675C]"><T>{t.detalle}</T></span>
            </button>
          ))}
        </div>

        {!prellenado && <LeerFotoIA alLeer={llenarDesdeFoto} adjuntar={(f) => elegirArchivos([f])} />}

        {opcionArchivo && !opcionArchivo.pideArchivo && (
          <p className="rounded-xl bg-[#F3F1EA] px-4 py-3 text-sm text-[#40403A]">
            <T>Sin problema. Descríbela lo mejor que puedas abajo (para qué sirve, medidas, dónde va).
            Los talleres que también diseñan te cotizan el diseño junto con la fabricación.</T>
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
              <span className="text-sm font-bold text-[#142033]"><T>Sube tu archivo o fotos</T></span>
              <span className="text-xs text-[#6B675C]">
                <T>DXF, DWG, SVG, AI, PDF, STL, STEP, fotos o ZIP · hasta</T> {MAX_ARCHIVOS} <T>archivos de</T> {MAX_MB_ARCHIVO} <T>MB</T>
              </span>
              <span className="mt-2 rounded-lg bg-[#142033] px-4 py-2 text-xs font-semibold text-white"><T>Elegir archivos</T></span>
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
                  <li key={a.id} className="rounded-xl border border-[#E7E4DC] text-sm">
                    <div className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-[#142033]"><T>{a.nombre}</T></span>
                      {a.error ? (
                        <span className="block text-xs text-[#B3261E]"><T>{a.error}</T></span>
                      ) : a.subido ? (
                        <span className="block text-xs text-[#2E7D32]"><T>Listo ·</T> {pesoLegible(a.tamano)}</span>
                      ) : (
                        <span className="mt-1 block h-1.5 overflow-hidden rounded bg-[#E7E4DC]">
                          <span className="block h-full bg-[#C2560A] transition-all" style={{ width: `${a.avance}%` }} />
                        </span>
                      )}
                    </span>
                    {a.geo && !a.error && (
                      <span className="hidden shrink-0 rounded-lg bg-[#F3F1EA] px-2 py-1 text-xs font-semibold text-[#142033] sm:block">📐 <T>{a.geo}</T></span>
                    )}
                    {!a.error && (
                      <select
                        aria-label={`Quién ve ${a.nombre}`}
                        value={a.soloElegido ? "elegido" : "todos"}
                        onChange={(e) => setArchivos((xs) => xs.map((x) => (x.id === a.id ? { ...x, soloElegido: e.target.value === "elegido" } : x)))}
                        className="max-w-[46%] shrink-0 rounded-lg border border-[#E7E4DC] bg-white px-2 py-1 text-xs text-[#142033]"
                      >
                        <option value="todos">Lo ven los talleres que cotizan</option>
                        <option value="elegido">Sólo el taller que elija</option>
                      </select>
                    )}
                    {a.cad && !a.error && (
                      <button
                        type="button"
                        onClick={() => setArchivos((xs) => xs.map((x) => (x.id === a.id ? { ...x, verCad: !x.verCad } : x)))}
                        className="text-xs font-semibold text-[#C2560A] hover:underline"
                      >
                        <T>{a.verCad ? "Ocultar" : "Ver pieza"}</T>
                      </button>
                    )}
                    <button type="button" onClick={() => quitar(a.id)} className="text-xs font-semibold text-[#6B675C] hover:text-[#B3261E]">
                      <T>Quitar</T>
                    </button>
                    </div>
                    {a.cad && a.verCad && !a.error && (
                      <div className="px-3 pb-3">
                        <VisorCad geo={a.cad} alto={240} />
                        <p className="mt-1 text-xs text-[#6B675C]"><T>Revisa que sea la pieza correcta: así la verá el taller al cotizar.</T></p>
                        <div className="mt-2">
                          <RevisionArchivo geo={a.cad} proceso={procesoDe(procesoElegido())} />
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-[#6B675C]">
              <T>Tus archivos se guardan en un almacenamiento privado: los descargan sólo los talleres que pueden cotizar tu trabajo,
              según los permisos que elijas, y en tu solicitud ves quién los descargó. Se borran</T> {DIAS_CONSERVACION_ARCHIVOS} <T>días
              después de que se cierra.</T>
            </p>
          </div>
        )}
      </fieldset>

      {/* 3. Detalles */}
      <fieldset className="grid gap-3">
        <legend className={PASO}>
          <span className={NUM}>3</span> <T>Detalles de la pieza</T>
        </legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={ETIQUETA} htmlFor="descripcion"><T>Comentarios: describe tu pieza o proyecto *</T></label>
            <textarea
              id="descripcion"
              name="descripcion"
              required
              minLength={10}
              maxLength={3000}
              rows={4}
              placeholder="Ej. 50 letreros de MDF de 30 x 20 cm con el logo grabado, para la entrada de una tienda"
              defaultValue={
                prellenado?.descripcion
                  ? prellenado.descripcion
                  : prellenado
                  ? `Pieza diseñada con las herramientas de HETNA: ${prellenado.pieza}${prellenado.medidas ? `, ${prellenado.medidas}` : ""}${prellenado.material ? `, en ${prellenado.material}` : ""}. El archivo de corte va adjunto; sólo necesito que la corten.`
                  : descripcionInicial
                  ? `Busco: ${descripcionInicial.slice(0, 200)}. `
                  : undefined
              }
              className="w-full rounded-xl border border-[#E7E4DC] bg-white p-3 text-sm text-[#142033] outline-none focus:border-[#C2560A]"
            />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="material"><T>Material</T></label>
            <input id="material" name="material" className={CAMPO} placeholder="MDF 6 mm, acrílico, acero, aluminio…" defaultValue={prellenado?.material} />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="cantidad"><T>Cantidad</T></label>
            <input ref={cantidadRef} id="cantidad" name="cantidad" className={CAMPO} placeholder="Ej. 1 pieza, 50 piezas" defaultValue={prellenado ? prellenado.cantidad || "1 pieza" : undefined} onChange={(e) => avisarPieza(e.target.value)} />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="medidas"><T>Medidas aproximadas</T></label>
            <input ref={medidasRef} id="medidas" name="medidas" className={CAMPO} placeholder="Ej. 30 x 20 cm, espesor 6 mm" defaultValue={prellenado?.medidas} />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="acabado"><T>Acabado</T></label>
            <select id="acabado" name="acabado" className={CAMPO} defaultValue="">
              <option value="">Selecciona</option>
              {ACABADOS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="tolerancia"><T>Tolerancia</T></label>
            <select id="tolerancia" name="tolerancia" className={CAMPO} defaultValue="">
              <option value="">Selecciona</option>
              {TOLERANCIAS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="fecha"><T>¿Para cuándo lo necesitas?</T></label>
            <input id="fecha" name="fecha" type="date" className={CAMPO} />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="servicio"><T>Proceso (si lo sabes)</T></label>
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
            <label className={ETIQUETA} htmlFor="frecuencia"><T>¿Cada cuánto lo necesitas?</T></label>
            <select id="frecuencia" name="frecuencia" className={CAMPO} defaultValue="">
              <option value="">Selecciona</option>
              <option>Una sola vez</option>
              <option>Cada mes</option>
              <option>Producción recurrente</option>
            </select>
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="presupuesto"><T>Presupuesto aproximado (opcional)</T></label>
            <input id="presupuesto" name="presupuesto" className={CAMPO} placeholder="Ej. $3,000 MXN" />
          </div>
          <div className="sm:col-span-2">
            <label className={ETIQUETA} htmlFor="archivo_url"><T>¿Tus archivos están en la nube? Pega la liga (opcional)</T></label>
            <input
              id="archivo_url"
              name="archivo_url"
              type="url"
              className={CAMPO}
              placeholder="Google Drive, Dropbox o WeTransfer"
            />
          </div>
          {/* «Que HETNA elija por mí» (lib/hetna-elige en el backend). Sólo si la solicitud es abierta a varios talleres */}
          {(!taller || abiertaOtros) && (
            <div className="sm:col-span-2 rounded-xl border border-[#E7E4DC] bg-[#FAF9F6] p-3">
              <label className="flex items-start gap-2 text-sm text-[#40403A]">
                <input type="checkbox" name="hetna_elige" value="1" className="mt-1 accent-[#C2560A]" onChange={(e) => setEligeHetna(e.target.checked)} />
                <span>
                  <b className="text-[#142033]"><T>Que HETNA elija por mí.</T></b> <T>Cuando lleguen propuestas, te mandamos la que mejor equilibra precio, tiempo y
                  cumplimiento del taller. Tú sólo confirmas y pagas.</T>
                </span>
              </label>
              {eligeHetna && (
                <div className="mt-2 pl-6">
                  <label className={ETIQUETA} htmlFor="tope_precio"><T>Lo más que quieres pagar (opcional, los talleres no lo ven)</T></label>
                  <input id="tope_precio" name="tope_precio" inputMode="numeric" className={CAMPO} placeholder="Ej. 3000" />
                </div>
              )}
            </div>
          )}
          {/* Empresas (estrategia 2.4): orden de compra y factura con los datos de Mi empresa */}
          <div>
            <label className={ETIQUETA} htmlFor="orden_compra"><T>Orden de compra (opcional)</T></label>
            <input id="orden_compra" name="orden_compra" className={CAMPO} maxLength={60} placeholder="Ej. OC-2026-0154" />
          </div>
          {conSesion && (
            <div className="flex items-end">
              <label className="flex items-start gap-2 text-sm text-[#40403A]">
                <input type="checkbox" name="con_factura" value="1" className="mt-1 accent-[#C2560A]" />
                <span>
                  <T>Necesito factura (CFDI) con los datos de</T><T>{" "}</T>
                  <a href="/mx/user/empresa" target="_blank" className="font-semibold text-[#C2560A] underline"><T>Mi empresa</T></a>
                </span>
              </label>
            </div>
          )}
        </div>
      </fieldset>

      {/* 4. Entrega y contacto */}
      <fieldset className="grid gap-3">
        <legend className={PASO}>
          <span className={NUM}>4</span> <T>Entrega y contacto</T>
        </legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={ETIQUETA} htmlFor="cp"><T>Código postal de entrega</T></label>
            <input id="cp" name="cp" className={CAMPO} inputMode="numeric" placeholder="5 dígitos" value={cp} onChange={(e) => cambiarCp(e.target.value)} autoComplete="postal-code" />
            <span className="mt-1 block text-xs text-[#6B675C]"><T>{avisoCp || "Con él te mostramos los talleres más cercanos."}</T></span>
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="ciudad"><T>Ciudad de entrega</T></label>
            <input id="ciudad" name="ciudad" className={CAMPO} autoComplete="address-level2" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="estado_mx"><T>Estado</T></label>
            <select id="estado_mx" name="estado_mx" className={CAMPO} value={estadoMx} onChange={(e) => setEstadoMx(e.target.value)}>
              <option value="">Selecciona</option>
              {ESTADOS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="acepta_envio"><T>¿Aceptas envío por paquetería?</T></label>
            <select id="acepta_envio" name="acepta_envio" className={CAMPO} defaultValue="Sí">
              <option>Sí</option>
              <option value="No">No, prefiero recoger o que me lo entreguen</option>
            </select>
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="nombre"><T>Tu nombre</T></label>
            <input id="nombre" name="nombre" className={CAMPO} autoComplete="name" />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="empresa"><T>Empresa (opcional)</T></label>
            <input id="empresa" name="empresa" className={CAMPO} autoComplete="organization" />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="email"><T>Correo *</T></label>
            <input id="email" name="email" type="email" required className={CAMPO} autoComplete="email" />
            <span className="mt-1 block text-xs text-[#6B675C]"><T>Ahí te llega la liga para ver y comparar propuestas.</T></span>
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="whatsapp"><T>WhatsApp</T></label>
            <input id="whatsapp" name="whatsapp" type="tel" className={CAMPO} autoComplete="tel" placeholder="10 dígitos" />
            <span className="mt-1 block text-xs text-[#6B675C]"><T>Para avisarte más rápido si falta algún dato.</T></span>
          </div>
          {taller && (
            <label className="flex items-start gap-2 text-sm text-[#40403A] sm:col-span-2">
              <input type="checkbox" name="abierta" value="1" checked={abiertaOtros} onChange={(e) => setAbiertaOtros(e.target.checked)} className="mt-1 accent-[#C2560A]" />
              <T>También quiero recibir propuestas de otros talleres de la red para comparar.</T>
            </label>
          )}
          {!conSesion && (
            <label className="flex items-start gap-2 rounded-xl border border-[#F2C98F] bg-[#FFF8EE] p-3 text-sm text-[#40403A] sm:col-span-2">
              <input
                type="checkbox"
                checked={crearCuenta}
                onChange={(e) => setCrearCuenta(e.target.checked)}
                className="mt-1 accent-[#C2560A]"
              />
              <span>
                <b className="text-[#142033]"><T>Crear mi cuenta gratis con estos datos</T></b> <T>y recibir mi número de afiliado HETNA,
                más</T> <b><T>$100 de descuento</T></b> <T>en mi primera compra. Sólo tendré que elegir mi contraseña.</T>
              </span>
            </label>
          )}
          <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        </div>
      </fieldset>

      {/* 5. Privacidad (Licitaciones 3.0) */}
      <fieldset className="grid gap-3">
        <legend className={PASO}>
          <span className={NUM}>5</span> <T>Privacidad: tú decides qué se ve</T>
        </legend>
        <div className="mt-3">
          <PrivacidadSolicitud dirigida={!!taller && !abiertaOtros} estado={estadoMx} />
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={estado === "enviando" || subiendo}
          className="rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          <T>{estado === "enviando"
            ? "Enviando…"
            : subiendo
              ? "Subiendo archivos…"
              : taller
                ? "Solicitar cotización"
                : "Enviar y recibir propuestas"}</T>
        </button>
        <span className="text-xs text-[#6B675C]">
          <T>Es gratis y sin compromiso. Tu correo y WhatsApp sólo los ve HETNA: los talleres reciben lo que tú permitas en el paso 5, nunca tus datos sin tu autorización.</T>
        </span>
      </div>
      {estado === "error" && <p className="text-sm text-[#B3261E]"><T>{mensaje}</T></p>}
    </form>
  )
}
