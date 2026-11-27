"use client"

import { T as Tr } from "@/components/hetna/i18n/Idioma"
import { T } from "@/components/hetna/i18n/Idioma"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"

import {
  Datos,
  ETIQUETAS,
  FORMAS,
  Forma,
  GRUPOS,
  Gen,
  acomodarPlantillas,
  formaPorId,
  generarEmpaque,
  plantillaDXF,
  acomodarEnHojas,
  aprovechamiento,
  hojaAjustada,
  hojaDXF,
  hojaSVG,
  hojasVistaSVG,
  paginasMosaico,
  TAMANOS_HOJA,
  type Hoja,
  doblecesSinPerforar,
  type ModoDoblez,
  type OpcionesDoblez,
  plantillaSVG,
} from "@/lib/generador/empaques"
import { mandarACotizador, mandarAFabricar } from "@/lib/generador/aCotizador"

type Unidad = "mm" | "cm" | "in"
const FACTOR: Record<Unidad, number> = { mm: 1, cm: 10, in: 25.4 }
type Valores = Record<Exclude<keyof Datos, "conBase">, string>

// medidas de inicio de cada plantilla (mm), de FORMAS
const CAMPOS_NUM = ["largo", "ancho", "alto", "pestana", "lados", "diametroSup", "altoTapa", "holgura", "margen", "filas", "columnas", "diametro"] as const
const INICIO: Record<Forma, Valores> = Object.fromEntries(
  FORMAS.map((f) => [f.id, Object.fromEntries(CAMPOS_NUM.map((c) => [c, String(f.inicio[c] ?? 0)]))])
) as Record<Forma, Valores>

// iconos por generador
const ICONOS: Record<Gen, string> = {
  caja: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
  cajaVentana: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8M7 11h4v4",
  tapaFondo: "M3 10h18v9H3zM2 7h20v3H2z",
  bandeja: "M3 10h18l-2 9H5zM3 10l2-3h14l2 3",
  bisagra: "M3 10h18v9H3zM3 10l3-6h12l3 6",
  pillow: "M4 8c4 3 12 3 16 0v8c-4-3-12-3-16 0z",
  cajon: "M3 8h18v10H3zM6 11h12v4H6zM10 13h4",
  hexagonal: "M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z",
  prisma: "M12 3l8 6-3 9H7L4 9z",
  cilindro: "M5 6a7 2.5 0 0 0 14 0a7 2.5 0 0 0-14 0zM5 6v12a7 2.5 0 0 0 14 0V6",
  bolsa: "M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2",
  bolsaAsa: "M5 9h14l-1 12H6zM9 9V7a3 3 0 0 1 6 0v2M9 13h6",
  bolsaPlana: "M6 4h12v16H6zM6 9h12",
  sobre: "M3 6h18v12H3zM3 6l9 7 9-7",
  sobrePuntas: "M3 6h18v12H3zM3 6l9 6 9-6M3 18l9-6 9 6",
  sobreBolsillo: "M5 4h14v16H5zM5 10h14",
  piramide: "M12 3L3 19h18zM12 3l3 16",
  tetra: "M12 2L4 20h16zM12 2v18",
  cono: "M12 3L5 18a7 3 0 0 0 14 0zM5 18a7 3 0 0 1 14 0",
  maceta: "M6 5h12l-2 14H8zM6 5a6 2 0 0 0 12 0",
  tarjeta: "M4 5h16v14H4zM12 5v14",
  inserto: "M3 5h18v14H3zM8 12a2 2 0 1 0 0-.1M16 12a2 2 0 1 0 0-.1",
  envio: "M3 9h18v10H3zM3 9l3-4h12l3 4M9 13h6",
  leche: "M6 9h12v12H6zM6 9l6-5 6 5M12 4V2",
  exhibidor: "M4 14h16v6H4zM6 14V4h12v10M9 8h6",
  cartas: "M7 3h10v18H7zM10 3a2 2 0 0 0 4 0M9 8h6",
  rebanada: "M4 18l16-6v6zM4 18l16-12v6M20 6v6",
  explosiva: "M9 9h6v6H9zM9 9L5 5M15 9l4-4M9 15l-4 4M15 15l4 4",
  redonda: "M4 8a8 3 0 0 0 16 0a8 3 0 0 0-16 0zM4 8v9a8 3 0 0 0 16 0V8",
  corazon: "M12 20s-8-5-8-11a4 4 0 0 1 8-1a4 4 0 0 1 8 1c0 6-8 11-8 11z",
  estrella: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z",
  poligonal: "M8 4h8l4 8-4 8H8l-4-8z",
  ataud: "M9 3h6l3 6-2 12H8L6 9z",
  rombo: "M12 3l8 9-8 9-8-9z",
}

