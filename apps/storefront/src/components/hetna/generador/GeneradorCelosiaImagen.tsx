"use client"

// Celosía desde imagen (2D Studio › Patrones de corte): el cliente sube la foto
// o captura de la celosía que vio en internet, la endereza marcando sus 4
// esquinas, elige plasma, láser o router y el espesor, y sale el panel con
// marco listo para cortar. El motor está en lib/generador/celosiaImagen.ts.
// La imagen no sale del navegador.
import { useEffect, useRef, useState } from "react"

import { CampoNum, Interruptor, Opciones, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { type Islas, type Proceso, hacerCelosiaImagen, minimosSugeridos } from "@/lib/generador/celosiaImagen"
import type { P } from "@/lib/generador/geo2d"
import type { Imagen } from "@/lib/generador/trazado"

const LADO_IMAGEN = 1400

function pixeles(img: HTMLImageElement): Imagen | null {
  const s = Math.min(1, LADO_IMAGEN / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * s))
  const h = Math.max(1, Math.round(img.naturalHeight * s))
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  const ctx = c.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h)
  return { data: d.data, width: w, height: h }
}

const NOMBRES_ESQUINA = ["arriba izquierda", "arriba derecha", "abajo derecha", "abajo izquierda"]

/** La imagen con las 4 esquinas para arrastrar (ratón o dedo). */
function Esquinas({ url, im, esquinas, cambiar }: { url: string; im: Imagen; esquinas: [P, P, P, P]; cambiar: (e: [P, P, P, P]) => void }) {
  const svg = useRef<SVGSVGElement>(null)
  const [arrastra, setArrastra] = useState<number | null>(null)
  const actuales = useRef(esquinas)
  actuales.current = esquinas
  // El arrastre se sigue en toda la ventana: aunque el puntero salga de la imagen
  useEffect(() => {
    if (arrastra === null) return
    const mover = (e: PointerEvent) => {
      if (!svg.current) return
      const r = svg.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(im.width, ((e.clientX - r.left) / r.width) * im.width))
      const y = Math.max(0, Math.min(im.height, ((e.clientY - r.top) / r.height) * im.height))
      const n = [...actuales.current] as [P, P, P, P]
      n[arrastra] = [x, y]
      cambiar(n)
    }
    const soltar = () => setArrastra(null)
    window.addEventListener("pointermove", mover)
    window.addEventListener("pointerup", soltar)
    window.addEventListener("pointercancel", soltar)
    return () => {
      window.removeEventListener("pointermove", mover)
      window.removeEventListener("pointerup", soltar)
      window.removeEventListener("pointercancel", soltar)
    }
  }, [arrastra, im.width, im.height, cambiar])
  const radio = Math.max(im.width, im.height) / 32
  return (
    <svg ref={svg} viewBox={`0 0 ${im.width} ${im.height}`} className="w-full touch-none select-none overflow-visible rounded-[8px] bg-black">
      <image href={url} width={im.width} height={im.height} />
      <polygon points={esquinas.map((p) => p.join(",")).join(" ")} fill="rgba(242,138,60,0.12)" stroke="#F28A3C" strokeWidth={radio / 4} />
      {esquinas.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={radio}
          fill={arrastra === i ? "#F28A3C" : "#C2560A"}
          stroke="#fff"
          strokeWidth={radio / 5}
          style={{ cursor: "grab" }}
          aria-label={`Esquina ${NOMBRES_ESQUINA[i]}`}
          onPointerDown={(e) => {
            e.preventDefault()
            setArrastra(i)
          }}
        />
      ))}
    </svg>
  )
}

