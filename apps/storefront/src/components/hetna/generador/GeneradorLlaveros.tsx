"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import dynamic from "next/dynamic"

import { mandarACotizador, mandarAFabricar } from "@/lib/generador/aCotizador"
import { FUENTES, cargarFuente, instalarFuentesVista } from "@/lib/generador/fuentes"
import type { Fuente } from "@/lib/generador/letreros"
import { FORMAS_LLAVERO, type FormaLlavero, hacerLlavero } from "@/lib/generador/llaveros"
import { dibujoDXF, dibujoSVG, mallaSTL } from "@/lib/generador/vectores"

import { Visor3D } from "./Visor3D"

const Malla3D = dynamic(() => import("./Malla3D"), { ssr: false })

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"
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
      <input type="text" inputMode="decimal" value={valor} onChange={(e) => cambiar(e.target.value)} className="w-full min-w-0 px-3 py-2.5 text-[16px] text-[#1B1B18] bg-transparent outline-none" />
      {sufijo && <span className="pr-3 text-[13px] text-[#9A978C]">{sufijo}</span>}
    </span>
  </label>
)

// Modelos con nombre: mismas opciones, distinto punto de partida
const MODELOS: { id: string; nombre: string; forma: FormaLlavero; texto: string; alto: string; fuente: string }[] = [
  { id: "llavero", nombre: "Llavero con nombre", forma: "rect", texto: "Sofía", alto: "12", fuente: "pacifico" },
  { id: "etiqueta", nombre: "Etiqueta de maleta", forma: "etiqueta", texto: "VIAJE", alto: "14", fuente: "bebas-neue" },
  { id: "corazon", nombre: "Corazón", forma: "corazon", texto: "Mamá", alto: "11", fuente: "lobster" },
  { id: "mascota", nombre: "Placa de mascota", forma: "circulo", texto: "Max", alto: "13", fuente: "montserrat" },
  { id: "placa", nombre: "Placa de puerta", forma: "rect", texto: "Taller", alto: "20", fuente: "oswald" },
  { id: "adorno", nombre: "Adorno navideño", forma: "ovalo", texto: "2026", alto: "16", fuente: "cinzel" },
]

