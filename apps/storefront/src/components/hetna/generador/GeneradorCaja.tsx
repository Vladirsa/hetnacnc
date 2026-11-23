"use client"

// Caja con juntas de dedo dentro del 2D Studio: panel oscuro a la izquierda,
// y a la derecha el plano de corte (Diseño 2D), la caja armada (Vista 3D) y
// los archivos (Exportación). Usa el mismo estudio que Letras 3D.
//
// Tipos: cerrada, abierta (charola) y con tapa sobrepuesta; a cualquiera se
// le pueden poner divisores, asas y (cerrada) ranura de alcancía. El ancho
// de dedo va en automático (4 × espesor) para que al cambiar de material la
// caja siga saliendo; a mano se puede fijar.
import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useParams } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

import {
  Aviso,
  Boton,
  CampoNum,
  Chips,
  Datos,
  Interruptor,
  Opciones,
  TarjetaExport,
  descargar,
  grupoATris,
  numero,
  r1,
} from "@/components/hetna/estudio3d/Controles"
import { mandarAFabricar, materialLaserPorEspesor, materialRouterMDF, mandarPaqueteACotizador, nombresDeArchivo } from "@/lib/generador/aCotizador"
import { PrecioFabricar } from "./PrecioFabricar"
import { aDXF, aSVG, acomodar, areaMaterial, dedoAutomatico, generarCaja, piezasPrueba, type Pieza, type TipoCaja } from "@/lib/generador/caja"
import { piezasAGrupo3D } from "@/lib/generador/caja3d"

const Estudio3D = dynamic(() => import("@/components/hetna/estudio3d/Estudio3D").then((m) => m.Estudio3D), { ssr: false })
const CajaSolido = dynamic(() => import("./CajaSolido"), { ssr: false })

type Unidad = "mm" | "cm" | "in"
const FACTOR: Record<Unidad, number> = { mm: 1, cm: 10, in: 25.4 }
const MAQUINAS = {
  laser: { nombre: "Láser", kerf: "0.15" },
  router: { nombre: "Router CNC", kerf: "0" },
} as const
const ESPESORES = [
  { etiqueta: "MDF 3", mm: 3 },
  { etiqueta: "MDF 6", mm: 6 },
  { etiqueta: "MDF 9", mm: 9 },
  { etiqueta: "MDF 12", mm: 12 },
  { etiqueta: "MDF 18", mm: 18 },
  { etiqueta: "Acrílico 3", mm: 3 },
  { etiqueta: "Acrílico 5", mm: 5 },
]
// Dibujo isométrico chico de cada tipo, para elegir viendo
const ICONOS: Record<TipoCaja, React.ReactNode> = {
  cerrada: (
    <>
      <path d="M6 14l14-7 14 7v14l-14 7-14-7z" />
      <path d="M6 14l14 7 14-7M20 21v14" />
    </>
  ),
  abierta: (
    <>
      <path d="M6 16l14 7 14-7v12l-14 7-14-7z" />
      <path d="M6 16l14-7 14 7M20 23v12" />
    </>
  ),
  separadores: (
    <>
      <path d="M5 14l15 7 15-7-15-7z" />
      <path d="M5 14v8l15 7 15-7v-8M20 21v8" />
      <path d="M12.5 10.5v8M27.5 10.5v8M10 17l15-7" />
    </>
  ),
  apilable: (
    <>
      <path d="M8 22l12 6 12-6v8l-12 6-12-6z" />
      <path d="M8 22l5-2.5M32 22l-5-2.5" />
      <path d="M8 10l12 6 12-6v8l-12 6-12-6z" />
      <path d="M8 10l12-6 12 6" />
    </>
  ),
  bisagra: (
    <>
      <path d="M6 18l14 7 14-7v11l-14 7-14-7z" />
      <path d="M20 25v11" />
      <path d="M6 18L13 6l14 7-7 12" />
      <circle cx="29" cy="20" r="1.6" />
    </>
  ),
  corrediza: (
    <>
      <path d="M6 16l14 7 14-7v12l-14 7-14-7z" />
      <path d="M20 23v12" />
      <path d="M2 11l14 7 14-7" />
      <path d="M2 11l14-7 14 7" strokeDasharray="2 2" />
    </>
  ),
  cajonera: (
    <>
      <path d="M6 12l14-7 14 7v16l-14 7-14-7z" />
      <path d="M6 12l14 7 14-7M20 19v16" />
      <path d="M9 18l9 4.5v8L9 26z" />
      <path d="M12 23.5l3 1.5" />
    </>
  ),
  sobrepuesta: (
    <>
      <path d="M6 20l14 7 14-7v9l-14 7-14-7z" />
      <path d="M20 27v9" />
      <path d="M4 10l16-7 16 7v4l-16 7-16-7z" />
      <path d="M4 10l16 7 16-7M20 17v4" />
    </>
  ),
}

// Más tipos: viven en el catálogo de cajas (motor Boxes.py, /disenar/cajas)
const MAS_TIPOS: { id: string; nombre: string; icono: React.ReactNode }[] = [
  {
    id: "SlidingLidBox",
    nombre: "Tapa corrediza",
    icono: (
      <>
        <path d="M6 18l14 7 14-7v10l-14 7-14-7z" />
        <path d="M10 12l14 7 10-5" />
        <path d="M30 9l6 3" strokeDasharray="2 2" />
      </>
    ),
  },
  {
    id: "HingeBox",
    nombre: "Con bisagra",
    icono: (
      <>
        <path d="M6 20l14 7 14-7v9l-14 7-14-7z" />
        <path d="M6 20L12 6l14 7-6 14" />
      </>
    ),
  },
  {
    id: "SlidingDrawer",
    nombre: "Cajonera",
    icono: (
      <>
        <path d="M8 10h24v22H8z" />
        <path d="M11 14h18v7H11zM11 24h18v5H11z" />
        <path d="M18 17.5h4M18 26.5h4" />
      </>
    ),
  },
  {
    id: "TypeTray",
    nombre: "Divisiones a medida",
    icono: (
      <>
        <path d="M6 10h28v20H6z" />
        <path d="M18 10v20M6 20h12M26 10v20" />
      </>
    ),
  },
  {
    id: "StackableBin",
    nombre: "Contenedor apilable",
    icono: (
      <>
        <path d="M8 8h24v10H8zM8 22h24v10H8z" />
        <path d="M8 13l6-5M8 27l6-5" />
      </>
    ),
  },
  {
    id: "RegularBox",
    nombre: "Poligonal",
    icono: <path d="M20 5l13 9-5 16H12L7 14z" />,
  },
  {
    id: "FlexBox",
    nombre: "Curva (flexible)",
    icono: (
      <>
        <path d="M8 12h16a8 8 0 0 1 8 8v0a8 8 0 0 1-8 8H8z" />
        <path d="M26 13v14M28 15v10" />
      </>
    ),
  },
]

