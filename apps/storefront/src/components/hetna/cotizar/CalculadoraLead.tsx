"use client"

import dynamic from "next/dynamic"
import { useRef, useState } from "react"
import { useParams } from "next/navigation"

import type { GeoCad } from "@/lib/cotizador/archivo-cad"

import { cotizarLead, type CotizarLeadInput } from "@/lib/cotizar/acciones"
import { mandarAFabricar } from "@/lib/generador/aCotizador"

type Props = {
  servicio: CotizarLeadInput["servicio"]
  tituloServicio: string
  materiales: string[]
  // Impresión 3D se cobra por volumen: pide también la altura.
  pideAlto?: boolean
  // Una pregunta más que cambia el precio: el calibre en plasma, la calidad
  // en impresión 3D. `campo` es el nombre que espera el API.
  opcion?: { campo: "calibre" | "calidad"; etiqueta: string; valores: string[]; inicial?: string }
  // Servicio con el que se abre el formulario de propuestas de talleres
  // (/cotizar?servicio=...), para quien quiere precio formal y no estimado.
  servicioSolicitud?: string
}

// El visor (y three.js) se cargan sólo cuando alguien sube su archivo
const VisorCad = dynamic(() => import("@/components/hetna/visor/VisorCad").then((m) => m.VisorCad), { ssr: false })
const cm = (mm: number, min = 1) => String(Math.max(min, Math.round(mm) / 10))

type Estado =
  | { paso: "form" }
  | { paso: "cargando" }
  | { paso: "resultado"; min: number; max: number; volumenAlto: boolean; whatsappUrl: string }
  | { paso: "error"; mensaje: string }

const formatoMXN = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })

