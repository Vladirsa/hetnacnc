"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { cajaPatron, generarPatron, patronADXF, patronASVG, type FormaPatron } from "@/lib/generador/patronRadial"

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"
const r1 = (x: number) => Math.round(x * 10) / 10

const EJEMPLOS: { nombre: string; escala: string; rotacion: string }[] = [
  { nombre: "Espiral clásica", escala: "i+i*7", rotacion: "10*sin(i/2)" },
  { nombre: "Anillos concéntricos", escala: "i*5", rotacion: "0" },
  { nombre: "Remolino", escala: "i*4", rotacion: "i*6" },
  { nombre: "Ondulado", escala: "i*4.5", rotacion: "15*sin(i/3)" },
]

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

const Campo = ({
  etiqueta,
  valor,
  cambiar,
  sufijo,
}: {
  etiqueta: string
  valor: string
  cambiar: (v: string) => void
  sufijo?: string
}) => (
  <label className="flex flex-col gap-1">
    <span className="text-[13px] font-semibold text-[#1B1B18]">{etiqueta}</span>
    <span className="flex items-center bg-white border border-[#E7E4DC] rounded-[10px] focus-within:border-[#C2560A]">
      <input
        type="text"
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
        className="w-full min-w-0 px-3 py-2.5 text-[15px] text-[#1B1B18] bg-transparent outline-none font-mono"
      />
      {sufijo && <span className="pr-3 text-[13px] text-[#9A978C]">{sufijo}</span>}
    </span>
  </label>
)

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

