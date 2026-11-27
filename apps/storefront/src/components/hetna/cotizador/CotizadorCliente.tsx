"use client"

// Cotizador del cliente (panel → /user/cotizar). Sube su archivo, ve la pieza,
// elige proceso, material, cantidad y acabado, y recibe un RANGO estimado al
// instante (lib/cotizador/estimador.ts, los mismos cálculos del Simulador 2.0
// de la app, con valores de referencia de HETNA). Con "Pedir propuestas" el
// archivo ya subido y los datos pasan a la licitación (FormSolicitudTaller) y
// los talleres mandan su precio real.
import { T as Tr } from "@/components/hetna/i18n/Idioma"
import { T } from "@/components/hetna/i18n/Idioma"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"

import { trackEstimadoVisto } from "@/lib/analytics/events"

import { type GeoCad, leerArchivoCad } from "@/lib/cotizador/archivo-cad"
import {
  ACABADOS,
  MATERIALES,
  type MaterialRef,
  SERVICIOS,
  type TipoMaquina,
  estimar,
  materialesPara,
  pesos,
  piezaAMano,
  piezaDeGeo,
} from "@/lib/cotizador/estimador"
import { useConfigPrecios } from "@/lib/cotizador/config-precios"
import { EXTENSIONES_ARCHIVO, MAX_MB_ARCHIVO } from "@/lib/fabricacion/opciones"
import type { ArchivoSubido } from "@/lib/cotizar/solicitud-taller"
import { subirArchivo } from "@/lib/subir-archivo"
import FormSolicitudTaller from "@/components/hetna/taller/FormSolicitudTaller"
import { MandarEstimado } from "@/components/hetna/cotizador/MandarEstimado"

// El cliente piensa en medidas: ancho × alto (y profundidad si es 3D), no en "largo"
const ETIQ_MEDIDA = { largo: "Ancho", ancho: "Alto", alto: "Profundidad" } as const

const VisorCad = dynamic(() => import("@/components/hetna/visor/VisorCad").then((m) => m.VisorCad), { ssr: false })

const CAMPO = "h-11 w-full rounded-xl border border-[#E7E4DC] bg-white px-3 text-sm text-[#142033] outline-none focus:border-[#C2560A]"
const ETIQUETA = "mb-1 block text-[13px] font-semibold text-[#142033]"
const PASO = "flex items-center gap-2 text-[15px] font-extrabold text-[#142033]"
const NUM = "grid h-6 w-6 place-items-center rounded-full bg-[#142033] text-[12px] font-bold text-white"

const mm = (v: number) => (v >= 100 ? Math.round(v) : v.toFixed(1))

