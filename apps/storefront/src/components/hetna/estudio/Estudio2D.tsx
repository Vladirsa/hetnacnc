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

import { Aviso, Boton, Interruptor, Seccion } from "@/components/hetna/estudio3d/Controles"
import { anidar, hojasComoDibujo, separarPiezas } from "@/lib/generador/anidado"
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

// Hojas comunes para "Acomodar en hojas" (mm)
const HOJAS = [
  { nombre: "Láser 600 × 400", ancho: 600, alto: 400 },
  { nombre: "Láser 900 × 600", ancho: 900, alto: 600 },
  { nombre: "Láser 1300 × 900", ancho: 1300, alto: 900 },
  { nombre: "MDF 1220 × 2440", ancho: 2440, alto: 1220 },
]

export function Estudio2D({
  titulo,
  acento,
  subtitulo,
  icono,
  panel,
  dibujo: dibujoOriginal,
  archivo,
  avisos = [],
  datos = [],
  pieza,
  material,
  sinHojas = false,
  descargas,
  vacio,
  vista3D,
  sinAcomodo = false,
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
  // reemplaza los botones de descarga (p. ej. descarga con créditos); recibe la función que exporta
  descargas?: (exportar: (tipo: "dxf" | "svg" | "pdf") => void) => React.ReactNode
  // mensaje cuando todavía no hay dibujo
  vacio?: React.ReactNode
  // vista del objeto armado: si viene, es la vista principal y el 2D queda en otra pestaña
  vista3D?: React.ReactNode
  // la herramienta trae su propio acomodo en hojas (se oculta el de aquí)
  sinAcomodo?: boolean
}) {
  const { locale } = useParams<{ locale: string }>()
  const cajaRef = useRef<HTMLDivElement>(null)
  const [vista, setVista] = useState<{ x: number; y: number; k: number }>({ x: 0, y: 0, k: 1 })
  // dedos (o ratón) sobre la vista: uno arrastra, dos hacen zoom
  const punteros = useRef(new Map<number, { x: number; y: number }>())
  const gesto = useRef<{ dist: number; k: number; cx: number; cy: number; vx: number; vy: number } | null>(null)
  const vistaRef = useRef(vista)
  vistaRef.current = vista
  const [aviso, setAviso] = useState("")
  const [pestana, setPestana] = useState<"3d" | "2d">("3d")
  const en3D = !!vista3D && pestana === "3d"

  // ---- Acomodar en hojas: las piezas del dibujo, con copias, en hojas de
  // material (mismo motor que la herramienta Anidado). Sirve para saber
  // cuántas hojas se necesitan y para cotizar.
  const [acomodo, setAcomodo] = useState(false)
  const [hojaSel, setHojaSel] = useState(0)
  const [copias, setCopias] = useState(1)
  const anidado = useMemo(() => {
    if (!acomodo || !dibujoOriginal) return null
    const limpio = { ...dibujoOriginal, trazos: dibujoOriginal.trazos.filter((t) => t.capa !== "hoja" && t.capa !== "guia") }
    if (!limpio.trazos.length) return null
    const partes = separarPiezas(limpio)
    return anidar(
      partes.map((d, i) => ({ id: `p${i}`, nombre: `Pieza ${i + 1}`, dibujo: d, cantidad: copias })),
      { hoja: HOJAS[hojaSel], separacion: 3, margen: 5, girar: true }
    )
  }, [acomodo, dibujoOriginal, hojaSel, copias])
  const dibujo = useMemo<Dibujo | null>(() => {
    if (!anidado || !anidado.hojas.length) return dibujoOriginal
    const d = hojasComoDibujo(anidado, HOJAS[hojaSel], 40)
    return { ...d, trazos: d.trazos.map((t) => ({ ...t, capa: t.capa === "HOJA" ? "hoja" : t.capa === "CORTE" ? "corte" : t.capa })) }
  }, [anidado, dibujoOriginal, hojaSel])

  const paraExportar = useMemo(() => {
    if (!dibujo) return null
    return { ...dibujo, trazos: dibujo.trazos.filter((t) => t.capa !== "hoja" && t.capa !== "guia" && !(sinHojas && t.capa === "hoja")) }
  }, [dibujo, sinHojas])

  const b = useMemo(() => (dibujo && dibujo.trazos.length ? cajaDibujo(dibujo.trazos) : null), [dibujo])
  const medidas = useMemo(() => (paraExportar && paraExportar.trazos.length ? cajaDibujo(paraExportar.trazos) : null), [paraExportar])
  const largo = useMemo(() => (paraExportar ? largoCorte(paraExportar.trazos.filter((t) => t.capa !== "grabado" && !t.capa.startsWith("BARRENO") && !t.capa.startsWith("CANTO") && t.capa !== "ETIQUETA" && !t.capa.startsWith("RANURA"))) : 0), [paraExportar])

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
          const col = COLORES[t.capa] || (t.capa === "ETIQUETA" ? "#9BE3B8" : t.capa.startsWith("RANURA") ? "#F5C451" : t.capa.startsWith("BARRENO") ? (t.capa.endsWith("ABAJO") ? "#B58CFF" : "#5FA8F5") : t.capa.startsWith("CANTO") ? "#9BE3B8" : COLORES.corte)
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

  // Zoom hacia un punto de la vista (px desde su centro): lo que está bajo
  // el cursor o entre los dedos se queda en su lugar.
  const zoomEn = (k: number, px: number, py: number, base = vistaRef.current) => {
    const nk = Math.min(40, Math.max(0.3, k))
    const r = nk / base.k
    setVista({ k: nk, x: px - (px - base.x) * r, y: py - (py - base.y) * r })
  }
  const desdeCentro = (x: number, y: number) => {
    const c = cajaRef.current?.getBoundingClientRect()
    return c ? [x - c.left - c.width / 2, y - c.top - c.height / 2] : [0, 0]
  }

  // La rueda va con un oyente no pasivo: así hace zoom sin mover la página
  useEffect(() => {
    const el = cajaRef.current
    if (!el) return
    const onRueda = (e: WheelEvent) => {
      e.preventDefault()
      const [px, py] = desdeCentro(e.clientX, e.clientY)
      const v = vistaRef.current
      zoomEn(v.k * Math.pow(1.0018, -e.deltaY), px, py)
    }
    el.addEventListener("wheel", onRueda, { passive: false })
    return () => el.removeEventListener("wheel", onRueda)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const empezarGesto = () => {
    const ps = [...punteros.current.values()]
    const v = vistaRef.current
    if (ps.length >= 2) {
      const [a, b] = ps
      const [cx, cy] = desdeCentro((a.x + b.x) / 2, (a.y + b.y) / 2)
      gesto.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: v.k, cx, cy, vx: v.x, vy: v.y }
    } else if (ps.length === 1) {
      gesto.current = { dist: 0, k: v.k, cx: ps[0].x, cy: ps[0].y, vx: v.x, vy: v.y }
    } else gesto.current = null
  }

  const ancho = medidas ? medidas.x1 - medidas.x0 : 0
  const alto = medidas ? medidas.y1 - medidas.y0 : 0

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-[#0D1015] text-white lg:flex-row">
      <aside className="order-2 flex w-full flex-col gap-4 border-t border-[#1F2937] lg:order-none lg:border-t-0 bg-[#111722] p-4 lg:sticky lg:top-14 lg:max-h-[calc(100dvh-3.5rem)] lg:w-[330px] lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
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

        <section className={`flex flex-col gap-2 rounded-[12px] border border-[#1F2937] bg-[#0F151E] p-3 ${sinAcomodo ? "hidden" : ""}`}>
          <Interruptor etiqueta="Acomodar en hojas" activo={acomodo} cambiar={setAcomodo} />
          {acomodo && (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                {HOJAS.map((h, i) => (
                  <button
                    key={h.nombre}
                    type="button"
                    aria-pressed={hojaSel === i}
                    onClick={() => setHojaSel(i)}
                    className={`rounded-[8px] px-2 py-1.5 text-[11.5px] font-semibold ${hojaSel === i ? "bg-[#243045] text-white ring-1 ring-[#C2560A]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"}`}
                  >
                    {h.nombre}
                  </button>
                ))}
              </div>
              <label className="flex items-center justify-between gap-2 text-[12.5px] text-[#C9D2E0]">
                Copias de cada pieza
                <span className="flex items-center rounded-[8px] bg-[#1C2431]">
                  <button type="button" aria-label="Menos copias" onClick={() => setCopias((c) => Math.max(1, c - 1))} className="px-2.5 py-1 text-[15px] hover:text-white">−</button>
                  <span className="w-8 text-center font-semibold text-white">{copias}</span>
                  <button type="button" aria-label="Más copias" onClick={() => setCopias((c) => Math.min(200, c + 1))} className="px-2.5 py-1 text-[15px] hover:text-white">+</button>
                </span>
              </label>
              {anidado && (
                <p className="m-0 rounded-[8px] bg-[#C2560A]/10 px-2.5 py-2 text-[12px] leading-snug text-[#F2D29B]">
                  {anidado.totalPiezas} piezas en <b className="text-white">{anidado.hojas.length} {anidado.hojas.length === 1 ? "hoja" : "hojas"}</b> de {HOJAS[hojaSel].nombre.replace(/^\S+ /, "")} mm · aprovechamiento{" "}
                  <b className="text-white">{Math.round(anidado.aprovechamiento * 100)}%</b>
                  {anidado.noCaben.length > 0 && <span className="mt-1 block text-[#F6B8AE]">No caben en esta hoja: {anidado.noCaben.slice(0, 3).join(", ")}. Elige una hoja más grande.</span>}
                </p>
              )}
            </>
          )}
        </section>

        <Seccion titulo="Descargar">
          {descargas ? (
            descargas(exportar)
          ) : (
            <div className="flex gap-2">
              <Boton tipo="primario" onClick={() => exportar("dxf")}>DXF</Boton>
              <Boton onClick={() => exportar("svg")}>SVG</Boton>
              <Boton onClick={() => exportar("pdf")}>PDF</Boton>
            </div>
          )}
        </Seccion>
        <Seccion titulo="¿No tienes máquina?" nota="Un taller de HETNA te lo corta y te lo manda.">
          <div className="flex gap-2">
            <Boton
              tipo="verde"
              onClick={() => {
                if (!paraExportar?.trazos.length) return
                const medidasTxt = anidado?.hojas.length
                  ? `${anidado.hojas.length} ${anidado.hojas.length === 1 ? "hoja" : "hojas"} de ${HOJAS[hojaSel].ancho} × ${HOJAS[hojaSel].alto} mm (${anidado.totalPiezas} piezas, ${Math.round(anidado.aprovechamiento * 100)}% aprovechado)`
                  : `${Math.round(ancho)} × ${Math.round(alto)} mm`
                if (!mandarAFabricar(`${archivo}.dxf`, dibujoDXF(paraExportar), locale, { pieza, medidas: medidasTxt, material }))
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

      {/* En el celular la vista va arriba y fija: se ve cada cambio del panel */}
      <section className="sticky top-14 z-10 order-1 flex h-[46vh] flex-col bg-[#0D1015] lg:static lg:order-none lg:h-auto lg:min-h-[60vh] lg:flex-1">
        <div className="flex items-center gap-1 border-b border-[#1F2937] bg-[#0F141C] px-3 py-2 text-[12.5px] text-[#8A97AB]">
          {vista3D ? (
            <div className="mr-auto flex gap-1" role="tablist">
              {([["3d", "Armado 3D"], ["2d", "Piezas 2D"]] as const).map(([id, t]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={pestana === id}
                  onClick={() => setPestana(id)}
                  className={`rounded-[7px] px-2.5 py-1 font-semibold ${pestana === id ? "bg-[#1C2431] text-white ring-1 ring-[#C2560A]" : "text-[#8A97AB] hover:text-white"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : (
            <span className="mr-auto font-semibold text-[#C9D2E0]">Vista 2D</span>
          )}
          {(en3D ? [] : [
            ["Ajustar", () => setVista({ x: 0, y: 0, k: 1 })],
            ["Acercar", () => zoomEn(vista.k * 1.3, 0, 0)],
            ["Alejar", () => zoomEn(vista.k / 1.3, 0, 0)],
          ]).map(([t, fn]) => (
            <button key={t as string} type="button" onClick={fn as () => void} className="rounded-[7px] px-2.5 py-1 hover:bg-[#1C2431] hover:text-white">
              {t as string}
            </button>
          ))}
        </div>
        {en3D && <div className="relative flex min-h-0 flex-1 flex-col">{vista3D}</div>}
        <div
          ref={cajaRef}
          className={`relative flex-1 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing ${en3D ? "hidden" : ""}`}
          style={{
            backgroundColor: "#0B0F15",
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)",
            backgroundSize: "24px 24px",
          }}
          onPointerDown={(e) => {
            ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
            punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
            empezarGesto()
          }}
          onPointerMove={(e) => {
            if (!punteros.current.has(e.pointerId)) return
            punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
            const g = gesto.current
            if (!g) return
            const ps = [...punteros.current.values()]
            if (ps.length >= 2 && g.dist) {
              const [a, b] = ps
              const base = { k: g.k, x: g.vx, y: g.vy }
              const [cx, cy] = desdeCentro((a.x + b.x) / 2, (a.y + b.y) / 2)
              const nk = Math.min(40, Math.max(0.3, (g.k * Math.hypot(a.x - b.x, a.y - b.y)) / g.dist))
              const r = nk / base.k
              setVista({ k: nk, x: cx - (g.cx - base.x) * r, y: cy - (g.cy - base.y) * r })
            } else if (ps.length === 1) {
              setVista({ ...vistaRef.current, x: g.vx + ps[0].x - g.cx, y: g.vy + ps[0].y - g.cy })
            }
          }}
          onPointerUp={(e) => {
            punteros.current.delete(e.pointerId)
            empezarGesto()
          }}
          onPointerCancel={(e) => {
            punteros.current.delete(e.pointerId)
            empezarGesto()
          }}
          onDoubleClick={() => setVista({ x: 0, y: 0, k: 1 })}
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
