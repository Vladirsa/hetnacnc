"use client"

// Mapa topográfico por capas (2D Studio · Decoración). El navegador baja los
// mosaicos de alturas (imágenes públicas) y el motor (lib/generador/mapaTopo.ts)
// saca una pieza por capa.
import { useMemo, useRef, useState } from "react"

import { Aviso, Boton, CampoNum, Interruptor, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { contextoMDF, precioMDF } from "@/lib/generador/aCotizador"
import { largoCorte } from "@/lib/generador/geo2d"
import { CREDITO, LUGARES, alturaTerrarium, piezasMapa, planMosaicos } from "@/lib/generador/mapaTopo"

const HOJAS = [
  { nombre: "60 × 40 cm", ancho: 600, alto: 400 },
  { nombre: "90 × 60 cm", ancho: 900, alto: 600 },
  { nombre: "122 × 61 cm", ancho: 1220, alto: 610 },
]
const MAX_PX = 160 // lado de la cuadrícula de alturas: detalle suficiente y rápido

const imagen = (url: string) =>
  new Promise<HTMLImageElement>((ok, mal) => {
    const i = new Image()
    i.crossOrigin = "anonymous"
    i.onload = () => ok(i)
    i.onerror = () => mal(new Error("No se pudieron bajar las alturas. Revisa tu conexión."))
    // un mosaico que no contesta no deja el botón en "Bajando…" para siempre
    setTimeout(() => mal(new Error("El servidor de alturas tardó mucho. Intenta de nuevo.")), 20000)
    i.src = url
  })

async function bajarAlturas(lat: number, lon: number, km: number) {
  const p = planMosaicos(lat, lon, km)
  const xs = p.tiles.map((t) => t.x), ys = p.tiles.map((t) => t.y)
  const cols = Math.max(...xs) - p.tx0 + 1, filas = Math.max(...ys) - p.ty0 + 1
  const lienzo = document.createElement("canvas")
  lienzo.width = cols * 256
  lienzo.height = filas * 256
  const ctx = lienzo.getContext("2d", { willReadFrequently: true })!
  const imgs = await Promise.all(p.tiles.map((t) => imagen(t.url)))
  p.tiles.forEach((t, i) => ctx.drawImage(imgs[i], (t.x - p.tx0) * 256, (t.y - p.ty0) * 256))
  const rx = Math.floor(p.recorte.x0 - p.tx0 * 256), ry = Math.floor(p.recorte.y0 - p.ty0 * 256)
  const rw = Math.ceil(p.recorte.x1 - p.recorte.x0), rh = Math.ceil(p.recorte.y1 - p.recorte.y0)
  const { data } = ctx.getImageData(rx, ry, rw, rh)
  // a una cuadrícula de MAX_PX de lado (promedio por bloque)
  const k = Math.max(1, Math.max(rw, rh) / MAX_PX)
  const w = Math.max(8, Math.round(rw / k)), h = Math.max(8, Math.round(rh / k))
  const alt = new Float32Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const px = Math.min(rw - 1, Math.floor(x * k)), py = Math.min(rh - 1, Math.floor(y * k))
      const o = (py * rw + px) * 4
      alt[y * w + x] = alturaTerrarium(data[o], data[o + 1], data[o + 2])
    }
  return { alt, w, h }
}