const TIPOS: { id: TipoCaja; nombre: string; nota: string }[] = [
  { id: "cerrada", nombre: "Cerrada", nota: "6 caras, tapa fija con dedos" },
  { id: "abierta", nombre: "Abierta", nota: "Charola u organizador, sin tapa" },
  { id: "sobrepuesta", nombre: "Con tapa", nota: "Tapa que se quita, cae por fuera" },
  { id: "cajonera", nombre: "Cajonera", nota: "Carcasa con un cajón que entra con 1 mm de juego por lado y jaladera" },
  { id: "corrediza", nombre: "Corrediza", nota: "Tapa que corre por una ranura en los costados; travesaño al frente que la sujeta" },
  { id: "bisagra", nombre: "Bisagra", nota: "Tapa que abre girando sobre dos pernos en los costados; se detiene sola a 90°" },
  { id: "apilable", nombre: "Apilable", nota: "Frente bajo para sacar piezas; patas que traban en las muescas del de abajo" },
  { id: "separadores", nombre: "Separadores", nota: "Organizador de cajón: rejilla a media madera con paredes, a la medida de ADENTRO del cajón" },
]

type Modelo = {
  id: string
  nombre: string
  tipo: TipoCaja
  a: number
  f: number
  h: number
  e: number
  cols?: number
  filas?: number
  asas?: boolean
  ranura?: boolean
  tapa?: number
}
// Medidas de arranque, para probar rápido (mm, exteriores)
const MODELOS: Modelo[] = [
  { id: "joyero", nombre: "Joyero", tipo: "sobrepuesta", a: 180, f: 120, h: 70, e: 3, cols: 3, filas: 2, tapa: 25 },
  { id: "regalo", nombre: "Caja de regalo", tipo: "sobrepuesta", a: 200, f: 150, h: 100, e: 3, tapa: 35 },
  { id: "te", nombre: "Caja de té", tipo: "sobrepuesta", a: 240, f: 170, h: 90, e: 3, cols: 3, filas: 2, tapa: 30 },
  { id: "organizador", nombre: "Organizador", tipo: "abierta", a: 300, f: 200, h: 80, e: 6, cols: 3, filas: 2 },
  { id: "lapicero", nombre: "Lapicero", tipo: "abierta", a: 90, f: 90, h: 110, e: 3 },
  { id: "charola", nombre: "Charola con asas", tipo: "abierta", a: 380, f: 260, h: 70, e: 6, asas: true },
  { id: "huacal", nombre: "Huacal", tipo: "abierta", a: 400, f: 300, h: 250, e: 9, asas: true },
  { id: "herramientas", nombre: "Caja de herramientas", tipo: "abierta", a: 420, f: 220, h: 160, e: 9, cols: 2, asas: true },
  { id: "alcancia", nombre: "Alcancía", tipo: "cerrada", a: 140, f: 100, h: 120, e: 3, ranura: true },
  { id: "vino", nombre: "Caja para vino", tipo: "sobrepuesta", a: 110, f: 110, h: 360, e: 6, tapa: 60 },
  { id: "cubo", nombre: "Cubo", tipo: "cerrada", a: 100, f: 100, h: 100, e: 3 },
  { id: "cajon", nombre: "Cajón para mueble", tipo: "abierta", a: 450, f: 400, h: 150, e: 12 },
  { id: "cajonera", nombre: "Cajonera de escritorio", tipo: "cajonera", a: 300, f: 250, h: 110, e: 3 },
  { id: "estuche", nombre: "Estuche de lápices", tipo: "corrediza", a: 210, f: 70, h: 50, e: 3 },
  { id: "cubiertos", nombre: "Organizador de cubiertos", tipo: "separadores", a: 400, f: 450, h: 60, e: 6, cols: 4 },
  { id: "cajon-herr", nombre: "Organizador de herramientas", tipo: "separadores", a: 500, f: 400, h: 70, e: 6, cols: 3, filas: 2 },
  { id: "tornilleria", nombre: "Contenedor de tornillería", tipo: "apilable", a: 120, f: 180, h: 80, e: 3 },
  { id: "gaveta", nombre: "Gaveta apilable grande", tipo: "apilable", a: 250, f: 350, h: 150, e: 6, cols: 2 },
  { id: "joyero-bisagra", nombre: "Joyero con bisagra", tipo: "bisagra", a: 200, f: 140, h: 70, e: 3, cols: 3, filas: 2, tapa: 30 },
  { id: "recuerdos", nombre: "Caja de recuerdos", tipo: "bisagra", a: 300, f: 220, h: 120, e: 6, tapa: 45 },
  { id: "te-corrediza", nombre: "Caja de té corrediza", tipo: "corrediza", a: 240, f: 170, h: 100, e: 3, cols: 3, filas: 2 },
  { id: "cajonera-herr", nombre: "Cajonera para herramientas", tipo: "cajonera", a: 420, f: 320, h: 140, e: 6 },
]

// "1, 1, 2" -> [1, 1, 2]; menos de dos números válidos -> nada
const leerProporciones = (texto: string) => {
  const v = texto.split(/[,;\s]+/).map((x) => parseFloat(x.replace(",", "."))).filter((x) => Number.isFinite(x) && x > 0)
  return v.length >= 2 ? v.slice(0, 12) : undefined
}

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522217076014"

