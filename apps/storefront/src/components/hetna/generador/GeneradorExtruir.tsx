"use client"

import { T } from "@/components/hetna/i18n/Idioma"
import { BotonesCam } from "./BotonesCam"
import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import dynamic from "next/dynamic"

import { mandarACotizador, mandarAFabricar } from "@/lib/generador/aCotizador"
import { type Operacion, extruir } from "@/lib/generador/extruir"
import { type Trazo, type Dibujo, dibujoDXF, dibujoSVG, escalar, leerDXF, leerSVG, mallaSTL, medidas, unir } from "@/lib/generador/vectores"

import { Visor3D } from "./Visor3D"

const Malla3D = dynamic(() => import("./Malla3D"), { ssr: false })

const LIMITE = 20 * 1024 * 1024
const numero = (s: string) => parseFloat((s || "").replace(",", "."))
const r1 = (x: number) => Math.round(x * 10) / 10

function descargar(nombre: string, contenido: string | ArrayBuffer, tipo: string) {
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
    className={`px-3 py-2 rounded-[8px] text-[13px] font-semibold border ${
      activa ? "bg-[#142033] text-white border-[#142033]" : "bg-white text-[#1B1B18] border-[#E7E4DC] hover:border-[#C2560A]"
    }`}
  >
    {children}
  </button>
)

const Campo = ({ etiqueta, valor, cambiar, sufijo = "mm" }: { etiqueta: string; valor: string; cambiar: (v: string) => void; sufijo?: string }) => (
  <label className="flex flex-col gap-1">
    <span className="text-[13px] font-semibold text-[#1B1B18]"><T>{etiqueta}</T></span>
    <span className="flex items-center bg-white border border-[#E7E4DC] rounded-[10px] focus-within:border-[#C2560A]">
      <input type="text" inputMode="decimal" value={valor} onChange={(e) => cambiar(e.target.value)} className="w-full min-w-0 px-3 py-2.5 text-[16px] text-[#1B1B18] bg-transparent outline-none" />
      <span className="pr-3 text-[13px] text-[#9A978C]">{sufijo}</span>
    </span>
  </label>
)

// Grupos del archivo: por color en SVG, por capa en DXF
const claveGrupo = (t: Trazo) => (t.color ? t.color : `capa:${t.capa}`)
const OPERACIONES: { id: Operacion; nombre: string }[] = [
  { id: "corte", nombre: "Corte" },
  { id: "grabado", nombre: "Grabado" },
  { id: "marcar", nombre: "Línea marcada" },
  { id: "ignorar", nombre: "Ignorar" },
]
// Operación que se propone para cada grupo, por su nombre y por si sus líneas cierran
// (en láser el rojo suele ser el corte: si hay rojo, los demás colores cerrados se proponen como grabado)
function operacionInicial(clave: string, cerrados: number, abiertos: number, hayRojo: boolean): Operacion {
  const n = clave.toLowerCase()
  if (/grab|engrav|raster|fill/.test(n)) return "grabado"
  if (/dobl|score|fold|marc|perfor|pliegue/.test(n)) return "marcar"
  if (/ignor|guia|guide|ref/.test(n)) return "ignorar"
  if (cerrados < abiertos) return "marcar"
  if (hayRojo && n.startsWith("#") && n !== "#ff0000") return "grabado"
  return "corte"
}

