"use client"

// Pasa por ImagenSegura: estas direcciones vienen de la base o del navegador,
// y next/image TRUENA con las que no empiezan en "/" o "https://" (una vista
// previa "blob:", por ejemplo).
import { ImagenSegura as Image } from '@/components/hetna/ImagenSegura'

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import {
  Aviso,
  Boton,
  CampoNum,
  Destacado,
  Interruptor,
  Opciones,
  Seccion,
  TarjetaExport,
  descargar,
  numero,
  r1,
} from "@/components/hetna/estudio3d/Controles"
import { mandarACotizador, mandarAFabricar } from "@/lib/generador/aCotizador"
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
  const [vista, setVista] = useState<"comparar" | "vector" | "original" | "exportar">("comparar")
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
    const img = new window.Image()
    img.onload = () => {
      imgRef.current = img
      const im = pixeles(img, RESOLUCION[resolucion])
      if (!im) return setError("Tu navegador no pudo leer la imagen.")
      if (original) URL.revokeObjectURL(original)
      setOriginal(url)
      setNombre(f.name.replace(/\.[^.]+$/, "") || "imagen")
      setImagen(im)
      sugerir(im)
      setVista("comparar")
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

  const opcionesPanel = imagen && (
    <>
      <Seccion titulo="Tipo de imagen">
        <Opciones
          opciones={[
            { id: "silueta", nombre: "Un color (corte)" },
            { id: "colores", nombre: "Varios colores" },
          ]}
          valor={modo}
          cambiar={(m) => setModo(m as OpcionesVector["modo"])}
        />
      </Seccion>

      {modo === "silueta" ? (
        <Destacado titulo="Umbral: qué tan oscuro cuenta como dibujo">
          <input type="range" min={1} max={254} value={umbral} onChange={(e) => setUmbral(Number(e.target.value))} className="w-full accent-[#C2560A]" />
          <button type="button" onClick={() => imagen && sugerir(imagen)} className="self-start text-[12px] font-semibold text-[#F2A15E] underline underline-offset-2">
            Calcular automático
          </button>
          <Interruptor etiqueta="Invertir (dibujo claro sobre fondo oscuro)" activo={invertir} cambiar={setInvertir} />
          <Interruptor etiqueta="Es una foto con grano (quitar ruido)" activo={ruido} cambiar={setRuido} />
        </Destacado>
      ) : (
        <Destacado titulo="Colores">
          <Opciones opciones={[2, 3, 4, 5, 6].map((n) => ({ id: String(n), nombre: String(n) }))} valor={String(colores)} cambiar={(n) => setColores(Number(n))} />
          <Interruptor etiqueta="Quitar el fondo" activo={quitarFondo} cambiar={setQuitarFondo} />
        </Destacado>
      )}

      <Seccion titulo="Detalle">
        <Opciones
          opciones={[
            { id: "alto", nombre: "Alto" },
            { id: "medio", nombre: "Medio" },
            { id: "bajo", nombre: "Bajo" },
          ]}
          valor={detalle}
          cambiar={(d) => setDetalle(d as Detalle)}
        />
      </Seccion>
      <Seccion titulo="Limpiar manchas">
        <Opciones
          opciones={[
            { id: "nada", nombre: "Nada" },
            { id: "poco", nombre: "Poco" },
            { id: "medio", nombre: "Medio" },
            { id: "mucho", nombre: "Mucho" },
          ]}
          valor={manchas}
          cambiar={(m) => setManchas(m as Manchas)}
        />
      </Seccion>
      <div className="grid grid-cols-2 gap-3">
        <Seccion titulo="Líneas">
          <Opciones
            opciones={[
              { id: "s", nombre: "Curvas" },
              { id: "r", nombre: "Rectas" },
            ]}
            valor={suave ? "s" : "r"}
            cambiar={(v) => setSuave(v === "s")}
          />
        </Seccion>
        <Seccion titulo="Resolución">
          <Opciones
            opciones={[
              { id: "normal", nombre: "Normal" },
              { id: "alta", nombre: "Alta" },
            ]}
            valor={resolucion}
            cambiar={(v) => setResolucion(v as Resolucion)}
          />
        </Seccion>
      </div>

      <Destacado titulo="Tamaño final">
        <CampoNum etiqueta="Ancho del dibujo" valor={ancho} cambiar={setAncho} />
        {anchoOk ? (
          <span className="text-[12px] text-[#F2D29B]">
            Quedará de {r1(anchoMM)} × {r1(altoMM)} mm
          </span>
        ) : (
          <span className="text-[12px] text-[#F6B8AE]">Escribe un ancho entre 1 y 5000 mm.</span>
        )}
      </Destacado>
    </>
  )

  const hoja = (contenido: React.ReactNode, etiqueta: string) => (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <span className="text-[12px] font-bold uppercase tracking-wide text-[#8A97AB]">{etiqueta}</span>
      <div
        className="flex min-h-[260px] flex-1 items-center justify-center overflow-hidden rounded-[12px] p-4 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]"
        style={{
          backgroundColor: "#FFFFFF",
          backgroundImage: "linear-gradient(45deg,#F1F1F1 25%,transparent 25%),linear-gradient(-45deg,#F1F1F1 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#F1F1F1 75%),linear-gradient(-45deg,transparent 75%,#F1F1F1 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
        }}
      >
        {contenido}
      </div>
    </div>
  )

  const vectorDibujo = (
    <div
      className={`w-full [&>svg]:h-auto [&>svg]:max-h-[62vh] [&>svg]:w-full ${procesando ? "opacity-50" : ""}`}
      dangerouslySetInnerHTML={{ __html: vistaHTML }}
    />
  )
  const originalDibujo = original ? (
    // eslint-disable-next-line @next/next/no-img-element
    <Image src={original} alt="Imagen original" className="h-auto max-h-[62vh] max-w-full" width={300} height={300} />
  ) : null

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-[#0D1015] text-white lg:flex-row">
      {/* Panel */}
      <aside className="flex w-full flex-col gap-4 border-b border-[#1F2937] bg-[#111722] p-4 lg:sticky lg:top-14 lg:max-h-[calc(100dvh-3.5rem)] lg:w-[320px] lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-[#C2560A]/20 text-[#F28A3C]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 20c4-1 6-5 7-9M20 4c-6 1-9 5-9 7" />
              <circle cx="4" cy="20" r="2" />
              <circle cx="20" cy="4" r="2" />
            </svg>
          </span>
          <div>
            <h1 className="m-0 text-[16px] font-bold">
              Vectorizador <span className="text-[#F28A3C]">2D</span>
            </h1>
            <p className="m-0 text-[12px] text-[#8A97AB]">Imagen a DXF y SVG para CNC</p>
          </div>
        </div>

        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            abrir(e.dataTransfer.files?.[0])
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[12px] border-2 border-dashed border-[#2B3648] p-4 text-center hover:border-[#C2560A] hover:bg-[#C2560A]/5"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#F28A3C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 16l5-5 4 4 3-3 6 6M15.5 9h.01" />
          </svg>
          <span className="text-[14px] font-semibold">{nombre ? `${nombre} (cambiar)` : "Sube tu imagen"}</span>
          <span className="text-[11.5px] text-[#8A97AB]">JPG, PNG o WebP · hasta 20 MB · o pégala con Ctrl+V</span>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" className="hidden" onChange={(e) => abrir(e.target.files?.[0])} />
        </label>
        {error && <Aviso tipo="error">{error}</Aviso>}
        {opcionesPanel}
        <p className="m-0 mt-auto text-[11.5px] text-[#5B6880]">Tu imagen no se sube a ningún servidor: todo se hace en tu navegador.</p>
      </aside>

      {/* Zona principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2937] bg-[#0F151E] px-3 py-2.5">
          <div className="flex gap-1">
            {(
              [
                ["comparar", "Comparar"],
                ["vector", "Vector"],
                ["original", "Original"],
                ["exportar", "Exportación"],
              ] as const
            ).map(([id, t]) => (
              <button
                key={id}
                type="button"
                onClick={() => setVista(id)}
                aria-pressed={vista === id}
                className={`rounded-[8px] px-3.5 py-2 text-[13.5px] font-semibold ${
                  vista === id ? "bg-[#C2560A]/20 text-[#F28A3C] ring-1 ring-[#C2560A]/50" : "text-[#C9D2E0] hover:bg-[#1C2431]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <span className="text-[12.5px] text-[#8A97AB]" aria-live="polite">
            {procesando ? "Vectorizando…" : res ? `${cuenta.contornos} contornos · ${cuenta.nodos} nodos · ${res.capas.length} ${res.capas.length === 1 ? "color" : "colores"}` : ""}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-4">
          {!imagen ? (
            <div className="m-auto flex max-w-[560px] flex-col items-center gap-4 py-10 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-[16px] bg-[#C2560A]/15 text-[#F28A3C]">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 20c4-1 6-5 7-9M20 4c-6 1-9 5-9 7" />
                  <circle cx="4" cy="20" r="2" />
                  <circle cx="20" cy="4" r="2" />
                  <circle cx="11" cy="11" r="2" />
                </svg>
              </span>
              <h2 className="m-0 text-[22px] font-bold">Convierte tu logo o dibujo en vector</h2>
              <p className="m-0 text-[14.5px] leading-relaxed text-[#C9D2E0]">
                Sube una imagen y en segundos tienes contornos cerrados en DXF o SVG, listos para láser, router o plasma.
              </p>
              <ul className="m-0 flex flex-col gap-1.5 p-0 text-left text-[13.5px] text-[#8A97AB]">
                <li>• Logotipos y dibujos con fondo liso salen casi perfectos.</li>
                <li>• Para cortar una silueta usa «Un color»; para grabar un logo de varios colores, «Varios colores».</li>
                <li>• En fotos, sube el contraste antes y marca «Es una foto con grano».</li>
              </ul>
            </div>
          ) : vista === "exportar" ? (
            listo && res ? (
              <div className="flex max-w-[760px] flex-col gap-4">
                <div>
                  <h3 className="m-0 text-[18px] font-bold">Archivos</h3>
                  <p className="m-0 mt-1 text-[13px] text-[#8A97AB]">
                    DXF: contornos cerrados en mm, una capa por color. SVG: relleno por color para grabar y línea roja de 0.1 mm para cortar.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TarjetaExport titulo="Para tu máquina" nota={`${r1(anchoMM)} × ${r1(altoMM)} mm`}>
                    <div className="flex gap-2">
                      <Boton tipo="primario" onClick={() => descargar(`${archivo}.dxf`, vectorDXF(res, anchoMM), "application/dxf")}>
                        DXF
                      </Boton>
                      <Boton onClick={() => descargar(`${archivo}.svg`, vectorSVG(res, anchoMM), "image/svg+xml")}>SVG</Boton>
                    </div>
                  </TarjetaExport>
                  <TarjetaExport titulo="¿Cuánto cuesta cortarlo?" nota="Precio al instante o por WhatsApp.">
                    <div className="flex gap-2">
                      <Boton
                        tipo="verde"
                        onClick={() => {
                          if (!mandarACotizador(`${archivo}.dxf`, vectorDXF(res, anchoMM), locale))
                            setAviso("El archivo es muy grande para pasarlo al Cotizador. Descárgalo y súbelo ahí.")
                        }}
                      >
                        Cotizador
                      </Boton>
                      <Boton href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`}>WhatsApp</Boton>
                    </div>
                  </TarjetaExport>
                </div>
                <div className="flex flex-col gap-2 rounded-[12px] border border-[#C2560A]/50 bg-[#C2560A]/10 p-4">
                  <span className="text-[15px] font-bold">¿No tienes máquina?</span>
                  <span className="text-[13px] text-[#F2D29B]">Un taller de HETNA lo corta o lo graba y te lo envía.</span>
                  <div>
                    <Boton
                      tipo="primario"
                      onClick={() => {
                        if (
                          !mandarAFabricar(`${archivo}.dxf`, vectorDXF(res, anchoMM), locale, {
                            pieza: "Imagen vectorizada",
                            medidas: `${r1(anchoMM)} × ${r1(altoMM)} mm`,
                            proceso: "Corte láser",
                          })
                        )
                          setAviso("El archivo es muy grande para mandarlo. Descárgalo y súbelo en la solicitud.")
                      }}
                    >
                      Fabrícamelo
                    </Boton>
                  </div>
                </div>
                {aviso && <Aviso tipo="error">{aviso}</Aviso>}
                <div className="flex flex-col justify-between gap-3 rounded-[12px] border border-[#2B3648] bg-[#1C2431] p-4 sm:flex-row sm:items-center">
                  <p className="m-0 text-[13.5px] text-[#C9D2E0]">
                    <strong className="text-white">¿No quedó como querías?</strong> Lo vectorizamos a mano, con contornos limpios.
                  </p>
                  <LocalizedClientLink
                    href="/servicios/generador-2d-3d/vectorizacion"
                    className="shrink-0 rounded-[8px] bg-[#2B3648] px-4 py-2 text-center text-[13px] font-semibold text-white hover:bg-[#344158]"
                  >
                    Vectorización profesional
                  </LocalizedClientLink>
                </div>
              </div>
            ) : (
              <p className="m-0 text-[14px] text-[#8A97AB]">Ajusta el tamaño final para generar los archivos.</p>
            )
          ) : (
            <>
              <div className={`flex min-h-0 flex-1 gap-4 ${vista === "comparar" ? "flex-col md:flex-row" : "flex-col"}`}>
                {(vista === "comparar" || vista === "original") && hoja(originalDibujo, "Original")}
                {(vista === "comparar" || vista === "vector") && hoja(vectorDibujo, "Vector")}
              </div>
              {res && res.capas.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {res.capas.map((c) => (
                    <span key={c.nombre} className="inline-flex items-center gap-1.5 rounded-full bg-[#1C2431] px-2.5 py-1 text-[12.5px]">
                      <span className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ background: c.color }} />
                      {c.nombre}
                    </span>
                  ))}
                </div>
              )}
              {res?.avisos.map((a) => (
                <Aviso key={a}>{a}</Aviso>
              ))}
              {listo && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="mr-auto text-[13px] text-[#8A97AB]">
                    {r1(anchoMM)} × {r1(altoMM)} mm
                  </span>
                  <button
                    type="button"
                    onClick={() => res && descargar(`${archivo}.dxf`, vectorDXF(res, anchoMM), "application/dxf")}
                    className="rounded-[8px] bg-[#C2560A] px-4 py-2 text-[13px] font-semibold hover:bg-[#A84A08]"
                  >
                    Descargar DXF
                  </button>
                  <button type="button" onClick={() => setVista("exportar")} className="rounded-[8px] bg-[#2B3648] px-4 py-2 text-[13px] font-semibold hover:bg-[#344158]">
                    Más opciones
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
