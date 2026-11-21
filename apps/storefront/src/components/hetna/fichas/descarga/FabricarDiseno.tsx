"use client"

// "Fabrícalo con un taller" en la ficha de un diseño (pedido de Vlado, 21 nov
// 2026): el cliente elige proceso, material y grosor, escala las medidas,
// agrega un grabado y la cantidad, ve un precio aproximado al momento y pide
// propuestas a los talleres dentro de HETNA.
//
// Las medidas y los metros de corte salen del modelo de muestra que subió el
// vendedor (vista_previa) o, si no hay, de las medidas de la ficha. El precio
// sale del mismo estimador de /cotizar (lib/cotizador/estimador.ts): es un
// rango orientativo; el precio real lo dan los talleres en sus propuestas.
import { useEffect, useMemo, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { type GeoCad, leerDxf, leerObj, leerStl, leerSvg } from "@/lib/cotizador/archivo-cad"
import { estimar, materialesPara, type Pieza, piezaAMano, piezaDeGeo, pesos, SERVICIOS, type TipoMaquina } from "@/lib/cotizador/estimador"
import { useConfigPrecios } from "@/lib/cotizador/config-precios"
import type { FormatoVista } from "@/lib/hetna/ficha-tecnica"

type Props = {
  titulo: string
  handle?: string | null
  /** Formatos del diseño (DXF, SVG, STL…) */
  formatos: string[]
  /** Texto de medidas de la ficha ("120 × 80 × 15 mm") */
  medidas?: string
  vistaPrevia?: { url: string; formato: FormatoVista } | null
}

const FORMATOS_3D = ["STL", "OBJ", "STEP", "3MF"]

/** "120 × 80 × 15 mm" o "12 x 8 cm" → mm */
export function leerMedidas(t?: string): { largo: number; ancho: number; alto: number } | null {
  if (!t) return null
  const nums = (t.match(/\d+(?:[.,]\d+)?/g) || []).map((x) => parseFloat(x.replace(",", ".")))
  if (nums.length < 2) return null
  const k = /\bcm\b/i.test(t) ? 10 : /\bm\b/i.test(t) && !/mm/i.test(t) ? 1000 : 1
  const [a, b, c] = nums.map((n) => n * k)
  return a > 0 && b > 0 ? { largo: a, ancho: b, alto: c || 0 } : null
}

const campo = "mt-1 min-h-[44px] w-full rounded-md border border-[#C5CCD3] bg-white px-3 text-[15px] outline-none focus:border-[#E85D04]"
const etiqueta = "block text-[13px] font-semibold text-[#1E2329]"

export default function FabricarDiseno({ titulo, handle, formatos, medidas, vistaPrevia }: Props) {
  const es3D = formatos.length > 0 && formatos.every((f) => FORMATOS_3D.includes(f))
  const procesos: TipoMaquina[] = es3D ? ["impresora_3d"] : formatos.some((f) => FORMATOS_3D.includes(f)) ? ["laser_co2", "router", "plasma", "impresora_3d"] : ["laser_co2", "router", "plasma"]

  const [geo, setGeo] = useState<GeoCad | null>(null)
  useEffect(() => {
    if (!vistaPrevia) return
    let vivo = true
    fetch(`/api/vista-previa?u=${encodeURIComponent(vistaPrevia.url)}`)
      .then(async (r) => {
        if (!r.ok) return null
        if (vistaPrevia.formato === "stl") return leerStl(await r.arrayBuffer())
        const t = await r.text()
        return vistaPrevia.formato === "obj" ? leerObj(t) : vistaPrevia.formato === "dxf" ? leerDxf(t) : leerSvg(t)
      })
      .then((g) => vivo && g && setGeo(g))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [vistaPrevia])

  const cfg = useConfigPrecios()
  const deFicha = leerMedidas(medidas)
  const [servicio, setServicio] = useState<TipoMaquina>(procesos[0])
  const mats = useMemo(() => materialesPara(servicio), [servicio])
  const [iMat, setIMat] = useState(0)
  // Medidas como las piensa el cliente: ancho × alto. Si el diseño trae
  // medidas, cambiar una ajusta la otra en proporción (escala `k`).
  const [k, setK] = useState(1)
  const [manual, setManual] = useState({ ancho: "", alto: "" })
  const [cantidad, setCantidad] = useState("10")
  const [conGrabado, setConGrabado] = useState(false)
  const [texto, setTexto] = useState("")

  useEffect(() => setIMat(0), [servicio])

  // Pieza base (tamaño original) y escala que eligió el cliente
  const base: Pieza | null = geo
    ? piezaDeGeo(geo, titulo)
    : deFicha
      ? piezaAMano(deFicha.largo, deFicha.ancho, deFicha.alto, "normal", servicio === "impresora_3d")
      : null
  const num = (v: string) => parseFloat(v.replace(",", ".")) || 0
  const piezaBase: Pieza | null =
    base || (num(manual.ancho) > 0 && num(manual.alto) > 0 ? piezaAMano(num(manual.ancho), num(manual.alto), 0, "normal", servicio === "impresora_3d") : null)
  const escala = base ? k : 1
  const pieza: Pieza | null = piezaBase
    ? {
        ...piezaBase,
        largo: piezaBase.largo * escala,
        ancho: piezaBase.ancho * escala,
        alto: piezaBase.alto * escala,
        metrosCorte: piezaBase.metrosCorte * escala,
        volumenCm3: piezaBase.volumenCm3 * escala ** 3,
      }
    : null

  // Grabado: letra de ~18 % del ancho (entre 5 y 25 mm), media letra rellena
  const altoLetra = pieza ? Math.min(25, Math.max(5, pieza.ancho * 0.18)) : 10
  const grabadoCm2 = conGrabado && texto.trim() ? (texto.trim().length * 0.6 * altoLetra * altoLetra * 0.5) / 100 : 0

  const n = Math.max(1, Math.min(10000, Math.round(Number(cantidad) || 1)))
  const material = mats[Math.min(iMat, mats.length - 1)]
  const r = pieza && material ? estimar({ servicio, pieza, material, cantidad: n, grabadoCm2, cfg }) : null
  const nombreServicio = SERVICIOS.find((s) => s.clave === servicio)

  const liga = (() => {
    if (!pieza || !material || !nombreServicio) return "/cotizar"
    const med = `${Math.round(pieza.largo)} × ${Math.round(pieza.ancho)}${pieza.es3D && pieza.alto ? ` × ${Math.round(pieza.alto)}` : ""} mm`
    const nota = [
      `Fabricar el diseño de la tienda "${titulo}"${handle ? ` (hetnacnc.com/mx/products/${handle})` : ""}.`,
      `Proceso: ${nombreServicio.nombre}. Material: ${material.nombre}. Medidas: ${med}. Cantidad: ${n}.`,
      conGrabado && texto.trim() ? `Grabado: "${texto.trim().slice(0, 120)}".` : "",
      r?.ok ? `Precio aproximado de la calculadora: ${pesos(r.min)} a ${pesos(r.max)}.` : "",
    ]
      .filter(Boolean)
      .join(" ")
    const q = new URLSearchParams({ desde: "producto", pieza: titulo, medidas: med, material: material.nombre, proceso: nombreServicio.solicitud, cantidad: String(n), nota })
    return `/cotizar?${q.toString()}`
  })()

  return (
    <section id="fabricar" aria-labelledby="titulo-fabricar" className="scroll-mt-24 rounded-md border-2 border-[#E85D04] bg-white p-5">
      <h2 id="titulo-fabricar" className="fuente-condensada m-0 text-[26px] font-bold uppercase leading-none text-[#1E2329]">
        Fabrícalo con un taller
      </h2>
      <p className="m-0 mt-1 text-[14px] text-[#3A414B]">
        Elige material, tamaño y cantidad: te damos un precio aproximado al momento y pides propuestas a los talleres de la red.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className={etiqueta}>
          Proceso
          <select className={campo} value={servicio} onChange={(e) => setServicio(e.target.value as TipoMaquina)}>
            {procesos.map((p) => (
              <option key={p} value={p}>
                {SERVICIOS.find((s) => s.clave === p)?.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          Material y grosor
          <select className={campo} value={iMat} onChange={(e) => setIMat(Number(e.target.value))}>
            {mats.map((m, i) => (
              <option key={m.nombre} value={i}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="m-0 border-0 p-0 sm:col-span-2">
          <legend className={etiqueta}>Medidas de la pieza (mm)</legend>
          <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <label>
              <span className="sr-only">Ancho en mm</span>
              <input
                className={campo + " mt-0"}
                inputMode="decimal"
                placeholder="Ancho"
                value={base ? String(Math.round(base.largo * k)) : manual.ancho}
                onChange={(e) => (base ? num(e.target.value) > 0 && setK(num(e.target.value) / base.largo) : setManual({ ...manual, ancho: e.target.value }))}
              />
            </label>
            <span className="text-[16px] font-bold text-[#5B6370]" aria-hidden="true">×</span>
            <label>
              <span className="sr-only">Alto en mm</span>
              <input
                className={campo + " mt-0"}
                inputMode="decimal"
                placeholder="Alto"
                value={base ? String(Math.round(base.ancho * k)) : manual.alto}
                onChange={(e) => (base ? num(e.target.value) > 0 && setK(num(e.target.value) / base.ancho) : setManual({ ...manual, alto: e.target.value }))}
              />
            </label>
          </div>
          <span className="mt-1 block text-[12px] font-normal text-[#5B6370]">
            {base
              ? `Tamaño del diseño: ${Math.round(base.largo)} × ${Math.round(base.ancho)} mm. Si cambias una medida, la otra se ajusta para no deformarlo.`
              : "Escribe el ancho y el alto que necesitas."}
            {base && k !== 1 && (
              <button type="button" onClick={() => setK(1)} className="ml-1 font-semibold text-[#E85D04] underline">
                Volver al original
              </button>
            )}
          </span>
        </fieldset>
        <label className={etiqueta}>
          Cantidad
          <input className={campo} inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        </label>
        {servicio !== "impresora_3d" && (
          <div className="sm:col-span-2">
            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-[14px] font-semibold text-[#1E2329]">
              <input type="checkbox" checked={conGrabado} onChange={(e) => setConGrabado(e.target.checked)} className="h-5 w-5 accent-[#E85D04]" />
              Agregar grabado (un nombre, texto o fecha)
            </label>
            {conGrabado && (
              <input className={campo} value={texto} maxLength={60} onChange={(e) => setTexto(e.target.value)} placeholder='Ej. "Familia López 2026"' />
            )}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-md bg-[#F7F8FA] p-4" aria-live="polite">
        {!pieza ? (
          <p className="m-0 text-[14px] text-[#5B6370]">Escribe las medidas de la pieza (ancho × alto) para ver el precio aproximado.</p>
        ) : r && r.ok ? (
          <>
            <p className="m-0 text-[12.5px] font-bold uppercase tracking-[0.06em] text-[#5B6370]">Precio aproximado</p>
            <p className="m-0 mt-1 text-[28px] font-extrabold leading-none text-[#1E2329]">
              {pesos(r.min)} – {pesos(r.max)}
            </p>
            <p className="m-0 mt-1 text-[13.5px] text-[#3A414B]">
              {n > 1 ? `${n} piezas · unos ${pesos(r.precioPieza)} cada una · ` : ""}material y maquinado, más IVA, sin envío.
            </p>
            <p className="m-0 mt-2 text-[12.5px] text-[#5B6370]">Cómo se calculó: {r.explicacion}.</p>
            {r.avisos.map((a) => (
              <p key={a} className="m-0 mt-1 text-[12.5px] text-[#9A5B00]">
                {a}
              </p>
            ))}
          </>
        ) : (
          <p className="m-0 text-[14px] text-[#9A5B00]">{r && !r.ok ? r.motivo : "No se pudo calcular con esos datos."}</p>
        )}
      </div>

      <LocalizedClientLink
        href={liga}
        aria-disabled={!pieza}
        className={`mt-4 flex min-h-[48px] w-full items-center justify-center rounded bg-[#E85D04] px-4 text-[15.5px] font-bold text-white hover:bg-[#C94F03] ${pieza ? "" : "pointer-events-none opacity-50"}`}
      >
        Pedir propuestas a talleres
      </LocalizedClientLink>
      <p className="m-0 mt-2 text-[12.5px] text-[#5B6370]">
        El precio es orientativo: cada taller manda su propuesta con precio, tiempo de entrega y garantía, y pagas dentro de HETNA. El taller necesita
        el archivo: cómpralo aquí y súbelo en tu solicitud, o pide al taller que lo incluya en su propuesta.
      </p>
    </section>
  )
}
