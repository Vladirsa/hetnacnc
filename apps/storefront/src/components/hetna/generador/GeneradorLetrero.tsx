"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { mandarACotizador } from "@/lib/generador/aCotizador"
import { type Fuente, type Letrero, type OpcionesLetrero, hacerLetrero, vistaLetrero } from "@/lib/generador/letreros"
import { vectorDXF, vectorSVG } from "@/lib/generador/trazado"

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"
const CDN = "https://cdn.jsdelivr.net/npm"
const OPENTYPE = `${CDN}/opentype.js@1.3.4/dist/opentype.min.js`

// Tipografías libres (licencia OFL) servidas por Fontsource
type Tipo = { id: string; peso: number; nombre: string; grupo: "Molde" | "Cursiva" | "Esténcil" }
const FUENTES: Tipo[] = [
  { id: "anton", peso: 400, nombre: "Anton", grupo: "Molde" },
  { id: "bebas-neue", peso: 400, nombre: "Bebas Neue", grupo: "Molde" },
  { id: "montserrat", peso: 800, nombre: "Montserrat", grupo: "Molde" },
  { id: "oswald", peso: 700, nombre: "Oswald", grupo: "Molde" },
  { id: "roboto-slab", peso: 700, nombre: "Roboto Slab", grupo: "Molde" },
  { id: "alfa-slab-one", peso: 400, nombre: "Alfa Slab", grupo: "Molde" },
  { id: "cinzel", peso: 700, nombre: "Cinzel", grupo: "Molde" },
  { id: "righteous", peso: 400, nombre: "Righteous", grupo: "Molde" },
  { id: "bungee", peso: 400, nombre: "Bungee", grupo: "Molde" },
  { id: "black-ops-one", peso: 400, nombre: "Black Ops", grupo: "Molde" },
  { id: "pacifico", peso: 400, nombre: "Pacifico", grupo: "Cursiva" },
  { id: "lobster", peso: 400, nombre: "Lobster", grupo: "Cursiva" },
  { id: "great-vibes", peso: 400, nombre: "Great Vibes", grupo: "Cursiva" },
  { id: "dancing-script", peso: 700, nombre: "Dancing Script", grupo: "Cursiva" },
  { id: "kaushan-script", peso: 400, nombre: "Kaushan", grupo: "Cursiva" },
  { id: "yellowtail", peso: 400, nombre: "Yellowtail", grupo: "Cursiva" },
  { id: "sacramento", peso: 400, nombre: "Sacramento", grupo: "Cursiva" },
  { id: "stardos-stencil", peso: 700, nombre: "Stardos Stencil", grupo: "Esténcil" },
  { id: "allerta-stencil", peso: 400, nombre: "Allerta Stencil", grupo: "Esténcil" },
]
const archivoFuente = (t: Tipo, ext: "woff" | "woff2") => `${CDN}/@fontsource/${t.id}@5.3.0/files/${t.id}-latin-${t.peso}-normal.${ext}`
const FRESAS = [
  { etiqueta: "1/8 in", mm: 3.175 },
  { etiqueta: "1/4 in", mm: 6.35 },
  { etiqueta: "3 mm", mm: 3 },
  { etiqueta: "6 mm", mm: 6 },
]

type Opentype = { parse(b: ArrayBuffer): Fuente }
let opentypeListo: Promise<Opentype> | null = null
function cargarOpentype(): Promise<Opentype> {
  if (!opentypeListo) {
    opentypeListo = new Promise((ok, mal) => {
      const w = window as unknown as { opentype?: Opentype }
      if (w.opentype) return ok(w.opentype)
      const s = document.createElement("script")
      s.src = OPENTYPE
      s.async = true
      s.onload = () => (w.opentype ? ok(w.opentype) : mal(new Error("opentype")))
      s.onerror = () => { opentypeListo = null; mal(new Error("opentype")) }
      document.head.appendChild(s)
    })
  }
  return opentypeListo
}
const cache = new Map<string, Promise<Fuente>>()
function cargarFuente(t: Tipo): Promise<Fuente> {
  let p = cache.get(t.id)
  if (!p) {
    p = Promise.all([cargarOpentype(), fetch(archivoFuente(t, "woff")).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer() })]).then(([ot, b]) => ot.parse(b))
    p.catch(() => cache.delete(t.id))
    cache.set(t.id, p)
  }
  return p
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

const Opcion = ({ activa, onClick, children, estilo }: { activa: boolean; onClick: () => void; children: React.ReactNode; estilo?: React.CSSProperties }) => (
  <button
    type="button"
    onClick={onClick}
    style={estilo}
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
      <input
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
        className="w-full min-w-0 px-3 py-2.5 text-[16px] text-[#1B1B18] bg-transparent outline-none"
      />
      {sufijo && <span className="pr-3 text-[13px] text-[#9A978C]">{sufijo}</span>}
    </span>
  </label>
)