export const CalculadoraLead = ({ servicio, tituloServicio, materiales, pideAlto, opcion, servicioSolicitud }: Props) => {
  const [estado, setEstado] = useState<Estado>({ paso: "form" })
  const [medidas, setMedidas] = useState({ ancho: "", largo: "", alto: "" })
  const [pieza, setPieza] = useState<{ nombre: string; geo: GeoCad } | null>(null)
  const [avisoArchivo, setAvisoArchivo] = useState("")
  const { locale } = useParams<{ locale: string }>()
  // Lo que el cliente ya capturó y su archivo: pasan tal cual a la solicitud
  // formal, para que no lo vuelva a escribir ni a subir.
  const archivoRef = useRef<File | null>(null)
  const capturado = useRef<{ material: string; medidas: string; cantidad: number } | null>(null)

  // Lee el archivo en el navegador (no se sube): lo muestra y toma sus medidas
  const elegirArchivo = async (f: File | undefined) => {
    setAvisoArchivo("")
    if (!f) return
    if (f.size > 40 * 1024 * 1024) return setAvisoArchivo("El archivo pasa de 40 MB. Captura las medidas a mano.")
    try {
      const { leerArchivoCad } = await import("@/lib/cotizador/archivo-cad")
      const geo = await leerArchivoCad(f)
      if (!geo || !(geo.largo > 0) || !(geo.ancho > 0)) {
        setPieza(null)
        return setAvisoArchivo("No pude leer ese archivo. Sirven DXF, SVG, STL y OBJ; o captura las medidas a mano.")
      }
      setPieza({ nombre: f.name, geo })
      archivoRef.current = f
      setMedidas({ ancho: cm(geo.ancho), largo: cm(geo.largo), alto: geo.tipo === "3d" ? cm(geo.alto, 0.1) : "" })
      if (pideAlto && geo.tipo !== "3d") setAvisoArchivo("Es un plano 2D: captura la altura de la pieza.")
    } catch {
      setPieza(null)
      setAvisoArchivo("No pude leer ese archivo. Captura las medidas a mano.")
    }
  }

  const enviar = async (formData: FormData) => {
    setEstado({ paso: "cargando" })
    const ancho = Number(formData.get("ancho"))
    const largo = Number(formData.get("largo"))
    const cantidad = Number(formData.get("cantidad"))
    const piezasMes = formData.get("piezas_mes") ? Number(formData.get("piezas_mes")) : undefined
    const alto = pideAlto ? Number(formData.get("alto")) : 0
    capturado.current = {
      material: String(formData.get("material") || ""),
      medidas: `${ancho} × ${largo}${alto ? ` × ${alto}` : ""} cm`,
      cantidad,
    }

    const r = await cotizarLead({
      servicio,
      material: String(formData.get("material") || ""),
      ancho,
      largo,
      ...(pideAlto ? { alto: Number(formData.get("alto")) } : {}),
      ...(opcion ? { [opcion.campo]: String(formData.get(opcion.campo) || "") } : {}),
      cantidad,
      piezas_mes_estimado: piezasMes,
      email: String(formData.get("email") || ""),
      nombre: String(formData.get("nombre") || "") || undefined,
      ciudad: typeof window !== "undefined" ? window.location.pathname.split("/").pop() : undefined,
    })

    if (!r.ok) {
      setEstado({ paso: "error", mensaje: r.mensaje })
      return
    }
    setEstado({
      paso: "resultado",
      min: r.estimado.minimo,
      max: r.estimado.maximo,
      volumenAlto: r.volumenAlto,
      whatsappUrl: r.whatsappUrl,
    })
  }

  // Precio formal: abre la solicitud con material, medidas, cantidad y (si lo
  // subió) el archivo ya puestos. Sin archivo, o si es muy grande para pasarlo
  // así, se abre la solicitud con los datos y el cliente lo sube ahí.
  const pedirFormal = async () => {
    const c = capturado.current
    const pieza = c ? `${c.cantidad} ${c.cantidad === 1 ? "pieza" : "piezas"} en ${tituloServicio}` : tituloServicio
    const f = archivoRef.current
    if (f) {
      const datos = await f.arrayBuffer().catch(() => null)
      if (datos && mandarAFabricar(f.name, datos, locale, { pieza, medidas: c?.medidas, material: c?.material, proceso: servicioSolicitud })) return
    }
    const q = new URLSearchParams({ desde: "cotizador", pieza })
    if (servicioSolicitud) q.set("servicio", servicioSolicitud)
    if (c?.medidas) q.set("medidas", c.medidas)
    if (c?.material) q.set("material", c.material)
    window.location.href = `/${locale}/cotizar?${q.toString()}`
  }

  if (estado.paso === "resultado") {
    return (
      <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-6 flex flex-col gap-4">
        <p className="m-0 text-[13px] font-semibold uppercase tracking-wide text-[#6B6A63]">Tu estimado</p>
        <p className="m-0 text-[32px] font-bold text-[#1B1B18]">
          {formatoMXN(estado.min)} – {formatoMXN(estado.max)}
        </p>
        <p className="m-0 text-[13px] text-[#6B6A63]">
          Precio aproximado con IVA incluido. Te mandamos este estimado a tu correo también.
        </p>
        {estado.volumenAlto && (
          <div className="bg-[#FDEEE1] border border-[#F2A65A] rounded-[10px] p-4 flex flex-col gap-1.5">
            <p className="m-0 text-[14px] font-bold text-[#B34D07]">¿Pedido recurrente de alto volumen?</p>
            <p className="m-0 text-[13.5px] text-[#1B1B18]">
              Con ese volumen, puede convenirte más tener tu propia máquina en vez de maquilar cada mes.
              Pregúntanos por nuestras máquinas CNC disponibles.
            </p>
          </div>
        )}
        {/* El estimado es para decidir; el precio formal lo dan los talleres. */}
        <button
          type="button"
          onClick={pedirFormal}
          className="inline-flex items-center justify-center bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 py-3 rounded-[10px] text-[15px]"
        >
          Pedir precio formal a talleres
        </button>
        <a
          href={estado.whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center border border-[#E7E4DC] text-[#1B1B18] font-semibold px-5 py-3 rounded-[10px] text-[15px] hover:border-[#C2560A]"
        >
          Preguntar por WhatsApp
        </a>
      </div>
    )
  }

  return (
    <form
      action={enviar}
      className="bg-white border border-[#E7E4DC] rounded-[14px] p-6 flex flex-col gap-4"
    >
      <p className="m-0 text-[15px] font-bold text-[#1B1B18]">Calcula tu precio de {tituloServicio}</p>

      <div className="flex flex-col gap-2 rounded-[10px] border border-dashed border-[#C9C4B8] bg-[#FAF9F6] p-3">
        <label className="flex cursor-pointer flex-col gap-1 text-[13.5px] font-medium text-[#1B1B18]">
          ¿Tienes el archivo de tu pieza? Súbelo para verla y tomar sus medidas (opcional)
          <input
            type="file"
            accept=".dxf,.svg,.stl,.obj"
            onChange={(e) => elegirArchivo(e.target.files?.[0])}
            className="text-[13px] font-normal text-[#4A4943] file:mr-3 file:rounded-[8px] file:border-0 file:bg-[#142033] file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-white"
          />
        </label>
        <span className="text-[12px] text-[#6B6A63]">DXF, SVG, STL u OBJ. Se lee en tu navegador: no se sube ni se guarda.</span>
        {pieza && (
          <>
            <VisorCad geo={pieza.geo} alto={260} />
            <span className="text-[12px] text-[#6B6A63]">
              {pieza.nombre}: llené las medidas con las de tu pieza. Revísalas y cámbialas si hace falta.
            </span>
          </>
        )}
        {pieza?.geo.avisos.slice(0, 2).map((a) => (
          <span key={a} className="text-[12px] text-[#B34D07]">{a}</span>
        ))}
        {avisoArchivo && <span className="text-[12.5px] text-[#B34D07]">{avisoArchivo}</span>}
      </div>

      <label className="flex flex-col gap-1.5 text-[13.5px] font-medium text-[#1B1B18]">
        Material
        <select name="material" required className="border border-[#E7E4DC] rounded-[8px] px-3 py-2.5 text-[14px]">
          {materiales.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-[13.5px] font-medium text-[#1B1B18]">
          Ancho (cm)
          <input name="ancho" type="number" min={1} step="0.1" required value={medidas.ancho} onChange={(e) => setMedidas({ ...medidas, ancho: e.target.value })} className="border border-[#E7E4DC] rounded-[8px] px-3 py-2.5 text-[14px]" />
        </label>
        <label className="flex flex-col gap-1.5 text-[13.5px] font-medium text-[#1B1B18]">
          Largo (cm)
          <input name="largo" type="number" min={1} step="0.1" required value={medidas.largo} onChange={(e) => setMedidas({ ...medidas, largo: e.target.value })} className="border border-[#E7E4DC] rounded-[8px] px-3 py-2.5 text-[14px]" />
        </label>
      </div>

      {pideAlto && (
        <label className="flex flex-col gap-1.5 text-[13.5px] font-medium text-[#1B1B18]">
          Alto (cm)
          <input name="alto" type="number" min={0.1} step="0.1" required value={medidas.alto} onChange={(e) => setMedidas({ ...medidas, alto: e.target.value })} className="border border-[#E7E4DC] rounded-[8px] px-3 py-2.5 text-[14px]" />
        </label>
      )}

      {opcion && (
        <label className="flex flex-col gap-1.5 text-[13.5px] font-medium text-[#1B1B18]">
          {opcion.etiqueta}
          <select name={opcion.campo} defaultValue={opcion.inicial} className="border border-[#E7E4DC] rounded-[8px] px-3 py-2.5 text-[14px]">
            {opcion.valores.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1.5 text-[13.5px] font-medium text-[#1B1B18]">
        Cantidad de piezas
        <input name="cantidad" type="number" min={1} step="1" defaultValue={1} required className="border border-[#E7E4DC] rounded-[8px] px-3 py-2.5 text-[14px]" />
      </label>

      <label className="flex flex-col gap-1.5 text-[13.5px] font-medium text-[#1B1B18]">
        ¿Lo necesitas seguido? Piezas al mes aprox. (opcional)
        <input name="piezas_mes" type="number" min={0} step="1" className="border border-[#E7E4DC] rounded-[8px] px-3 py-2.5 text-[14px]" />
      </label>

      <label className="flex flex-col gap-1.5 text-[13.5px] font-medium text-[#1B1B18]">
        Tu correo
        <input name="email" type="email" required className="border border-[#E7E4DC] rounded-[8px] px-3 py-2.5 text-[14px]" />
      </label>

      <label className="flex flex-col gap-1.5 text-[13.5px] font-medium text-[#1B1B18]">
        Nombre (opcional)
        <input name="nombre" type="text" className="border border-[#E7E4DC] rounded-[8px] px-3 py-2.5 text-[14px]" />
      </label>

      {estado.paso === "error" && (
        <p className="m-0 text-[13.5px] text-[#B34D07]">{estado.mensaje}</p>
      )}

      <button
        type="submit"
        disabled={estado.paso === "cargando"}
        className="inline-flex items-center justify-center bg-[#142033] hover:bg-[#1E2E4A] disabled:opacity-60 text-white font-semibold px-5 py-3 rounded-[10px] text-[15px]"
      >
        {estado.paso === "cargando" ? "Calculando…" : "Ver mi precio"}
      </button>
    </form>
  )
}