export function GeneradorMapaTopo({ cabecera }: { cabecera?: React.ReactNode }) {
  const [lat, setLat] = useState(String(LUGARES[0].lat))
  const [lon, setLon] = useState(String(LUGARES[0].lon))
  const [km, setKm] = useState(String(LUGARES[0].km))
  const [capas, setCapas] = useState("10")
  const [ancho, setAncho] = useState("300")
  const [hoja, setHoja] = useState(0)
  const [invertir, setInvertir] = useState(false)
  const [alturas, setAlturas] = useState<{ alt: Float32Array; w: number; h: number } | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const carga = useRef(0)

  const cargar = async () => {
    const la = numero(lat), lo = numero(lon), k = numero(km)
    if (!(Math.abs(la) <= 84 && Math.abs(lo) <= 180 && k >= 1 && k <= 300)) return setError("Revisa la latitud, la longitud y el ancho (1 a 300 km).")
    setError("")
    setCargando(true)
    // si mientras tanto piden otro lugar, esta carga ya no cuenta
    const n = ++carga.current
    try {
      const a = await bajarAlturas(la, lo, k)
      if (n === carga.current) setAlturas(a)
    } catch (e) {
      if (n === carga.current) setError((e as Error).message)
    } finally {
      if (n === carga.current) setCargando(false)
    }
  }
  const r = useMemo(() => (alturas ? piezasMapa(alturas.alt, alturas.w, alturas.h, { capas: numero(capas) || 10, ancho: numero(ancho) || 300, hoja: HOJAS[hoja], invertir }) : null), [alturas, capas, ancho, hoja, invertir])

  // precio aprox.: corte en láser de MDF de 3 mm, por hoja de material (la guía rayada no se cobra aparte)
  const corte = useMemo(() => (r && !r.errores.length ? r.dibujo.trazos.filter((t) => t.capa === "corte") : []), [r])
  const pedidoPrecio =
    r && r.hojas > 0 && corte.length
      ? { ...precioMDF("laser", 3), anchoMm: HOJAS[hoja].ancho - 20, largoMm: HOJAS[hoja].alto - 20, cantidad: r.hojas, unidad: "hojas" as const, corte_mm: largoCorte(corte) / r.hojas, perforaciones: Math.round(corte.length / r.hojas) }
      : undefined

  const panel = (
    <div className="flex flex-col gap-4">
      {cabecera}
      <Seccion titulo="Lugar" nota="Escoge uno o pega las coordenadas de Google Maps (clic derecho en el mapa).">
        <div className="grid grid-cols-2 gap-1.5">
          {LUGARES.map((l) => (
            <button key={l.nombre} type="button" onClick={() => (carga.current++, setCargando(false), setLat(String(l.lat)), setLon(String(l.lon)), setKm(String(l.km)), setAlturas(null))} className="rounded-[8px] bg-[#1C2431] px-2 py-1.5 text-left text-[11.5px] font-semibold text-[#C9D2E0] hover:bg-[#243045]">
              {l.nombre}
            </button>
          ))}
        </div>
      </Seccion>
      <div className="grid grid-cols-3 gap-2">
        <CampoNum etiqueta="Latitud" valor={lat} cambiar={setLat} sufijo="" />
        <CampoNum etiqueta="Longitud" valor={lon} cambiar={setLon} sufijo="" />
        <CampoNum etiqueta="Ancho" valor={km} cambiar={setKm} sufijo="km" />
      </div>
      <Boton tipo="primario" onClick={cargar} disabled={cargando}>
        {cargando ? "Bajando alturas…" : alturas ? "Volver a cargar" : "Cargar el terreno"}
      </Boton>
      <div className="grid grid-cols-2 gap-2">
        <CampoNum etiqueta="Capas" valor={capas} cambiar={setCapas} sufijo="" />
        <CampoNum etiqueta="Tamaño del mapa" valor={ancho} cambiar={setAncho} />
      </div>
      <Seccion titulo="Hoja de material">
        <div className="grid grid-cols-3 gap-1.5">
          {HOJAS.map((h, i) => (
            <button key={h.nombre} type="button" aria-pressed={hoja === i} onClick={() => setHoja(i)} className={`rounded-[8px] px-1.5 py-1.5 text-[11.5px] font-semibold ${hoja === i ? "bg-[#C2560A] text-white" : "bg-[#1C2431] text-[#C9D2E0]"}`}>
              {h.nombre}
            </button>
          ))}
        </div>
      </Seccion>
      <Interruptor etiqueta="Profundidad (lagos y mar) en vez de altura" activo={invertir} cambiar={setInvertir} />
      {error && <Aviso tipo="error">{error}</Aviso>}
      {r && <span className="text-[12px] text-[#F2D29B]">{r.niveles.length} capas de {Math.round(r.niveles[0] || 0)} a {Math.round(r.niveles[r.niveles.length - 1] || 0)} m · {r.hojas} {r.hojas === 1 ? "hoja" : "hojas"}</span>}
      <span className="text-[11.5px] leading-snug text-[#8A97AB]">Cada pieza trae rayada (línea punteada) la silueta de la que va encima: pégalas en orden sobre la base. {CREDITO}</span>
    </div>
  )

  return (
    <Estudio2D
      titulo="Mapa topográfico"
      acento="2D"
      subtitulo="Montañas y barrancas por capas"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M3 20l6-10 4 6 3-4 5 8z" />
          <path d="M7 14c2 1 4 1 6 0" />
        </svg>
      }
      panel={panel}
      dibujo={r && !r.errores.length ? r.dibujo : null}
      avisos={r ? [...r.errores, ...r.avisos] : []}
      archivo={`mapa-topografico-${numero(lat).toFixed(2)}_${numero(lon).toFixed(2)}`}
      pieza={`Mapa topográfico de ${numero(ancho) || 300} mm en ${numero(capas) || 10} capas`}
      material="MDF o acrílico de 3 mm"
      precio={pedidoPrecio}
      cotizar={r && !r.errores.length ? { ...contextoMDF("laser", 3), nota: `Mapa topográfico de ${numero(ancho) || 300} mm: ${r.niveles.length + 1} piezas (base y capas) en ${r.hojas} hojas, con la silueta de la capa de encima rayada.` } : undefined}
      vacio="Escoge un lugar y carga el terreno."
    />
  )
}