export function GeneradorLlaveros() {
  const { locale } = useParams<{ locale: string }>()
  const [texto, setTexto] = useState("Sofía")
  const [fuenteId, setFuenteId] = useState("pacifico")
  const [fuente, setFuente] = useState<Fuente | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const [forma, setForma] = useState<FormaLlavero>("rect")
  const [alto, setAlto] = useState("12")
  const [espaciado, setEspaciado] = useState("0")
  const [margen, setMargen] = useState("4")
  const [radio, setRadio] = useState("5")
  const [argolla, setArgolla] = useState("4.5")
  const [grosor, setGrosor] = useState("3")
  const [relieve, setRelieve] = useState("1.5")
  const [vista, setVista] = useState<"3d" | "2d">("2d")
  const [aviso, setAviso] = useState("")

  useEffect(() => {
    instalarFuentesVista()
  }, [])

  useEffect(() => {
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
  }, [fuenteId])

  const elegirModelo = (m: (typeof MODELOS)[number]) => {
    setForma(m.forma)
    setTexto(m.texto)
    setAlto(m.alto)
    setFuenteId(m.fuente)
  }

  const r = useMemo(() => {
    if (!fuente) return null
    try {
      return hacerLlavero(fuente, {
        texto,
        alto: numero(alto),
        espaciado: numero(espaciado) || 0,
        forma,
        margen: numero(margen) || 0,
        radio: numero(radio) || 0,
        argolla: numero(argolla) || 0,
        grosor: numero(grosor) || 0,
        relieve: numero(relieve) || 0,
      })
    } catch {
      return null
    }
  }, [fuente, texto, alto, espaciado, forma, margen, radio, argolla, grosor, relieve])

  const listo = !!r && !r.errores.length
  const vista2d = useMemo(() => (listo ? dibujoSVG(r!.dibujo, "vista") : ""), [r, listo])
  const archivo = `llavero-hetna-${(texto.split("\n")[0] || "nombre").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30).toLowerCase() || "nombre"}`
  const mensaje = r ? `Hola HETNA CNC, quiero cotizar llaveros con nombre:\n- Texto: ${texto}\n- Forma: ${FORMAS_LLAVERO.find((f) => f.id === forma)?.nombre}\n- Tamaño: ${r1(r.ancho)} × ${r1(r.alto)} mm` : ""

  return (
    <div className="w-full bg-[#FAF9F6]">
      <section className="px-4 lg:px-8 pt-4 pb-3">
        <span className="inline-block text-[12px] font-bold tracking-wide uppercase bg-[#E6F4EC] text-[#16794F] px-3 py-1 rounded-full">Gratis</span>
        <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]">Llaveros, placas y adornos con nombre</h1>
        <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[720px]">
          Escribe el nombre, elige la letra y la forma, y descarga el archivo: DXF/SVG para cortar y grabar en láser, o STL con las letras en relieve para imprimir en 3D. Con el agujero de la argolla ya puesto.
        </p>
      </section>

      <div className="px-4 lg:px-8 pb-12 grid lg:grid-cols-[400px_1fr] gap-5 items-start">
        <section className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Empieza con un modelo</span>
            <div className="grid grid-cols-3 gap-1.5">
              {MODELOS.map((m) => (
                <button key={m.id} type="button" onClick={() => elegirModelo(m)} className="rounded-[10px] border border-[#E7E4DC] bg-white px-1.5 py-2 text-[11.5px] font-semibold leading-tight text-[#1B1B18] hover:border-[#C2560A]">
                  {m.nombre}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Texto</span>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} maxLength={60} className="w-full px-3 py-2.5 text-[16px] text-[#1B1B18] bg-white border border-[#E7E4DC] rounded-[10px] outline-none focus:border-[#C2560A] resize-y" />
            <span className="text-[12px] text-[#6B6A63]">Enter para un segundo renglón.</span>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Tipografía {cargando && <span className="font-normal text-[#6B6A63]">(cargando...)</span>}</span>
            <div className="flex flex-wrap gap-1.5">
              {FUENTES.map((t) => (
                <Opcion key={t.id} activa={fuenteId === t.id} onClick={() => setFuenteId(t.id)} estilo={{ fontFamily: `"hl-${t.id}", sans-serif`, fontWeight: t.peso, fontSize: 15 }}>
                  {t.nombre}
                </Opcion>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Forma</span>
            <div className="flex flex-wrap gap-2">
              {FORMAS_LLAVERO.map((f) => <Opcion key={f.id} activa={forma === f.id} onClick={() => setForma(f.id)}>{f.nombre}</Opcion>)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Alto de la letra" valor={alto} cambiar={setAlto} />
            <Campo etiqueta="Espacio entre letras" valor={espaciado} cambiar={setEspaciado} />
            <Campo etiqueta="Margen" valor={margen} cambiar={setMargen} />
            {(forma === "rect" || forma === "etiqueta") && <Campo etiqueta="Esquinas" valor={radio} cambiar={setRadio} />}
            <Campo etiqueta="Agujero de la argolla (0 = sin)" valor={argolla} cambiar={setArgolla} />
          </div>

          <details className="border-t border-[#E7E4DC] pt-3">
            <summary className="text-[13px] font-semibold text-[#1B1B18] cursor-pointer">Para impresión 3D (STL)</summary>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Campo etiqueta="Grosor de la placa" valor={grosor} cambiar={setGrosor} />
              <Campo etiqueta="Relieve de las letras" valor={relieve} cambiar={setRelieve} />
            </div>
            <p className="m-0 mt-2 text-[12px] text-[#6B6A63]">Pausa la impresión al llegar al relieve para cambiar de color y que el nombre quede en otro tono.</p>
          </details>
          {error && <p className="m-0 text-[13.5px] text-[#8A1C1C]">{error}</p>}
        </section>

        <section className="flex flex-col gap-4 min-w-0">
          {r && r.errores.length > 0 && (
            <div className="bg-[#FDECEC] border border-[#F2B8B5] text-[#8A1C1C] rounded-[12px] px-4 py-3 text-[14px]">
              {r.errores.map((e) => <p key={e} className="m-0">{e}</p>)}
            </div>
          )}
          <div className="flex gap-2">
            <Opcion activa={vista === "2d"} onClick={() => setVista("2d")}>Para láser (corte y grabado)</Opcion>
            <Opcion activa={vista === "3d"} onClick={() => setVista("3d")}>Para impresión 3D</Opcion>
          </div>
          <div className={`bg-white border border-[#E7E4DC] rounded-[14px] overflow-hidden flex items-center justify-center min-h-[260px] ${listo && vista === "3d" ? "" : "p-4"}`}>
            {!listo ? (
              <span className="text-[14px] text-[#6B6A63]">{cargando ? "Cargando tipografía..." : "Escribe un texto"}</span>
            ) : vista === "3d" ? (
              <Visor3D alto="h-[380px] lg:h-[480px]"><Malla3D tris={r!.malla.tris} /></Visor3D>
            ) : (
              <div className="w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[380px]" dangerouslySetInnerHTML={{ __html: vista2d }} />
            )}
          </div>
          {listo && (
            <>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 m-0">
                {[
                  ["Tamaño", `${r1(r!.ancho)} × ${r1(r!.alto)} mm`],
                  ["Láser", "Capa CORTE + capa GRABADO"],
                  ["Impresión 3D", `${r1(numero(grosor) + numero(relieve))} mm de alto`],
                ].map(([k, v]) => (
                  <div key={k} className="bg-white border border-[#E7E4DC] rounded-[12px] px-3 py-2.5">
                    <dt className="text-[12px] text-[#6B6A63]">{k}</dt>
                    <dd className="m-0 text-[14px] font-semibold text-[#1B1B18]">{v}</dd>
                  </div>
                ))}
              </dl>
              {r!.avisos.length > 0 && (
                <ul className="m-0 pl-5 text-[13.5px] text-[#5A3A12] bg-[#FFF6E8] border border-[#F2C98F] rounded-[12px] py-3 pr-4">
                  {r!.avisos.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}
              <button
                type="button"
                onClick={() => { if (!mandarACotizador(`${archivo}.dxf`, dibujoDXF(r!.dibujo), locale)) setAviso("El archivo es muy grande para pasarlo al Cotizador. Descárgalo y súbelo ahí.") }}
                className="w-full bg-[#16794F] hover:bg-[#12623F] text-white font-semibold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h4" /></svg>
                Ver precio al instante en el Cotizador
              </button>
              <button
                type="button"
                onClick={() => {
                  const ok = vista === "3d"
                    ? mandarAFabricar(`${archivo}.stl`, mallaSTL(r!.malla), locale, { pieza: `Llavero "${texto.split("\n")[0]}"`, medidas: `${r1(r!.ancho)} × ${r1(r!.alto)} mm`, proceso: "Impresión 3D" })
                    : mandarAFabricar(`${archivo}.dxf`, dibujoDXF(r!.dibujo), locale, { pieza: `Llavero "${texto.split("\n")[0]}"`, medidas: `${r1(r!.ancho)} × ${r1(r!.alto)} mm`, proceso: "Corte láser" })
                  if (!ok) setAviso("El archivo es muy grande para mandarlo. Descárgalo y súbelo en la solicitud.")
                }}
                className="w-full bg-[#FF6A1A] hover:bg-[#E65C12] text-white font-extrabold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9H3z" /><path d="M9 20v-6h6v6" /></svg>
                Fabrícamelo: {vista === "3d" ? "que un taller lo imprima" : "que un taller lo corte"}
              </button>
              {aviso && <p className="m-0 text-[13px] text-[#8A1C1C]">{aviso}</p>}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button type="button" onClick={() => descargar(`${archivo}.dxf`, dibujoDXF(r!.dibujo), "application/dxf")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                  Descargar DXF
                </button>
                <button type="button" onClick={() => descargar(`${archivo}.svg`, dibujoSVG(r!.dibujo, "corte"), "image/svg+xml")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                  Descargar SVG
                </button>
                <button type="button" onClick={() => descargar(`${archivo}.stl`, mallaSTL(r!.malla), "model/stl")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                  Descargar STL
                </button>
                <a href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer" className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold py-3 rounded-[10px] text-[14px] text-center">
                  Pedir por WhatsApp
                </a>
              </div>
              <p className="m-0 text-[12.5px] text-[#6B6A63]">
                En el DXF y el SVG: capa CORTE (placa y agujero) y capa GRABADO (las letras, para grabar o marcar). El STL trae la placa con el agujero y las letras en relieve, en milímetros.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