export function GeneradorPatron() {
  const { locale } = useParams<{ locale: string }>()
  const [forma, setForma] = useState<FormaPatron>("poligono")
  const [lados, setLados] = useState("5")
  const [capas, setCapas] = useState("25")
  const [radioMin, setRadioMin] = useState("20")
  const [radioMax, setRadioMax] = useState("50")
  const [anguloMin, setAnguloMin] = useState("0")
  const [anguloMax, setAnguloMax] = useState("360")
  const [formulaEscala, setFormulaEscala] = useState("i+i*7")
  const [formulaRotacion, setFormulaRotacion] = useState("10*sin(i/2)")
  const [redondeo, setRedondeo] = useState(0)
  const [semilla, setSemilla] = useState("10")

  const n = (s: string) => parseFloat(s.replace(",", ".")) || 0

  const r = useMemo(
    () =>
      generarPatron({
        forma,
        lados: n(lados),
        capas: n(capas),
        radioMin: n(radioMin),
        radioMax: n(radioMax),
        anguloMin: n(anguloMin),
        anguloMax: n(anguloMax),
        formulaEscala,
        formulaRotacion,
        redondeo,
        semilla: n(semilla),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [forma, lados, capas, radioMin, radioMax, anguloMin, anguloMax, formulaEscala, formulaRotacion, redondeo, semilla]
  )
  const listo = r.capas.length > 0
  const vista = useMemo(() => (listo ? patronASVG(r.capas, "vista") : ""), [r, listo])
  const caja = listo ? cajaPatron(r.capas) : null
  const nombreArchivo = `patron-hetna-${forma}-${capas}capas`

  const mensaje =
    `Hola HETNA CNC, quiero cotizar el corte láser de un patrón decorativo:\n` +
    `- ${capas} capas, figura de ${lados} lados${forma === "organico" ? " (orgánica)" : ""}\n` +
    `- Tamaño aproximado: ${caja ? `${r1(caja.ancho)} x ${r1(caja.alto)} mm` : "-"}`

  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="px-4 lg:px-16 pt-5 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/servicios" className="hover:text-[#B34D07]">Servicios</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/servicios/generador-2d-3d" className="hover:text-[#B34D07]">Generador 2D y 3D</LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">Patrones radiales</span>
      </div>

      <section className="px-4 lg:px-16 pt-4 pb-3">
        <span className="inline-block text-[12px] font-bold tracking-wide uppercase bg-[#E6F4EC] text-[#16794F] px-3 py-1 rounded-full">
          Gratis
        </span>
        <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]">
          Generador de patrones radiales (mandalas, arte de pared)
        </h1>
        <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[680px]">
          Capas de una misma figura, escaladas y rotadas con una fórmula matemática, para corte láser decorativo. Descarga en DXF o SVG.
        </p>
      </section>

      <div className="px-4 lg:px-16 pb-12 grid lg:grid-cols-[380px_1fr] gap-5 items-start">
        {/* Datos */}
        <section className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Figura base</span>
            <div className="flex gap-2">
              <Opcion activa={forma === "poligono"} onClick={() => setForma("poligono")}>Polígono</Opcion>
              <Opcion activa={forma === "organico"} onClick={() => setForma("organico")}>Orgánica</Opcion>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Lados" valor={lados} cambiar={setLados} />
            <Campo etiqueta="Capas" valor={capas} cambiar={setCapas} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Radio inicial" valor={radioMin} cambiar={setRadioMin} sufijo="mm" />
            <Campo etiqueta="Radio de referencia" valor={radioMax} cambiar={setRadioMax} sufijo="mm" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Ángulo inicial" valor={anguloMin} cambiar={setAnguloMin} sufijo="°" />
            <Campo etiqueta="Ángulo final" valor={anguloMax} cambiar={setAnguloMax} sufijo="°" />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Redondeo de esquinas</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={redondeo}
              onChange={(e) => setRedondeo(parseFloat(e.target.value))}
              className="accent-[#C2560A]"
            />
          </div>

          {forma === "organico" && <Campo etiqueta="Semilla (para repetir el mismo patrón)" valor={semilla} cambiar={setSemilla} />}

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Fórmula de escala (variable: i = número de capa)</span>
            <Campo etiqueta="" valor={formulaEscala} cambiar={setFormulaEscala} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Fórmula de rotación (grados)</span>
            <Campo etiqueta="" valor={formulaRotacion} cambiar={setFormulaRotacion} />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Ejemplos</span>
            <div className="flex flex-wrap gap-1.5">
              {EJEMPLOS.map((e) => (
                <button
                  key={e.nombre}
                  type="button"
                  onClick={() => { setFormulaEscala(e.escala); setFormulaRotacion(e.rotacion) }}
                  className="text-[12px] font-semibold bg-[#FAF9F6] border border-[#E7E4DC] hover:border-[#C2560A] px-2.5 py-1 rounded-full text-[#1B1B18]"
                >
                  {e.nombre}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Vista previa y descarga */}
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
                  className="w-full aspect-square [&>svg]:w-full [&>svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: vista }}
                />
              </div>

              <dl className="grid grid-cols-2 gap-2 m-0">
                <div className="bg-white border border-[#E7E4DC] rounded-[12px] px-3 py-2.5">
                  <dt className="text-[12px] text-[#6B6A63]">Tamaño</dt>
                  <dd className="m-0 text-[14px] font-semibold text-[#1B1B18]">{caja ? `${r1(caja.ancho)} × ${r1(caja.alto)} mm` : "-"}</dd>
                </div>
                <div className="bg-white border border-[#E7E4DC] rounded-[12px] px-3 py-2.5">
                  <dt className="text-[12px] text-[#6B6A63]">Capas</dt>
                  <dd className="m-0 text-[14px] font-semibold text-[#1B1B18]">{r.capas.length}</dd>
                </div>
              </dl>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => descargar(`${nombreArchivo}.dxf`, patronADXF(r.capas), "application/dxf")}
                  className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]"
                >
                  Descargar DXF
                </button>
                <button
                  type="button"
                  onClick={() => descargar(`${nombreArchivo}.svg`, patronASVG(r.capas, "corte"), "image/svg+xml")}
                  className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]"
                >
                  Descargar SVG
                </button>
              </div>
              <a
                href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold py-3.5 rounded-[10px] text-[15px] text-center"
              >
                Pedir por WhatsApp
              </a>
              <p className="m-0 text-[12.5px] text-[#6B6A63]">
                Las fórmulas aceptan funciones como sin, cos, sqrt, etc. Si escribes algo inválido, esa capa usa 0 en vez de romper el patrón.
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