// Definidos fuera del generador: un componente creado dentro del render se
// vuelve a montar en cada tecla y el campo pierde el foco.
const Contador = ({ etiqueta, valor, cambiar }: { etiqueta: string; valor: number; cambiar: (n: number) => void }) => (
  <div className="flex min-w-0 flex-col gap-1">
    <span className="text-[12.5px] text-[#C9D2E0]">{etiqueta}</span>
    <div className="flex items-center rounded-[8px] bg-[#1C2431]">
      <button type="button" aria-label={`Menos: ${etiqueta}`} onClick={() => cambiar(Math.max(1, valor - 1))} className="px-3 py-2 text-[16px] text-[#C9D2E0] hover:text-white">
        −
      </button>
      <span className="flex-1 text-center text-[14px] font-semibold text-white">{valor}</span>
      <button type="button" aria-label={`Más: ${etiqueta}`} onClick={() => cambiar(Math.min(12, valor + 1))} className="px-3 py-2 text-[16px] text-[#C9D2E0] hover:text-white">
        +
      </button>
    </div>
  </div>
)

const Paso = ({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-2.5 rounded-[12px] border border-[#1F2937] bg-[#0F151E] p-3">
    <h3 className="m-0 flex items-center gap-2 text-[13px] font-bold text-white">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-[#C2560A] text-[11px]">{n}</span>
      {titulo}
    </h3>
    {children}
  </section>
)

// La dirección vieja del organizador de cajón abre las cajas en ese tipo
export function GeneradorOrganizadorCaja() {
  return <GeneradorCaja tipoInicial="separadores" />
}

export function GeneradorCaja({ tipoInicial }: { tipoInicial?: TipoCaja }) {
  const sep0 = tipoInicial === "separadores"
  const { locale } = useParams<{ locale: string }>()
  const [aviso, setAviso] = useState("")
  const [unidad, setUnidad] = useState<Unidad>("mm")
  // el organizador arranca con las medidas que tenía antes (cajón de cocina)
  const [ancho, setAncho] = useState(sep0 ? "400" : "200")
  const [fondo, setFondo] = useState(sep0 ? "450" : "150")
  const [alto, setAlto] = useState(sep0 ? "60" : "100")
  const [espesor, setEspesor] = useState(sep0 ? "6" : "3")
  const [dedo, setDedo] = useState("12")
  const [dedoAuto, setDedoAuto] = useState(true)
  const [tipo, setTipo] = useState<TipoCaja>(tipoInicial || "cerrada")
  const [muescas, setMuescas] = useState(true) // separadores: muesca para los dedos
  const [altoTapa, setAltoTapa] = useState("30")
  const [perno, setPerno] = useState("3") // caja con bisagra: diámetro del perno, mm
  const [columnas, setColumnas] = useState(1)
  // divisiones a medida: proporciones como "1,1,2" (vacío = todas iguales)
  const [propAncho, setPropAncho] = useState(sep0 ? "1, 1, 1, 2" : "")
  const [propFondo, setPropFondo] = useState("")
  const [filas, setFilas] = useState(1)
  const [asas, setAsas] = useState(false)
  const [ranura, setRanura] = useState(false)
  const [modelo, setModelo] = useState("")
  const [despiece, setDespiece] = useState(0) // 0 = armada, 100 = piezas separadas

  // Llegar con medidas desde el catálogo: ?tipo=cajonera&x=&y=&h=&thickness=&outside=
  // (x ancho, y fondo, h alto, en mm; outside=0 son medidas interiores)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const num = (k: string) => {
      const v = q.get(k)
      return v && /^[0-9.]+$/.test(v) && Number(v) > 0 ? v : null
    }
    const t = q.get("tipo")
    if (t && TIPOS.some((x) => x.id === t)) setTipo(t as TipoCaja)
    const x = num("x"), y = num("y"), h = num("h"), e = num("thickness")
    if (x) setAncho(x)
    if (y) setFondo(y)
    if (h) setAlto(h)
    if (e) setEspesor(e)
    if (q.get("outside") === "0") setMedidas("interiores")
    else if (q.get("outside") === "1") setMedidas("exteriores")
  }, [])
  const [maquina, setMaquina] = useState<keyof typeof MAQUINAS>("laser")
  const [kerf, setKerf] = useState<string>(MAQUINAS.laser.kerf)
  const [fresa, setFresa] = useState("3.175") // 1/8" en mm, fresa común para madera
  const [medidas, setMedidas] = useState<"exteriores" | "interiores">("exteriores")

  const k = FACTOR[unidad]
  const r = useMemo(
    () =>
      generarCaja({
        ancho: numero(ancho) * k,
        fondo: numero(fondo) * k,
        alto: numero(alto) * k,
        espesor: numero(espesor) * k,
        dedo: dedoAuto ? 0 : numero(dedo) * k,
        kerf: numero(kerf) || 0,
        fresa: maquina === "router" ? numero(fresa) * k || 0 : 0,
        medidas,
        tipo,
        altoTapa: numero(altoTapa) * k,
        perno: numero(perno) || 3,
        columnas,
        filas,
        proporcionesAncho: leerProporciones(propAncho),
        proporcionesFondo: leerProporciones(propFondo),
        asas,
        muescas,
        ranura: tipo === "cerrada" && ranura,
      }),
    [ancho, fondo, alto, espesor, dedo, dedoAuto, kerf, fresa, maquina, medidas, tipo, altoTapa, perno, columnas, filas, propAncho, propFondo, asas, muescas, ranura, k]
  )
  const listo = r.piezas.length > 0
  const ext = r.exterior
  const esp = numero(espesor) * k
  const tapa = tipo === "cerrada" || tipo === "sobrepuesta"
  const nombreTipo = TIPOS.find((x) => x.id === tipo)?.nombre || ""
  const hoja = listo ? acomodar(r.piezas) : null
  const nombreArchivo = `caja-hetna-${r1(ext.ancho)}x${r1(ext.fondo)}x${r1(ext.alto)}mm-e${r1(esp)}`

  // La vista 3D se rearma un instante después de dejar de teclear o mover un
  // slider: rearmar la escena en cada tecla se siente trabado.
  const [rVista, setRVista] = useState(r)
  const [despieceVista, setDespieceVista] = useState(despiece)
  useEffect(() => {
    const id = setTimeout(() => {
      setRVista(r)
      setDespieceVista(despiece)
    }, 140)
    return () => clearTimeout(id)
  }, [r, despiece])

  // La caja armada, como malla para el visor del estudio
  const tris = useMemo(() => {
    const rv = rVista
    if (!rv.piezas.length) return undefined
    try {
      const W = rv.armado.ancho
      const H = rv.armado.alto
      const D = rv.armado.fondo
      // la tapa sobrepuesta se ve levantada y el cajón medio abierto, para que se vea adentro
      const alzar = Math.max(15, rv.exterior.alto * 0.45)
      const jalar = rv.exterior.fondo * 0.45
      const sep = (despieceVista / 100) * Math.max(W, H, D) * 0.6
      const mover = (p: Pieza, d: [number, number, number]): Pieza =>
        p.ubicacion ? { ...p, ubicacion: { ...p.ubicacion, origen: [p.ubicacion.origen[0] + d[0], p.ubicacion.origen[1] + d[1], p.ubicacion.origen[2] + d[2]] } } : p
      // Grupos: la caja, la tapa ("Tapa · …"), la carcasa y el cajón. El
      // despiece separa cada grupo alrededor de su propio centro, así el cajón
      // no choca con la carcasa.
      const grupo = (p: Pieza) => (p.nombre.includes(" · ") ? p.nombre.split(" · ")[0] : "caja")
      const cajas = new Map<string, { mn: number[]; mx: number[] }>()
      for (const p of rv.piezas) {
        const u = p.ubicacion
        if (!u) continue
        const g = cajas.get(grupo(p)) || { mn: [Infinity, Infinity, Infinity], mx: [-Infinity, -Infinity, -Infinity] }
        for (const a of [0, p.ancho]) for (const b of [0, p.alto]) for (const c of [0, esp])
          for (let i = 0; i < 3; i++) {
            const w = u.origen[i] + a * u.ux[i] + b * u.uy[i] + c * u.uz[i]
            g.mn[i] = Math.min(g.mn[i], w)
            g.mx[i] = Math.max(g.mx[i], w)
          }
        cajas.set(grupo(p), g)
      }
      const piezas = rv.piezas.map((p) => {
        const u = p.ubicacion
        if (!u) return p
        let q = p.nombre.startsWith("Tapa · ") ? mover(p, [0, alzar + sep * 0.8, 0]) : p
        if (p.nombre.startsWith("Cajón · ")) q = mover(q, [0, 0, -(jalar + sep * 1.8)])
        // la tapa corrediza se ve medio abierta, saliendo por el frente
        if (p.nombre === "Tapa corrediza") q = mover(q, [0, sep * 0.5, -(rv.exterior.fondo * 0.4 + sep)])
        if (!sep) return q
        // Despiece: cada pieza se aleja del centro de su grupo en la dirección
        // de su espesor; los divisores (al centro) suben.
        const g = cajas.get(grupo(p))!
        const centro = [0, 1, 2].map((i) => (g.mn[i] + g.mx[i]) / 2)
        const tam = [0, 1, 2].map((i) => g.mx[i] - g.mn[i])
        const c = [0, 1, 2].map((i) => u.origen[i] + (p.ancho / 2) * u.ux[i] + (p.alto / 2) * u.uy[i] + (esp / 2) * u.uz[i])
        const dot = (c[0] - centro[0]) * u.uz[0] + (c[1] - centro[1]) * u.uz[1] + (c[2] - centro[2]) * u.uz[2]
        const largo = Math.abs(u.uz[0]) * tam[0] + Math.abs(u.uz[1]) * tam[1] + Math.abs(u.uz[2]) * tam[2]
        const s2 = sep * 0.6
        if (p.nombre.startsWith("Divisor") || Math.abs(dot) < largo * 0.2) q = mover(q, [0, s2 * 1.2, 0])
        else {
          const sg = Math.sign(dot)
          q = mover(q, [u.uz[0] * sg * s2, u.uz[1] * sg * s2, u.uz[2] * sg * s2])
        }
        return q
      })
      // Caja con bisagra: la tapa se ve abierta, girada sobre el eje de los pernos
      const P = rv.pivote
      const abierta = P
        ? piezas.map((p) => {
            if (!p.nombre.startsWith("Tapa abatible · ") || !p.ubicacion) return p
            const th = ((65 + despieceVista * 0.25) * Math.PI) / 180
            const co = Math.cos(th)
            const si = Math.sin(th)
            // giro en el plano (z, y): el frente sube y va hacia atrás
            const gira = (v: [number, number, number]): [number, number, number] => [v[0], -v[2] * si + v[1] * co, v[2] * co + v[1] * si]
            const o = p.ubicacion.origen
            const d = gira([0, o[1] - P.y, o[2] - P.z])
            return {
              ...p,
              ubicacion: {
                origen: [o[0], P.y + d[1], P.z + d[2]] as [number, number, number],
                ux: gira(p.ubicacion.ux),
                uy: gira(p.ubicacion.uy),
                uz: gira(p.ubicacion.uz),
              },
            }
          })
        : piezas
      // Contenedor apilable: se muestra otro encima, trabado en las muescas
      if (rv.paso) {
        const extraY = sep * 0.9
        for (const p of piezas.slice()) if (!p.nombre.startsWith("Encima · ")) piezas.push({ ...mover(p, [0, rv.paso + extraY, 0]), nombre: "Encima · " + p.nombre })
      }
      // La cámara del estudio mira desde +Z; el frente de la caja está en Z = 0.
      // Se refleja a lo fondo para que el frente (y el cajón que sale) quede de
      // cara a quien mira.
      const F = rv.exterior.fondo
      const deFrente = abierta.map((p) =>
        p.ubicacion
          ? {
              ...p,
              ubicacion: {
                origen: [p.ubicacion.origen[0], p.ubicacion.origen[1], F - p.ubicacion.origen[2]] as [number, number, number],
                ux: [p.ubicacion.ux[0], p.ubicacion.ux[1], -p.ubicacion.ux[2]] as [number, number, number],
                uy: [p.ubicacion.uy[0], p.ubicacion.uy[1], -p.ubicacion.uy[2]] as [number, number, number],
                uz: [p.ubicacion.uz[0], p.ubicacion.uz[1], -p.ubicacion.uz[2]] as [number, number, number],
              },
            }
          : p
      )
      return grupoATris(piezasAGrupo3D(deFrente, esp, rv.exterior))
    } catch {
      return undefined
    }
  }, [rVista, despieceVista, esp])

  const vista = useMemo(
    () =>
      listo
        ? aSVG(r.piezas, "vista")
            .replace(/fill="#FDEEE1" fill-opacity="0.55"/g, 'fill="#C9A27A" fill-opacity="0.9"')
            .replace(/stroke="#C2560A" stroke-width="1.4"/g, 'stroke="#FF7A2E" stroke-width="1.4"')
            .replace(/fill="#6B6A63" font-family/g, 'fill="#FFFFFF" font-family')
        : "",
    [r, listo]
  )

  const cambiarUnidad = (u: Unidad) => {
    const conv = (s: string) => {
      const v = numero(s)
      return Number.isFinite(v) ? String(Math.round(((v * FACTOR[unidad]) / FACTOR[u]) * 1000) / 1000) : s
    }
    setAncho(conv(ancho))
    setFondo(conv(fondo))
    setAlto(conv(alto))
    setEspesor(conv(espesor))
    setDedo(conv(dedo))
    setFresa(conv(fresa))
    setAltoTapa(conv(altoTapa))
    setUnidad(u)
  }

  const usarModelo = (id: string) => {
    const m = MODELOS.find((x) => x.id === id)
    if (!m) return
    const a = (mm: number) => String(Math.round((mm / k) * 1000) / 1000)
    setModelo(id)
    setTipo(m.tipo)
    setMedidas("exteriores")
    setAncho(a(m.a))
    setFondo(a(m.f))
    setAlto(a(m.h))
    setEspesor(a(m.e))
    setColumnas(m.cols || 1)
    setPropAncho("")
    setPropFondo("")
    setFilas(m.filas || 1)
    setAsas(!!m.asas)
    setRanura(!!m.ranura)
    if (m.tapa) setAltoTapa(a(m.tapa))
    // el dedo vuelve a automático: así un material grueso no rompe la caja
    setDedoAuto(true)
  }

  const imprimir = () => {
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(
      `<!doctype html><title>${nombreArchivo}</title><style>@page{margin:5mm}body{margin:0}</style>` +
        `<p style="font:12px sans-serif">Imprime al 100% (sin "ajustar a la página"). Medidas en mm.</p>` +
        aSVG(r.piezas, "corte")
    )
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  const mensaje =
    `Hola HETNA CNC, quiero cotizar el corte de una caja con juntas de dedo (${nombreTipo.toLowerCase()}):\n` +
    `- Medidas exteriores: ${r1(ext.ancho)} x ${r1(ext.fondo)} x ${r1(ext.alto)} mm\n` +
    `- Material: ${r1(esp)} mm de espesor\n` +
    `- ${r.piezas.length} piezas${tapa ? " (con tapa)" : " (sin tapa)"}${columnas * filas > 1 ? `, ${columnas * filas} compartimentos` : ""}, ${hoja ? `hoja de ${r1(hoja.ancho)} x ${r1(hoja.alto)} mm` : ""}\n` +
    `- Máquina: ${MAQUINAS[maquina].nombre}`

  const fabricar = () => {
    if (!listo) return
    if (
      !mandarAFabricar(`${nombreArchivo}.dxf`, aDXF(r.piezas), locale, {
        pieza: `Caja con juntas de dedo (${nombreTipo.toLowerCase()})`,
        medidas: `${r1(ext.ancho)} × ${r1(ext.fondo)} × ${r1(ext.alto)} mm`,
        proceso: maquina === "router" ? "Router CNC" : "Corte láser",
      })
    )
      setAviso("El archivo es muy grande para mandarlo. Descárgalo y súbelo en la solicitud.")
  }


  // las medidas de esta caja viajan al generador del catálogo
  const llevarMedidas = listo
    ? `?${new URLSearchParams({ x: String(r1(ext.ancho)), y: String(r1(ext.fondo)), h: String(r1(ext.alto)), thickness: String(r1(esp)), outside: "1" })}`
    : ""
  const volumen = (r.interior.ancho * r.interior.fondo * r.interior.alto) / 1e6 // litros
  const EJES = [
    { id: "x", nombre: "Ancho", color: "#F87171", valor: ancho, cambiar: setAncho },
    { id: "y", nombre: "Fondo", color: "#60A5FA", valor: fondo, cambiar: setFondo },
    { id: "z", nombre: "Alto", color: "#4ADE80", valor: alto, cambiar: setAlto },
  ]
  const minMed = Math.round((30 / k) * 100) / 100
  const maxMed = Math.round((1000 / k) * 100) / 100

  const descargarPrueba = () => {
    const pr = piezasPrueba(esp, numero(kerf) || 0, dedoAuto ? 0 : numero(dedo) * k)
    descargar(`prueba-kerf-e${r1(esp)}.svg`, aSVG(pr, "corte"), "image/svg+xml")
  }


  const panel = (
    <div className="flex flex-col gap-3">
      <Paso n={1} titulo="Tipo de caja">
        <div className="grid grid-cols-3 gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tipo === t.id}
              onClick={() => {
                setTipo(t.id)
                setModelo("")
              }}
              className={`flex flex-col items-center gap-1 rounded-[10px] px-1 py-2 text-[12px] font-semibold transition ${
                tipo === t.id ? "bg-[#C2560A]/20 text-white ring-2 ring-[#F28A3C]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"
              }`}
            >
              <svg viewBox="0 0 40 40" className="h-9 w-9" fill="none" stroke={tipo === t.id ? "#F28A3C" : "#8A97AB"} strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                {ICONOS[t.id]}
              </svg>
              {t.nombre}
            </button>
          ))}
        </div>
        <span className="text-[11.5px] leading-snug text-[#8A97AB]">{TIPOS.find((t) => t.id === tipo)?.nota}</span>
        <span className="mt-1 text-[11.5px] font-bold uppercase tracking-wide text-[#8A97AB]">Más tipos · abren en el catálogo</span>
        <div className="grid grid-cols-4 gap-1.5">
          {MAS_TIPOS.map((t) => (
            <LocalizedClientLink
              key={t.id}
              href={`/disenar/cajas/${t.id}${llevarMedidas}`}
              className="flex flex-col items-center gap-1 rounded-[10px] border border-dashed border-[#2B3648] px-1 py-1.5 text-center text-[10.5px] font-semibold leading-tight text-[#C9D2E0] hover:border-[#F28A3C] hover:text-white"
            >
              <svg viewBox="0 0 40 40" className="h-7 w-7" fill="none" stroke="#8A97AB" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                {t.icono}
              </svg>
              {t.nombre}
            </LocalizedClientLink>
          ))}
          <LocalizedClientLink
            href="/disenar/cajas"
            className="flex flex-col items-center justify-center gap-0.5 rounded-[10px] border border-dashed border-[#C2560A]/60 px-1 py-1.5 text-center text-[10.5px] font-semibold leading-tight text-[#F28A3C] hover:border-[#F28A3C]"
          >
            <span className="text-[15px] font-extrabold">170+</span>
            Ver todas
          </LocalizedClientLink>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MODELOS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => usarModelo(m.id)}
              aria-pressed={modelo === m.id}
              className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
                modelo === m.id ? "bg-[#C2560A] text-white" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045] hover:text-white"
              }`}
            >
              {m.nombre}
            </button>
          ))}
        </div>
      </Paso>

      <Paso n={2} titulo="Medidas">
        <div className="grid grid-cols-2 gap-2">
          <Opciones
            opciones={[
              { id: "mm", nombre: "mm" },
              { id: "cm", nombre: "cm" },
              { id: "in", nombre: "in" },
            ]}
            valor={unidad}
            cambiar={(u) => cambiarUnidad(u as Unidad)}
          />
          <Opciones
            opciones={[
              { id: "exteriores", nombre: "Exterior" },
              { id: "interiores", nombre: "Interior" },
            ]}
            valor={medidas}
            cambiar={(m) => setMedidas(m as "exteriores" | "interiores")}
          />
        </div>
        {EJES.map((e) => (
          <div key={e.id} className="grid grid-cols-[52px_1fr_84px] items-center gap-2">
            <span className="text-[12.5px] font-semibold text-[#C9D2E0]">
              {e.nombre} <span style={{ color: e.color }}>{e.id.toUpperCase()}</span>
            </span>
            <input
              type="range"
              min={minMed}
              max={maxMed}
              step={unidad === "mm" ? 1 : 0.1}
              value={Math.min(maxMed, Math.max(minMed, numero(e.valor) || minMed))}
              onChange={(ev) => e.cambiar(ev.target.value)}
              aria-label={`${e.nombre} (${unidad})`}
              className="w-full"
              style={{ accentColor: e.color }}
            />
            <label className="flex items-center rounded-[8px] bg-[#1C2431] focus-within:ring-1 focus-within:ring-[#C2560A]">
              <input
                type="text"
                inputMode="decimal"
                value={e.valor}
                onChange={(ev) => e.cambiar(ev.target.value)}
                aria-label={e.nombre}
                className="w-full min-w-0 bg-transparent py-1.5 pl-2 text-right text-[14px] font-semibold text-white outline-none"
              />
              <span className="pl-1 pr-2 text-[11px] text-[#8A97AB]">{unidad}</span>
            </label>
          </div>
        ))}
        {(tipo === "sobrepuesta" || tipo === "bisagra") && <CampoNum etiqueta="Alto de la tapa (por fuera)" valor={altoTapa} cambiar={setAltoTapa} sufijo={unidad} />}
        {tipo === "bisagra" && (
          <div className="flex flex-col gap-1">
            <CampoNum etiqueta="Diámetro del perno" valor={perno} cambiar={setPerno} sufijo="mm" />
            <span className="text-[11.5px] leading-snug text-[#8A97AB]">Clavo, tornillo M3 o filamento de 3 mm. El agujero sale del diámetro exacto (justo); para que gire suelto, súbele 0.2 mm.</span>
          </div>
        )}
        {listo && (
          <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-1 rounded-[10px] bg-[#C2560A]/10 px-3 py-2 text-[12px]">
            <dt className="text-[#8A97AB]">Volumen interior</dt>
            <dd className="m-0 text-right font-semibold text-[#F2D29B]">{volumen < 1 ? `${Math.round(volumen * 1000)} ml` : `${volumen.toFixed(2)} L`}</dd>
            <dt className="text-[#8A97AB]">Exterior</dt>
            <dd className="m-0 text-right font-semibold text-white">
              {r1(r.armado.ancho)} × {r1(r.armado.fondo)} × {r1(r.armado.alto)} mm
            </dd>
            <dt className="text-[#8A97AB]">Interior</dt>
            <dd className="m-0 text-right font-semibold text-white">
              {r1(r.interior.ancho)} × {r1(r.interior.fondo)} × {r1(r.interior.alto)} mm
            </dd>
            <dt className="text-[#8A97AB]">Hoja</dt>
            <dd className="m-0 text-right font-semibold text-white">{hoja ? `${r1(hoja.ancho)} × ${r1(hoja.alto)} mm` : "-"}</dd>
          </dl>
        )}
      </Paso>

      <Paso n={3} titulo="Material">
        <CampoNum etiqueta="Espesor" valor={espesor} cambiar={setEspesor} sufijo={unidad} />
        <Chips
          items={ESPESORES.map((e) => ({ id: e.etiqueta, nombre: `${e.etiqueta} mm` }))}
          onClick={(id) => {
            const e = ESPESORES.find((x) => x.etiqueta === id)
            if (e) setEspesor(String(Math.round((e.mm / k) * 1000) / 1000))
          }}
        />
      </Paso>

      <Paso n={4} titulo="Extras">
        <div className="grid grid-cols-2 gap-2">
          <Contador etiqueta="Divisiones a lo ancho" valor={columnas} cambiar={setColumnas} />
          <Contador etiqueta="Divisiones a lo fondo" valor={filas} cambiar={setFilas} />
        </div>
        <details className="rounded-[8px] bg-[#1C2431] px-2.5 py-2" open={Boolean(propAncho || propFondo)}>
          <summary className="cursor-pointer text-[12.5px] font-semibold text-[#C9D2E0]">Divisiones a medida (proporciones)</summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="flex min-w-0 flex-col gap-1 text-[12px] text-[#C9D2E0]">
              A lo ancho
              <input value={propAncho} onChange={(e) => setPropAncho(e.target.value)} placeholder="1, 1, 2" className="w-full rounded-[8px] bg-[#121923] px-2 py-1.5 text-[13.5px] text-white outline-none placeholder:text-[#5B6880] focus:ring-1 focus:ring-[#C2560A]" />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[12px] text-[#C9D2E0]">
              A lo fondo
              <input value={propFondo} onChange={(e) => setPropFondo(e.target.value)} placeholder="2, 1" className="w-full rounded-[8px] bg-[#121923] px-2 py-1.5 text-[13.5px] text-white outline-none placeholder:text-[#5B6880] focus:ring-1 focus:ring-[#C2560A]" />
            </label>
          </div>
          <span className="mt-1 block text-[11px] leading-snug text-[#8A97AB]">&quot;1, 1, 2&quot; = tres compartimentos, el último del doble. Si lo llenas, manda sobre los contadores.</span>
        </details>
        {tipo === "separadores" ? (
          <Interruptor etiqueta="Muescas para los dedos" activo={muescas} cambiar={setMuescas} />
        ) : (
          <Interruptor etiqueta="Asas en los costados" activo={asas} cambiar={setAsas} />
        )}
        {tipo === "cerrada" && <Interruptor etiqueta="Ranura de alcancía en la tapa" activo={ranura} cambiar={setRanura} />}
      </Paso>

      <section className="flex flex-col gap-1.5 px-1">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] font-semibold text-[#C9D2E0]">Ver cómo se arma</span>
          <span className="text-[12px] font-semibold text-[#F28A3C]">{despiece === 0 ? "Armada" : `${despiece}%`}</span>
        </div>
        <input type="range" min={0} max={100} value={despiece} onChange={(e) => setDespiece(Number(e.target.value))} aria-label="Separar las piezas en la vista 3D" style={{ accentColor: "#F28A3C" }} />
      </section>

      <details className="group rounded-[12px] border border-[#1F2937] bg-[#0F151E] p-3">
        <summary className="cursor-pointer list-none text-[13px] font-bold text-white">
          <span className="mr-1 inline-block transition group-open:rotate-90">▸</span> Avanzado: máquina, dedos y kerf
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <Opciones
            opciones={(Object.keys(MAQUINAS) as (keyof typeof MAQUINAS)[]).map((m) => ({ id: m, nombre: MAQUINAS[m].nombre }))}
            valor={maquina}
            cambiar={(m) => {
              setMaquina(m)
              setKerf(MAQUINAS[m].kerf)
            }}
          />
          <Interruptor
            etiqueta={`Dedos automáticos${dedoAuto && listo ? ` (${r1(r.dedoUsado / k)} ${unidad})` : ""}`}
            activo={dedoAuto}
            cambiar={(v) => {
              if (!v) setDedo(String(Math.round(((r.dedoUsado || dedoAutomatico(esp)) / k) * 1000) / 1000))
              setDedoAuto(v)
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            {!dedoAuto && <CampoNum etiqueta="Ancho de dedo" valor={dedo} cambiar={setDedo} sufijo={unidad} />}
            {maquina === "router" ? (
              <CampoNum etiqueta="Diámetro de fresa" valor={fresa} cambiar={setFresa} sufijo={unidad} />
            ) : (
              <CampoNum etiqueta="Kerf (corte)" valor={kerf} cambiar={setKerf} sufijo="mm" />
            )}
          </div>
          <button type="button" onClick={descargarPrueba} className="rounded-[8px] border border-dashed border-[#3A4A63] px-3 py-2 text-left text-[12.5px] text-[#C9D2E0] hover:border-[#F28A3C] hover:text-white">
            Descargar pieza de prueba (SVG): corta dos tiras chicas y revisa que encajen justas antes de cortar la caja.
          </button>
        </div>
      </details>

      {r.errores.map((e) => (
        <Aviso key={e} tipo="error">
          {e}
        </Aviso>
      ))}
      {r.avisos.map((a) => (
        <Aviso key={a}>{a}</Aviso>
      ))}
      {maquina === "router" && numero(fresa) * k > 0 && listo && (
        <Aviso tipo="ok">El archivo ya trae el alivio de esquina (&quot;dogbone&quot;) para tu fresa de {r1(numero(fresa) * k)} mm.</Aviso>
      )}

    </div>
  )

  // Descargas y venta siempre a la mano, al pie del panel
  const pie = (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Boton tipo="primario" onClick={() => listo && descargar(`${nombreArchivo}.dxf`, aDXF(r.piezas), "application/dxf")}>
          DXF
        </Boton>
        <Boton onClick={() => listo && descargar(`${nombreArchivo}.svg`, aSVG(r.piezas, "corte"), "image/svg+xml")}>SVG</Boton>
        <Boton onClick={() => listo && imprimir()}>PDF</Boton>
      </div>
      {/* En celular el precio va aquí; en computadora, en la barra debajo de la
          vista, para no tapar los controles del diseño (Vlado, 23 nov 2026) */}
      {listo && (
        <div className="lg:hidden">
          <PrecioFabricar
            dxf={aDXF(r.piezas)}
            nombreArchivo={nombreArchivo}
            pieza={`Caja con juntas de dedo (${nombreTipo.toLowerCase()})`}
            medidas={`${r1(ext.ancho)} × ${r1(ext.fondo)} × ${r1(ext.alto)} mm`}
            maquina={maquina === "router" ? "router" : "laser"}
            espesorMm={esp}
          />
        </div>
      )}
      <Boton href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`}>Preguntar por WhatsApp</Boton>
      {aviso && <Aviso tipo="error">{aviso}</Aviso>}
    </>
  )

  const diseno2d = (
    <div className="flex h-full flex-col gap-3 p-3 lg:p-4">
      {!listo ? (
        <p className="m-0 text-[14px] text-[#F6B8AE]">{r.errores[0] || "Revisa las medidas del panel."}</p>
      ) : (
        <>
          <div className="hidden sm:block">
            <Datos
              filas={[
                ["Hoja necesaria", hoja ? `${r1(hoja.ancho)} × ${r1(hoja.alto)} mm` : "-"],
                ["Material", `${areaMaterial(r.piezas).toFixed(3)} m²`],
                ["Piezas", `${r.piezas.length}${columnas * filas > 1 ? ` · ${columnas * filas} compartimentos` : ""}`],
                ["Espesor", `${r1(esp)} mm`],
              ]}
            />
          </div>
          <p className="m-0 text-[12px] text-[#C9D2E0] sm:hidden">
            Hoja {hoja ? `${r1(hoja.ancho)} × ${r1(hoja.alto)} mm` : "-"} · {r.piezas.length} piezas · {areaMaterial(r.piezas).toFixed(3)} m²
          </p>
          <div
            className="min-h-[200px] flex-1 rounded-[10px] bg-[#0F151E] p-3 [&>svg]:h-full [&>svg]:max-h-[560px] [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: vista }}
          />
        </>
      )}
    </div>
  )

  const exportacion = !listo ? (
    <p className="m-0 text-[14px] text-[#8A97AB]">Completa las medidas para generar los archivos.</p>
  ) : (
    <div className="flex max-w-[760px] flex-col gap-4">
      <div>
        <h3 className="m-0 text-[18px] font-bold">Archivos de corte</h3>
        <p className="m-0 mt-1 text-[13px] text-[#8A97AB]">Revisa el archivo antes de cortar y haz una prueba en retazo para ajustar el kerf.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TarjetaExport titulo="Para tu máquina" nota="DXF para LightBurn, RDWorks, Aspire o Fusion; SVG para Inkscape o Illustrator.">
          <div className="flex gap-2">
            <Boton tipo="primario" onClick={() => descargar(`${nombreArchivo}.dxf`, aDXF(r.piezas), "application/dxf")}>
              DXF
            </Boton>
            <Boton onClick={() => descargar(`${nombreArchivo}.svg`, aSVG(r.piezas, "corte"), "image/svg+xml")}>SVG</Boton>
            <Boton onClick={imprimir}>PDF</Boton>
          </div>
        </TarjetaExport>
        <TarjetaExport titulo="¿Cuánto cuesta cortarla?" nota="Ve el precio al instante o pídela por WhatsApp.">
          <div className="flex gap-2">
            <Boton
              tipo="verde"
              onClick={() => {
                // Cada pieza con su medida; las iguales (dos laterales) van juntas con su cantidad
                const grupos: { nombres: string[]; pieza: Pieza; cantidad: number }[] = []
                const red = (l: [number, number][]) => l.map(([x, y]) => [Math.round(x * 10), Math.round(y * 10)])
                const firma = (p: Pieza) => JSON.stringify([red(p.contorno), (p.huecos || []).map(red)])
                const vistas = new Map<string, number>()
                for (const p of r.piezas) {
                  const k = firma(p)
                  const i = vistas.get(k)
                  if (i === undefined) { vistas.set(k, grupos.length); grupos.push({ nombres: [p.nombre], pieza: p, cantidad: 1 }) }
                  else { grupos[i].cantidad++; grupos[i].nombres.push(p.nombre) }
                }
                const nombres = nombresDeArchivo(grupos.map((g) => (g.nombres.length > 2 ? g.nombres[0] : g.nombres.join(" y "))), "dxf")
                if (!mandarPaqueteACotizador({
                    proyecto: nombreArchivo,
                    origen: "Cajas",
                    ...(maquina === "router"
                      ? { servicio: "router" as const, material: materialRouterMDF(esp) }
                      : { servicio: "laser_co2" as const, material: "MDF", opciones: { materialLaser: materialLaserPorEspesor(esp) } }),
                    nota: `Caja de ${r1(ext.ancho)} × ${r1(ext.fondo)} × ${r1(ext.alto)} mm en ${r1(esp)} mm, ${r.piezas.length} piezas.`,
                    piezas: grupos.map((g, i) => ({ nombre: nombres[i], contenido: aDXF([g.pieza]), cantidad: g.cantidad })),
                  }, locale))
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
        <span className="text-[13px] text-[#F2D29B]">Un taller de HETNA te la corta y te la envía.</span>
        <div>
          <Boton
            tipo="primario"
            onClick={fabricar}
          >
            Fabrícamelo
          </Boton>
        </div>
      </div>
      {aviso && <Aviso tipo="error">{aviso}</Aviso>}

      <div className="overflow-hidden rounded-[14px] text-[#1B1B18]">
        <CajaSolido piezas={r.piezas} espesor={esp} exterior={ext} nombreArchivo={nombreArchivo} />
      </div>
    </div>
  )

  return (
    <Estudio3D
      llenar
      titulo="Caja con juntas de dedo"
      subtitulo="2D Studio · láser y router"
      materialInicial="mdf"
      lineas
      dePie
      tris={tris}
      panel={panel}
      diseno2d={diseno2d}
      exportacion={exportacion}
      avisos={[]}
      pestanaInicial="vista"
      pie={pie}
      barraFabricar={
        listo ? (
          <PrecioFabricar
            barra
            dxf={aDXF(r.piezas)}
            nombreArchivo={nombreArchivo}
            pieza={`Caja con juntas de dedo (${nombreTipo.toLowerCase()})`}
            medidas={`${r1(ext.ancho)} × ${r1(ext.fondo)} × ${r1(ext.alto)} mm`}
            maquina={maquina === "router" ? "router" : "laser"}
            espesorMm={esp}
          />
        ) : null
      }
      medidasReales={listo ? r.armado : undefined}
      sinPieza={r.errores[0] || "Revisa las medidas del panel."}
      barra={
        listo ? (
          <span>
            · {nombreTipo} · {r.piezas.length} piezas · {r1(esp)} mm · dedo {r1(r.dedoUsado)} mm
          </span>
        ) : null
      }
    />
  )
}
