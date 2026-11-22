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
//
// 22 nov 2026 (Vlado): sale en TODOS los productos, digitales y físicos (en
// un físico es "fabricar algo similar"), va debajo de las fotos, más chico, y
// pide las tres medidas: ancho × largo × alto. En piezas planas el alto es
// opcional (el grosor lo da el material).
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
  /** Producto físico: se pide "algo similar" y se ofrecen todos los procesos */
  fisico?: boolean
  /** Proceso que sale elegido (p. ej. router para un tallado) */
  procesoInicial?: TipoMaquina
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

const campo = "mt-1 min-h-[44px] w-full rounded-md border border-[#C5CCD3] bg-white px-2.5 text-[14px] outline-none focus:border-[#E85D04]"
const etiqueta = "block text-[12.5px] font-semibold text-[#1E2329]"

export default function FabricarDiseno({ titulo, handle, formatos, medidas, vistaPrevia, fisico = false, procesoInicial }: Props) {
  const es3D = !fisico && formatos.length > 0 && formatos.every((f) => FORMATOS_3D.includes(f))
  const todos: TipoMaquina[] = ["laser_co2", "router", "plasma", "impresora_3d"]
  const lista: TipoMaquina[] = fisico ? todos : es3D ? ["impresora_3d"] : formatos.some((f) => FORMATOS_3D.includes(f)) ? todos : ["laser_co2", "router", "plasma"]
  // El proceso sugerido va primero
  const procesos = procesoInicial && lista.includes(procesoInicial) ? [procesoInicial, ...lista.filter((p) => p !== procesoInicial)] : lista

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
  // Medidas: ancho × largo × alto. Si el diseño trae medidas, cambiar una
  // ajusta las otras en proporción (escala `k`) para no deformarlo.
  const [k, setK] = useState(1)
  const [manual, setManual] = useState({ ancho: "", largo: "", alto: "" })
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
  // Ancho y largo son obligatorios; el alto sólo en impresión 3D
  const faltaAlto = servicio === "impresora_3d" && !(num(manual.alto) > 0)
  const piezaBase: Pieza | null =
    base ||
    (num(manual.ancho) > 0 && num(manual.largo) > 0 && !faltaAlto
      ? piezaAMano(num(manual.ancho), num(manual.largo), num(manual.alto), "normal", servicio === "impresora_3d")
      : null)
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
    const med = `${Math.round(pieza.largo)} × ${Math.round(pieza.ancho)}${pieza.alto ? ` × ${Math.round(pieza.alto)}` : ""} mm`
    const nota = [
      fisico
        ? `Fabricar algo similar al producto "${titulo}"${handle ? ` (hetnacnc.com/mx/products/${handle})` : ""}.`
        : `Fabricar el diseño de la tienda "${titulo}"${handle ? ` (hetnacnc.com/mx/products/${handle})` : ""}.`,
      `Proceso: ${nombreServicio.nombre}. Material: ${material.nombre}. Medidas: ${med}. Cantidad: ${n}.`,
      conGrabado && texto.trim() ? `Grabado: "${texto.trim().slice(0, 120)}".` : "",
      r?.ok ? `Precio aproximado de la calculadora: ${pesos(r.min)} a ${pesos(r.max)}.` : "",
    ]
      .filter(Boolean)
      .join(" ")
    const q = new URLSearchParams({ desde: "producto", pieza: titulo, medidas: med, material: material.nombre, proceso: nombreServicio.solicitud, cantidad: String(n), nota })
    return `/cotizar?${q.toString()}`
  })()

  // Valor de cada medida en pantalla. Con diseño base: se escalan juntas.
  const dims = [
    { clave: "ancho", nombre: "Ancho", base: base?.largo },
    { clave: "largo", nombre: "Largo", base: base?.ancho },
    { clave: "alto", nombre: servicio === "impresora_3d" ? "Alto" : "Alto (opcional)", base: base?.alto },
  ] as const

  return (
    <section
      id="fabricar"
      aria-labelledby="titulo-fabricar"
      className="flex h-full scroll-mt-24 flex-col rounded-xl border-2 border-[#E85D04] bg-white p-4"
      data-testid="fabricar-con-taller"
    >
      <h2 id="titulo-fabricar" className="fuente-condensada m-0 text-[20px] font-bold uppercase leading-none text-[#1E2329]">
        {fisico ? "Fabrícalo a tu medida con un taller" : "Fabrícalo con un taller"}
      </h2>
      <p className="m-0 mt-1 text-[13px] text-[#3A414B]">Precio aproximado al momento y propuestas de talleres de la red.</p>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
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
        <fieldset className="col-span-2 m-0 border-0 p-0">
          <legend className={etiqueta}>Medidas (mm)</legend>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {dims.map((d) => (
              <label key={d.clave} className="block">
                <span className="block text-[11.5px] text-[#5B6370]">{d.nombre}</span>
                <input
                  className={campo + " mt-0.5"}
                  inputMode="decimal"
                  placeholder={d.clave === "alto" && servicio !== "impresora_3d" ? "—" : "0"}
                  value={base ? (d.base ? String(Math.round(d.base * k)) : "") : manual[d.clave]}
                  disabled={Boolean(base) && !d.base}
                  onChange={(e) =>
                    base
                      ? d.base && num(e.target.value) > 0 && setK(num(e.target.value) / d.base)
                      : setManual({ ...manual, [d.clave]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
          {base && (
            <span className="mt-1 block text-[11.5px] text-[#5B6370]">
              Original: {Math.round(base.largo)} × {Math.round(base.ancho)}
              {base.alto ? ` × ${Math.round(base.alto)}` : ""} mm · se escala en proporción.
              {k !== 1 && (
                <button type="button" onClick={() => setK(1)} className="ml-1 font-semibold text-[#E85D04] underline">
                  Volver al original
                </button>
              )}
            </span>
          )}
        </fieldset>
        <label className={etiqueta}>
          Cantidad
          <input className={campo} inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        </label>
        {servicio !== "impresora_3d" ? (
          <label className="flex min-h-[44px] cursor-pointer items-end gap-2 pb-2.5 text-[13px] font-semibold text-[#1E2329]">
            <input type="checkbox" checked={conGrabado} onChange={(e) => setConGrabado(e.target.checked)} className="h-5 w-5 accent-[#E85D04]" />
            Con grabado
          </label>
        ) : (
          <span />
        )}
        {conGrabado && servicio !== "impresora_3d" && (
          <input
            className={campo + " col-span-2 mt-0"}
            value={texto}
            maxLength={60}
            onChange={(e) => setTexto(e.target.value)}
            placeholder='Texto del grabado, ej. "Familia López 2026"'
            aria-label="Texto del grabado"
          />
        )}
      </div>

      <div className="mt-3 rounded-lg bg-[#F7F8FA] p-3" aria-live="polite">
        {!pieza ? (
          <p className="m-0 text-[13px] text-[#5B6370]">
            {faltaAlto ? "En impresión 3D escribe también el alto." : "Escribe el ancho y el largo para ver el precio aproximado."}
          </p>
        ) : r && r.ok ? (
          <>
            <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#5B6370]">Precio aproximado</p>
            <p className="m-0 mt-0.5 text-[22px] font-extrabold leading-none text-[#1E2329]">
              {pesos(r.min)} – {pesos(r.max)}
            </p>
            <p className="m-0 mt-1 text-[12.5px] text-[#3A414B]">
              {n > 1 ? `${n} piezas · unos ${pesos(r.precioPieza)} c/u · ` : ""}material y maquinado, más IVA, sin envío.
            </p>
            {r.avisos.map((a) => (
              <p key={a} className="m-0 mt-1 text-[12px] text-[#9A5B00]">
                {a}
              </p>
            ))}
            <details className="mt-1 text-[12px] text-[#5B6370]">
              <summary className="cursor-pointer font-semibold">Cómo se calculó</summary>
              <p className="m-0 mt-1">{r.explicacion}.</p>
            </details>
          </>
        ) : (
          <p className="m-0 text-[13px] text-[#9A5B00]">{r && !r.ok ? r.motivo : "No se pudo calcular con esos datos."}</p>
        )}
      </div>

      <LocalizedClientLink
        href={liga}
        aria-disabled={!pieza}
        className={`mt-3 flex min-h-[46px] w-full items-center justify-center rounded-lg bg-[#E85D04] px-4 text-[15px] font-bold text-white hover:bg-[#C94F03] ${pieza ? "" : "pointer-events-none opacity-50"}`}
      >
        Pedir propuestas a talleres
      </LocalizedClientLink>
      <p className="m-0 mt-1.5 text-[11.5px] leading-snug text-[#5B6370]">
        {fisico
          ? "Precio orientativo: el precio real lo da cada taller en su propuesta."
          : "Precio orientativo. El taller necesita el archivo: cómpralo aquí y súbelo en tu solicitud."}
      </p>

      {/* Cómo funciona: esta parte crece cuando la columna de compra es más
          alta, para que debajo de las fotos no quede hueco (antes crecía el
          recuadro del precio y quedaba un espacio gris vacío). */}
      <ol className="relative m-0 mt-3 flex flex-1 list-none flex-col justify-between gap-2 border-t border-[#EDEFF2] p-0 pt-3" aria-label="Cómo funciona">
        {/* Línea que une los pasos (va detrás de los círculos) */}
        <span aria-hidden="true" className="absolute bottom-6 left-[15px] top-7 w-0.5 bg-[#F6D3BC]" />
        {[
          ["1", "Elige material y medidas", "Ves un precio aproximado al momento."],
          ["2", "Los talleres te mandan propuestas", "Cada una con precio, tiempo de entrega y garantía."],
          ["3", "Eliges y pagas dentro de HETNA", "Con Mercado Pago, sin tratos por fuera."],
        ].map(([n, t, d]) => (
          <li key={n} className="flex items-start gap-3">
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FDECE0] text-[14px] font-bold text-[#C2560A] ring-4 ring-white">{n}</span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-bold leading-snug text-[#1E2329]">{t}</span>
              <span className="block text-[12.5px] leading-snug text-[#5B6370]">{d}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
