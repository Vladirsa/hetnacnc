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
import { T } from "@/components/hetna/i18n/Idioma"
import { useEffect, useId, useMemo, useRef, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { type GeoCad, leerDxf, leerObj, leerStl, leerSvg } from "@/lib/cotizador/archivo-cad"
import { estimar, materialesPara, type Pieza, piezaAMano, piezaDeGeo, pesos, SERVICIOS, type TipoMaquina } from "@/lib/cotizador/estimador"
import { useConfigPrecios } from "@/lib/cotizador/config-precios"
import type { FormatoVista } from "@/lib/hetna/ficha-tecnica"
import { aMmDe, deMmEn, type Medidas, medidasEnUnidad, medidasTrasCambio, type Unidad } from "@/lib/cotizador/medidas-fabricar"

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
  /** Texto con el material del producto ("Pino", "MDF 6 mm"…): sale elegido el que más se parece */
  materialInicial?: string
  /** Título del recuadro (por omisión, según sea físico o diseño) */
  encabezado?: string
  /** Piezas al abrir (10 por omisión; 1 en las piezas impresas, que se compran sueltas) */
  cantidadInicial?: number
  /** Volumen real de la pieza (cm³): sin modelo, en impresión 3D se usa en vez de estimarlo de la caja */
  volumenCm3?: number
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

/**
 * El material de la lista que más se parece al del producto: primero el tipo
 * (pino, MDF, acrílico, aluminio…) y, entre esos, el grosor más cercano si el
 * texto lo trae ("MDF 6 mm"). Si nada coincide, el primero de la lista.
 */
export function indiceMaterial(mats: { nombre: string; espesor: number }[], texto?: string): number {
  const t = sinAcentos(texto || "")
  if (!t || !mats.length) return 0
  const palabra = (m: { nombre: string }) => sinAcentos(m.nombre).split(/[\s(]/)[0] // "pino", "mdf", "acrilico", "aluminio"…
  const tipos = mats.map((m, i) => ({ i, m })).filter(({ m }) => {
    const w = palabra(m)
    return w.length > 2 && new RegExp(`\\b${w}`).test(t)
  })
  if (!tipos.length) return 0
  const grosor = parseFloat((t.match(/(\d+(?:[.,]\d+)?)\s*mm\b/) || [])[1]?.replace(",", ".") || "")
  if (!(grosor > 0) || grosor > 60) return tipos[0].i // "600 mm" es medida, no grosor
  return tipos.reduce((a, b) => (Math.abs(b.m.espesor - grosor) < Math.abs(a.m.espesor - grosor) ? b : a)).i
}

const campo = "mt-1 min-h-[44px] w-full rounded-md border border-[#C5CCD3] bg-white px-2.5 text-[14px] outline-none focus:border-[#E85D04]"
const etiqueta = "block text-[12.5px] font-semibold text-[#1E2329]"

export default function FabricarDiseno({ titulo, handle, formatos, medidas, vistaPrevia, fisico = false, procesoInicial, materialInicial, encabezado, cantidadInicial = 10, volumenCm3 }: Props) {
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
  // Medidas de la ficha: si son de menos de 1 cm sin unidad ("Tabla 2 x 1") no se sabe en qué vienen: se escriben a mano
  const leidas = leerMedidas(medidas)
  const deFicha = leidas && Math.max(leidas.largo, leidas.ancho) >= 10 ? leidas : null
  const [servicio, setServicio] = useState<TipoMaquina>(procesos[0])
  const mats = useMemo(() => materialesPara(servicio), [servicio])
  const [iMat, setIMat] = useState(() => indiceMaterial(materialesPara(procesos[0]), materialInicial))
  // Medidas: ancho × largo × alto, en cm o mm (28 nov 2026, Vlado: se
  // escriben libres; antes, con medidas de la ficha, sólo se escalaban y no se
  // podía borrar el número ni poner el alto). Con «Mantener proporción», cambiar
  // una ajusta las otras para no deformar el diseño.
  const [unidad, setUnidad] = useState<Unidad>("cm")
  // libre por omisión: cada medida se escribe por su lado (la queja era que al poner una cambiaba la otra)
  const [proporcion, setProporcion] = useState(false)
  const [med, setMed] = useState<Medidas | null>(null)
  const [cantidad, setCantidad] = useState(String(cantidadInicial))
  const [conGrabado, setConGrabado] = useState(false)
  const [texto, setTexto] = useState("")

  // al cambiar de proceso, el material del producto si esa máquina lo corta
  const primeraVez = useRef(true)
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false
      return
    }
    setIMat(indiceMaterial(mats, materialInicial))
  }, [mats, materialInicial])

  // Pieza base (tamaño original) y escala que eligió el cliente
  const base: Pieza | null = geo
    ? piezaDeGeo(geo, titulo)
    : deFicha
      ? {
          ...piezaAMano(deFicha.largo, deFicha.ancho, deFicha.alto, "normal", servicio === "impresora_3d"),
          // Sin modelo 3D sólo sabemos la caja que ocupa la pieza. Una pieza
          // impresa llena ~20–40 % de su caja (un soporte en L, ~23 %), no el
          // 60 % que se usa para piezas escritas a mano: con eso 10 soportes
          // NEMA 23 salían en $6,000–8,000.
          ...(servicio === "impresora_3d" ? { volumenCm3: volumenCm3 && volumenCm3 > 0 ? volumenCm3 : ((deFicha.largo * deFicha.ancho * deFicha.alto) / 1000) * 0.3 } : {}),
        }
      : null
  const aMm = (v: string) => aMmDe(v, unidad)
  const deMm = (mm: number) => deMmEn(mm, unidad)
  // ancho ↔ largo de la pieza base (así venían en la ficha)
  const baseDe = { ancho: base?.largo || 0, largo: base?.ancho || 0, alto: base?.alto || 0 }
  // lo que se ve en los campos: lo que escribió el cliente o, al inicio, las medidas del diseño
  const vista = med ?? { ancho: deMm(baseDe.ancho), largo: deMm(baseDe.largo), alto: deMm(baseDe.alto) }
  const baseMm: Medidas | null = base ? { ancho: String(baseDe.ancho), largo: String(baseDe.largo), alto: String(baseDe.alto) } : null
  const cambiarMedida = (clave: keyof Medidas, v: string) => setMed(medidasTrasCambio(vista, clave, v, { proporcion, base: baseMm, unidad }))
  const cambiarUnidad = (u: Unidad) => {
    setMed(medidasEnUnidad(vista, unidad, u))
    setUnidad(u)
  }
  const anchoMm = aMm(vista.ancho), largoMm = aMm(vista.largo), altoMm = aMm(vista.alto)
  // Ancho y largo son obligatorios; el alto sólo en impresión 3D
  const faltaAlto = servicio === "impresora_3d" && !(altoMm > 0) && !(base && baseDe.alto > 0)
  let pieza: Pieza | null = null
  if (anchoMm > 0 && largoMm > 0 && !faltaAlto) {
    if (base) {
      // la pieza del diseño, estirada en cada eje a lo que pidió el cliente
      const kx = baseDe.ancho > 0 ? anchoMm / baseDe.ancho : 1, ky = baseDe.largo > 0 ? largoMm / baseDe.largo : 1
      const kz = baseDe.alto > 0 && altoMm > 0 ? altoMm / baseDe.alto : 1
      pieza = { ...base, largo: base.largo * kx, ancho: base.ancho * ky, alto: baseDe.alto > 0 ? base.alto * kz : altoMm, metrosCorte: base.metrosCorte * Math.sqrt(kx * ky), volumenCm3: base.volumenCm3 * kx * ky * kz }
    } else pieza = piezaAMano(anchoMm, largoMm, altoMm, "normal", servicio === "impresora_3d")
  }
  const cambiado = med !== null

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

  // Las tres medidas y la cantidad, en un solo renglón
  const dims = [
    { clave: "ancho", nombre: "Ancho" },
    { clave: "largo", nombre: "Largo" },
    { clave: "alto", nombre: servicio === "impresora_3d" ? "Alto" : "Alto (opc.)" },
  ] as const
  const [verCalculo, setVerCalculo] = useState(false)

  // Versión corta (23 nov 2026, borrador aprobado por Vlado): proceso y
  // material con buscador, medidas y cantidad en un renglón, y el precio
  // junto al botón. El grabado y el "cómo se calculó" se abren aparte.
  return (
    <section
      id="fabricar"
      aria-labelledby="titulo-fabricar"
      className="scroll-mt-24 rounded-xl border-2 border-[#E85D04] bg-white p-4"
      data-testid="fabricar-con-taller"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="titulo-fabricar" className="fuente-condensada m-0 text-[19px] font-bold uppercase leading-none text-[#1E2329]">
          <T>{encabezado || (fisico ? "Fabrícalo a tu medida" : "Fabrícalo con un taller")}</T>
        </h2>
        <span className="shrink-0 text-[12px] text-[#5B6370]"><T>precio al momento</T></span>
      </div>

      <div className="mt-2.5 grid grid-cols-[1fr_1.3fr] gap-2">
        <label className="block">
          <span className="sr-only"><T>Proceso</T></span>
          <select className={campo + " mt-0"} value={servicio} onChange={(e) => setServicio(e.target.value as TipoMaquina)}>
            {procesos.map((p) => (
              <option key={p} value={p}>
                {SERVICIOS.find((s) => s.clave === p)?.nombre}
              </option>
            ))}
          </select>
        </label>
        <BuscadorMaterial materiales={mats.map((m) => m.nombre)} claves={mats.map((m) => m.clave)} elegido={Math.min(iMat, mats.length - 1)} onElegir={setIMat} />
      </div>

      <div className="mt-2 grid grid-cols-4 gap-2">
        {dims.map((d) => (
          <label key={d.clave} className="block min-w-0">
            <span className="block truncate text-[11px] text-[#5B6370]"><T>{d.nombre}</T> {unidad}</span>
            <input
              className={campo + " mt-0.5"}
              inputMode="decimal"
              placeholder={d.clave === "alto" && servicio !== "impresora_3d" ? "—" : "0"}
              value={vista[d.clave]}
              onChange={(e) => cambiarMedida(d.clave, e.target.value.replace(/[^\d.,]/g, ""))}
            />
          </label>
        ))}
        <label className="block min-w-0">
          <span className="block text-[11px] text-[#5B6370]"><T>Cantidad</T></span>
          <input className={campo + " mt-0.5"} inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        </label>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#5B6370]">
        <span className="inline-flex overflow-hidden rounded-md border border-[#C5CCD3]" role="group" aria-label="Unidad de las medidas">
          {(["cm", "mm"] as const).map((u) => (
            <button key={u} type="button" aria-pressed={unidad === u} onClick={() => cambiarUnidad(u)} className={`min-h-[30px] px-3 font-semibold ${unidad === u ? "bg-[#1E2329] text-white" : "bg-white text-[#1E2329]"}`}>
              {u}
            </button>
          ))}
        </span>
        {base && (
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={proporcion} onChange={(e) => setProporcion(e.target.checked)} />
            <T>Mantener proporción</T>
          </label>
        )}
      </div>

      {conGrabado && servicio !== "impresora_3d" && (
        <input
          className={campo}
          value={texto}
          maxLength={60}
          onChange={(e) => setTexto(e.target.value)}
          placeholder='Texto del grabado, ej. "Familia López 2026"'
          aria-label="Texto del grabado"
        />
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <div className="min-w-[180px] flex-1 rounded-md bg-[#F7F8FA] px-3 py-2" aria-live="polite">
          {!pieza ? (
            <span className="text-[12.5px] text-[#5B6370]"><T>{faltaAlto ? "En impresión 3D escribe también el alto." : "Escribe ancho y largo para ver el precio."}</T></span>
          ) : r && r.ok ? (
            <span className="text-[12.5px] text-[#5B6370]">
              <span className="text-[11px] font-bold uppercase tracking-wide"><T>Aprox.</T></span><T>{" "}</T>
              <b className="text-[18px] text-[#1E2329]">
                {pesos(r.min)} – {pesos(r.max)}
              </b><T>{" "}</T>
              · {n} <T>{n === 1 ? "pieza" : "pzas"}</T>
            </span>
          ) : (
            <span className="text-[12.5px] text-[#9A5B00]"><T>{r && !r.ok ? r.motivo : "No se pudo calcular con esos datos."}</T></span>
          )}
        </div>
        <LocalizedClientLink
          href={liga}
          aria-disabled={!pieza}
          className={`flex min-h-[44px] items-center justify-center rounded-md bg-[#E85D04] px-4 text-[14px] font-bold text-white hover:bg-[#C94F03] ${pieza ? "" : "pointer-events-none opacity-50"}`}
        >
          <T>Pedir propuestas →</T>
        </LocalizedClientLink>
      </div>

      {r && r.ok && r.avisos.length > 0 && (
        <p className="m-0 mt-1.5 text-[12px] text-[#9A5B00]"><T>{r.avisos.join(" ")}</T></p>
      )}
      {verCalculo && r && r.ok && (
        <p className="m-0 mt-1.5 text-[12px] text-[#5B6370]">
          <T>{n > 1 ? `Unos ${pesos(r.precioPieza)} por pieza. ` : ""}</T><T>Material y maquinado, más IVA, sin envío.</T> <T>{r.explicacion}</T>.
        </p>
      )}
      <p className="m-0 mt-1.5 text-[11.5px] leading-snug text-[#5B6370]">
        {servicio !== "impresora_3d" && (
          <>
            <button type="button" onClick={() => setConGrabado(!conGrabado)} className="font-semibold underline">
              <T>{conGrabado ? "Quitar grabado" : "+ Agregar grabado"}</T>
            </button>
            <T>{" · "}</T>
          </>
        )}
        <button type="button" onClick={() => setVerCalculo(!verCalculo)} className="font-semibold underline" aria-expanded={verCalculo}>
          <T>Cómo se calculó</T>
        </button>
        <T>{" · "}</T><T>Precio orientativo; el real lo da cada taller.</T>
        {base && cambiado && (
          <>
            <T>{" · "}</T>
            <button type="button" onClick={() => setMed(null)} className="font-semibold text-[#E85D04] underline">
              <T>Medidas originales</T>
            </button>
          </>
        )}
      </p>
    </section>
  )
}

// Grupos del buscador de material
const GRUPOS: [string, (c: string) => boolean][] = [
  ["Maderas sólidas", (c) => c === "madera"],
  ["Tableros", (c) => ["mdf", "triplay", "melamina"].includes(c)],
  ["Plásticos y espumas", (c) => ["acrilico", "pvc", "espuma"].includes(c)],
  ["Metales", (c) => ["aluminio", "acero", "inox"].includes(c)],
  ["Filamentos y resina", () => true],
]
const grupoDe = (c: string) => GRUPOS.find(([, f]) => f(c))![0]
const sinAcentos = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

/** Selector de material con buscador: escribes "pino" o "acrí" y filtra; sin
 *  escribir se ven todos, agrupados (maderas, tableros, plásticos, metales). */
function BuscadorMaterial({
  materiales,
  claves,
  elegido,
  onElegir,
}: {
  materiales: string[]
  claves: string[]
  elegido: number
  onElegir: (i: number) => void
}) {
  const id = useId()
  const caja = useRef<HTMLDivElement>(null)
  const [abierto, setAbierto] = useState(false)
  const [q, setQ] = useState("")
  const [activo, setActivo] = useState(0)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => !caja.current?.contains(e.target as Node) && setAbierto(false)
    document.addEventListener("mousedown", fuera)
    return () => document.removeEventListener("mousedown", fuera)
  }, [abierto])

  const busca = sinAcentos(q.trim())
  const lista = materiales
    .map((nombre, i) => ({ nombre, i, grupo: grupoDe(claves[i]) }))
    .filter((x) => !busca || sinAcentos(x.nombre).includes(busca) || sinAcentos(x.grupo).includes(busca))
    .sort((a, b) => GRUPOS.findIndex(([g]) => g === a.grupo) - GRUPOS.findIndex(([g]) => g === b.grupo))

  const elegir = (i: number) => {
    onElegir(i)
    setAbierto(false)
    setQ("")
  }

  return (
    <div ref={caja} className="relative">
      <label className="block">
        <span className="sr-only"><T>Material y grosor</T></span>
        <input
          role="combobox"
          aria-expanded={abierto}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          className={campo + " mt-0 pr-7"}
          value={abierto ? q : materiales[elegido] || ""}
          placeholder="Buscar material…"
          onFocus={() => {
            setAbierto(true)
            setQ("")
            setActivo(0)
          }}
          onChange={(e) => {
            setQ(e.target.value)
            setActivo(0)
            setAbierto(true)
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setActivo((a) => Math.min(lista.length - 1, a + 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setActivo((a) => Math.max(0, a - 1))
            } else if (e.key === "Enter" && abierto && lista[activo]) {
              e.preventDefault()
              elegir(lista[activo].i)
            } else if (e.key === "Escape") {
              setAbierto(false)
            }
          }}
        />
      </label>
      <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#5B6370]">
        ▾
      </span>
      {abierto && (
        <ul
          id={`${id}-lista`}
          role="listbox"
          className="absolute left-0 right-0 z-30 m-0 mt-1 max-h-[300px] list-none overflow-y-auto rounded-md border border-[#C5CCD3] bg-white p-0 shadow-lg"
        >
          {lista.length === 0 && <li className="px-3 py-2 text-[13px] text-[#5B6370]"><T>Sin resultados. Prueba con otra palabra.</T></li>}
          {lista.map((x, n) => (
            <li key={x.i} role="presentation">
              {(n === 0 || lista[n - 1].grupo !== x.grupo) && (
                <span className="block bg-[#FAF9F6] px-3 py-1 text-[10.5px] font-bold uppercase tracking-wide text-[#6B6A63]"><T>{x.grupo}</T></span>
              )}
              <button
                type="button"
                role="option"
                aria-selected={x.i === elegido}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(x.i)}
                onMouseEnter={() => setActivo(n)}
                className={`block min-h-[40px] w-full px-3 text-left text-[14px] ${n === activo ? "bg-[#FDECE0]" : ""} ${
                  x.i === elegido ? "font-semibold" : ""
                }`}
              >
                <T>{x.nombre}</T>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
