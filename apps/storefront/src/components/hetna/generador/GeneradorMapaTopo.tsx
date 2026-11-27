"use client"

// Mapa topográfico por capas (2D Studio · Decoración). El navegador baja los
// mosaicos de alturas (imágenes públicas) y el motor (lib/generador/mapaTopo.ts)
// saca una pieza por capa.
import { T } from "@/components/hetna/i18n/Idioma"
import { useEffect, useMemo, useRef, useState } from "react"

import { Aviso, Boton, CampoNum, Interruptor, Seccion, descargar, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { contextoMDF, precioMDF } from "@/lib/generador/aCotizador"
import { largoCorte } from "@/lib/generador/geo2d"
import { CREDITO_GLOBAL, LUGARES, OPCIONES_MAPA_3D, deUrlMapa, mallaMapa, piezasMapa, planMosaicos, rejillaAlturas } from "@/lib/generador/mapaTopo"
import { mallaSTL } from "@/lib/generador/vectores"

const HOJAS = [
  { nombre: "60 × 40 cm", ancho: 600, alto: 400 },
  { nombre: "90 × 60 cm", ancho: 900, alto: 600 },
  { nombre: "122 × 61 cm", ancho: 1220, alto: 610 },
]
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

/** Baja los mosaicos y saca sus píxeles; la cuadrícula la arma rejillaAlturas (la misma que usa el catálogo). */
async function bajarAlturas(lat: number, lon: number, km: number) {
  const p = planMosaicos(lat, lon, km)
  const lienzo = document.createElement("canvas")
  lienzo.width = lienzo.height = 256
  const ctx = lienzo.getContext("2d", { willReadFrequently: true })!
  const imgs = await Promise.all(p.tiles.map((t) => imagen(t.url)))
  const pixeles = imgs.map((im) => (ctx.clearRect(0, 0, 256, 256), ctx.drawImage(im, 0, 0), ctx.getImageData(0, 0, 256, 256).data))
  return rejillaAlturas(p, pixeles)
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

  const cargar = async (la = numero(lat), lo = numero(lon), k = numero(km)) => {
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
  // Liga con el lugar (la ficha del mapa impreso: "modificar"): lo carga solo
  useEffect(() => {
    const l = deUrlMapa(window.location.search)
    if (l.capas) setCapas(String(l.capas))
    if (l.ancho) setAncho(String(l.ancho))
    if (l.lat !== undefined && l.lon !== undefined && l.km !== undefined) {
      setLat(String(l.lat)), setLon(String(l.lon)), setKm(String(l.km))
      void cargar(l.lat, l.lon, l.km)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nCapas = numero(capas) || 10, mm = numero(ancho) || 300
  const archivo = `mapa-topografico-${numero(lat).toFixed(2)}_${numero(lon).toFixed(2)}`
  // para impresora 3D: las mismas capas apiladas en una pieza (base y montaña, y la cumbre de otro color)
  const bajarSTL = () => {
    if (!alturas) return
    const m = mallaMapa(alturas.alt, alturas.w, alturas.h, { capas: nCapas, ancho: mm })
    if (m.errores.length) return setError(m.errores[0])
    descargar(`${archivo}.stl`, mallaSTL(m.malla), "model/stl")
  }

  const r = useMemo(() => (alturas ? piezasMapa(alturas.alt, alturas.w, alturas.h, { capas: nCapas, ancho: mm, hoja: HOJAS[hoja], invertir }) : null), [alturas, nCapas, mm, hoja, invertir])

  // precio aprox.: corte en láser de MDF de 3 mm, por hoja de material (la guía rayada no se cobra aparte)
  // si alguna pieza no cabe en la hoja no hay precio ni cotización (saldrían de una parte del mapa)
  const completo = !!r && !r.errores.length && !r.noCaben
  const corte = useMemo(() => (completo ? r!.dibujo.trazos.filter((t) => t.capa === "corte") : []), [r, completo])
  const pedidoPrecio =
    completo && r!.hojas > 0 && corte.length
      ? { ...precioMDF("laser", 3), anchoMm: HOJAS[hoja].ancho - 20, largoMm: HOJAS[hoja].alto - 20, cantidad: r!.hojas, unidad: "hojas" as const, corte_mm: largoCorte(corte) / r!.hojas, perforaciones: Math.round(corte.length / r!.hojas) }
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
      <Boton tipo="primario" onClick={() => void cargar()} disabled={cargando}>
        <T>{cargando ? "Bajando alturas…" : alturas ? "Volver a cargar" : "Cargar el terreno"}</T>
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
      {r && <span className="text-[12px] text-[#F2D29B]">{r.niveles.length} capas de {Math.round(r.niveles[0] || 0)} a {Math.round(r.niveles[r.niveles.length - 1] || 0)} m · {r.hojas} <T>{r.hojas === 1 ? "hoja" : "hojas"}</T></span>}
      {r && !r.errores.length && !invertir && (
        <>
          <Boton onClick={bajarSTL}>Bajar STL para impresora 3D</Boton>
          <span className="text-[11.5px] leading-snug text-[#8A97AB]">
            Para impresora sale en una sola pieza: base de {OPCIONES_MAPA_3D.base} mm y capas de {OPCIONES_MAPA_3D.grosorCapa} mm (la cumbre puede ir de otro color).
            <T>{mm > 250 ? ` Sale de ${mm} mm: para la mayoría de las impresoras pon 250 mm o menos en «Tamaño del mapa».` : ""}</T>
          </span>
        </>
      )}
      <span className="text-[11.5px] leading-snug text-[#8A97AB]">Cada pieza trae rayada (línea punteada) la silueta de la que va encima: pégalas en orden sobre la base. {CREDITO_GLOBAL}</span>
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
      archivo={archivo}
      pieza={`Mapa topográfico de ${mm} mm en ${nCapas} capas`}
      material="MDF o acrílico de 3 mm"
      precio={pedidoPrecio}
      cotizar={pedidoPrecio ? { ...contextoMDF("laser", 3), nota: `Mapa topográfico de ${mm} mm: ${r!.piezas} piezas (base y capas) en ${r!.hojas} hojas, con la silueta de la capa de encima rayada.` } : undefined}
      vacio="Escoge un lugar y carga el terreno."
    />
  )
}
