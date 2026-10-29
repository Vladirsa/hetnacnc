"use client"

// Pasa por ImagenSegura: estas direcciones vienen de la base o del navegador,
// y next/image TRUENA con las que no empiezan en "/" o "https://" (una vista
// previa "blob:", por ejemplo).
import { ImagenSegura as Image } from '@/components/hetna/ImagenSegura'

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { mandarACotizador } from "@/lib/generador/aCotizador"
import {
  Imagen,
  OpcionesVector,
  Vector,
  caja,
  contar,
  gris,
  orillaOscura,
  umbralAutomatico,
  vectorDXF,
  vectorSVG,
  vectorizar,
  vistaSVG,
} from "@/lib/generador/trazado"

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"
const LIMITE = 20 * 1024 * 1024
const RESOLUCION = { normal: 900, alta: 1600 }
const DETALLE = { alto: 0.6, medio: 1, bajo: 2 }
const MANCHAS = { nada: 0, poco: 6, medio: 30, mucho: 150 }
type Resolucion = keyof typeof RESOLUCION
type Detalle = keyof typeof DETALLE
type Manchas = keyof typeof MANCHAS

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
    className={`px-3 py-2 rounded-[8px] text-[13px] font-semibold border ${
      activa ? "bg-[#142033] text-white border-[#142033]" : "bg-white text-[#1B1B18] border-[#E7E4DC] hover:border-[#C2560A]"
    }`}
  >
    {children}
  </button>
)

const Grupo = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-2">
    <span className="text-[13px] font-semibold text-[#1B1B18]">{titulo}</span>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
)

// Dibuja la imagen reducida y devuelve sus píxeles
function pixeles(img: HTMLImageElement, lado: number): Imagen | null {
  const s = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * s))
  const h = Math.max(1, Math.round(img.naturalHeight * s))
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  const ctx = c.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h)
  return { data: d.data, width: w, height: h }
}

