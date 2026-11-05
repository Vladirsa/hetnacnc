"use client"

// Pantalla común de los generadores nuevos del 2D Studio (celosías, bisagra
// viva, QR, rebanado y los que sigan):
//
//   ┌ panel ─────────┐┌ vista: ajustar · acercar · alejar ───────────────┐
//   │ título         ││                                                   │
//   │ controles      ││        dibujo en mm (rueda = zoom, arrastra)      │
//   │ descargar      ││                                                   │
//   └────────────────┘└ barra: ancho × alto · trazos · largo de corte ───┘
//
// La herramienta sólo arma el Dibujo (lib/generador/geo2d); aquí se ve, se
// mide y se descarga en DXF, SVG o PDF, o se manda a cotizar o a fabricar.
import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"

import { Aviso, Boton, Seccion } from "@/components/hetna/estudio3d/Controles"
import { mandarACotizador, mandarAFabricar } from "@/lib/generador/aCotizador"
import { cajaDibujo, largoCorte } from "@/lib/generador/geo2d"
import { dibujoDXF, dibujoSVG, type Dibujo } from "@/lib/generador/vectores"

const COLORES: Record<string, string> = { corte: "#FF7A2E", grabado: "#5FA8F5", interior: "#FFB067", doblez: "#5FA8F5", hoja: "#3A4658", guia: "#3A4658", texto: "#9BE3B8" }

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

const f = (x: number) => String(Math.round(x * 100) / 100)