const numero = (s: string) => parseFloat((s || "").replace(",", "."))
const r1 = (x: number) => Math.round(x * 10) / 10

function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const Opcion = ({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-2 rounded-[8px] text-[13.5px] font-semibold border ${
      activa ? "bg-[#142033] text-white border-[#142033]" : "bg-white text-[#1B1B18] border-[#E7E4DC] hover:border-[#C2560A]"
    }`}
  >
    {children}
  </button>
)

// Puntos de partida para perforar dobleces según el material (corte / puente, mm)
const PERFORADOS = [
  { nombre: "Cartulina", corte: 4, puente: 2 },
  { nombre: "Cartón gris", corte: 6, puente: 3 },
  { nombre: "Corrugado", corte: 10, puente: 4 },
]

export function GeneradorEmpaques() {
  const { locale } = useParams<{ locale: string }>()
  const [avisoCotizar, setAvisoCotizar] = useState("")
  const [forma, setForma] = useState<Forma>("caja")
  const [grupoAbierto, setGrupoAbierto] = useState<string>("Cajas")
  const [unidad, setUnidad] = useState<Unidad>("mm")
  const [valores, setValores] = useState<Record<Forma, Valores>>(INICIO)
  const [conBase, setConBase] = useState(true)
  const [anguloPestana, setAnguloPestana] = useState("45")
  const [modoDoblez, setModoDoblez] = useState<ModoDoblez>("marcar")
  const [corteDoblez, setCorteDoblez] = useState("6")
  const [puenteDoblez, setPuenteDoblez] = useState("3")
  // Hoja: "ajustar" (tamaño del dibujo), un tamaño de TAMANOS_HOJA o "medida"
  const [tamano, setTamano] = useState("ajustar")
  const [horizontal, setHorizontal] = useState(false)
  const [margenHoja, setMargenHoja] = useState("5")
  const [anchoHoja, setAnchoHoja] = useState("600")
  const [altoHoja, setAltoHoja] = useState("400")
  const [papelMosaico, setPapelMosaico] = useState("carta")

  // /disenar/plantillas-empaque?modelo=pizza abre esa plantilla
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("modelo")
    const f = m ? formaPorId(m) : undefined
    if (f) {
      setForma(f.id)
      setGrupoAbierto(f.grupo)
      setConBase(!!f.inicio.conBase)
    }
  }, [])

  const k = FACTOR[unidad]
  const v = valores[forma]
  const def = formaPorId(forma)!
  const campos = def.campos.filter((c) => c !== "conBase") as (keyof Valores)[]
  const elegirForma = (f: typeof FORMAS[number]) => {
    setForma(f.id)
    setConBase(!!f.inicio.conBase)
  }

  const r = useMemo(() => {
    const entero = (c: keyof Valores) => numero(v[c])
    const mm = (c: keyof Valores) => numero(v[c]) * k
    return generarEmpaque(forma, {
      largo: mm("largo"),
      ancho: mm("ancho"),
      alto: mm("alto"),
      pestana: mm("pestana"),
      lados: entero("lados"),
      diametroSup: numero(v.diametroSup) * k || 0,
      conBase,
      altoTapa: mm("altoTapa"),
      holgura: numero(v.holgura) * k || 0,
      margen: mm("margen"),
      filas: entero("filas"),
      columnas: entero("columnas"),
      diametro: mm("diametro"),
      anguloPestana: numero(anguloPestana),
    })
  }, [forma, v, k, conBase, anguloPestana])

  const listo = r.piezas.length > 0
  const dob: OpcionesDoblez = useMemo(
    () => ({ modo: modoDoblez, corte: Math.max(0.5, numero(corteDoblez) || 0), puente: Math.max(0.3, numero(puenteDoblez) || 0) }),
    [modoDoblez, corteDoblez, puenteDoblez],
  )
  // Para cotizar o mandar a un taller sólo van líneas que se cortan: el
  // perforado sí (es corte), el marcado no.
  const dobCotizar: OpcionesDoblez = dob.modo === "perforado" ? dob : { ...dob, modo: "ninguno" }
  // Tamaño de hoja elegido (mm) y piezas acomodadas en una o varias hojas
  const medidaHoja = useMemo(() => {
    if (tamano === "ajustar") return null
    const t = TAMANOS_HOJA.find((x) => x.id === tamano)
    const w = t ? t.ancho : (numero(anchoHoja) || 0) * k
    const h = t ? t.alto : (numero(altoHoja) || 0) * k
    if (!(w > 10 && h > 10)) return null
    // los tamaños de la lista vienen verticales; la medida propia se respeta tal cual
    return t && horizontal ? { w: h, h: w } : { w, h }
  }, [tamano, horizontal, anchoHoja, altoHoja, k])
  const margenMm = Math.max(0, (numero(margenHoja) || 0) * k)
  const acomodo = useMemo(() => {
    if (!listo) return { hojas: [] as Hoja[], noCaben: [] as string[] }
    if (!medidaHoja) return { hojas: [hojaAjustada(r.piezas)], noCaben: [] as string[] }
    return acomodarEnHojas(r.piezas, medidaHoja.w, medidaHoja.h, Math.min(margenMm, medidaHoja.w / 3, medidaHoja.h / 3))
  }, [r, listo, medidaHoja, margenMm])
  const hojas = acomodo.hojas
  const vista = useMemo(
    () => (!listo ? "" : medidaHoja ? (hojas.length ? hojasVistaSVG(hojas, dob) : "") : plantillaSVG(r.piezas, "vista", dob)),
    [r, listo, dob, hojas, medidaHoja],
  )
  const nombreHoja = tamano === "ajustar" ? "" : tamano === "medida" ? "medida propia" : TAMANOS_HOJA.find((x) => x.id === tamano)?.nombre || ""
  const usoHojas = medidaHoja && hojas.length ? Math.round((hojas.reduce((a, h) => a + aprovechamiento(h), 0) / hojas.length) * 100) : 0
  // Descarga por hoja: con más de una, un archivo por hoja (-hoja1, -hoja2…)
  const descargarHojas = (ext: "dxf" | "svg") => {
    if (!medidaHoja) {
      if (ext === "dxf") descargar(`${nombreArchivo}.dxf`, plantillaDXF(r.piezas, dob), "application/dxf")
      else descargar(`${nombreArchivo}.svg`, plantillaSVG(r.piezas, "corte", dob), "image/svg+xml")
      return
    }
    hojas.forEach((h, i) => {
      const nombre = `${nombreArchivo}${hojas.length > 1 ? `-hoja${i + 1}` : ""}.${ext}`
      setTimeout(() => {
        if (ext === "dxf") descargar(nombre, hojaDXF(h, dob), "application/dxf")
        else descargar(nombre, hojaSVG(h, "corte", dob), "image/svg+xml")
      }, i * 400)
    })
  }
  const sinPerforar = useMemo(() => (listo ? doblecesSinPerforar(r.piezas, dob) : 0), [r, listo, dob])
  const hoja = listo ? acomodarPlantillas(r.piezas) : null
  const SIN_UNIDAD = ["lados", "filas", "columnas"]
  const nombreArchivo = `${forma}-hetna-${campos.map((c) => (SIN_UNIDAD.includes(c) ? v[c] : r1(numero(v[c]) * k))).join("x")}`

  const cambiar = (c: keyof Valores, s: string) => setValores((x) => ({ ...x, [forma]: { ...x[forma], [c]: s } }))

  const cambiarUnidad = (u: Unidad) => {
    const conv = (s: string) => {
      const n = numero(s)
      return Number.isFinite(n) ? String(Math.round(((n * FACTOR[unidad]) / FACTOR[u]) * 1000) / 1000) : s
    }
    setValores((x) => {
      const y = { ...x }
      for (const f of Object.keys(y) as Forma[]) {
        const w = { ...y[f] }
        for (const c of Object.keys(w) as (keyof Valores)[]) if (!["lados", "filas", "columnas"].includes(c)) w[c] = conv(w[c])
        y[f] = w
      }
      return y
    })
    setMargenHoja(conv)
    setAnchoHoja(conv)
    setAltoHoja(conv)
    setUnidad(u)
  }

  const imprimir = () => {
    const w = window.open("", "_blank")
    if (!w) return
    const nota = `Imprime al 100% (sin "ajustar a la página"). ${dob.modo === "perforado" ? "Negro: corte · Magenta: perforado para doblar." : "Negro: corte · Azul punteado: doblez."}`
    if (medidaHoja && hojas.length) {
      // una página por hoja, del tamaño de la hoja elegida (sirve para guardar como PDF)
      w.document.write(
        `<!doctype html><title>${nombreArchivo}</title><style>@page{size:${r1(medidaHoja.w)}mm ${r1(medidaHoja.h)}mm;margin:0}body{margin:0}` +
          `.h{width:${r1(medidaHoja.w)}mm;height:${r1(medidaHoja.h)}mm;break-after:page;overflow:hidden}.h:last-child{break-after:auto}.h svg{display:block}` +
          `.n{font:12px sans-serif;padding:8px}@media print{.n{display:none}}</style>` +
          `<p class="n">${nota} Elige el tamaño ${nombreHoja} en el cuadro de impresión.</p>` +
          hojas.map((h) => `<div class="h">${hojaSVG(h, "imprimir", dob)}</div>`).join("")
      )
    } else {
      w.document.write(
        `<!doctype html><title>${nombreArchivo}</title><style>@page{margin:5mm}body{margin:0}</style>` +
          `<p style="font:12px sans-serif">${nota}</p>` +
          plantillaSVG(r.piezas, "imprimir", dob)
      )
    }
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  // Plantillas grandes en hojas de impresora: una página por pedazo, más un mapa de armado
  const papel = TAMANOS_HOJA.find((t) => t.id === papelMosaico) || TAMANOS_HOJA[0]
  const mosaico = useMemo(() => (listo ? paginasMosaico(hojaAjustada(r.piezas, 0), papel.ancho, papel.alto, dob) : null), [r, listo, papel, dob])
  const imprimirMosaico = () => {
    if (!mosaico) return
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(
      `<!doctype html><title>${nombreArchivo}-mosaico</title><style>@page{size:${papel.ancho}mm ${papel.alto}mm;margin:0}body{margin:0}` +
        `.h{width:${papel.ancho}mm;height:${papel.alto}mm;break-after:page;overflow:hidden}.h:last-child{break-after:auto}.h svg{display:block}` +
        `.n{font:12px sans-serif;padding:8px}@media print{.n{display:none}}</style>` +
        `<p class="n">Imprime al 100% (sin "ajustar a la página") en hojas ${papel.nombre}. La primera página es el mapa de armado.</p>` +
        [mosaico.mapa, ...mosaico.paginas.map((x) => x.svg)].map((x) => `<div class="h">${x}</div>`).join("")
    )
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  return (
    <div className="w-full bg-[#FAF9F6]">
      <section className="px-4 lg:px-8 pt-4 pb-3">
        <span className="inline-block text-[12px] font-bold tracking-wide uppercase bg-[#E6F4EC] text-[#16794F] px-3 py-1 rounded-full">
          <T>Gratis</T>
        </span>
        <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]">
          <T>Generador de plantillas de empaque</T>
        </h1>
        <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[680px]">
          <T>Más de 40 modelos: cajas con tapa, de regalo, para pizza o pastel, bolsas con asas, sobres, tubos, pirámides y más, a tu medida. Descarga la plantilla para imprimir, para plotter de corte o para láser.</T>
        </p>
      </section>

      <div className="px-4 lg:px-8 pb-12 grid lg:grid-cols-[380px_1fr] gap-5 items-start">
        <section className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]"><T>Plantilla</T> <span className="font-normal text-[#6B6A63]">({FORMAS.length} <T>modelos)</T></span></span>
            {GRUPOS.map((g) => {
              const abierto = grupoAbierto === g
              const lista = FORMAS.filter((f) => f.grupo === g)
              return (
                <div key={g} className="rounded-[10px] border border-[#E7E4DC] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setGrupoAbierto(abierto ? "" : g)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-[13px] font-bold ${abierto ? "bg-[#142033] text-white" : "bg-[#FAF9F6] text-[#1B1B18]"}`}
                  >
                    <span>{g} <span className={`font-normal ${abierto ? "text-white/70" : "text-[#6B6A63]"}`}>({lista.length})</span></span>
                    <span aria-hidden="true"><Tr>{abierto ? "−" : "+"}</Tr></span>
                  </button>
                  {abierto && (
                    <div className="grid grid-cols-3 gap-1.5 p-2">
                      {lista.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => elegirForma(f)}
                          title={f.detalle}
                          className={`flex flex-col items-center gap-1 rounded-[10px] border px-1.5 py-2 text-[11.5px] leading-tight font-semibold text-center ${
                            forma === f.id ? "border-[#C2560A] bg-[#FDEEE1] text-[#8A3D06]" : "border-[#E7E4DC] bg-white text-[#1B1B18] hover:border-[#C2560A]"
                          }`}
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
                            <path d={ICONOS[f.gen]} />
                          </svg>
                          {f.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {def.detalle && <p className="m-0 text-[12.5px] text-[#6B6A63]">{def.nombre}: <T>{def.detalle}</T>.</p>}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]"><T>Unidades</T></span>
            <div className="flex gap-2">
              {(["mm", "cm", "in"] as Unidad[]).map((u) => (
                <Opcion key={u} activa={unidad === u} onClick={() => cambiarUnidad(u)}>
                  <Tr>{u === "in" ? "pulgadas" : u}</Tr>
                </Opcion>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {campos.map((c) => (
              <label key={c} className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-[#1B1B18]">{ETIQUETAS[forma][c]}</span>
                <span className="flex items-center bg-white border border-[#E7E4DC] rounded-[10px] focus-within:border-[#C2560A]">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={v[c]}
                    onChange={(e) => cambiar(c, e.target.value)}
                    className="w-full min-w-0 px-3 py-2.5 text-[16px] text-[#1B1B18] bg-transparent outline-none"
                  />
                  {!SIN_UNIDAD.includes(c) && <span className="pr-3 text-[13px] text-[#9A978C]">{unidad}</span>}
                </span>
              </label>
            ))}
          </div>

          {def.campos.includes("conBase") && (
            <label className="flex items-center gap-2 text-[14px] text-[#1B1B18]">
              <input type="checkbox" checked={conBase} onChange={(e) => setConBase(e.target.checked)} className="w-4 h-4 accent-[#C2560A]" />
              <Tr>{ETIQUETAS[forma].conBase || "Con base"}</Tr> <T>(pestañas y tapa redonda)</T>
            </label>
          )}

          {def.campos.includes("pestana") && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-[#1B1B18]"><T>Ángulo de las pestañas</T></span>
              <div className="flex flex-wrap gap-2">
                {["30", "45", "60", "90"].map((a) => (
                  <Opcion key={a} activa={anguloPestana === a} onClick={() => setAnguloPestana(a)}>
                    {a}°
                  </Opcion>
                ))}
              </div>
              <p className="m-0 text-[12px] text-[#9A978C]">
                <T>45° es lo normal. Con menos ángulo las pestañas quedan más afiladas y no chocan en las esquinas; con 90° quedan rectangulares y pegan más.</T>
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]"><T>Líneas de doblez</T></span>
            <div className="flex flex-wrap gap-2">
              <Opcion activa={modoDoblez === "marcar"} onClick={() => setModoDoblez("marcar")}><T>Marcar</T></Opcion>
              <Opcion activa={modoDoblez === "perforado"} onClick={() => setModoDoblez("perforado")}><T>Perforado (cartón)</T></Opcion>
              <Opcion activa={modoDoblez === "ninguno"} onClick={() => setModoDoblez("ninguno")}><T>Sin líneas</T></Opcion>
            </div>
            <p className="m-0 text-[12.5px] text-[#6B6A63]">
              {modoDoblez === "marcar" && "Línea continua para marcar con plotter o grabar con láser a baja potencia."}
              {modoDoblez === "perforado" && "La máquina corta el doblez por distancias: un tramo de corte y un puente sin cortar, repetidos. Cada doblez empieza y termina con puente para que la solapa no se desprenda."}
              {modoDoblez === "ninguno" && "Sólo el contorno de corte; los dobleces los haces a mano."}
            </p>
            {modoDoblez === "perforado" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {([["Corte", corteDoblez, setCorteDoblez], ["Puente (sin cortar)", puenteDoblez, setPuenteDoblez]] as const).map(([t, val, set]) => (
                    <label key={t} className="flex flex-col gap-1">
                      <span className="text-[13px] font-semibold text-[#1B1B18]">{t}</span>
                      <span className="flex items-center bg-white border border-[#E7E4DC] rounded-[10px] focus-within:border-[#C2560A]">
                        <input type="text" inputMode="decimal" value={val} onChange={(e) => set(e.target.value)} className="w-full min-w-0 px-3 py-2.5 text-[16px] text-[#1B1B18] bg-transparent outline-none" />
                        <span className="pr-3 text-[13px] text-[#9A978C]"><T>mm</T></span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PERFORADOS.map((pr) => (
                    <button
                      key={pr.nombre}
                      type="button"
                      onClick={() => { setCorteDoblez(String(pr.corte)); setPuenteDoblez(String(pr.puente)) }}
                      className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold ${numero(corteDoblez) === pr.corte && numero(puenteDoblez) === pr.puente ? "border-[#C2560A] bg-[#FDEEE1] text-[#8A3D06]" : "border-[#E7E4DC] bg-white text-[#1B1B18] hover:border-[#C2560A]"}`}
                    >
                      {pr.nombre} · {pr.corte}/{pr.puente}
                    </button>
                  ))}
                </div>
                <p className="m-0 text-[12px] text-[#9A978C]"><T>Son valores para empezar. Haz una prueba en tu cartón: si dobla duro, alarga el corte; si se rompe, alarga el puente.</T></p>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]"><T>Tamaño de hoja</T></span>
            <select
              value={tamano}
              onChange={(e) => setTamano(e.target.value)}
              className="w-full bg-white border border-[#E7E4DC] rounded-[10px] px-3 py-2.5 text-[15px] text-[#1B1B18] outline-none focus:border-[#C2560A]"
            >
              <option value="ajustar">Ajustar al dibujo</option>
              {[...new Set(TAMANOS_HOJA.map((t) => t.grupo))].map((g) => (
                <optgroup key={g} label={g}>
                  {TAMANOS_HOJA.filter((t) => t.grupo === g).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} ({r1(t.ancho)} × {r1(t.alto)} mm)
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value="medida">Medida propia</option>
            </select>
            {tamano !== "ajustar" && (
              <>
                {tamano !== "medida" && (
                  <div className="flex gap-2">
                    <Opcion activa={!horizontal} onClick={() => setHorizontal(false)}><T>Vertical</T></Opcion>
                    <Opcion activa={horizontal} onClick={() => setHorizontal(true)}><T>Horizontal</T></Opcion>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {(tamano === "medida"
                    ? ([["Ancho de hoja", anchoHoja, setAnchoHoja], ["Alto de hoja", altoHoja, setAltoHoja], ["Margen", margenHoja, setMargenHoja]] as const)
                    : ([["Margen", margenHoja, setMargenHoja]] as const)
                  ).map(([t, val, set]) => (
                    <label key={t} className="flex flex-col gap-1">
                      <span className="text-[13px] font-semibold text-[#1B1B18]">{t}</span>
                      <span className="flex items-center bg-white border border-[#E7E4DC] rounded-[10px] focus-within:border-[#C2560A]">
                        <input type="text" inputMode="decimal" value={val} onChange={(e) => set(e.target.value)} className="w-full min-w-0 px-3 py-2.5 text-[16px] text-[#1B1B18] bg-transparent outline-none" />
                        <span className="pr-3 text-[13px] text-[#9A978C]">{unidad}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="m-0 text-[12.5px] text-[#6B6A63]">
                  <T>Las piezas se acomodan en la hoja y se giran si así caben. Si no caben en una, se usan varias y cada hoja se descarga en su propio archivo. Al imprimir, cada hoja sale en su página.</T>
                </p>
              </>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4 min-w-0">
          {r.errores.length > 0 && (
            <div className="bg-[#FDECEC] border border-[#F2B8B5] text-[#8A1C1C] rounded-[12px] px-4 py-3 text-[14px]">
              {r.errores.map((e) => <p key={e} className="m-0">{e}</p>)}
            </div>
          )}

          {listo && (
            <>
              <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-3 lg:p-5">
                <div
                  className="w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[560px]"
                  dangerouslySetInnerHTML={{ __html: vista }}
                />
                <div className="mt-3 flex flex-wrap gap-4 text-[12.5px] text-[#6B6A63]">
                  <span className="flex items-center gap-2"><span className="w-6 border-t-2 border-[#C2560A]" /> <T>Corte</T></span>
                  {dob.modo === "marcar" && <span className="flex items-center gap-2"><span className="w-6 border-t-2 border-dashed border-[#1F5FBF]" /> <T>Doblez (marcar)</T></span>}
                  {dob.modo === "perforado" && <span className="flex items-center gap-2"><span className="w-6 border-t-2 border-dashed border-[#B0127A]" /> <T>Doblez perforado (</T>{r1(dob.corte)} <T>mm corte /</T> {r1(dob.puente)} <T>mm puente)</T></span>}
                  {hoja && !medidaHoja && <span><T>Hoja necesaria:</T> {r1(hoja.ancho)} × {r1(hoja.alto)} <T>mm</T></span>}
                  {medidaHoja && hojas.length > 0 && (
                    <span>
                      <Tr>{hojas.length === 1 ? "1 hoja" : `${hojas.length} hojas`}</Tr> {nombreHoja} <T>de</T> {r1(medidaHoja.w)} × {r1(medidaHoja.h)} <T>mm · aprovechamiento</T> {usoHojas}%
                    </span>
                  )}
                </div>
              </div>

              {acomodo.noCaben.length > 0 && (
                <p className="m-0 text-[13.5px] text-[#8A1C1C] bg-[#FDECEC] border border-[#F2B8B5] rounded-[12px] px-4 py-3">
                  <T>No cabe en la hoja</T> {nombreHoja} <T>ni girándola:</T> <Tr>{acomodo.noCaben.join(", ")}</Tr><T>. Elige una hoja más grande, baja las medidas o usa &quot;Ajustar al dibujo&quot;.</T>
                </p>
              )}
              {sinPerforar > 0 && (
                <p className="m-0 text-[13.5px] text-[#5A3A12] bg-[#FFF6E8] border border-[#F2C98F] rounded-[12px] px-4 py-3">
                  <Tr>{sinPerforar === 1 ? "1 doblez es muy corto" : `${sinPerforar} dobleces son muy cortos`}</Tr> <T>para</T> {r1(dob.corte)} <T>mm de corte y</T> {r1(dob.puente)} <T>mm de puente, y quedan sin perforar. Baja las medidas del perforado o márcalos a mano.</T>
                </p>
              )}
              {r.avisos.length > 0 && (
                <ul className="m-0 pl-5 text-[13.5px] text-[#5A3A12] bg-[#FFF6E8] border border-[#F2C98F] rounded-[12px] py-3 pr-4">
                  {r.avisos.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}

              <button
                type="button"
                onClick={() => { if (!mandarACotizador(`${nombreArchivo}.dxf`, plantillaDXF(r.piezas, dobCotizar), locale, { origen: "Empaques", servicio: "laser_co2", material: "Otro", opciones: { materialLaser: "otros" } })) setAvisoCotizar("El archivo es muy grande para pasarlo al Cotizador. Descárgalo y súbelo ahí.") }}
                className="w-full bg-[#16794F] hover:bg-[#12623F] text-white font-semibold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h4" /></svg>
                <T>Ver precio al instante en el Cotizador</T>
              </button>
              <button
                type="button"
                onClick={() => { if (!mandarAFabricar(`${nombreArchivo}.dxf`, plantillaDXF(r.piezas, dobCotizar), locale, { pieza: "Plantilla de empaque", proceso: "Corte láser" })) setAvisoCotizar("El archivo es muy grande para mandarlo. Descárgalo y súbelo en la solicitud.") }}
                className="w-full bg-[#FF6A1A] hover:bg-[#E65C12] text-white font-extrabold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9H3z" /><path d="M9 20v-6h6v6" /></svg>
                <T>Fabrícamelo: que un taller la corte</T>
              </button>
              {avisoCotizar && <p className="m-0 text-[13px] text-[#8A1C1C]">{avisoCotizar}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => descargarHojas("dxf")}
                  className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]"
                >
                  <T>Descargar DXF</T>
                </button>
                <button
                  type="button"
                  onClick={() => descargarHojas("svg")}
                  className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]"
                >
                  <T>Descargar SVG</T>
                </button>
                <button
                  type="button"
                  onClick={imprimir}
                  className="bg-white border border-[#142033] text-[#142033] font-semibold py-3 rounded-[10px] text-[14px]"
                >
                  <T>PDF / Imprimir</T>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[#E7E4DC] bg-white px-3 py-2.5">
                <span className="text-[13px] font-semibold text-[#1B1B18]"><T>¿Es más grande que tu hoja?</T></span>
                <select
                  value={papelMosaico}
                  onChange={(e) => setPapelMosaico(e.target.value)}
                  aria-label="Papel para imprimir en mosaico"
                  className="bg-white border border-[#E7E4DC] rounded-[8px] px-2 py-1.5 text-[14px] text-[#1B1B18] outline-none focus:border-[#C2560A]"
                >
                  {TAMANOS_HOJA.filter((t) => t.grupo === "Impresora").map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={imprimirMosaico}
                  className="bg-white border border-[#142033] text-[#142033] font-semibold px-3 py-1.5 rounded-[8px] text-[14px]"
                >
                  <T>Imprimir en mosaico</T><Tr>{mosaico ? ` (${mosaico.paginas.length} ${mosaico.paginas.length === 1 ? "página" : "páginas"} + mapa)` : ""}</Tr>
                </button>
                <span className="basis-full text-[12px] text-[#6B6A63]">
                  <T>Parte la plantilla en hojas</T> {papel.nombre} <T>que se recortan y se pegan encimadas 10 mm, con un mapa para armarlas.</T>
                </span>
              </div>
              <p className="m-0 text-[12.5px] text-[#6B6A63]">
                <Tr>{dob.modo === "perforado"
                  ? "En el DXF y el SVG, la capa CORTE (rojo) es el contorno y la capa PERFORADO (magenta) son los cortes cortos de los dobleces. Las dos se cortan; puedes darle a PERFORADO otra velocidad o potencia."
                  : dob.modo === "marcar"
                    ? "En el DXF y el SVG, la capa CORTE (rojo) es la línea de corte y la capa DOBLEZ (azul) se marca o se graba a baja potencia. En plotter (Cricut, Silhouette) usa DOBLEZ como línea de marcado."
                    : "El archivo sólo trae la capa CORTE (rojo), sin líneas de doblez."}</Tr>
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