export function GeneradorVectorizador() {
  const { locale } = useParams<{ locale: string }>()
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [nombre, setNombre] = useState("")
  const [original, setOriginal] = useState("")
  const [imagen, setImagen] = useState<Imagen | null>(null)
  const [error, setError] = useState("")
  const [resolucion, setResolucion] = useState<Resolucion>("normal")
  const [modo, setModo] = useState<OpcionesVector["modo"]>("silueta")
  const [umbral, setUmbral] = useState(128)
  const [invertir, setInvertir] = useState(false)
  const [colores, setColores] = useState(3)
  const [quitarFondo, setQuitarFondo] = useState(true)
  const [detalle, setDetalle] = useState<Detalle>("medio")
  const [manchas, setManchas] = useState<Manchas>("poco")
  const [suave, setSuave] = useState(true)
  const [ruido, setRuido] = useState(false)
  const [ancho, setAncho] = useState("200")
  const [vista, setVista] = useState<"vector" | "original">("vector")
  const [res, setRes] = useState<Vector | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [aviso, setAviso] = useState("")

  // umbral e inversión sugeridos para la imagen actual
  const sugerir = (im: Imagen) => {
    const g = gris(im)
    const u = umbralAutomatico(g)
    setUmbral(u)
    setInvertir(orillaOscura(g, im.width, im.height, u) > 0.5)
  }

  const abrir = (f?: File | null) => {
    setError("")
    setAviso("")
    if (!f) return
    if (!/^image\/(png|jpe?g|webp|gif|bmp)$/.test(f.type)) return setError("Sube una imagen JPG, PNG, WebP, GIF o BMP.")
    if (f.size > LIMITE) return setError("La imagen pesa más de 20 MB.")
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const im = pixeles(img, RESOLUCION[resolucion])
      if (!im) return setError("Tu navegador no pudo leer la imagen.")
      if (original) URL.revokeObjectURL(original)
      setOriginal(url)
      setNombre(f.name.replace(/\.[^.]+$/, "") || "imagen")
      setImagen(im)
      sugerir(im)
      setVista("vector")
    }
    img.onerror = () => setError("No se pudo abrir la imagen.")
    img.src = url
  }

  // pegar una imagen con Ctrl+V
  useEffect(() => {
    const pegar = (e: ClipboardEvent) => {
      const it = Array.from(e.clipboardData?.items || []).find((x) => x.type.startsWith("image/"))
      if (it) abrir(it.getAsFile())
    }
    window.addEventListener("paste", pegar)
    return () => window.removeEventListener("paste", pegar)
  })

  // al cambiar la resolución se vuelve a leer la imagen
  useEffect(() => {
    if (!imgRef.current) return
    const im = pixeles(imgRef.current, RESOLUCION[resolucion])
    if (im) setImagen(im)
  }, [resolucion])

  const opciones: OpcionesVector = {
    modo, umbral, invertir, colores, quitarFondo,
    tolerancia: DETALLE[detalle],
    manchas: MANCHAS[manchas] * (imagen ? Math.max(imagen.width, imagen.height) / 900 : 1) ** 2,
    suave, ruido,
  }
  const clave = JSON.stringify(opciones)

  useEffect(() => {
    if (!imagen) return
    setProcesando(true)
    const t = window.setTimeout(() => {
      try {
        setRes(vectorizar(imagen, opciones))
      } catch (e) {
        console.error("[vectorizador]", e)
        setError("No se pudo vectorizar esta imagen. Prueba con menos detalle.")
      }
      setProcesando(false)
    }, 150)
    return () => window.clearTimeout(t)
  }, [imagen, clave]) // eslint-disable-line react-hooks/exhaustive-deps

  const vistaHTML = useMemo(() => (res ? vistaSVG(res) : ""), [res])
  const b = res ? caja(res) : null
  const cuenta = res ? contar(res) : { contornos: 0, nodos: 0 }
  const anchoMM = numero(ancho)
  const anchoOk = anchoMM > 0 && anchoMM <= 5000
  const altoMM = b && b.ancho ? (b.alto * anchoMM) / b.ancho : 0
  const listo = !!res && cuenta.contornos > 0 && anchoOk
  const archivo = `${nombre}-vector-${r1(anchoMM)}mm`
  const mensaje =
    `Hola HETNA CNC, quiero cotizar el corte o grabado de un diseño vectorizado:\n` +
    `- Tamaño: ${r1(anchoMM)} × ${r1(altoMM)} mm\n` +
    `- ${cuenta.contornos} contornos${res && res.capas.length > 1 ? `, ${res.capas.length} colores` : ""}`

  return (
    <div className="w-full bg-[#FAF9F6]">
      <section className="px-4 lg:px-8 pt-4 pb-3">
        <span className="inline-block text-[12px] font-bold tracking-wide uppercase bg-[#E6F4EC] text-[#16794F] px-3 py-1 rounded-full">Gratis</span>
        <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]">Vectorizador de imágenes para CNC</h1>
        <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[720px]">
          Convierte un logotipo, un dibujo o una foto en contornos cerrados listos para láser, router o plasma. Tu imagen no se sube a ningún servidor: todo se hace en tu navegador.
        </p>
      </section>

      <div className="px-4 lg:px-8 pb-12 grid lg:grid-cols-[380px_1fr] gap-5 items-start">
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
            <span className="text-[14px] font-semibold text-[#1B1B18]">{nombre ? `${nombre} (cambiar)` : "Sube tu imagen"}</span>
            <span className="text-[12px] text-[#6B6A63]">JPG, PNG o WebP · hasta 20 MB · también puedes pegarla con Ctrl+V</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" className="hidden" onChange={(e) => abrir(e.target.files?.[0])} />
          </label>
          {error && <p className="m-0 text-[13.5px] text-[#8A1C1C]">{error}</p>}

          {imagen && (
            <>
              <Grupo titulo="Tipo de imagen">
                <Opcion activa={modo === "silueta"} onClick={() => setModo("silueta")}>Un color (corte)</Opcion>
                <Opcion activa={modo === "colores"} onClick={() => setModo("colores")}>Varios colores</Opcion>
              </Grupo>

              {modo === "silueta" ? (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="flex justify-between text-[13px] font-semibold text-[#1B1B18]">
                      Umbral (qué tan oscuro cuenta como dibujo)
                      <button type="button" onClick={() => imagen && sugerir(imagen)} className="text-[12px] font-semibold text-[#B34D07] underline underline-offset-2">
                        Automático
                      </button>
                    </span>
                    <input type="range" min={1} max={254} value={umbral} onChange={(e) => setUmbral(Number(e.target.value))} className="w-full accent-[#C2560A]" />
                  </label>
                  <label className="flex items-center gap-2 text-[14px] text-[#1B1B18]">
                    <input type="checkbox" checked={invertir} onChange={(e) => setInvertir(e.target.checked)} className="w-4 h-4 accent-[#C2560A]" />
                    Invertir (dibujo claro sobre fondo oscuro)
                  </label>
                  <label className="flex items-center gap-2 text-[14px] text-[#1B1B18]">
                    <input type="checkbox" checked={ruido} onChange={(e) => setRuido(e.target.checked)} className="w-4 h-4 accent-[#C2560A]" />
                    Es una foto con grano (quitar ruido)
                  </label>
                </>
              ) : (
                <>
                  <Grupo titulo="Número de colores">
                    {[2, 3, 4, 5, 6].map((n) => <Opcion key={n} activa={colores === n} onClick={() => setColores(n)}>{n}</Opcion>)}
                  </Grupo>
                  <label className="flex items-center gap-2 text-[14px] text-[#1B1B18]">
                    <input type="checkbox" checked={quitarFondo} onChange={(e) => setQuitarFondo(e.target.checked)} className="w-4 h-4 accent-[#C2560A]" />
                    Quitar el fondo
                  </label>
                </>
              )}

              <Grupo titulo="Detalle">
                <Opcion activa={detalle === "alto"} onClick={() => setDetalle("alto")}>Alto</Opcion>
                <Opcion activa={detalle === "medio"} onClick={() => setDetalle("medio")}>Medio</Opcion>
                <Opcion activa={detalle === "bajo"} onClick={() => setDetalle("bajo")}>Bajo</Opcion>
              </Grupo>
              <Grupo titulo="Limpiar manchas">
                <Opcion activa={manchas === "nada"} onClick={() => setManchas("nada")}>Nada</Opcion>
                <Opcion activa={manchas === "poco"} onClick={() => setManchas("poco")}>Poco</Opcion>
                <Opcion activa={manchas === "medio"} onClick={() => setManchas("medio")}>Medio</Opcion>
                <Opcion activa={manchas === "mucho"} onClick={() => setManchas("mucho")}>Mucho</Opcion>
              </Grupo>
              <Grupo titulo="Líneas">
                <Opcion activa={suave} onClick={() => setSuave(true)}>Curvas suaves</Opcion>
                <Opcion activa={!suave} onClick={() => setSuave(false)}>Solo rectas</Opcion>
              </Grupo>
              <Grupo titulo="Resolución">
                <Opcion activa={resolucion === "normal"} onClick={() => setResolucion("normal")}>Normal (rápida)</Opcion>
                <Opcion activa={resolucion === "alta"} onClick={() => setResolucion("alta")}>Alta</Opcion>
              </Grupo>

              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-[#1B1B18]">Ancho final del dibujo</span>
                <span className="flex items-center bg-white border border-[#E7E4DC] rounded-[10px] focus-within:border-[#C2560A]">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={ancho}
                    onChange={(e) => setAncho(e.target.value)}
                    className="w-full min-w-0 px-3 py-2.5 text-[16px] text-[#1B1B18] bg-transparent outline-none"
                  />
                  <span className="pr-3 text-[13px] text-[#9A978C]">mm</span>
                </span>
                {!anchoOk && <span className="text-[12.5px] text-[#8A1C1C]">Escribe un ancho entre 1 y 5000 mm.</span>}
              </label>
            </>
          )}
        </section>

        <section className="flex flex-col gap-4 min-w-0">
          {!imagen && (
            <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-6 text-[14.5px] text-[#6B6A63] flex flex-col gap-2">
              <p className="m-0 font-semibold text-[#1B1B18]">Cómo sacar un buen vector</p>
              <ul className="m-0 pl-5 flex flex-col gap-1">
                <li>Logotipos y dibujos con fondo liso salen casi perfectos.</li>
                <li>Para cortar una silueta usa «Un color»; para grabar un logo de varios colores usa «Varios colores».</li>
                <li>En fotos, sube el contraste antes y marca «Es una foto con grano».</li>
              </ul>
            </div>
          )}

          {imagen && (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex gap-2">
                  <Opcion activa={vista === "vector"} onClick={() => setVista("vector")}>Vector</Opcion>
                  <Opcion activa={vista === "original"} onClick={() => setVista("original")}>Original</Opcion>
                </div>
                <span className="text-[13px] text-[#6B6A63]" aria-live="polite">{procesando ? "Vectorizando..." : ""}</span>
              </div>
              <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-3 flex items-center justify-center min-h-[240px]">
                {vista === "original" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <Image src={original} alt="Imagen original" className="max-w-full max-h-[520px] h-auto" width={300} height={300} />
                ) : (
                  <div className={`w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[520px] ${procesando ? "opacity-60" : ""}`} dangerouslySetInnerHTML={{ __html: vistaHTML }} />
                )}
              </div>

              {res && (
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 m-0">
                  {[
                    ["Tamaño final", anchoOk ? `${r1(anchoMM)} × ${r1(altoMM)} mm` : "—"],
                    ["Contornos", String(cuenta.contornos)],
                    ["Nodos", String(cuenta.nodos)],
                    ["Colores", String(res.capas.length)],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-white border border-[#E7E4DC] rounded-[12px] px-3 py-2.5">
                      <dt className="text-[12px] text-[#6B6A63]">{k}</dt>
                      <dd className="m-0 text-[14px] font-semibold text-[#1B1B18]">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {res && res.capas.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {res.capas.map((c) => (
                    <span key={c.nombre} className="inline-flex items-center gap-1.5 text-[12.5px] text-[#1B1B18] bg-white border border-[#E7E4DC] rounded-full px-2.5 py-1">
                      <span className="w-3.5 h-3.5 rounded-full border border-[#E7E4DC]" style={{ background: c.color }} />
                      {c.nombre}
                    </span>
                  ))}
                </div>
              )}
              {res && res.avisos.length > 0 && (
                <ul className="m-0 pl-5 text-[13.5px] text-[#5A3A12] bg-[#FFF6E8] border border-[#F2C98F] rounded-[12px] py-3 pr-4">
                  {res.avisos.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}

              {listo && res && (
                <>
                  <button
                    type="button"
                    onClick={() => { if (!mandarACotizador(`${archivo}.dxf`, vectorDXF(res, anchoMM), locale)) setAviso("El archivo es muy grande para pasarlo al Cotizador. Descárgalo y súbelo ahí.") }}
                    className="w-full bg-[#16794F] hover:bg-[#12623F] text-white font-semibold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h4" /></svg>
                    Ver precio al instante en el Cotizador
                  </button>
                  {aviso && <p className="m-0 text-[13px] text-[#8A1C1C]">{aviso}</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button type="button" onClick={() => descargar(`${archivo}.dxf`, vectorDXF(res, anchoMM), "application/dxf")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                      Descargar DXF
                    </button>
                    <button type="button" onClick={() => descargar(`${archivo}.svg`, vectorSVG(res, anchoMM), "image/svg+xml")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                      Descargar SVG
                    </button>
                    <a href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer" className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold py-3 rounded-[10px] text-[14px] text-center">
                      Pedir por WhatsApp
                    </a>
                  </div>
                  <p className="m-0 text-[12.5px] text-[#6B6A63]">
                    DXF: contornos cerrados en mm, una capa por color. SVG: relleno por color para grabar y línea roja de 0.1 mm para cortar.
                  </p>
                </>
              )}

              <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="m-0 text-[14px] text-[#1B1B18]">
                  <strong>¿No quedó como querías?</strong> Lo vectorizamos a mano, con contornos limpios y listos para cortar.
                </p>
                <LocalizedClientLink href="/servicios/generador-2d-3d/vectorizacion" className="shrink-0 text-center bg-white border border-[#142033] text-[#142033] font-semibold px-4 py-2.5 rounded-[10px] text-[14px]">
                  Vectorización profesional
                </LocalizedClientLink>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