export function GeneradorLetrero() {
  const { locale } = useParams<{ locale: string }>()
  const [texto, setTexto] = useState("Taller HETNA")
  const [fuenteId, setFuenteId] = useState("pacifico")
  const [propia, setPropia] = useState<{ nombre: string; fuente: Fuente } | null>(null)
  const [fuente, setFuente] = useState<Fuente | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const [tipo, setTipo] = useState<"recorte" | "placa">("recorte")
  const [alto, setAlto] = useState("50")
  const [espaciado, setEspaciado] = useState("0")
  const [interlineado, setInterlineado] = useState("1.6")
  const [alineacion, setAlineacion] = useState<OpcionesLetrero["alineacion"]>("centro")
  const [conBarra, setConBarra] = useState(false)
  const [barra, setBarra] = useState("5")
  const [margen, setMargen] = useState("15")
  const [radio, setRadio] = useState("6")
  const [barreno, setBarreno] = useState("5")
  const [maquina, setMaquina] = useState<"laser" | "router">("router")
  const [fresa, setFresa] = useState("3.175")
  const [res, setRes] = useState<Letrero | null>(null)
  const [calculando, setCalculando] = useState(false)
  const [aviso, setAviso] = useState("")
  const archivoRef = useRef<HTMLInputElement>(null)

  // cada botón de tipografía se ve con su propia letra
  useEffect(() => {
    const id = "hetna-fuentes-letrero"
    if (document.getElementById(id)) return
    const st = document.createElement("style")
    st.id = id
    st.textContent = FUENTES.map((t) => `@font-face{font-family:"hl-${t.id}";src:url(${archivoFuente(t, "woff2")}) format("woff2");font-weight:${t.peso};font-display:swap}`).join("")
    document.head.appendChild(st)
  }, [])

  useEffect(() => {
    if (propia) {
      setFuente(propia.fuente)
      return
    }
    const t = FUENTES.find((x) => x.id === fuenteId)
    if (!t) return
    let vivo = true
    setCargando(true)
    setError("")
    cargarFuente(t)
      .then((f) => { if (vivo) setFuente(f) })
      .catch(() => { if (vivo) setError("No se pudo cargar la tipografía. Revisa tu conexión e inténtalo otra vez.") })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [fuenteId, propia])

  const subirFuente = async (f?: File | null) => {
    if (!f) return
    setError("")
    if (/\.woff2$/i.test(f.name)) return setError("El formato WOFF2 no se puede leer aquí. Usa TTF, OTF o WOFF.")
    try {
      const ot = await cargarOpentype()
      setPropia({ nombre: f.name.replace(/\.[^.]+$/, ""), fuente: ot.parse(await f.arrayBuffer()) })
    } catch {
      setError("No se pudo leer esa tipografía. Prueba con un archivo TTF u OTF.")
    }
  }

  const opciones: OpcionesLetrero = {
    texto,
    alto: numero(alto),
    espaciado: numero(espaciado) || 0,
    interlineado: numero(interlineado) || 1.6,
    alineacion,
    barra: tipo === "recorte" && conBarra ? Math.max(0, numero(barra) || 0) : 0,
    placa: tipo === "placa" ? { margen: Math.max(0, numero(margen) || 0), radio: Math.max(0, numero(radio) || 0), barreno: Math.max(0, numero(barreno) || 0) } : null,
    fresa: maquina === "router" ? Math.max(0, numero(fresa) || 0) : 0,
  }
  const clave = JSON.stringify(opciones)

  useEffect(() => {
    if (!fuente) return
    setCalculando(true)
    const t = window.setTimeout(() => {
      try {
        setRes(hacerLetrero(fuente, opciones))
      } catch (e) {
        console.error("[letrero]", e)
        setError("No se pudo armar el letrero con esa tipografía.")
      }
      setCalculando(false)
    }, 250)
    return () => window.clearTimeout(t)
  }, [fuente, clave]) // eslint-disable-line react-hooks/exhaustive-deps

  const vista = useMemo(() => (res ? vistaLetrero(res) : ""), [res])
  const listo = !!res && res.ancho > 0
  const nombreFuente = propia ? propia.nombre : FUENTES.find((x) => x.id === fuenteId)?.nombre || ""
  const archivo = `letrero-hetna-${(texto.split("\n")[0] || "texto").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30).toLowerCase() || "texto"}`
  const mensaje =
    `Hola HETNA CNC, quiero cotizar un ${tipo === "placa" ? "letrero en placa" : "letrero recortado"}:\n` +
    `- Texto: ${texto.replace(/\n/g, " / ")}\n` +
    `- Tipografía: ${nombreFuente}\n` +
    (res ? `- Tamaño: ${r1(res.ancho)} × ${r1(res.alto)} mm${tipo === "recorte" ? `, ${res.piezas} pieza(s)` : ""}` : "")
  const multilinea = texto.includes("\n")

  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="px-4 lg:px-16 pt-5 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/servicios" className="hover:text-[#B34D07]">Servicios</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/servicios/generador-2d-3d" className="hover:text-[#B34D07]">Generador 2D y 3D</LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">Letreros y nombres</span>
      </div>

      <section className="px-4 lg:px-16 pt-4 pb-3">
        <span className="inline-block text-[12px] font-bold tracking-wide uppercase bg-[#E6F4EC] text-[#16794F] px-3 py-1 rounded-full">Gratis</span>
        <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]">Generador de letreros y nombres</h1>
        <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[720px]">
          Escribe el texto, elige la letra y descarga el DXF listo para cortar en router, láser o plasma. Las letras que se tocan salen unidas en una sola pieza.
        </p>
      </section>

      <div className="px-4 lg:px-16 pb-12 grid lg:grid-cols-[400px_1fr] gap-5 items-start">
        <section className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Texto</span>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={2}
              maxLength={200}
              className="w-full px-3 py-2.5 text-[16px] text-[#1B1B18] bg-white border border-[#E7E4DC] rounded-[10px] outline-none focus:border-[#C2560A] resize-y"
            />
            <span className="text-[12px] text-[#6B6A63]">Usa Enter para hacer otro renglón.</span>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Tipografía {cargando && <span className="font-normal text-[#6B6A63]">(cargando...)</span>}</span>
            {(["Cursiva", "Molde", "Esténcil"] as const).map((grupo) => (
              <div key={grupo} className="flex flex-col gap-1.5">
                <span className="text-[12px] text-[#6B6A63]">{grupo === "Esténcil" ? "Esténcil (para plantillas y plasma)" : grupo}</span>
                <div className="flex flex-wrap gap-1.5">
                  {FUENTES.filter((t) => t.grupo === grupo).map((t) => (
                    <Opcion
                      key={t.id}
                      activa={!propia && fuenteId === t.id}
                      onClick={() => { setPropia(null); setFuenteId(t.id) }}
                      estilo={{ fontFamily: `"hl-${t.id}", sans-serif`, fontWeight: t.peso, fontSize: 16 }}
                    >
                      {t.nombre}
                    </Opcion>
                  ))}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => archivoRef.current?.click()} className="self-start text-[13px] font-semibold text-[#B34D07] underline underline-offset-4">
              {propia ? `Usando tu tipografía: ${propia.nombre} (cambiar)` : "Usar mi propia tipografía (TTF, OTF o WOFF)"}
            </button>
            <input ref={archivoRef} type="file" accept=".ttf,.otf,.woff" className="hidden" onChange={(e) => subirFuente(e.target.files?.[0])} />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Tipo de letrero</span>
            <div className="flex flex-wrap gap-2">
              <Opcion activa={tipo === "recorte"} onClick={() => setTipo("recorte")}>Letras recortadas</Opcion>
              <Opcion activa={tipo === "placa"} onClick={() => setTipo("placa")}>Placa con texto grabado</Opcion>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Alto de la mayúscula" valor={alto} cambiar={setAlto} />
            <Campo etiqueta="Espacio entre letras" valor={espaciado} cambiar={setEspaciado} />
          </div>
          {multilinea && (
            <div className="grid grid-cols-2 gap-2 items-end">
              <Campo etiqueta="Entre renglones (× alto)" valor={interlineado} cambiar={setInterlineado} sufijo="" />
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-[#1B1B18]">Alinear</span>
                <div className="flex gap-1">
                  <Opcion activa={alineacion === "izquierda"} onClick={() => setAlineacion("izquierda")}>Izq.</Opcion>
                  <Opcion activa={alineacion === "centro"} onClick={() => setAlineacion("centro")}>Cen.</Opcion>
                  <Opcion activa={alineacion === "derecha"} onClick={() => setAlineacion("derecha")}>Der.</Opcion>
                </div>
              </div>
            </div>
          )}

          {tipo === "recorte" ? (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-[14px] text-[#1B1B18]">
                <input type="checkbox" checked={conBarra} onChange={(e) => setConBarra(e.target.checked)} className="w-4 h-4 accent-[#C2560A]" />
                Barra inferior que une las letras
              </label>
              {conBarra && <Campo etiqueta="Grosor de la barra" valor={barra} cambiar={setBarra} />}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Campo etiqueta="Margen" valor={margen} cambiar={setMargen} />
              <Campo etiqueta="Esquinas" valor={radio} cambiar={setRadio} />
              <Campo etiqueta="Barrenos" valor={barreno} cambiar={setBarreno} />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Máquina</span>
            <div className="flex flex-wrap gap-2">
              <Opcion activa={maquina === "router"} onClick={() => setMaquina("router")}>Router (revisar fresa)</Opcion>
              <Opcion activa={maquina === "laser"} onClick={() => setMaquina("laser")}>Láser o plasma</Opcion>
            </div>
            {maquina === "router" && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {FRESAS.map((x) => (
                    <button key={x.etiqueta} type="button" onClick={() => setFresa(String(x.mm))} className={`text-[12px] font-semibold border px-2.5 py-1 rounded-full ${numero(fresa) === x.mm ? "bg-[#142033] text-white border-[#142033]" : "bg-[#FAF9F6] text-[#1B1B18] border-[#E7E4DC] hover:border-[#C2560A]"}`}>
                      {x.etiqueta}
                    </button>
                  ))}
                </div>
                <Campo etiqueta="Diámetro de la fresa" valor={fresa} cambiar={setFresa} />
              </>
            )}
          </div>
          {error && <p className="m-0 text-[13.5px] text-[#8A1C1C]">{error}</p>}
        </section>

        <section className="flex flex-col gap-4 min-w-0 order-first lg:order-none">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#6B6A63]">Vista previa{maquina === "router" && numero(fresa) > 0 ? " · en rojo lo que la fresa no alcanza" : ""}</span>
            <span className="text-[13px] text-[#6B6A63]" aria-live="polite">{calculando || cargando ? "Calculando..." : ""}</span>
          </div>
          <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 flex items-center justify-center min-h-[220px]">
            {vista ? (
              <div className={`w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[460px] ${calculando ? "opacity-60" : ""}`} dangerouslySetInnerHTML={{ __html: vista }} />
            ) : (
              <span className="text-[14px] text-[#6B6A63]">{cargando ? "Cargando tipografía..." : "Escribe un texto"}</span>
            )}
          </div>

          {res && listo && (
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 m-0">
              {[
                ["Tamaño final", `${r1(res.ancho)} × ${r1(res.alto)} mm`],
                [tipo === "placa" ? "Capas" : "Piezas", tipo === "placa" ? "PLACA y GRABADO" : String(res.piezas)],
                ["Fresa", maquina === "router" && numero(fresa) > 0 ? (res.problema.length ? `${res.problema.length} zona${res.problema.length === 1 ? "" : "s"} sin alcanzar` : "Todo se alcanza") : "Sin revisión"],
              ].map(([k, v]) => (
                <div key={k} className="bg-white border border-[#E7E4DC] rounded-[12px] px-3 py-2.5">
                  <dt className="text-[12px] text-[#6B6A63]">{k}</dt>
                  <dd className="m-0 text-[14px] font-semibold text-[#1B1B18]">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {res && res.avisos.length > 0 && (
            <ul className="m-0 pl-5 text-[13.5px] text-[#5A3A12] bg-[#FFF6E8] border border-[#F2C98F] rounded-[12px] py-3 pr-4">
              {res.avisos.map((a) => <li key={a}>{a}</li>)}
            </ul>
          )}

          {res && listo && (
            <>
              <button
                type="button"
                onClick={() => { if (!mandarACotizador(`${archivo}.dxf`, vectorDXF(res.vector, res.ancho), locale)) setAviso("El archivo es muy grande para pasarlo al Cotizador. Descárgalo y súbelo ahí.") }}
                className="w-full bg-[#16794F] hover:bg-[#12623F] text-white font-semibold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h4" /></svg>
                Ver precio al instante en el Cotizador
              </button>
              {aviso && <p className="m-0 text-[13px] text-[#8A1C1C]">{aviso}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button type="button" onClick={() => descargar(`${archivo}.dxf`, vectorDXF(res.vector, res.ancho), "application/dxf")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                  Descargar DXF
                </button>
                <button type="button" onClick={() => descargar(`${archivo}.svg`, vectorSVG(res.vector, res.ancho), "image/svg+xml")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                  Descargar SVG
                </button>
                <a href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer" className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold py-3 rounded-[10px] text-[14px] text-center">
                  Pedir por WhatsApp
                </a>
              </div>
              <p className="m-0 text-[12.5px] text-[#6B6A63]">
                {tipo === "placa"
                  ? "En el DXF: capa PLACA con el contorno y los barrenos (corte) y capa GRABADO con las letras (bolsillo o grabado)."
                  : "En el DXF: capa CORTE con el contorno de las letras ya unidas, en mm."}
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