export function Estudio2D({
  titulo,
  acento,
  subtitulo,
  icono,
  panel,
  dibujo,
  archivo,
  avisos = [],
  datos = [],
  pieza,
  material,
  sinHojas = false,
  vacio,
}: {
  titulo: string
  acento?: string
  subtitulo: string
  icono: React.ReactNode
  panel: React.ReactNode
  dibujo: Dibujo | null
  // nombre del archivo sin extensión
  archivo: string
  avisos?: string[]
  datos?: [string, string][]
  // para Fabrícamelo
  pieza: string
  material?: string
  // las líneas de "hoja" no se exportan
  sinHojas?: boolean
  // mensaje cuando todavía no hay dibujo
  vacio?: React.ReactNode
}) {
  const { locale } = useParams<{ locale: string }>()
  const cajaRef = useRef<HTMLDivElement>(null)
  const [vista, setVista] = useState<{ x: number; y: number; k: number }>({ x: 0, y: 0, k: 1 })
  const arrastre = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const [aviso, setAviso] = useState("")

  const paraExportar = useMemo(() => {
    if (!dibujo) return null
    return { ...dibujo, trazos: dibujo.trazos.filter((t) => t.capa !== "hoja" && t.capa !== "guia" && !(sinHojas && t.capa === "hoja")) }
  }, [dibujo, sinHojas])

  const b = useMemo(() => (dibujo && dibujo.trazos.length ? cajaDibujo(dibujo.trazos) : null), [dibujo])
  const medidas = useMemo(() => (paraExportar && paraExportar.trazos.length ? cajaDibujo(paraExportar.trazos) : null), [paraExportar])
  const largo = useMemo(() => (paraExportar ? largoCorte(paraExportar.trazos.filter((t) => t.capa !== "grabado")) : 0), [paraExportar])

  // Al cambiar el tamaño del dibujo, se vuelve a ajustar a la vista
  const clave = b ? `${Math.round(b.x1 - b.x0)}x${Math.round(b.y1 - b.y0)}` : ""
  useEffect(() => setVista({ x: 0, y: 0, k: 1 }), [clave])

  const svg = useMemo(() => {
    if (!dibujo || !b) return null
    const mar = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.06 + 2
    const W = b.x1 - b.x0 + 2 * mar
    const H = b.y1 - b.y0 + 2 * mar
    const X = (x: number) => f(x - b.x0 + mar)
    const Y = (y: number) => f(H - mar - (y - b.y0))
    const camino = (pts: [number, number][], cerrado: boolean) => pts.map(([x, y], j) => `${j ? "L" : "M"}${X(x)} ${Y(y)}`).join("") + (cerrado ? "Z" : "")
    // Lo grabado se rellena como una sola figura (par-impar): así los huecos
    // de un contorno se ven vacíos, como quedarán grabados.
    const grabado = dibujo.trazos.filter((t) => t.capa === "grabado" && t.cerrado)
    const paths = [
      grabado.length ? (
        <path key="grabado" d={grabado.map((t) => camino(t.pts, true)).join("")} fill={COLORES.grabado + "88"} stroke={COLORES.grabado} strokeWidth={1} vectorEffect="non-scaling-stroke" fillRule="evenodd" />
      ) : null,
      ...dibujo.trazos
        .filter((t) => !(t.capa === "grabado" && t.cerrado))
        .map((t, i) => {
          const col = COLORES[t.capa] || COLORES.corte
          return <path key={i} d={camino(t.pts, t.cerrado)} fill="none" stroke={col} strokeWidth={t.capa === "hoja" ? 1 : 1.3} vectorEffect="non-scaling-stroke" strokeDasharray={t.capa === "doblez" || t.capa === "guia" ? "6 4" : undefined} />
        }),
    ]
    return { W, H, paths }
  }, [dibujo, b])

  const exportar = (tipo: "dxf" | "svg" | "pdf") => {
    if (!paraExportar?.trazos.length) return
    if (tipo === "dxf") return descargar(`${archivo}.dxf`, dibujoDXF(paraExportar), "application/dxf")
    if (tipo === "svg") return descargar(`${archivo}.svg`, dibujoSVG(paraExportar, "corte"), "image/svg+xml")
    const w = window.open("", "_blank")
    if (!w) return setAviso("Permite las ventanas emergentes para imprimir el PDF.")
    w.document.write(
      `<!doctype html><title>${archivo}</title><style>@page{margin:5mm}body{margin:0}</style>` +
        `<p style="font:12px sans-serif">Imprime al 100% (sin "ajustar a la página"). Medidas en mm.</p>` +
        dibujoSVG(paraExportar, "corte"),
    )
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  const rueda = (e: React.WheelEvent) => {
    const k = Math.min(20, Math.max(0.3, vista.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
    setVista({ ...vista, k })
  }

  const ancho = medidas ? medidas.x1 - medidas.x0 : 0
  const alto = medidas ? medidas.y1 - medidas.y0 : 0

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-[#0D1015] text-white lg:flex-row">
      <aside className="flex w-full flex-col gap-4 border-b border-[#1F2937] bg-[#111722] p-4 lg:sticky lg:top-14 lg:max-h-[calc(100dvh-3.5rem)] lg:w-[330px] lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#C2560A]/20 text-[#F28A3C]">{icono}</span>
          <div className="min-w-0">
            <h1 className="m-0 text-[16px] font-bold">
              {titulo} {acento && <span className="text-[#F28A3C]">{acento}</span>}
            </h1>
            <p className="m-0 text-[12px] text-[#8A97AB]">{subtitulo}</p>
          </div>
        </div>

        {panel}

        {avisos.map((a) => (
          <Aviso key={a}>{a}</Aviso>
        ))}
        {aviso && <Aviso tipo="error">{aviso}</Aviso>}

        <Seccion titulo="Descargar">
          <div className="flex gap-2">
            <Boton tipo="primario" onClick={() => exportar("dxf")}>DXF</Boton>
            <Boton onClick={() => exportar("svg")}>SVG</Boton>
            <Boton onClick={() => exportar("pdf")}>PDF</Boton>
          </div>
        </Seccion>
        <Seccion titulo="¿No tienes máquina?" nota="Un taller de HETNA te lo corta y te lo manda.">
          <div className="flex gap-2">
            <Boton
              tipo="verde"
              onClick={() => {
                if (!paraExportar?.trazos.length) return
                if (!mandarAFabricar(`${archivo}.dxf`, dibujoDXF(paraExportar), locale, { pieza, medidas: `${Math.round(ancho)} × ${Math.round(alto)} mm`, material }))
                  setAviso("El archivo es muy grande para mandarlo así. Descárgalo y súbelo en Fabrícamelo.")
              }}
            >
              Fabrícamelo
            </Boton>
            <Boton
              onClick={() => {
                if (!paraExportar?.trazos.length) return
                if (!mandarACotizador(`${archivo}.dxf`, dibujoDXF(paraExportar), locale))
                  setAviso("El archivo es muy grande para mandarlo así. Descárgalo y súbelo al cotizador.")
              }}
            >
              Cotizar
            </Boton>
          </div>
        </Seccion>
        <p className="m-0 mt-auto text-[11.5px] text-[#5B6880]">Todo se calcula en tu navegador. Medidas en milímetros.</p>
      </aside>

      <section className="relative flex min-h-[60vh] flex-1 flex-col">
        <div className="flex items-center gap-1 border-b border-[#1F2937] bg-[#0F141C] px-3 py-2 text-[12.5px] text-[#8A97AB]">
          <span className="mr-auto font-semibold text-[#C9D2E0]">Vista 2D</span>
          {[
            ["Ajustar", () => setVista({ x: 0, y: 0, k: 1 })],
            ["Acercar", () => setVista({ ...vista, k: Math.min(20, vista.k * 1.3) })],
            ["Alejar", () => setVista({ ...vista, k: Math.max(0.3, vista.k / 1.3) })],
          ].map(([t, fn]) => (
            <button key={t as string} type="button" onClick={fn as () => void} className="rounded-[7px] px-2.5 py-1 hover:bg-[#1C2431] hover:text-white">
              {t as string}
            </button>
          ))}
        </div>
        <div
          ref={cajaRef}
          className="relative flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
          style={{
            backgroundColor: "#0B0F15",
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)",
            backgroundSize: "24px 24px",
          }}
          onWheel={rueda}
          onPointerDown={(e) => {
            arrastre.current = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y }
            ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          }}
          onPointerMove={(e) => {
            const a = arrastre.current
            if (a) setVista({ ...vista, x: a.vx + e.clientX - a.x, y: a.vy + e.clientY - a.y })
          }}
          onPointerUp={() => (arrastre.current = null)}
        >
          {svg ? (
            <svg
              viewBox={`0 0 ${f(svg.W)} ${f(svg.H)}`}
              className="absolute inset-0 h-full w-full p-6"
              style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.k})`, transformOrigin: "center" }}
              role="img"
              aria-label={`Vista previa: ${titulo}`}
            >
              {svg.paths}
            </svg>
          ) : (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-[14px] text-[#8A97AB]">{vacio || "Ajusta los valores del panel."}</div>
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-[#1F2937] bg-[#0F141C] px-4 py-2 text-[12.5px] text-[#8A97AB]">
          {medidas && (
            <span>
              Medidas: <b className="text-white">{Math.round(ancho * 10) / 10} × {Math.round(alto * 10) / 10} mm</b>
            </span>
          )}
          {paraExportar && (
            <span>
              Trazos: <b className="text-white">{paraExportar.trazos.length}</b>
            </span>
          )}
          {largo > 0 && (
            <span>
              Corte: <b className="text-white">{largo >= 1000 ? `${(largo / 1000).toFixed(2)} m` : `${Math.round(largo)} mm`}</b>
            </span>
          )}
          {datos.map(([t, v]) => (
            <span key={t}>
              {t}: <b className="text-white">{v}</b>
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
