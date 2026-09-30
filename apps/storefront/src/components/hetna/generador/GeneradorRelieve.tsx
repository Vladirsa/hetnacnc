"use client"

import { useEffect, useRef, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { aGris, pngConDPI } from "@/lib/generador/grabado"
import { type Alturas, type Forma, type OpcionesRelieve, alturas, mallaSTL, mapaAlturas, medidasPieza, vistaLuz, vistaSombra, volumen } from "@/lib/generador/relieve"

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"
const LIMITE = 20 * 1024 * 1024
const MAX_PUNTOS = 160_000 // malla de hasta ~32 MB en STL
const CALIDADES = [
  { nombre: "Rápida", paso: 0.5 },
  { nombre: "Normal", paso: 0.35 },
  { nombre: "Alta", paso: 0.25 },
]
type Modo = OpcionesRelieve["modo"]
const INICIO: Record<Modo, { min: string; max: string; marco: string; suavizado: number }> = {
  litofania: { min: "0.8", max: "3", marco: "3", suavizado: 0 },
  relieve: { min: "3", max: "10", marco: "0", suavizado: 1 },
}

const numero = (s: string) => parseFloat((s || "").replace(",", "."))
const r1 = (x: number) => Math.round(x * 10) / 10

function bajar(nombre: string, datos: Blob) {
  const url = URL.createObjectURL(datos)
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function grisDe(img: HTMLImageElement, w: number, h: number): Float32Array | null {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  const ctx = c.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, 0, 0, w, h)
  return aGris(ctx.getImageData(0, 0, w, h).data, w, h)
}

function pintar(c: HTMLCanvasElement, rgba: Uint8ClampedArray, w: number, h: number) {
  c.width = w
  c.height = h
  const ctx = c.getContext("2d")
  if (!ctx) return
  const im = ctx.createImageData(w, h)
  im.data.set(rgba)
  ctx.putImageData(im, 0, 0)
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
      {sufijo && <span className="pr-3 text-[13px] text-[#9A978C]">{sufijo}</span>}
    </span>
  </label>
)

const Deslizador = ({ etiqueta, valor, min, max, paso = 1, cambiar }: { etiqueta: string; valor: number; min: number; max: number; paso?: number; cambiar: (v: number) => void }) => (
  <label className="flex flex-col gap-1">
    <span className="flex justify-between text-[13px] font-semibold text-[#1B1B18]">
      {etiqueta}
      <span className="font-normal text-[#6B6A63]">{valor}</span>
    </span>
    <input type="range" min={min} max={max} step={paso} value={valor} onChange={(e) => cambiar(Number(e.target.value))} className="w-full accent-[#C2560A]" />
  </label>
)

export function GeneradorRelieve() {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const lienzo = useRef<HTMLCanvasElement>(null)
  const ultima = useRef<{ a: Alturas; o: OpcionesRelieve } | null>(null)
  const [nombre, setNombre] = useState("")
  const [version, setVersion] = useState(0)
  const [proporcion, setProporcion] = useState(1)
  const [error, setError] = useState("")
  const [modo, setModo] = useState<Modo>("litofania")
  const [forma, setForma] = useState<Forma>("plano")
  const [arco, setArco] = useState("120")
  const [ancho, setAncho] = useState("100")
  const [paso, setPaso] = useState(0.35)
  const [min, setMin] = useState(INICIO.litofania.min)
  const [max, setMax] = useState(INICIO.litofania.max)
  const [marco, setMarco] = useState(INICIO.litofania.marco)
  const [invertir, setInvertir] = useState(false)
  const [gamma, setGamma] = useState(1)
  const [suavizado, setSuavizado] = useState(INICIO.litofania.suavizado)
  const [vista, setVista] = useState<"luz" | "sombra">("luz")
  const [procesando, setProcesando] = useState(false)
  const [preparando, setPreparando] = useState(false)
  const [info, setInfo] = useState<{ ancho: number; alto: number; fondo: number; triangulos: number; volumen: number } | null>(null)

  const cambiarModo = (m: Modo) => {
    setModo(m)
    setMin(INICIO[m].min)
    setMax(INICIO[m].max)
    setMarco(INICIO[m].marco)
    setSuavizado(INICIO[m].suavizado)
    setVista(m === "litofania" ? "luz" : "sombra")
    if (m === "relieve") setForma("plano")
  }

  const anchoMM = numero(ancho)
  const nMin = numero(min)
  const nMax = numero(max)
  const valido = anchoMM > 0 && anchoMM <= 1500 && nMin > 0 && nMax > nMin && nMax <= 100
  // puntos de la foto; si son demasiados se abre el paso
  let w = Math.max(2, Math.round(anchoMM / paso))
  let h = Math.max(2, Math.round((anchoMM * proporcion) / paso))
  let pasoReal = paso
  if (w * h > MAX_PUNTOS) {
    const k = Math.sqrt(MAX_PUNTOS / (w * h))
    w = Math.max(2, Math.floor(w * k))
    h = Math.max(2, Math.floor(h * k))
    pasoReal = anchoMM / w
  }

  const opciones: OpcionesRelieve = {
    modo,
    forma: modo === "relieve" ? "plano" : forma,
    arco: numero(arco) || 120,
    paso: pasoReal,
    min: nMin,
    max: nMax,
    marco: Math.max(0, numero(marco) || 0),
    invertir,
    gamma,
    suavizado,
  }

  const abrir = (f?: File | null) => {
    setError("")
    if (!f) return
    if (!/^image\/(png|jpe?g|webp|gif|bmp)$/.test(f.type)) return setError("Sube una foto JPG, PNG, WebP, GIF o BMP.")
    if (f.size > LIMITE) return setError("La foto pesa más de 20 MB.")
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => {
      if (imgRef.current) URL.revokeObjectURL(imgRef.current.src)
      imgRef.current = img
      setProporcion(img.naturalHeight / img.naturalWidth)
      setNombre(f.name.replace(/\.[^.]+$/, "") || "foto")
      setVersion((v) => v + 1)
    }
    img.onerror = () => setError("No se pudo abrir la foto.")
    img.src = url
  }

  useEffect(() => {
    const pegar = (e: ClipboardEvent) => {
      const it = Array.from(e.clipboardData?.items || []).find((x) => x.type.startsWith("image/"))
      if (it) abrir(it.getAsFile())
    }
    window.addEventListener("paste", pegar)
    return () => window.removeEventListener("paste", pegar)
  })

  const clave = JSON.stringify([version, w, h, opciones, vista])
  useEffect(() => {
    const img = imgRef.current
    if (!img || !valido || !lienzo.current) return
    setProcesando(true)
    const t = window.setTimeout(() => {
      const g = grisDe(img, w, h)
      if (g && lienzo.current) {
        const a = alturas(g, w, h, opciones)
        ultima.current = { a, o: opciones }
        pintar(lienzo.current, vista === "luz" ? vistaLuz(a, opciones) : vistaSombra(a, opciones), a.nx, a.ny)
        const m = medidasPieza(a, opciones)
        const columnas = opciones.forma === "cilindro" ? a.nx : a.nx - 1
        const triangulos = 4 * columnas * (a.ny - 1) + 4 * columnas + (opciones.forma === "cilindro" ? 0 : 4 * (a.ny - 1))
        setInfo({ ...m, triangulos, volumen: volumen(a, opciones) })
      }
      setProcesando(false)
    }, 200)
    return () => window.clearTimeout(t)
  }, [clave]) // eslint-disable-line react-hooks/exhaustive-deps

  const archivo = `${nombre || "foto"}-${modo === "litofania" ? `litofania-${opciones.forma}` : "relieve"}-${r1(anchoMM)}mm`

  const bajarSTL = () => {
    const u = ultima.current
    if (!u) return
    setPreparando(true)
    window.setTimeout(() => {
      bajar(`${archivo}.stl`, new Blob([mallaSTL(u.a, u.o)], { type: "model/stl" }))
      setPreparando(false)
    }, 50)
  }
  const bajarMapa = () => {
    const u = ultima.current
    if (!u) return
    const c = document.createElement("canvas")
    pintar(c, mapaAlturas(u.a, u.o), u.a.nx, u.a.ny)
    c.toBlob(async (b) => {
      if (!b) return
      const png = pngConDPI(new Uint8Array(await b.arrayBuffer()), 25.4 / u.o.paso)
      bajar(`${archivo}-alturas.png`, new Blob([png.buffer as ArrayBuffer], { type: "image/png" }))
    }, "image/png")
  }

  const gramos = info ? (info.volumen / 1000) * 1.24 : 0
  const mensaje =
    `Hola HETNA CNC, quiero ${modo === "litofania" ? "una litofanía impresa en 3D" : "un relieve maquinado en router"}:\n` +
    (info ? `- Medidas: ${r1(info.ancho)} × ${r1(info.alto)} × ${r1(info.fondo)} mm\n` : "") +
    (modo === "litofania" ? `- Forma: ${opciones.forma === "plano" ? "plana" : opciones.forma === "curvo" ? "curva" : "cilindro (lámpara)"}` : `- Profundidad: ${r1(nMax - nMin)} mm sobre base de ${r1(nMin)} mm`)

  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="px-4 lg:px-16 pt-5 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/servicios" className="hover:text-[#B34D07]">Servicios</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/servicios/generador-2d-3d" className="hover:text-[#B34D07]">Generador 2D y 3D</LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">Litofanías y relieves 3D</span>
      </div>

      <section className="px-4 lg:px-16 pt-4 pb-3">
        <span className="inline-block text-[12px] font-bold tracking-wide uppercase bg-[#E6F4EC] text-[#16794F] px-3 py-1 rounded-full">Gratis</span>
        <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]">Litofanías y relieves 3D desde una foto</h1>
        <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[720px]">
          Convierte una foto en un STL: litofanía plana, curva o en cilindro para lámpara, o un relieve para tallar en router. Tu foto no se sube a ningún servidor.
        </p>
      </section>

      <div className="px-4 lg:px-16 pb-12 grid lg:grid-cols-[380px_1fr] gap-5 items-start">
        <section className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5 flex flex-col gap-4">
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); abrir(e.dataTransfer.files?.[0]) }}
            className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-[#E7E4DC] rounded-[12px] cursor-pointer hover:border-[#C2560A] hover:bg-[#FFF8F1] text-center"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#C2560A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 16l5-5 4 4 3-3 6 6M15.5 9h.01" />
            </svg>
            <span className="text-[14px] font-semibold text-[#1B1B18]">{nombre ? `${nombre} (cambiar)` : "Sube tu foto"}</span>
            <span className="text-[12px] text-[#6B6A63]">JPG, PNG o WebP · hasta 20 MB · también con Ctrl+V</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" className="hidden" onChange={(e) => abrir(e.target.files?.[0])} />
          </label>
          {error && <p className="m-0 text-[13.5px] text-[#8A1C1C]">{error}</p>}

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Qué quieres hacer</span>
            <div className="flex flex-wrap gap-2">
              <Opcion activa={modo === "litofania"} onClick={() => cambiarModo("litofania")}>Litofanía (impresión 3D)</Opcion>
              <Opcion activa={modo === "relieve"} onClick={() => cambiarModo("relieve")}>Relieve para router</Opcion>
            </div>
          </div>
          {modo === "litofania" && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-[#1B1B18]">Forma</span>
              <div className="flex flex-wrap gap-2">
                <Opcion activa={forma === "plano"} onClick={() => setForma("plano")}>Plana</Opcion>
                <Opcion activa={forma === "curvo"} onClick={() => setForma("curvo")}>Curva</Opcion>
                <Opcion activa={forma === "cilindro"} onClick={() => setForma("cilindro")}>Cilindro (lámpara)</Opcion>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta={forma === "cilindro" && modo === "litofania" ? "Ancho desarrollado" : "Ancho de la foto"} valor={ancho} cambiar={setAncho} />
            {modo === "litofania" && forma === "curvo" ? <Campo etiqueta="Curvatura" valor={arco} cambiar={setArco} sufijo="°" /> : <Campo etiqueta="Marco" valor={marco} cambiar={setMarco} />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta={modo === "litofania" ? "Espesor mínimo" : "Base"} valor={min} cambiar={setMin} />
            <Campo etiqueta={modo === "litofania" ? "Espesor máximo" : "Alto máximo"} valor={max} cambiar={setMax} />
          </div>
          {modo === "litofania" && forma === "curvo" && <Campo etiqueta="Marco" valor={marco} cambiar={setMarco} />}
          {!valido && <p className="m-0 text-[12.5px] text-[#8A1C1C]">Revisa las medidas: el máximo debe ser mayor que el mínimo.</p>}

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Detalle de la malla</span>
            <div className="flex flex-wrap gap-2">
              {CALIDADES.map((c) => <Opcion key={c.nombre} activa={paso === c.paso} onClick={() => setPaso(c.paso)}>{c.nombre} ({c.paso} mm)</Opcion>)}
            </div>
            {pasoReal > paso + 1e-9 && <span className="text-[12.5px] text-[#6B6A63]">Para no hacer un archivo gigante se usa un punto cada {Math.round(pasoReal * 100) / 100} mm.</span>}
          </div>

          <Deslizador etiqueta="Tonos (gamma)" valor={gamma} min={0.3} max={3} paso={0.05} cambiar={setGamma} />
          <Deslizador etiqueta="Suavizado" valor={suavizado} min={0} max={4} cambiar={setSuavizado} />
          <label className="flex items-center gap-2 text-[14px] text-[#1B1B18]">
            <input type="checkbox" checked={invertir} onChange={(e) => setInvertir(e.target.checked)} className="w-4 h-4 accent-[#C2560A]" />
            {modo === "litofania" ? "Invertir (lo claro sale grueso)" : "Invertir (lo oscuro sale alto)"}
          </label>
        </section>

        <section className="flex flex-col gap-4 min-w-0">
          {!nombre && (
            <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-6 text-[14.5px] text-[#6B6A63] flex flex-col gap-2">
              <p className="m-0 font-semibold text-[#1B1B18]">Para que salga bien</p>
              <ul className="m-0 pl-5 flex flex-col gap-1">
                <li>Litofanía: imprime en PLA blanco, relleno 100% y de pie (vertical).</li>
                <li>Las fotos con buen contraste y caras de cerca se ven mejor a contraluz.</li>
                <li>Relieve: en VCarve o Aspire importa el STL como modelo 3D, o el mapa de alturas como imagen.</li>
              </ul>
            </div>
          )}
          <div className={nombre ? "flex flex-col gap-4" : "hidden"}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-2">
                <Opcion activa={vista === "luz"} onClick={() => setVista("luz")}>Con luz atrás</Opcion>
                <Opcion activa={vista === "sombra"} onClick={() => setVista("sombra")}>Relieve</Opcion>
              </div>
              <span className="text-[13px] text-[#6B6A63]" aria-live="polite">{procesando ? "Calculando..." : ""}</span>
            </div>
            <div className="bg-[#2A2622] border border-[#E7E4DC] rounded-[14px] p-3 flex items-center justify-center">
              <canvas ref={lienzo} className="max-w-full max-h-[520px] h-auto" />
            </div>
            {info && valido && (
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 m-0">
                {[
                  ["Medidas", `${r1(info.ancho)} × ${r1(info.alto)} × ${r1(info.fondo)} mm`],
                  ["Triángulos", info.triangulos.toLocaleString("es-MX")],
                  ["Archivo STL", `${r1((84 + 50 * info.triangulos) / 1e6)} MB`],
                  [modo === "litofania" ? "Material (PLA)" : "Volumen", modo === "litofania" ? `${Math.round(gramos)} g aprox.` : `${r1(info.volumen / 1000)} cm³`],
                ].map(([k, v]) => (
                  <div key={k} className="bg-white border border-[#E7E4DC] rounded-[12px] px-3 py-2.5">
                    <dt className="text-[12px] text-[#6B6A63]">{k}</dt>
                    <dd className="m-0 text-[14px] font-semibold text-[#1B1B18]">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className={`grid grid-cols-1 gap-2 ${modo === "relieve" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
              <button type="button" disabled={preparando || !valido || !info} onClick={bajarSTL} className="bg-[#142033] hover:bg-[#0F1826] disabled:opacity-50 text-white font-semibold py-3 rounded-[10px] text-[14px]">
                {preparando ? "Preparando..." : "Descargar STL"}
              </button>
              {modo === "relieve" && (
                <button type="button" disabled={!valido || !info} onClick={bajarMapa} className="bg-[#142033] hover:bg-[#0F1826] disabled:opacity-50 text-white font-semibold py-3 rounded-[10px] text-[14px]">
                  Mapa de alturas (PNG)
                </button>
              )}
              <a href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer" className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold py-3 rounded-[10px] text-[14px] text-center">
                {modo === "litofania" ? "Pedirla impresa" : "Pedirlo maquinado"}
              </a>
            </div>
            <p className="m-0 text-[12.5px] text-[#6B6A63]">
              {modo === "litofania"
                ? "El STL es una pieza cerrada en mm, lista para tu programa de impresión (Cura, PrusaSlicer, Bambu Studio)."
                : "El STL es una pieza cerrada en mm. El mapa de alturas lleva guardada su escala: blanco es lo más alto."}
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