export function CotizadorCliente({ email, nombre }: { email?: string; nombre?: string }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [geo, setGeo] = useState<GeoCad | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [aMano, setAMano] = useState(false)
  const [dims, setDims] = useState({ largo: "", ancho: "", alto: "" })
  const [complejidad, setComplejidad] = useState<"sencillo" | "normal" | "calado">("normal")
  const [servicio, setServicio] = useState<TipoMaquina>("router")
  const [materialIdx, setMaterialIdx] = useState<number>(() => MATERIALES.findIndex((m) => m.nombre === "MDF 6 mm"))
  const [cantidad, setCantidad] = useState(1)
  const [acabado, setAcabado] = useState("")
  const [relleno, setRelleno] = useState(20)
  const [subiendo, setSubiendo] = useState<number | null>(null)
  const [subido, setSubido] = useState<ArchivoSubido | null>(null)
  const [pedir, setPedir] = useState(false)
  const [error, setError] = useState("")

  const materiales = useMemo(() => materialesPara(servicio), [servicio])
  const material: MaterialRef = MATERIALES[materialIdx] && materiales.includes(MATERIALES[materialIdx]) ? MATERIALES[materialIdx] : materiales[0]

  const pieza = useMemo(() => {
    if (geo && !aMano) return piezaDeGeo(geo, archivo?.name || "pieza")
    const l = Number(dims.largo), a = Number(dims.ancho), h = Number(dims.alto)
    if (!(l > 0 && a > 0)) return null
    return piezaAMano(l, a, h, complejidad, servicio === "impresora_3d" || servicio === "router_3d")
  }, [geo, aMano, dims, complejidad, servicio, archivo])

  const cfg = useConfigPrecios()
  const est = useMemo(() => (pieza && material ? estimar({ servicio, pieza, material, cantidad, acabado, relleno, cfg }) : null), [pieza, material, servicio, cantidad, acabado, relleno, cfg])

  // Medición: una vez por visita, la primera vez que aparece un estimado
  const medido = useRef(false)
  useEffect(() => {
    if (medido.current || !est?.ok) return
    medido.current = true
    trackEstimadoVisto(servicio, Boolean(geo && !aMano))
  }, [est, servicio, geo, aMano])

  const elegirArchivo = async (f: File | undefined) => {
    if (!f) return
    setError("")
    if (f.size > MAX_MB_ARCHIVO * 1024 * 1024) {
      setError(`El archivo pesa más de ${MAX_MB_ARCHIVO} MB. Comprímelo en ZIP o mándalo por la solicitud normal.`)
      return
    }
    setArchivo(f)
    setSubido(null)
    setPedir(false)
    setAMano(false)
    setLeyendo(true)
    try {
      const g = await leerArchivoCad(f)
      setGeo(g)
      if (!g) setError("No pude leer la geometría de ese archivo. Puedes dar las medidas a mano y de todos modos adjuntarlo a la solicitud.")
      else if (g.tipo === "3d") setServicio((s) => (s === "impresora_3d" || s === "router_3d" ? s : "impresora_3d"))
    } catch {
      setGeo(null)
      setError("No pude leer ese archivo. Da las medidas a mano.")
    } finally {
      setLeyendo(false)
    }
  }

  // Sube el archivo al bucket (una vez) y abre la licitación ya llena
  const pedirPropuestas = async () => {
    setError("")
    if (archivo && !subido) {
      setSubiendo(0)
      try {
        const s = await subirArchivo(archivo, setSubiendo)
        setSubido(s)
      } catch (e) {
        setError((e as Error).message || "No se pudo subir el archivo.")
        setSubiendo(null)
        return
      }
      setSubiendo(null)
    }
    setPedir(true)
    setTimeout(() => document.getElementById("licitacion")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
  }

  const srv = SERVICIOS.find((s) => s.clave === servicio)!
  const geoTexto = geo
    ? geo.tipo === "3d"
      ? `${mm(geo.largo)} × ${mm(geo.ancho)} × ${mm(geo.alto)} mm, ${geo.volumen_cm3.toFixed(1)} cm³`
      : `${mm(geo.largo)} × ${mm(geo.ancho)} mm, ${(geo.corte_mm / 1000).toFixed(2)} m de corte, ${geo.contornos} contornos`
    : pieza
      ? `${mm(pieza.largo)} × ${mm(pieza.ancho)}${pieza.alto ? ` × ${mm(pieza.alto)}` : ""} mm`
      : ""

  const descripcionSolicitud = est?.ok
    ? `${cantidad} ${cantidad === 1 ? "pieza" : "piezas"} de ${material.nombre} en ${srv.nombre}${acabado ? `, acabado: ${ACABADOS.find((a) => a.clave === acabado)?.nombre.toLowerCase()}` : ""}. ${geoTexto ? `Medidas: ${geoTexto}. ` : ""}Estimado HETNA de referencia: ${pesos(est.min)} – ${pesos(est.max)} MXN en total (${pesos(est.precioPieza)} por pieza). ${archivo ? "El archivo va adjunto." : "No tengo archivo; las medidas van arriba."}`
    : ""

  return (
    <div className="grid gap-5">
      <div className="grid gap-6 rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-7">
        {/* 1. Pieza */}
        <fieldset className="grid gap-3">
          <legend className={PASO}><span className={NUM}>1</span> <T>Tu pieza</T></legend>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={entrada} type="file" accept={EXTENSIONES_ARCHIVO.map((e) => `.${e}`).join(",")} className="hidden" onChange={(e) => elegirArchivo(e.target.files?.[0])} />
            <button type="button" onClick={() => entrada.current?.click()} className="rounded-xl border-2 border-[#C2560A] px-4 py-2.5 text-sm font-bold text-[#C2560A] hover:bg-[#FDEEE1]">
              <Tr>{archivo ? `📄 ${archivo.name}` : "Subir DXF, SVG, STL, OBJ o STEP"}</Tr>
            </button>
            <button type="button" onClick={() => { setAMano((v) => !v); if (!aMano) setGeo(null) }} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${aMano ? "border-[#C2560A] bg-[#FDEEE1] text-[#C2560A]" : "border-[#E7E4DC] text-[#40403A]"}`}>
              <T>Dar medidas a mano</T>
            </button>
            {leyendo && <span className="text-sm text-[#6B675C]"><T>Leyendo el archivo…</T></span>}
          </div>
          <p className="text-xs text-[#6B675C]"><T>Hasta</T> {MAX_MB_ARCHIVO} <T>MB. El archivo se lee aquí en tu navegador; sólo se sube cuando pides propuestas.</T></p>
          {geo && !aMano && (
            <div className="grid gap-2">
              <VisorCad geo={geo} alto={260} oscuro />
              <p className="text-sm text-[#40403A]"><Tr>{geoTexto}</Tr></p>
              {geo.avisos.map((a) => (
                <p key={a} className="text-xs text-[#B45309]">⚠ <Tr>{a}</Tr></p>
              ))}
            </div>
          )}
          {aMano && (
            <div className="grid gap-3">
              <div className="grid grid-cols-3 gap-2">
                {(["largo", "ancho", "alto"] as const).map((k) => (
                  <div key={k}>
                    <label className={ETIQUETA}><Tr>{ETIQ_MEDIDA[k]}</Tr> <T>(mm)</T></label>
                    <input className={CAMPO} inputMode="decimal" value={dims[k]} onChange={(e) => setDims({ ...dims, [k]: e.target.value.replace(",", ".") })} placeholder={k === "alto" ? "sólo 3D" : "300"} />
                  </div>
                ))}
              </div>
              <div>
                <label className={ETIQUETA}><T>¿Qué tanto corte lleva?</T></label>
                <div className="flex flex-wrap gap-2">
                  {([["sencillo", "Sencillo (sólo el contorno)"], ["normal", "Normal"], ["calado", "Calado o celosía"]] as const).map(([v, t]) => (
                    <button key={v} type="button" onClick={() => setComplejidad(v)} className={`rounded-full border px-3 py-1.5 text-sm ${complejidad === v ? "border-[#C2560A] bg-[#FDEEE1] font-bold text-[#C2560A]" : "border-[#E7E4DC] text-[#40403A]"}`}><Tr>{t}</Tr></button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </fieldset>

        {/* 2. Proceso */}
        <fieldset className="grid gap-3">
          <legend className={PASO}><span className={NUM}>2</span> <T>Proceso</T></legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SERVICIOS.map((s) => (
              <button key={s.clave} type="button" onClick={() => setServicio(s.clave)} className={`rounded-xl border px-3 py-2.5 text-left transition ${servicio === s.clave ? "border-[#C2560A] bg-[#FDEEE1] ring-1 ring-[#C2560A]" : "border-[#E7E4DC] bg-white hover:border-[#C2560A]"}`}>
                <span className="block text-sm font-bold text-[#142033]"><Tr>{s.emoji}</Tr> <Tr>{s.nombre}</Tr></span>
                <span className="block text-[11px] leading-snug text-[#6B675C]"><T>{s.descripcion}</T></span>
              </button>
            ))}
          </div>
          {servicio === "impresora_3d" && (
            <label className="flex items-center gap-3 text-sm text-[#40403A]">
              <T>Relleno</T> <Tr>{relleno}</Tr> %
              <input type="range" min={5} max={100} step={5} value={relleno} onChange={(e) => setRelleno(Number(e.target.value))} className="flex-1 accent-[#C2560A]" />
            </label>
          )}
        </fieldset>

        {/* 3–5. Material, cantidad, acabado */}
        <fieldset className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={ETIQUETA}><span className={`${NUM} mr-1 inline-grid`}>3</span> <T>Material</T></label>
            <select className={CAMPO} value={MATERIALES.indexOf(material)} onChange={(e) => setMaterialIdx(Number(e.target.value))}>
              {materiales.map((m) => (
                <option key={m.nombre} value={MATERIALES.indexOf(m)}>{m.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={ETIQUETA}><span className={`${NUM} mr-1 inline-grid`}>4</span> <T>Cantidad</T></label>
            <div className="flex gap-1">
              <input className={CAMPO} inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))} />
              {[1, 10, 50].map((n) => (
                <button key={n} type="button" onClick={() => setCantidad(n)} className="rounded-xl border border-[#E7E4DC] px-2 text-xs font-semibold text-[#40403A] hover:border-[#C2560A]">{n}</button>
              ))}
            </div>
          </div>
          <div>
            <label className={ETIQUETA}><span className={`${NUM} mr-1 inline-grid`}>5</span> <T>Acabado</T></label>
            <select className={CAMPO} value={acabado} onChange={(e) => setAcabado(e.target.value)}>
              {ACABADOS.map((a) => (
                <option key={a.clave} value={a.clave}>{a.nombre}</option>
              ))}
            </select>
          </div>
        </fieldset>

        {error && <p className="rounded-xl bg-[#FDECEA] px-4 py-3 text-sm text-[#B3261E]"><Tr>{error}</Tr></p>}

        {/* Resultado */}
        {!pieza ? (
          <p className="rounded-xl bg-[#F3F1EA] px-4 py-3 text-sm text-[#40403A]"><T>Sube tu archivo o escribe las medidas y aquí aparece el estimado al instante.</T></p>
        ) : !est || !est.ok ? (
          <p className="rounded-xl bg-[#FFF1E6] px-4 py-3 text-sm text-[#C2560A]"><Tr>{est && !est.ok ? est.motivo : "Completa los datos."}</Tr></p>
        ) : (
          <div className="rounded-2xl border-2 border-[#142033] bg-[#F8F7F2] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6B675C]"><T>Estimado HETNA · referencia, no es un precio final</T></p>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[30px] font-extrabold leading-none text-[#142033]">{pesos(est.min)} – {pesos(est.max)}</p>
                <p className="mt-1 text-sm text-[#40403A]">
                  <T>por</T> {cantidad} <Tr>{cantidad === 1 ? "pieza" : "piezas"}</Tr> · ≈ {pesos(est.precioPieza)} <T>cada una · sin IVA ni envío</T>
                </p>
              </div>
              <div className="text-right text-sm text-[#40403A]">
                <p>⏱ <Tr>{est.tiempoPiezaMin < 1 ? `${Math.round(est.tiempoPiezaMin * 60)} s` : `${est.tiempoPiezaMin.toFixed(1)} min`}</Tr> <T>de máquina por pieza</T></p>
                {est.hojas > 0 && <p>📐 <Tr>{est.piezasPorHoja}</Tr> <T>por hoja ·</T> <Tr>{est.hojas}</Tr> <Tr>{est.hojas === 1 ? "hoja" : "hojas"}</Tr> <T>de</T> <Tr>{material.nombre}</Tr></p>}
                {est.gramos > 0 && <p>⚖️ ≈ <Tr>{est.gramos >= 1000 ? `${(est.gramos / 1000).toFixed(2)} kg` : `${Math.round(est.gramos)} g`}</Tr> <T>de material</T></p>}
              </div>
            </div>
            <p className="mt-2 text-xs text-[#6B675C]"><T>Tiempo:</T> <Tr>{est.explicacion}</Tr><T>. Costos de referencia de talleres en México; cada taller cotiza con los suyos.</T></p>
            {est.avisos.map((a) => (
              <p key={a} className="mt-1 text-xs text-[#B45309]">⚠ <Tr>{a}</Tr></p>
            ))}
            {[10, 50, 100].filter((n) => n !== cantidad).length > 0 && (
              <p className="mt-3 text-xs text-[#40403A]">
                <T>Por volumen:</T><Tr>{" "}</Tr>
                {[1, 10, 50, 100].filter((n) => n !== cantidad).map((n) => {
                  const e = estimar({ servicio, pieza, material, cantidad: n, acabado, relleno, cfg })
                  return e.ok ? <button key={n} type="button" onClick={() => setCantidad(n)} className="mr-2 underline decoration-dotted hover:text-[#C2560A]">{n} <T>pzas ≈</T> {pesos(e.precioPieza)} c/u</button> : null
                })}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={pedirPropuestas} disabled={subiendo !== null || pedir} className="rounded-xl bg-[#C2560A] px-5 py-3 text-[15px] font-bold text-white hover:bg-[#A84A08] disabled:opacity-60">
                <Tr>{subiendo !== null ? `Subiendo archivo… ${subiendo}%` : pedir ? "Llena tus datos abajo ↓" : "Pedir propuestas a talleres"}</Tr>
              </button>
              <p className="text-xs text-[#6B675C]"><T>Gratis. Los talleres verificados de HETNA te mandan su precio y tiempo real; tú eliges y pagas protegido por HETNA.</T></p>
            </div>
            {!pedir && (
              <MandarEstimado
                key={`${servicio}|${material.nombre}|${cantidad}|${Math.round(est.min)}`}
                servicio={srv.nombre}
                material={material.nombre}
                largoMm={pieza.largo}
                anchoMm={pieza.ancho}
                cantidad={cantidad}
                min={est.min}
                max={est.max}
                emailInicial={email}
              />
            )}
          </div>
        )}
      </div>

      {pedir && est?.ok && (
        <div id="licitacion" className="grid gap-3">
          <h2 className="text-[20px] font-bold text-[#1B1B18]"><T>Pide propuestas a los talleres</T></h2>
          <p className="text-sm text-[#4A4943]"><T>Tu archivo y los datos ya van puestos; confirma dónde estás y para cuándo lo necesitas.</T></p>
          <FormSolicitudTaller
            servicioInicial={srv.solicitud}
            necesidadInicial="Cortar piezas"
            prellenado={{
              pieza: pieza!.nombre,
              medidas: geoTexto,
              material: material.nombre,
              proceso: srv.solicitud,
              archivos: subido ? [{ ...subido, geo: geoTexto }] : [],
              cantidad: `${cantidad} ${cantidad === 1 ? "pieza" : "piezas"}`,
              descripcion: descripcionSolicitud,
            }}
          />
          {(email || nombre) && <p className="text-xs text-[#6B675C]"><T>Sesión de</T> {nombre || email}<T>: la solicitud quedará en Mis solicitudes de fabricación.</T></p>}
        </div>
      )}
    </div>
  )
}
