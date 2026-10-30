"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import dynamic from "next/dynamic"

import { mandarACotizador, mandarAFabricar } from "@/lib/generador/aCotizador"
import { extruir } from "@/lib/generador/extruir"
import { type Dibujo, dibujoSVG, escalar, leerDXF, leerSVG, mallaSTL, medidas, unir } from "@/lib/generador/vectores"

const Malla3D = dynamic(() => import("./Malla3D"), { ssr: false })

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"
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
    <span className="text-[13px] font-semibold text-[#1B1B18]">{etiqueta}</span>
    <span className="flex items-center bg-white border border-[#E7E4DC] rounded-[10px] focus-within:border-[#C2560A]">
      <input type="text" inputMode="decimal" value={valor} onChange={(e) => cambiar(e.target.value)} className="w-full min-w-0 px-3 py-2.5 text-[16px] text-[#1B1B18] bg-transparent outline-none" />
      <span className="pr-3 text-[13px] text-[#9A978C]">{sufijo}</span>
    </span>
  </label>
)

export function GeneradorExtruir() {
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
    } catch {
      setError("No pude leer el archivo. Sube un SVG o DXF.")
    }
  }

  const med0 = useMemo(() => (archivo ? medidas(archivo.dibujo) : null), [archivo])
  const factor = med0 && numero(ancho) > 0 && med0.ancho > 0 ? numero(ancho) / med0.ancho : 1
  const dibujo = useMemo(() => (archivo ? (factor !== 1 ? escalar(archivo.dibujo, factor) : archivo.dibujo) : null), [archivo, factor])
  const med = useMemo(() => (dibujo ? medidas(dibujo) : null), [dibujo])

  const r = useMemo(() => {
    if (!dibujo || !(numero(alto) > 0)) return null
    return extruir(dibujo, {
      alto: numero(alto),
      base: conBase ? Math.max(0, numero(base) || 0) : 0,
      margenBase: Math.max(0, numero(margen) || 0),
      redondearBase: Math.max(0, numero(redondear) || 0),
      espejo,
    })
  }, [dibujo, alto, conBase, base, margen, redondear, espejo])

  const listo = !!r && !r.errores.length && r.malla.tris.length > 0
  const nombre = archivo ? `${archivo.nombre}-${r1(numero(alto))}mm` : "pieza"
  const vista2d = useMemo(() => (dibujo ? dibujoSVG(dibujo, "vista") : ""), [dibujo])
  const altoTotal = numero(alto) + (conBase ? numero(base) || 0 : 0)
  const mensaje = med
    ? `Hola HETNA CNC, quiero cotizar la impresión 3D de una pieza extruida:\n- Tamaño: ${r1(med.ancho)} × ${r1(med.alto)} × ${r1(altoTotal)} mm\n- ${r?.piezas || 0} pieza(s) en el archivo "${archivo?.nombre}"`
    : ""

  return (
    <div className="w-full bg-[#FAF9F6]">
      <section className="px-4 lg:px-8 pt-4 pb-3">
        <span className="inline-block text-[12px] font-bold tracking-wide uppercase bg-[#E6F4EC] text-[#16794F] px-3 py-1 rounded-full">Gratis</span>
        <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]">SVG o DXF a STL: extruir en 3D</h1>
        <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[720px]">
          Sube un logotipo, un nombre o una silueta en SVG o DXF, dale altura y descarga el STL para imprimir en 3D o tallar en relieve. Con placa base opcional para llaveros, letreros y placas. Tu archivo no se sube a ningún servidor.
        </p>
      </section>

      <div className="px-4 lg:px-8 pb-12 grid lg:grid-cols-[380px_1fr] gap-5 items-start">
        <section className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5 flex flex-col gap-4">
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); abrir(e.dataTransfer.files?.[0]) }}
            className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-[#E7E4DC] rounded-[12px] cursor-pointer hover:border-[#C2560A] hover:bg-[#FFF8F1] text-center"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#C2560A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" /></svg>
            <span className="text-[14px] font-semibold text-[#1B1B18]">{archivo ? `${archivo.nombre} (cambiar)` : "Sube tu SVG o DXF"}</span>
            <span className="text-[12px] text-[#6B6A63]">Contornos cerrados: logotipos, letras ya vectorizadas, siluetas</span>
            <input type="file" accept=".svg,.dxf" className="hidden" onChange={(e) => abrir(e.target.files?.[0])} />
          </label>
          {error && <p className="m-0 text-[13.5px] text-[#8A1C1C]">{error}</p>}

          {archivo && med0 && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Campo etiqueta="Ancho final" valor={ancho || String(r1(med0.ancho))} cambiar={setAncho} />
                <Campo etiqueta="Altura (extrusión)" valor={alto} cambiar={setAlto} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[2, 3, 5, 10, 20].map((x) => (
                  <button key={x} type="button" onClick={() => setAlto(String(x))} className="text-[12px] font-semibold bg-[#FAF9F6] border border-[#E7E4DC] hover:border-[#C2560A] px-2.5 py-1 rounded-full text-[#1B1B18]">{x} mm</button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-[14px] text-[#1B1B18]">
                <input type="checkbox" checked={conBase} onChange={(e) => setConBase(e.target.checked)} className="w-4 h-4 accent-[#C2560A]" />
                Con placa base (llavero, placa, letrero)
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
                Espejo (para sellos y moldes)
              </label>
            </>
          )}
        </section>

        <section className="flex flex-col gap-4 min-w-0">
          {!archivo && (
            <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-6 text-[14px] text-[#6B6A63] flex flex-col gap-2">
              <p className="m-0 font-semibold text-[#1B1B18]">¿Para qué sirve?</p>
              <ul className="m-0 pl-5 flex flex-col gap-1">
                <li>Llaveros y placas con tu logotipo: sube el SVG, marca «placa base» y descarga el STL.</li>
                <li>Letras en relieve para letreros: genera el nombre en «Letreros y nombres», descarga el SVG y extrúyelo aquí.</li>
                <li>Sellos y moldes: activa «espejo» para que la impresión salga legible al estampar.</li>
                <li>Relieves para tallar en router: el STL abre en VCarve, Aspire o Fusion.</li>
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
                <Opcion activa={vista === "3d"} onClick={() => setVista("3d")}>Vista 3D</Opcion>
                <Opcion activa={vista === "2d"} onClick={() => setVista("2d")}>Contornos</Opcion>
              </div>
              <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-3 lg:p-4">
                {vista === "3d" && listo ? (
                  <Malla3D tris={r!.malla.tris} />
                ) : (
                  <div className="w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[420px]" dangerouslySetInnerHTML={{ __html: vista2d }} />
                )}
              </div>
              {vista === "3d" && <p className="m-0 -mt-2 text-[12.5px] text-[#6B6A63]">Arrastra para rotar, rueda del mouse para acercar.</p>}

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
                    onClick={() => { if (!mandarACotizador(`${nombre}.stl`, mallaSTL(r!.malla), locale)) setAviso("El archivo es muy grande para pasarlo al Cotizador. Descárgalo y súbelo ahí.") }}
                    className="w-full bg-[#16794F] hover:bg-[#12623F] text-white font-semibold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h4" /></svg>
                    Ver precio al instante en el Cotizador
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (!mandarAFabricar(`${nombre}.stl`, mallaSTL(r!.malla), locale, { pieza: "Pieza extruida", medidas: `${r1(med!.ancho)} × ${r1(med!.alto)} × ${r1(altoTotal)} mm`, proceso: "Impresión 3D" })) setAviso("El archivo es muy grande para mandarlo. Descárgalo y súbelo en la solicitud.") }}
                    className="w-full bg-[#FF6A1A] hover:bg-[#E65C12] text-white font-extrabold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9H3z" /><path d="M9 20v-6h6v6" /></svg>
                    Fabrícamelo: que un taller la imprima
                  </button>
                  {aviso && <p className="m-0 text-[13px] text-[#8A1C1C]">{aviso}</p>}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button type="button" onClick={() => descargar(`${nombre}.stl`, mallaSTL(r!.malla), "model/stl")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                      Descargar STL
                    </button>
                    <button type="button" onClick={() => descargar(`${nombre}.svg`, dibujoSVG(dibujo, "corte"), "image/svg+xml")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                      SVG escalado
                    </button>
                    <a href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer" className="col-span-2 sm:col-span-1 bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold py-3 rounded-[10px] text-[14px] text-center">
                      Pedir por WhatsApp
                    </a>
                  </div>
                  <p className="m-0 text-[12.5px] text-[#6B6A63]">
                    STL binario en milímetros, con las caras orientadas hacia afuera. Los contornos dentro de otro contorno se vuelven agujeros (la o, la a, el hueco del llavero).
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