export function GeneradorExtruir({ cabecera }: { cabecera?: React.ReactNode }) {
  const { locale } = useParams<{ locale: string }>()
  const [archivo, setArchivo] = useState<{ nombre: string; dibujo: Dibujo } | null>(null)
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState("")
  const [ancho, setAncho] = useState("")
  const [alto, setAlto] = useState("5")
  const [conBase, setConBase] = useState(false)
  const [base, setBase] = useState("2")
  const [margen, setMargen] = useState("3")
  const [redondear, setRedondear] = useState("4")
  const [espejo, setEspejo] = useState(false)
  const [vista, setVista] = useState<"3d" | "2d">("3d")
  const [modos, setModos] = useState<Record<string, Operacion>>({})
  const [profundidad, setProfundidad] = useState("0.6")
  const [anchoLinea, setAnchoLinea] = useState("0.8")

  const abrir = async (f?: File | null) => {
    setError("")
    if (!f) return
    if (f.size > LIMITE) return setError("El archivo pesa más de 20 MB.")
    const ext = (f.name.split(".").pop() || "").toLowerCase()
    try {
      const texto = await f.text()
      const d = ext === "svg" || /^\s*(<\?xml|<svg)/i.test(texto.slice(0, 200)) ? leerSVG(texto) : leerDXF(texto)
      setArchivo({ nombre: f.name.replace(/\.[^.]+$/, ""), dibujo: unir(d) })
      setAncho("")
      setModos({})
    } catch {
      setError("No pude leer el archivo. Sube un SVG o DXF.")
    }
  }

  const med0 = useMemo(() => (archivo ? medidas(archivo.dibujo) : null), [archivo])
  const factor = med0 && numero(ancho) > 0 && med0.ancho > 0 ? numero(ancho) / med0.ancho : 1
  const dibujo = useMemo(() => (archivo ? (factor !== 1 ? escalar(archivo.dibujo, factor) : archivo.dibujo) : null), [archivo, factor])
  const med = useMemo(() => (dibujo ? medidas(dibujo) : null), [dibujo])

  // grupos de color o capa con cuántas líneas cerradas y abiertas tienen
  const grupos = useMemo(() => {
    if (!archivo) return []
    const m = new Map<string, { clave: string; cerrados: number; abiertos: number }>()
    for (const t of archivo.dibujo.trazos) {
      const k = claveGrupo(t)
      const g = m.get(k) || { clave: k, cerrados: 0, abiertos: 0 }
      if (t.cerrado) g.cerrados++
      else g.abiertos++
      m.set(k, g)
    }
    return [...m.values()].sort((a, b) => b.cerrados + b.abiertos - (a.cerrados + a.abiertos))
  }, [archivo])
  const hayRojo = grupos.some((g) => g.clave === "#ff0000" && g.cerrados >= g.abiertos)
  const modoDe = (k: string) => modos[k] ?? operacionInicial(k, grupos.find((g) => g.clave === k)?.cerrados ?? 0, grupos.find((g) => g.clave === k)?.abiertos ?? 0, hayRojo)
  const hayRebaje = grupos.some((g) => ["grabado", "marcar"].includes(modoDe(g.clave)))

  const r = useMemo(() => {
    if (!dibujo || !(numero(alto) > 0)) return null
    return extruir(dibujo, {
      alto: numero(alto),
      base: conBase ? Math.max(0, numero(base) || 0) : 0,
      margenBase: Math.max(0, numero(margen) || 0),
      redondearBase: Math.max(0, numero(redondear) || 0),
      espejo,
      operacion: (t) => modoDe(claveGrupo(t)),
      profundidad: Math.max(0.05, numero(profundidad) || 0.6),
      anchoLinea: Math.max(0.1, numero(anchoLinea) || 0.8),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dibujo, alto, conBase, base, margen, redondear, espejo, modos, grupos, profundidad, anchoLinea])

  const listo = !!r && !r.errores.length && r.malla.tris.length > 0
  const nombre = archivo ? `${archivo.nombre}-${r1(numero(alto))}mm` : "pieza"
  const vista2d = useMemo(() => (dibujo ? dibujoSVG(dibujo, "vista") : ""), [dibujo])
  const altoTotal = numero(alto) + (conBase ? numero(base) || 0 : 0)

  return (
    <div className="w-full bg-[#FAF9F6]">
      <section className="px-4 lg:px-8 pt-4 pb-3">
        <span className="inline-block text-[12px] font-bold tracking-wide uppercase bg-[#E6F4EC] text-[#16794F] px-3 py-1 rounded-full"><T>Gratis</T></span>
        <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]"><T>SVG o DXF a STL: extruir en 3D</T></h1>
        <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[720px]">
          <T>Sube un logotipo, un nombre o un archivo de corte láser en SVG o DXF, elige qué hace cada color (corte, grabado hundido o línea marcada), dale altura y descarga el STL para imprimir en 3D o tallar en relieve. Con placa base opcional para llaveros, letreros y placas. Tu archivo no se sube a ningún servidor.</T>
        </p>
      </section>

      <div className="px-4 lg:px-8 pb-12 grid lg:grid-cols-[380px_1fr] gap-5 items-start">
        <section className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5 flex flex-col gap-4">
          {cabecera}
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); abrir(e.dataTransfer.files?.[0]) }}
            className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-[#E7E4DC] rounded-[12px] cursor-pointer hover:border-[#C2560A] hover:bg-[#FFF8F1] text-center"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#C2560A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" /></svg>
            <span className="text-[14px] font-semibold text-[#1B1B18]"><T>{archivo ? `${archivo.nombre} (cambiar)` : "Sube tu SVG o DXF"}</T></span>
            <span className="text-[12px] text-[#6B6A63]"><T>Logotipos, letras ya vectorizadas o archivos de corte láser con varios colores</T></span>
            <input type="file" accept=".svg,.dxf" className="hidden" onChange={(e) => abrir(e.target.files?.[0])} />
          </label>
          {error && <p className="m-0 text-[13.5px] text-[#8A1C1C]">{error}</p>}

          {archivo && grupos.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-[#1B1B18]">
                <T>{grupos.some((g) => g.clave.startsWith("capa:")) ? "Capas del archivo" : "Colores del archivo"}</T> <T>y qué hacer con cada uno</T>
              </span>
              {grupos.map((g) => (
                <div key={g.clave} className="flex items-center gap-2">
                  {g.clave.startsWith("capa:") ? (
                    <span className="w-4 h-4 rounded-[4px] border border-[#E7E4DC] bg-[#FAF9F6] shrink-0" aria-hidden="true" />
                  ) : (
                    <span className="w-4 h-4 rounded-[4px] border border-[#E7E4DC] shrink-0" style={{ background: g.clave.startsWith("#") ? g.clave : "#999" }} aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[13px] text-[#1B1B18]" title={g.clave}>
                    <T>{g.clave.startsWith("capa:") ? `Capa ${g.clave.slice(5)}` : g.clave}</T>
                    <span className="text-[#9A978C]"> · <T>{g.cerrados ? `${g.cerrados} cerrada${g.cerrados === 1 ? "" : "s"}` : ""}</T><T>{g.cerrados && g.abiertos ? ", " : ""}</T><T>{g.abiertos ? `${g.abiertos} abierta${g.abiertos === 1 ? "" : "s"}` : ""}</T></span>
                  </span>
                  <select
                    value={modoDe(g.clave)}
                    onChange={(e) => setModos((m) => ({ ...m, [g.clave]: e.target.value as Operacion }))}
                    aria-label={`Operación para ${g.clave}`}
                    className="bg-white border border-[#E7E4DC] rounded-[8px] px-2 py-1.5 text-[13px] text-[#1B1B18] outline-none focus:border-[#C2560A]"
                  >
                    {OPERACIONES.map((o) => (
                      <option key={o.id} value={o.id}>{o.nombre}</option>
                    ))}
                  </select>
                </div>
              ))}
              <p className="m-0 text-[12px] text-[#6B6A63]">
                <T>Corte forma las piezas y sus huecos. Grabado hunde las áreas cerradas en la cara de arriba (lo que queda dentro de un área grabada vuelve a subir). Línea marcada convierte las líneas en canales.</T>
              </p>
              {hayRebaje && (
                <div className="grid grid-cols-2 gap-2">
                  <Campo etiqueta="Profundidad del grabado" valor={profundidad} cambiar={setProfundidad} />
                  <Campo etiqueta="Ancho de línea marcada" valor={anchoLinea} cambiar={setAnchoLinea} />
                </div>
              )}
            </div>
          )}

          {archivo && med0 && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Campo etiqueta="Ancho final" valor={ancho || String(r1(med0.ancho))} cambiar={setAncho} />
                <Campo etiqueta="Altura (extrusión)" valor={alto} cambiar={setAlto} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[2, 3, 5, 10, 20].map((x) => (
                  <button key={x} type="button" onClick={() => setAlto(String(x))} className="text-[12px] font-semibold bg-[#FAF9F6] border border-[#E7E4DC] hover:border-[#C2560A] px-2.5 py-1 rounded-full text-[#1B1B18]">{x} <T>mm</T></button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-[14px] text-[#1B1B18]">
                <input type="checkbox" checked={conBase} onChange={(e) => setConBase(e.target.checked)} className="w-4 h-4 accent-[#C2560A]" />
                <T>Con placa base (llavero, placa, letrero)</T>
              </label>
              {conBase && (
                <div className="grid grid-cols-3 gap-2">
                  <Campo etiqueta="Grosor" valor={base} cambiar={setBase} />
                  <Campo etiqueta="Margen" valor={margen} cambiar={setMargen} />
                  <Campo etiqueta="Esquinas" valor={redondear} cambiar={setRedondear} />
                </div>
              )}
              <label className="flex items-center gap-2 text-[14px] text-[#1B1B18]">
                <input type="checkbox" checked={espejo} onChange={(e) => setEspejo(e.target.checked)} className="w-4 h-4 accent-[#C2560A]" />
                <T>Espejo (para sellos y moldes)</T>
              </label>
            </>
          )}
        </section>

        <section className="flex flex-col gap-4 min-w-0">
          {!archivo && (
            <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-6 text-[14px] text-[#6B6A63] flex flex-col gap-2">
              <p className="m-0 font-semibold text-[#1B1B18]"><T>¿Para qué sirve?</T></p>
              <ul className="m-0 pl-5 flex flex-col gap-1">
                <li><T>Llaveros y placas con tu logotipo: sube el SVG, marca «placa base» y descarga el STL.</T></li>
                <li><T>Letras en relieve para letreros: genera el nombre en «Letreros y nombres», descarga el SVG y extrúyelo aquí.</T></li>
                <li><T>Sellos y moldes: activa «espejo» para que la impresión salga legible al estampar.</T></li>
                <li><T>Relieves para tallar en router: el STL abre en VCarve, Aspire o Fusion.</T></li>
              </ul>
            </div>
          )}

          {r && r.errores.length > 0 && (
            <div className="bg-[#FDECEC] border border-[#F2B8B5] text-[#8A1C1C] rounded-[12px] px-4 py-3 text-[14px]">
              {r.errores.map((e) => <p key={e} className="m-0">{e}</p>)}
            </div>
          )}

          {archivo && dibujo && (
            <>
              <div className="flex gap-2">
                <Opcion activa={vista === "3d"} onClick={() => setVista("3d")}><T>Vista 3D</T></Opcion>
                <Opcion activa={vista === "2d"} onClick={() => setVista("2d")}><T>Contornos</T></Opcion>
              </div>
              <div className={`bg-white border border-[#E7E4DC] rounded-[14px] overflow-hidden ${vista === "3d" && listo ? "" : "p-3 lg:p-4"}`}>
                {vista === "3d" && listo ? (
                  <Visor3D oscuro alto="h-[420px] lg:h-[560px]"><Malla3D oscuro tris={r!.malla.tris} /></Visor3D>
                ) : (
                  <div className="w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[420px]" dangerouslySetInnerHTML={{ __html: vista2d }} />
                )}
              </div>
              {vista === "3d" && <p className="m-0 -mt-2 text-[12.5px] text-[#6B6A63]"><T>Arrastra para rotar, rueda del mouse para acercar.</T></p>}

              {med && r && (
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 m-0">
                  {[
                    ["Tamaño", `${r1(med.ancho)} × ${r1(med.alto)} × ${r1(altoTotal)} mm`],
                    ["Piezas", String(r.piezas)],
                    ["Agujeros", String(r.agujeros)],
                    ["Triángulos", (r.malla.tris.length / 9).toLocaleString("es-MX")],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-white border border-[#E7E4DC] rounded-[12px] px-3 py-2.5">
                      <dt className="text-[12px] text-[#6B6A63]">{k}</dt>
                      <dd className="m-0 text-[14px] font-semibold text-[#1B1B18]">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {r && r.malla.avisos.length > 0 && (
                <ul className="m-0 pl-5 text-[13.5px] text-[#5A3A12] bg-[#FFF6E8] border border-[#F2C98F] rounded-[12px] py-3 pr-4">
                  {r.malla.avisos.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}

              {listo && (
                <>
                  <button
                    type="button"
                    onClick={() => { if (!mandarACotizador(`${nombre}.stl`, mallaSTL(r!.malla), locale, { origen: "SVG a STL", servicio: "impresion_3d", opciones: { materialImpresion: "pla" } })) setAviso("El archivo es muy grande para pasarlo al Cotizador. Descárgalo y súbelo ahí.") }}
                    className="w-full bg-[#16794F] hover:bg-[#12623F] text-white font-semibold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h4" /></svg>
                    <T>Ver precio al instante en el Cotizador</T>
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (!mandarAFabricar(`${nombre}.stl`, mallaSTL(r!.malla), locale, { pieza: "Pieza extruida", medidas: `${r1(med!.ancho)} × ${r1(med!.alto)} × ${r1(altoTotal)} mm`, proceso: "Impresión 3D" })) setAviso("El archivo es muy grande para mandarlo. Descárgalo y súbelo en la solicitud.") }}
                    className="w-full bg-[#FF6A1A] hover:bg-[#E65C12] text-white font-extrabold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9H3z" /><path d="M9 20v-6h6v6" /></svg>
                    <T>Fabrícamelo: que un taller la imprima</T>
                  </button>
                  <BotonesCam nombre={nombre} dxf={() => dibujoDXF(dibujo)} stl={() => mallaSTL(r!.malla)} />
                  {aviso && <p className="m-0 text-[13px] text-[#8A1C1C]">{aviso}</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => descargar(`${nombre}.stl`, mallaSTL(r!.malla), "model/stl")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                      <T>Descargar STL</T>
                    </button>
                    <button type="button" onClick={() => descargar(`${nombre}.svg`, dibujoSVG(dibujo, "corte"), "image/svg+xml")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                      <T>SVG escalado</T>
                    </button>
                  </div>
                  <p className="m-0 text-[12.5px] text-[#6B6A63]">
                    <T>STL binario en milímetros, con las caras orientadas hacia afuera. Los contornos dentro de otro contorno se vuelven agujeros (la o, la a, el hueco del llavero).</T>
                  </p>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
