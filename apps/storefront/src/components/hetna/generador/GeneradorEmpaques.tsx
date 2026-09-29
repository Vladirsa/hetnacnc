"use client"

import { useMemo, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import {
  Datos,
  ETIQUETAS,
  FORMAS,
  Forma,
  acomodarPlantillas,
  generarEmpaque,
  plantillaDXF,
  plantillaSVG,
} from "@/lib/generador/empaques"

type Unidad = "mm" | "cm" | "in"
const FACTOR: Record<Unidad, number> = { mm: 1, cm: 10, in: 25.4 }
type Valores = Record<Exclude<keyof Datos, "conBase">, string>

// medidas de inicio de cada forma (mm)
const INICIO: Record<Forma, Valores> = {
  caja: { largo: "80", ancho: "50", alto: "120", pestana: "12", lados: "4", diametroSup: "0" },
  piramide: { largo: "0", ancho: "60", alto: "80", pestana: "10", lados: "4", diametroSup: "0" },
  cono: { largo: "0", ancho: "60", alto: "100", pestana: "10", lados: "4", diametroSup: "0" },
  sobre: { largo: "150", ancho: "100", alto: "0", pestana: "10", lados: "4", diametroSup: "0" },
  bolsa: { largo: "160", ancho: "80", alto: "220", pestana: "15", lados: "4", diametroSup: "0" },
  hexagonal: { largo: "0", ancho: "40", alto: "80", pestana: "12", lados: "4", diametroSup: "0" },
}

// iconos de cada forma
const ICONOS: Record<Forma, string> = {
  caja: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
  piramide: "M12 3L3 19h18zM12 3l3 16",
  cono: "M12 3L5 18a7 3 0 0 0 14 0zM5 18a7 3 0 0 1 14 0",
  sobre: "M3 6h18v12H3zM3 6l9 7 9-7",
  bolsa: "M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2",
  hexagonal: "M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z",
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
  const [forma, setForma] = useState<Forma>("caja")
  const [unidad, setUnidad] = useState<Unidad>("mm")
  const [valores, setValores] = useState<Record<Forma, Valores>>(INICIO)
  const [conBase, setConBase] = useState(true)

  const k = FACTOR[unidad]
  const v = valores[forma]
  const def = FORMAS.find((f) => f.id === forma)!
  const campos = def.campos.filter((c) => c !== "conBase") as (keyof Valores)[]

  const r = useMemo(() => {
    const mm = (c: keyof Valores) => (c === "lados" ? numero(v[c]) : numero(v[c]) * k)
    return generarEmpaque(forma, {
      largo: mm("largo"),
      ancho: mm("ancho"),
      alto: mm("alto"),
      pestana: mm("pestana"),
      lados: mm("lados"),
      diametroSup: numero(v.diametroSup) * k || 0,
      conBase,
    })
  }, [forma, v, k, conBase])

  const listo = r.piezas.length > 0
  const vista = useMemo(() => (listo ? plantillaSVG(r.piezas, "vista") : ""), [r, listo])
  const hoja = listo ? acomodarPlantillas(r.piezas) : null
  const nombreArchivo = `${forma}-hetna-${campos.map((c) => (c === "lados" ? v[c] : r1(numero(v[c]) * k))).join("x")}`

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
        for (const c of Object.keys(w) as (keyof Valores)[]) if (c !== "lados") w[c] = conv(w[c])
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
    campos.map((c) => `- ${ETIQUETAS[forma][c]}: ${v[c]}${c === "lados" ? "" : ` ${unidad}`}`).join("\n") +
    (hoja ? `\n- Hoja necesaria: ${r1(hoja.ancho)} x ${r1(hoja.alto)} mm` : "")

  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="px-4 lg:px-16 pt-5 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/servicios" className="hover:text-[#B34D07]">Servicios</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/servicios/generador-2d-3d" className="hover:text-[#B34D07]">Generador 2D y 3D</LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">Plantillas de empaque</span>
      </div>

      <section className="px-4 lg:px-16 pt-4 pb-3">
        <span className="inline-block text-[12px] font-bold tracking-wide uppercase bg-[#E6F4EC] text-[#16794F] px-3 py-1 rounded-full">
          Gratis
        </span>
        <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]">
          Generador de plantillas de empaque
        </h1>
        <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[680px]">
          Cajas, pirámides, conos, sobres y bolsas a tu medida. Descarga la plantilla para imprimir, para plotter de corte o para láser.
        </p>
      </section>

      <div className="px-4 lg:px-16 pb-12 grid lg:grid-cols-[380px_1fr] gap-5 items-start">
        <section className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            {FORMAS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setForma(f.id)}
                className={`flex flex-col items-center gap-1 rounded-[10px] border px-2 py-2.5 text-[12px] font-semibold ${
                  forma === f.id ? "border-[#C2560A] bg-[#FDEEE1] text-[#8A3D06]" : "border-[#E7E4DC] bg-white text-[#1B1B18] hover:border-[#C2560A]"
                }`}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
                  <path d={ICONOS[f.id]} />
                </svg>
                {f.nombre}
              </button>
            ))}
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
                  {c !== "lados" && <span className="pr-3 text-[13px] text-[#9A978C]">{unidad}</span>}
                </span>
              </label>
            ))}
          </div>

          {def.campos.includes("conBase") && (
            <label className="flex items-center gap-2 text-[14px] text-[#1B1B18]">
              <input type="checkbox" checked={conBase} onChange={(e) => setConBase(e.target.checked)} className="w-4 h-4 accent-[#C2560A]" />
              Con base (pestañas y tapa redonda)
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
                  Cotizar el corte
                </a>
              </div>
              <p className="m-0 text-[12.5px] text-[#6B6A63]">
                En el DXF, la capa CORTE es la línea de corte y la capa DOBLEZ se marca o se graba a baja potencia. En plotter (Cricut, Silhouette) usa DOBLEZ como línea de marcado.
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
