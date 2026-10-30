"use client"

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
}

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"
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

export function GeneradorEmpaques() {
  const { locale } = useParams<{ locale: string }>()
  const [avisoCotizar, setAvisoCotizar] = useState("")
  const [forma, setForma] = useState<Forma>("caja")
  const [grupoAbierto, setGrupoAbierto] = useState<string>("Cajas")
  const [unidad, setUnidad] = useState<Unidad>("mm")
  const [valores, setValores] = useState<Record<Forma, Valores>>(INICIO)
  const [conBase, setConBase] = useState(true)

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
    })
  }, [forma, v, k, conBase])

  const listo = r.piezas.length > 0
  const vista = useMemo(() => (listo ? plantillaSVG(r.piezas, "vista") : ""), [r, listo])
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
    setUnidad(u)
  }

  const imprimir = () => {
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(
      `<!doctype html><title>${nombreArchivo}</title><style>@page{margin:5mm}body{margin:0}</style>` +
        `<p style="font:12px sans-serif">Imprime al 100% (sin "ajustar a la página"). Rojo: corte · Azul punteado: doblez.</p>` +
        plantillaSVG(r.piezas, "corte")
    )
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  const mensaje =
    `Hola HETNA CNC, quiero cotizar una plantilla de ${def.nombre.toLowerCase()}:\n` +
    campos.map((c) => `- ${ETIQUETAS[forma][c]}: ${v[c]}${SIN_UNIDAD.includes(c) ? "" : ` ${unidad}`}`).join("\n") +
    (hoja ? `\n- Hoja necesaria: ${r1(hoja.ancho)} x ${r1(hoja.alto)} mm` : "")

  return (
    <div className="w-full bg-[#FAF9F6]">
      <section className="px-4 lg:px-8 pt-4 pb-3">
        <span className="inline-block text-[12px] font-bold tracking-wide uppercase bg-[#E6F4EC] text-[#16794F] px-3 py-1 rounded-full">
          Gratis
        </span>
        <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]">
          Generador de plantillas de empaque
        </h1>
        <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[680px]">
          Más de 30 modelos: cajas con tapa, de regalo, para pizza o pastel, bolsas con asas, sobres, tubos, pirámides y más, a tu medida. Descarga la plantilla para imprimir, para plotter de corte o para láser.
        </p>
      </section>

      <div className="px-4 lg:px-8 pb-12 grid lg:grid-cols-[380px_1fr] gap-5 items-start">
        <section className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Plantilla <span className="font-normal text-[#6B6A63]">({FORMAS.length} modelos)</span></span>
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
                    <span aria-hidden="true">{abierto ? "−" : "+"}</span>
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
            {def.detalle && <p className="m-0 text-[12.5px] text-[#6B6A63]">{def.nombre}: {def.detalle}.</p>}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Unidades</span>
            <div className="flex gap-2">
              {(["mm", "cm", "in"] as Unidad[]).map((u) => (
                <Opcion key={u} activa={unidad === u} onClick={() => cambiarUnidad(u)}>
                  {u === "in" ? "pulgadas" : u}
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
              {ETIQUETAS[forma].conBase || "Con base"} (pestañas y tapa redonda)
            </label>
          )}
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
                  <span className="flex items-center gap-2"><span className="w-6 border-t-2 border-[#C2560A]" /> Corte</span>
                  <span className="flex items-center gap-2"><span className="w-6 border-t-2 border-dashed border-[#1F5FBF]" /> Doblez</span>
                  {hoja && <span>Hoja necesaria: {r1(hoja.ancho)} × {r1(hoja.alto)} mm</span>}
                </div>
              </div>

              {r.avisos.length > 0 && (
                <ul className="m-0 pl-5 text-[13.5px] text-[#5A3A12] bg-[#FFF6E8] border border-[#F2C98F] rounded-[12px] py-3 pr-4">
                  {r.avisos.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}

              <button
                type="button"
                onClick={() => { if (!mandarACotizador(`${nombreArchivo}.dxf`, plantillaDXF(r.piezas.map((p) => ({ ...p, pliegues: [] }))), locale)) setAvisoCotizar("El archivo es muy grande para pasarlo al Cotizador. Descárgalo y súbelo ahí.") }}
                className="w-full bg-[#16794F] hover:bg-[#12623F] text-white font-semibold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h4" /></svg>
                Ver precio al instante en el Cotizador
              </button>
              <button
                type="button"
                onClick={() => { if (!mandarAFabricar(`${nombreArchivo}.dxf`, plantillaDXF(r.piezas.map((p) => ({ ...p, pliegues: [] }))), locale, { pieza: "Plantilla de empaque", proceso: "Corte láser" })) setAvisoCotizar("El archivo es muy grande para mandarlo. Descárgalo y súbelo en la solicitud.") }}
                className="w-full bg-[#FF6A1A] hover:bg-[#E65C12] text-white font-extrabold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9H3z" /><path d="M9 20v-6h6v6" /></svg>
                Fabrícamelo: que un taller la corte
              </button>
              {avisoCotizar && <p className="m-0 text-[13px] text-[#8A1C1C]">{avisoCotizar}</p>}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => descargar(`${nombreArchivo}.dxf`, plantillaDXF(r.piezas), "application/dxf")}
                  className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]"
                >
                  Descargar DXF
                </button>
                <button
                  type="button"
                  onClick={() => descargar(`${nombreArchivo}.svg`, plantillaSVG(r.piezas, "corte"), "image/svg+xml")}
                  className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]"
                >
                  Descargar SVG
                </button>
                <button
                  type="button"
                  onClick={imprimir}
                  className="bg-white border border-[#142033] text-[#142033] font-semibold py-3 rounded-[10px] text-[14px]"
                >
                  PDF / Imprimir
                </button>
                <a
                  href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold py-3 rounded-[10px] text-[14px] text-center"
                >
                  Pedir por WhatsApp
                </a>
              </div>
              <p className="m-0 text-[12.5px] text-[#6B6A63]">
                En el DXF, la capa CORTE es la línea de corte y la capa DOBLEZ se marca o se graba a baja potencia. En plotter (Cricut, Silhouette) usa DOBLEZ como línea de marcado.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
