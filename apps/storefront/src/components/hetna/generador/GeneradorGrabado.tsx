"use client"

import { useEffect, useRef, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { type Difusion, type Estilo, type OpcionesGrabado, aGris, cobertura, grabar, pngConDPI } from "@/lib/generador/grabado"

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"
const LIMITE = 20 * 1024 * 1024
const MAX_PX = 25_000_000 // imagen final
const MAX_VISTA = 1_200_000 // vista previa
const DPIS = [127, 254, 318, 423, 508]
const ESTILOS: { id: Estilo; nombre: string }[] = [
  { id: "tramado", nombre: "Tramado" },
  { id: "semitono", nombre: "Semitono" },
  { id: "grises", nombre: "Escala de grises" },
  { id: "boceto", nombre: "Boceto" },
  { id: "umbral", nombre: "Blanco y negro" },
]
const DIFUSIONES: { id: Difusion; nombre: string }[] = [
  { id: "jarvis", nombre: "Jarvis" },
  { id: "stucki", nombre: "Stucki" },
  { id: "floyd", nombre: "Floyd" },
  { id: "atkinson", nombre: "Atkinson" },
]
type Ajustes = Pick<OpcionesGrabado, "brillo" | "contraste" | "gamma" | "nitidez" | "invertir" | "espejo">
const MATERIALES: { nombre: string; a: Ajustes }[] = [
  { nombre: "Madera", a: { brillo: 0, contraste: 10, gamma: 1.2, nitidez: 30, invertir: false, espejo: false } },
  { nombre: "MDF", a: { brillo: 5, contraste: 15, gamma: 1.3, nitidez: 30, invertir: false, espejo: false } },
  { nombre: "Piel", a: { brillo: 0, contraste: 5, gamma: 1.1, nitidez: 20, invertir: false, espejo: false } },
  { nombre: "Pizarra", a: { brillo: 0, contraste: 15, gamma: 1, nitidez: 30, invertir: true, espejo: false } },
  { nombre: "Anodizado", a: { brillo: 0, contraste: 10, gamma: 1, nitidez: 40, invertir: true, espejo: false } },
  { nombre: "Acrílico por detrás", a: { brillo: 0, contraste: 10, gamma: 1, nitidez: 30, invertir: true, espejo: true } },
]

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

// Foto reducida al tamaño pedido, en gris
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

function pintar(c: HTMLCanvasElement, r: Uint8Array, w: number, h: number) {
  c.width = w
  c.height = h
  const ctx = c.getContext("2d")
  if (!ctx) return
  const im = ctx.createImageData(w, h)
  for (let i = 0; i < r.length; i++) {
    im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = r[i]
    im.data[i * 4 + 3] = 255
  }
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

const Deslizador = ({ etiqueta, valor, min, max, paso = 1, cambiar }: { etiqueta: string; valor: number; min: number; max: number; paso?: number; cambiar: (v: number) => void }) => (
  <label className="flex flex-col gap-1">
    <span className="flex justify-between text-[13px] font-semibold text-[#1B1B18]">
      {etiqueta}
      <span className="font-normal text-[#6B6A63]">{valor}</span>
    </span>
    <input type="range" min={min} max={max} step={paso} value={valor} onChange={(e) => cambiar(Number(e.target.value))} className="w-full accent-[#C2560A]" />
  </label>
)

export function GeneradorGrabado() {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const lienzo = useRef<HTMLCanvasElement>(null)
  const [nombre, setNombre] = useState("")
  const [version, setVersion] = useState(0) // cambia con cada foto nueva
  const [proporcion, setProporcion] = useState(1) // alto / ancho de la foto
  const [error, setError] = useState("")
  const [ancho, setAncho] = useState("150")
  const [dpi, setDpi] = useState(254)
  const [material, setMaterial] = useState("Madera")
  const [aj, setAj] = useState<Ajustes>(MATERIALES[0].a)
  const [estilo, setEstilo] = useState<Estilo>("tramado")
  const [difusion, setDifusion] = useState<Difusion>("jarvis")
  const [celda, setCelda] = useState("0.6")
  const [umbral, setUmbral] = useState(128)
  const [procesando, setProcesando] = useState(false)
  const [preparando, setPreparando] = useState(false)
  const [info, setInfo] = useState<{ cobertura: number; reducida: boolean } | null>(null)
  const [acercar, setAcercar] = useState(false)

  const anchoMM = numero(ancho)
  const altoMM = anchoMM * proporcion
  const pxmm = dpi / 25.4
  const W = Math.max(1, Math.round(anchoMM * pxmm))
  const H = Math.max(1, Math.round(altoMM * pxmm))
  const tamOk = anchoMM > 0 && anchoMM <= 2000
  const muyGrande = W * H > MAX_PX

  const opciones = (escala: number): OpcionesGrabado => ({
    ...aj,
    estilo,
    difusion,
    semitono: Math.max(2, (numero(celda) || 0.6) * pxmm * escala),
    umbral,
  })

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

  // pegar con Ctrl+V
  useEffect(() => {
    const pegar = (e: ClipboardEvent) => {
      const it = Array.from(e.clipboardData?.items || []).find((x) => x.type.startsWith("image/"))
      if (it) abrir(it.getAsFile())
    }
    window.addEventListener("paste", pegar)
    return () => window.removeEventListener("paste", pegar)
  })

  const clave = JSON.stringify([version, W, H, aj, estilo, difusion, celda, umbral])
  useEffect(() => {
    const img = imgRef.current
    if (!img || !tamOk || muyGrande || !lienzo.current) return
    setProcesando(true)
    const t = window.setTimeout(() => {
      const k = Math.min(1, Math.sqrt(MAX_VISTA / (W * H)))
      const w = Math.max(1, Math.round(W * k))
      const h = Math.max(1, Math.round(H * k))
      const g = grisDe(img, w, h)
      if (g && lienzo.current) {
        const r = grabar(g, w, h, opciones(k))
        pintar(lienzo.current, r, w, h)
        setInfo({ cobertura: cobertura(r), reducida: k < 1 })
      }
      setProcesando(false)
    }, 200)
    return () => window.clearTimeout(t)
  }, [clave]) // eslint-disable-line react-hooks/exhaustive-deps

  const archivo = `${nombre || "foto"}-grabado-${r1(anchoMM)}x${r1(altoMM)}mm-${dpi}dpi`

  // la imagen final se calcula completa al descargar
  const final = (listo: (png: Uint8Array) => void) => {
    const img = imgRef.current
    if (!img || !tamOk || muyGrande) return
    setPreparando(true)
    window.setTimeout(() => {
      const g = grisDe(img, W, H)
      if (!g) return setPreparando(false)
      const c = document.createElement("canvas")
      pintar(c, grabar(g, W, H, opciones(1)), W, H)
      c.toBlob(async (b) => {
        if (b) listo(pngConDPI(new Uint8Array(await b.arrayBuffer()), dpi))
        setPreparando(false)
      }, "image/png")
    }, 50)
  }
  const bajarPNG = () => final((png) => bajar(`${archivo}.png`, new Blob([png.buffer as ArrayBuffer], { type: "image/png" })))
  const bajarSVG = () =>
    final((png) => {
      let s = ""
      for (let i = 0; i < png.length; i += 0x8000) s += String.fromCharCode(...png.subarray(i, i + 0x8000))
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${r1(anchoMM)}mm" height="${r1(altoMM)}mm" viewBox="0 0 ${r1(anchoMM)} ${r1(altoMM)}"><image width="${r1(anchoMM)}" height="${r1(altoMM)}" preserveAspectRatio="none" xlink:href="data:image/png;base64,${btoa(s)}"/></svg>\n`
      bajar(`${archivo}.svg`, new Blob([svg], { type: "image/svg+xml" }))
    })

  const mensaje =
    `Hola HETNA CNC, quiero cotizar el grabado láser de una foto:\n` +
    `- Tamaño: ${r1(anchoMM)} × ${r1(altoMM)} mm\n` +
    `- Material: ${material}`

  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="px-4 lg:px-16 pt-5 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/servicios" className="hover:text-[#B34D07]">Servicios</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/servicios/generador-2d-3d" className="hover:text-[#B34D07]">Generador 2D y 3D</LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">Foto para grabado láser</span>
      </div>

      <section className="px-4 lg:px-16 pt-4 pb-3">
        <span className="inline-block text-[12px] font-bold tracking-wide uppercase bg-[#E6F4EC] text-[#16794F] px-3 py-1 rounded-full">Gratis</span>
        <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]">Foto para grabado láser</h1>
        <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[720px]">
          Convierte una foto en una imagen lista para grabar en madera, MDF, piel, pizarra o acrílico, al tamaño y la resolución de tu láser. Tu foto no se sube a ningún servidor.
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

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-[#1B1B18]">Ancho del grabado</span>
              <span className="flex items-center bg-white border border-[#E7E4DC] rounded-[10px] focus-within:border-[#C2560A]">
                <input type="text" inputMode="decimal" value={ancho} onChange={(e) => setAncho(e.target.value)} className="w-full min-w-0 px-3 py-2.5 text-[16px] text-[#1B1B18] bg-transparent outline-none" />
                <span className="pr-3 text-[13px] text-[#9A978C]">mm</span>
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-[#1B1B18]">Resolución</span>
              <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))} className="px-3 py-2.5 text-[16px] text-[#1B1B18] bg-white border border-[#E7E4DC] rounded-[10px] outline-none focus:border-[#C2560A]">
                {DPIS.map((d) => <option key={d} value={d}>{d} DPI</option>)}
              </select>
            </label>
          </div>
          {!tamOk && <p className="m-0 text-[12.5px] text-[#8A1C1C]">Escribe un ancho entre 1 y 2000 mm.</p>}
          {muyGrande && <p className="m-0 text-[12.5px] text-[#8A1C1C]">Es demasiado grande para el navegador. Baja el tamaño o la resolución.</p>}

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Material</span>
            <div className="flex flex-wrap gap-2">
              {MATERIALES.map((m) => (
                <Opcion key={m.nombre} activa={material === m.nombre} onClick={() => { setMaterial(m.nombre); setAj(m.a) }}>{m.nombre}</Opcion>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Estilo</span>
            <div className="flex flex-wrap gap-2">
              {ESTILOS.map((e) => <Opcion key={e.id} activa={estilo === e.id} onClick={() => setEstilo(e.id)}>{e.nombre}</Opcion>)}
            </div>
          </div>
          {estilo === "tramado" && (
            <div className="flex flex-wrap gap-1.5">
              {DIFUSIONES.map((d) => (
                <button key={d.id} type="button" onClick={() => setDifusion(d.id)} className={`text-[12px] font-semibold border px-2.5 py-1 rounded-full ${difusion === d.id ? "bg-[#142033] text-white border-[#142033]" : "bg-[#FAF9F6] text-[#1B1B18] border-[#E7E4DC] hover:border-[#C2560A]"}`}>
                  {d.nombre}
                </button>
              ))}
            </div>
          )}
          {estilo === "semitono" && (
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-[#1B1B18]">Tamaño del punto</span>
              <span className="flex items-center bg-white border border-[#E7E4DC] rounded-[10px] focus-within:border-[#C2560A]">
                <input type="text" inputMode="decimal" value={celda} onChange={(e) => setCelda(e.target.value)} className="w-full min-w-0 px-3 py-2.5 text-[16px] text-[#1B1B18] bg-transparent outline-none" />
                <span className="pr-3 text-[13px] text-[#9A978C]">mm</span>
              </span>
            </label>
          )}
          {estilo === "umbral" && <Deslizador etiqueta="Umbral" valor={umbral} min={1} max={254} cambiar={setUmbral} />}

          <Deslizador etiqueta="Brillo" valor={aj.brillo} min={-100} max={100} cambiar={(v) => setAj({ ...aj, brillo: v })} />
          <Deslizador etiqueta="Contraste" valor={aj.contraste} min={-100} max={100} cambiar={(v) => setAj({ ...aj, contraste: v })} />
          <Deslizador etiqueta="Medios tonos (gamma)" valor={aj.gamma} min={0.3} max={3} paso={0.05} cambiar={(v) => setAj({ ...aj, gamma: v })} />
          <Deslizador etiqueta="Nitidez" valor={aj.nitidez} min={0} max={100} cambiar={(v) => setAj({ ...aj, nitidez: v })} />
          <label className="flex items-center gap-2 text-[14px] text-[#1B1B18]">
            <input type="checkbox" checked={aj.invertir} onChange={(e) => setAj({ ...aj, invertir: e.target.checked })} className="w-4 h-4 accent-[#C2560A]" />
            Invertir (el grabado sale claro)
          </label>
          <label className="flex items-center gap-2 text-[14px] text-[#1B1B18]">
            <input type="checkbox" checked={aj.espejo} onChange={(e) => setAj({ ...aj, espejo: e.target.checked })} className="w-4 h-4 accent-[#C2560A]" />
            Espejo (grabar por detrás o sellos)
          </label>
        </section>

        <section className="flex flex-col gap-4 min-w-0">
          {!nombre && (
            <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-6 text-[14.5px] text-[#6B6A63] flex flex-col gap-2">
              <p className="m-0 font-semibold text-[#1B1B18]">Para que salga bien</p>
              <ul className="m-0 pl-5 flex flex-col gap-1">
                <li>Usa una foto nítida, con buena luz y fondo sencillo.</li>
                <li>El tramado Jarvis es el más usado para madera; en pizarra y anodizado se invierte.</li>
                <li>Graba primero una prueba pequeña para ajustar potencia y velocidad.</li>
              </ul>
            </div>
          )}
          <div className={nombre ? "flex flex-col gap-4" : "hidden"}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Opcion activa={acercar} onClick={() => setAcercar(!acercar)}>{acercar ? "Ver completa" : "Acercar"}</Opcion>
              <span className="text-[13px] text-[#6B6A63]" aria-live="polite">
                {procesando ? "Procesando..." : info?.reducida ? "Vista previa reducida; el archivo sale completo" : ""}
              </span>
            </div>
            <div className={`bg-white border border-[#E7E4DC] rounded-[14px] p-3 ${acercar ? "overflow-auto max-h-[560px]" : "flex items-center justify-center"}`}>
              <canvas
                ref={lienzo}
                className={acercar ? "max-w-none [image-rendering:pixelated]" : "max-w-full max-h-[520px] h-auto"}
                style={acercar ? { width: "auto" } : undefined}
              />
            </div>
            {tamOk && (
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 m-0">
                {[
                  ["Tamaño", `${r1(anchoMM)} × ${r1(altoMM)} mm`],
                  ["Píxeles", `${W} × ${H}`],
                  ["Resolución", `${dpi} DPI`],
                  ["Se quema", info ? `${Math.round(info.cobertura * 100)}% del área` : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="bg-white border border-[#E7E4DC] rounded-[12px] px-3 py-2.5">
                    <dt className="text-[12px] text-[#6B6A63]">{k}</dt>
                    <dd className="m-0 text-[14px] font-semibold text-[#1B1B18]">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button type="button" disabled={preparando || !tamOk || muyGrande} onClick={bajarPNG} className="bg-[#142033] hover:bg-[#0F1826] disabled:opacity-50 text-white font-semibold py-3 rounded-[10px] text-[14px]">
                {preparando ? "Preparando..." : "Descargar PNG"}
              </button>
              <button type="button" disabled={preparando || !tamOk || muyGrande} onClick={bajarSVG} className="bg-[#142033] hover:bg-[#0F1826] disabled:opacity-50 text-white font-semibold py-3 rounded-[10px] text-[14px]">
                Descargar SVG
              </button>
              <a href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer" className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold py-3 rounded-[10px] text-[14px] text-center">
                Pedir el grabado
              </a>
            </div>
            <p className="m-0 text-[12.5px] text-[#6B6A63]">
              El PNG lleva guardada la resolución: LightBurn y otros programas lo abren al tamaño exacto. En el programa usa el modo «pasar» (threshold o pass-through) para que no vuelva a tramar la imagen.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