export function GeneradorCelosiaImagen({ cabecera }: { cabecera?: React.ReactNode }) {
  const [url, setUrl] = useState("")
  const [nombre, setNombre] = useState("")
  const [im, setIm] = useState<Imagen | null>(null)
  const [esquinas, setEsquinas] = useState<[P, P, P, P]>([[0, 0], [1, 0], [1, 1], [0, 1]])
  const [cortar, setCortar] = useState<"oscuro" | "claro">("oscuro")
  const [umbralAuto, setUmbralAuto] = useState(true)
  const [umbral, setUmbral] = useState(128)
  const [proceso, setProceso] = useState<Proceso>("plasma")
  const [espesor, setEspesor] = useState("3")
  const [puente, setPuente] = useState("3")
  const [hueco, setHueco] = useState("3")
  const [islas, setIslas] = useState<Islas>("puentes")
  const [ancho, setAncho] = useState("600")
  const [alto, setAlto] = useState("1200")
  const [marco, setMarco] = useState("30")
  const [barrenos, setBarrenos] = useState(true)
  const [fondo, setFondo] = useState(true)
  const [diam, setDiam] = useState("8")
  const [res, setRes] = useState<ReturnType<typeof hacerCelosiaImagen> | null>(null)
  const [calculando, setCalculando] = useState(false)

  // Mínimos sugeridos al cambiar de proceso o de espesor (el cliente los puede editar)
  useEffect(() => {
    const m = minimosSugeridos(proceso, numero(espesor) || 3)
    setPuente(String(Math.round(m.puente * 10) / 10))
    setHueco(String(Math.round(m.hueco * 10) / 10))
  }, [proceso, espesor])

  const abrir = (f?: File) => {
    if (!f) return
    if (!/^image\//.test(f.type)) return
    const u = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => {
      const p = pixeles(img)
      if (!p) return
      setIm(p)
      setUrl(u)
      setNombre(f.name.replace(/\.[^.]+$/, ""))
      // Un poco hacia adentro, para que los 4 puntos se vean completos y se puedan agarrar
      const mx = p.width * 0.04
      const my = p.height * 0.04
      setEsquinas([[mx, my], [p.width - mx, my], [p.width - mx, p.height - my], [mx, p.height - my]])
      // Alto con la proporción de la imagen
      const a = numero(ancho) || 600
      setAlto(String(Math.round((a * p.height) / p.width)))
    }
    img.src = u
  }

  // Proporción de lo que se marcó con las esquinas (promedio de lados opuestos)
  const proporcion = () => {
    const d = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1])
    const w = (d(esquinas[0], esquinas[1]) + d(esquinas[3], esquinas[2])) / 2
    const h = (d(esquinas[0], esquinas[3]) + d(esquinas[1], esquinas[2])) / 2
    return w > 0 ? h / w : 1
  }

  // Se calcula un momento después del último cambio, para no trabar la página
  useEffect(() => {
    if (!im) return
    setCalculando(true)
    const t = setTimeout(() => {
      setRes(
        hacerCelosiaImagen(im, {
          esquinas,
          ancho: numero(ancho) || 600,
          alto: numero(alto) || 600,
          marco: numero(marco) || 0,
          cortar,
          umbral: umbralAuto ? null : umbral,
          proceso,
          puenteMin: Math.max(0.2, numero(puente) || 0.2),
          huecoMin: Math.max(0.2, numero(hueco) || 0.2),
          islas,
          suave: true,
          barrenos,
          fondo,
          diametroBarreno: numero(diam) || 8,
        }),
      )
      setCalculando(false)
    }, 450)
    return () => clearTimeout(t)
  }, [im, esquinas, ancho, alto, marco, cortar, umbralAuto, umbral, proceso, puente, hueco, islas, barrenos, diam, fondo])

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="1. Tu imagen" nota="Una captura o foto de la celosía que te gustó. Arrastra los 4 puntos naranjas a las esquinas del diseño para enderezarlo y quitar lo que sobra.">
        <label className="flex cursor-pointer items-center justify-center rounded-[10px] border-2 border-dashed border-[#2A3546] px-3 py-4 text-center text-[13px] text-[#C9D2E0] hover:border-[#C2560A]">
          {im ? "Cambiar imagen" : "Subir imagen (JPG, PNG o WEBP)"}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => abrir(e.target.files?.[0])} />
        </label>
        {im && url && <div className="mt-2"><Esquinas url={url} im={im} esquinas={esquinas} cambiar={setEsquinas} /></div>}
      </Seccion>
      {im && (
        <>
          <Seccion titulo="2. Qué se corta">
            <Opciones<"oscuro" | "claro">
              valor={cortar}
              cambiar={setCortar}
              opciones={[
                { id: "oscuro", nombre: "Lo oscuro" },
                { id: "claro", nombre: "Lo claro" },
              ]}
            />
            <Interruptor etiqueta="Umbral automático" activo={umbralAuto} cambiar={setUmbralAuto} />
            <Interruptor etiqueta="Ignorar el fondo (lo que toca la orilla de la foto)" activo={fondo} cambiar={setFondo} />
            {!umbralAuto && (
              <label className="flex flex-col gap-1 text-[12.5px] text-[#C9D2E0]">
                <span>Umbral: {umbral}</span>
                <input type="range" min={1} max={254} value={umbral} onChange={(e) => setUmbral(Number(e.target.value))} className="accent-[#C2560A]" />
              </label>
            )}
          </Seccion>
          <Seccion titulo="3. Cómo se va a cortar">
            <Opciones<Proceso>
              valor={proceso}
              cambiar={setProceso}
              opciones={[
                { id: "plasma", nombre: "Plasma" },
                { id: "laser", nombre: "Láser" },
                { id: "router", nombre: "Router" },
              ]}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <CampoNum etiqueta="Espesor del material" valor={espesor} cambiar={setEspesor} />
              <CampoNum etiqueta="Puente mínimo" valor={puente} cambiar={setPuente} />
              <CampoNum etiqueta={proceso === "router" ? "Fresa / hueco mínimo" : "Hueco mínimo"} valor={hueco} cambiar={setHueco} />
            </div>
            <p className="mt-1 text-[12px] text-[#8A97AB]">
              {proceso === "plasma"
                ? "En plasma, los huecos y los puentes deben medir al menos el espesor de la lámina."
                : proceso === "router"
                  ? "Con router, ningún hueco puede ser más angosto que la fresa ni tener esquinas más cerradas que ella."
                  : "En láser se pueden detalles finos; en MDF deja puentes de al menos la mitad del espesor."}
            </p>
          </Seccion>
          <Seccion titulo="Piezas que quedan sueltas">
            <Opciones<Islas>
              valor={islas}
              cambiar={setIslas}
              columnas={3}
              opciones={[
                { id: "puentes", nombre: "Ponerles puente" },
                { id: "quitar", nombre: "Quitarlas" },
                { id: "sueltas", nombre: "Dejarlas caer" },
              ]}
            />
          </Seccion>
          <Seccion titulo="4. Medidas del panel">
            <div className="grid grid-cols-2 gap-2">
              <CampoNum etiqueta="Ancho" valor={ancho} cambiar={setAncho} />
              <CampoNum etiqueta="Alto" valor={alto} cambiar={setAlto} />
              <CampoNum etiqueta="Marco" valor={marco} cambiar={setMarco} />
            </div>
            <button
              type="button"
              onClick={() => setAlto(String(Math.round((numero(ancho) || 600) * proporcion())))}
              className="mt-2 rounded-full bg-[#1C2431] px-3 py-1 text-[12px] text-[#C9D2E0] hover:bg-[#232D3D]"
            >
              Alto según la proporción de la imagen
            </button>
            <Interruptor etiqueta="Barrenos en las esquinas" activo={barrenos} cambiar={setBarrenos} />
            {barrenos && <CampoNum etiqueta="Diámetro" valor={diam} cambiar={setDiam} />}
          </Seccion>
          {calculando && <p className="text-[12.5px] text-[#8A97AB]">Calculando…</p>}
        </>
      )}
    </div>
  )

  const medida = `${Math.round(numero(ancho) || 0)}x${Math.round(numero(alto) || 0)}`
  return (
    <Estudio2D
      titulo="Celosía desde imagen"
      acento="2D"
      subtitulo="La celosía que viste en internet, lista para plasma, láser o router"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      }
      panel={
        <>
          {cabecera}
          {panel}
        </>
      }
      dibujo={res?.dibujo ?? null}
      avisos={res?.avisos ?? []}
      archivo={`celosia-${nombre || "imagen"}-${medida}`}
      pieza={`Celosía desde imagen ${medida} mm (${proceso}, ${espesor} mm)`}
      material={`${proceso} ${espesor} mm`}
      datos={res ? [["Huecos", String(res.huecos)]] : []}
      vacio={<p className="text-center text-[14px] text-[#8A97AB]">Sube la imagen de la celosía que te gustó y aquí aparece el panel listo para cortar.</p>}
    />
  )
}
