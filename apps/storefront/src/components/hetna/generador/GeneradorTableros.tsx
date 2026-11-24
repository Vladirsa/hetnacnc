"use client"

// Mueble desde una imagen (2D Studio, Muebles): el cliente sube la foto, boceto
// o plano de cualquier mueble de tablero; la IA lo describe como tableros a
// escala y el motor (lib/generador/tableros.ts) calcula espigas, mortajas y
// alivios. La vista principal es el mueble armado en 3D, hecho con las mismas
// piezas que se cortan. Leer la imagen cuesta 2 créditos (se regresan si no
// sirve); ver, ajustar y medir es gratis; descargar los archivos, 1 crédito.
import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useParams } from "next/navigation"

import { CampoNum, Opciones, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import type { Herramienta, Plano } from "@/lib/generador/ensamble"
import { HOJAS_TABLERO, type Veta, acomodarEnTablero, listaCorteCSV } from "@/lib/generador/acomodoHojas"
import { dibujo } from "@/lib/generador/geo2d"
import { TABLEROS_INICIO, type Tablero, type TipoUnion, UNIONES } from "@/lib/generador/tableros"
import { type DefHerraje, HERRAJE_DE_UNION, HERRAJES_BASE } from "@/lib/generador/herrajes"
import { CAPAS_INICIO, type PlantillasCapas, capaFinal } from "@/lib/generador/capas"
import { dibujoDXF } from "@/lib/generador/vectores"
import { hacerZip } from "@/lib/generador/zip"
import { mandarPaqueteACotizador, materialRouterMDF } from "@/lib/generador/aCotizador"
import { listaCorte } from "@/lib/generador/planosTaller"
import { type DatosPresupuesto, abrirDocumento, htmlEtiquetas, htmlPlanos, htmlPresupuesto } from "@/lib/generador/planosTaller"
import { GRUPOS_MODELO, MODELOS_COCINA, opcionesModelo } from "@/lib/generador/bibliotecaCocina"
import { CATALOGO, miniaturaSVG } from "@/lib/generador/catalogoMuebles"
import { type Abertura, COCINA_INICIO, HABITACION_INICIO, MODULOS, type Modulo, type OpcionesHabitacion, type TipoModulo, cocina, habitacion, proponerModulos } from "@/lib/generador/cocina"
import { GABINETE_INICIO, type OpcionesGabinete, type TipoGabinete, gabinete } from "@/lib/generador/gabinete"
import { DISENOS_FRENTE, type DisenoFrente, TIRADORES, type Tirador, MATERIALES, PREDETERMINADO, ROLES, type Rol, type TableroC, type TipoComponente, agregarComponente, esEstructura, materialDe, muebleCompleto } from "@/lib/generador/componentes"
import { cobrarDescargaMueble, disenarTablerosDesdeImagen } from "@/lib/muebles/acciones"

import { type TipoNuevo, abrirHueco, agregar, duplicar, empujar, mover, quitar, quitarHuecos } from "@/lib/generador/editorTableros"

import { claveDiseno, piezasTendidas, reducirImagen } from "./GeneradorEnsamble"
import { BibliotecaHerrajes, useHerrajes } from "./BibliotecaHerrajes"
import { MisDisenos, PanelCreditos } from "./PanelCuenta"
import { creditosDescarga, textoCreditos } from "@/lib/hetna/precios-diseno"
import type { AmbienteVista, CajaVista, ColocacionVista, VistaEstandar } from "./Mueble3D"
import { SelectorFresa, useFresas } from "./SelectorFresa"
import { Visor3D } from "./Visor3D"

const Mueble3D = dynamic(() => import("./Mueble3D"), { ssr: false })
type Pt = [number, number, number]
const cajaVista = (t: Tablero): CajaVista => ({ lo: [t.x0, t.y0, t.z0], hi: [t.x1, t.y1, t.z1] })
const TABLERO = { ancho: 1220, largo: 2440 }
const PLANOS: { id: Plano; nombre: string }[] = [
  { id: "lateral", nombre: "Costado" },
  { id: "horizontal", nombre: "Repisa" },
  { id: "frontal", nombre: "Frente" },
]

// Ejemplo mientras no hay imagen: un librero
const EJEMPLO: { nombre: string; grosor: number; tableros: Tablero[] } = {
  nombre: "Librero (ejemplo)",
  grosor: 18,
  tableros: [
    { nombre: "Costado izquierdo", plano: "lateral", x0: 0, x1: 18, y0: 0, y1: 300, z0: 0, z1: 1800 },
    { nombre: "Costado derecho", plano: "lateral", x0: 782, x1: 800, y0: 0, y1: 300, z0: 0, z1: 1800 },
    { nombre: "Piso", plano: "horizontal", x0: 18, x1: 782, y0: 0, y1: 300, z0: 60, z1: 78 },
    { nombre: "Repisa 1", plano: "horizontal", x0: 18, x1: 782, y0: 0, y1: 300, z0: 480, z1: 498 },
    { nombre: "Repisa 2", plano: "horizontal", x0: 18, x1: 782, y0: 0, y1: 300, z0: 900, z1: 918 },
    { nombre: "Repisa 3", plano: "horizontal", x0: 18, x1: 782, y0: 0, y1: 300, z0: 1320, z1: 1338 },
    { nombre: "Techo", plano: "horizontal", x0: 18, x1: 782, y0: 0, y1: 300, z0: 1782, z1: 1800 },
    { nombre: "Respaldo", plano: "frontal", x0: 18, x1: 782, y0: 282, y1: 300, z0: 78, z1: 480 },
  ],
}

// tablero nuevo: una repisa al centro del mueble actual
const VISTAS: [VistaEstandar, string][] = [["iso", "Iso"], ["arriba", "Arriba"], ["frente", "Frente"], ["derecha", "Derecha"], ["atras", "Atrás"], ["izquierda", "Izquierda"], ["abajo", "Abajo"]]

// valor guardado en el navegador (precios, capas): se lee al abrir y se guarda al cambiar
function useGuardado<T>(clave: string, inicio: T): [T, (f: (x: T) => T) => void] {
  const [v, setV] = useState<T>(inicio)
  useEffect(() => {
    try {
      const x = localStorage.getItem(clave)
      if (x) setV({ ...inicio, ...JSON.parse(x) })
    } catch {
      // nada guardado
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const cambiar = (f: (x: T) => T) =>
    setV((x) => {
      const n = f(x)
      try {
        localStorage.setItem(clave, JSON.stringify(n))
      } catch {
        // sin espacio
      }
      return n
    })
  return [v, cambiar]
}

function bajarArchivo(nombre: string, datos: BlobPart, tipo: string) {
  const url = URL.createObjectURL(new Blob([datos], { type: tipo }))
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const nombreArchivo = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "pieza"

function tableroNuevo(ts: Tablero[], g: number): Tablero {
  const x1 = Math.max(400, ...ts.map((t) => t.x1)), y1 = Math.max(250, ...ts.map((t) => t.y1)), z1 = Math.max(400, ...ts.map((t) => t.z1))
  const z = Math.round(z1 / 2)
  return { nombre: `Tablero ${ts.length + 1}`, plano: "horizontal", x0: 0, x1, y0: 0, y1, z0: z, z1: z + g }
}

// enfoque "imagen": mueble desde una foto o del catálogo; "cocina": biblioteca de gabinetes de cocina y cocina completa
export function GeneradorTableros({ cabecera, enfoque = "imagen" }: { cabecera?: React.ReactNode; enfoque?: "imagen" | "cocina" }) {
  const inicioCocina = enfoque === "cocina" ? gabinete(opcionesModelo(MODELOS_COCINA[1], MODELOS_COCINA[1].medidas, 18)).tableros : null
  const { locale } = useParams<{ locale: string }>()
  const [nombre, setNombre] = useState(enfoque === "cocina" ? MODELOS_COCINA[1].nombre : EJEMPLO.nombre)
  const [tableros, setTableros] = useState<TableroC[]>(inicioCocina || EJEMPLO.tableros)
  const [esEjemplo, setEsEjemplo] = useState(enfoque !== "cocina")
  const [foto, setFoto] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [lectura, setLectura] = useState<{ texto: string; tipo: "ok" | "aviso" | "error"; login?: boolean; creditos?: boolean } | null>(null)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [textos, setTextos] = useState<Record<string, string>>({}) // lo que el cliente escribe en las medidas de cada tablero
  const [v, setV] = useState<Record<string, string>>({ ancho: "", fondo: "", alto: "", grosor: String(EJEMPLO.grosor), holgura: "0.3", saliente: "0" })
  const [laser, setLaser] = useState(false)
  const [herr, setHerr] = useState("base-r635") // fresa de corte (id de la base)
  const [herrRanura, setHerrRanura] = useState("base-r3")
  const [herrV, setHerrV] = useState("base-v60")
  const { todas: fresas, agregar: agregarFresa } = useFresas()
  // acomodo de espigas y esquinas
  const [alivio, setAlivio] = useState<"hueso" | "t" | "ninguno">("hueso")
  const [numEspigas, setNumEspigas] = useState(0)
  const [anchoEspiga, setAnchoEspiga] = useState("")
  const [esquinas, setEsquinas] = useState<{ tipo: "recta" | "redonda" | "chaflan"; medida: string }>({ tipo: "recta", medida: "10" })
  const [union, setUnion] = useState<TipoUnion>(enfoque === "cocina" ? "confirmat" : "espiga")
  const herrajes = useHerrajes()
  const [herraje, setHerraje] = useState<DefHerraje>(HERRAJES_BASE[0])
  // al escoger Confirmat, Minifix o Taquete se usa ese herraje (con las medidas que el cliente le haya puesto)
  useEffect(() => {
    const id = HERRAJE_DE_UNION[union]
    if (id) setHerraje(herrajes.todos.find((h) => h.id === id) || HERRAJES_BASE[0])
  }, [union, herrajes.todos.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const [movibles, setMovibles] = useState(false) // repisas sobre pines
  const [vista, setVista] = useState<{ cual: VistaEstandar; n: number } | undefined>(undefined)
  const nombreUnion = union === "biblioteca" ? herraje.nombre : UNIONES.find((x) => x.id === union)?.nombre || ""
  const [sel, setSel] = useState<number | null>(null) // pieza seleccionada en el 3D (índice de tablerosFinales)
  const [punto, setPunto] = useState<Pt | null>(null) // donde tocó el cliente
  const [explotar, setExplotar] = useState(0)
  const [rayosX, setRayosX] = useState(false)
  const [verCotas, setVerCotas] = useState(true)
  const [ajustar, setAjustar] = useState(0)
  const [pasado, setPasado] = useState<TableroC[][]>([])
  const [futuro, setFuturo] = useState<TableroC[][]>([])
  const [material, setMaterial] = useState("melamina-blanca")
  const [patas, setPatas] = useState("0")
  const [cantoG, setCantoG] = useState(1)
  const [tirador, setTirador] = useState<Tirador>("jaladera")
  const [disenoFrente, setDisenoFrente] = useState<DisenoFrente>("liso")
  // cocina completa en una pared
  const [varios, setVarios] = useState(false)
  const [pared, setPared] = useState("3000")
  const [conColumna, setConColumna] = useState(true)
  const [modulos, setModulos] = useState<Modulo[]>(() => proponerModulos(3000, true))
  const [conAltos, setConAltos] = useState(true)
  const [conCubierta, setConCubierta] = useState(true)
  const [alturaAltos, setAlturaAltos] = useState(String(COCINA_INICIO.alturaAltos))
  const sumaModulos = modulos.reduce((t, x) => t + (x.ancho || 0), 0)
  // cocina en una habitación (L o U, ventanas, puertas, isla)
  const [hab, setHab] = useState<Omit<OpcionesHabitacion, "grosor" | "isla"> & { conIsla: boolean; islaLargo: number; islaPasillo: number }>({ ...HABITACION_INICIO, conIsla: false, islaLargo: 1800, islaPasillo: 1000 })
  const [habTxt, setHabTxt] = useState<Record<string, string>>({})
  // firma: nombre del primer tablero del diseño (mientras siga ahí, se muestra la escena)
  const [habVista, setHabVista] = useState<{ firma: string; colocacion: ColocacionVista[]; ambiente: AmbienteVista } | null>(null)
  const [verHab, setVerHab] = useState(true)
  const numHab = (k: string, inicial: number, poner: (n: number) => void) => ({
    valor: habTxt[k] ?? String(inicial),
    cambiar: (x: string) => {
      setHabTxt((t) => ({ ...t, [k]: x }))
      if (x.trim() !== "" && Number.isFinite(numero(x))) poner(numero(x))
    },
  })
  const setAb = (i: number, c: Partial<Abertura>) => setHab((h) => ({ ...h, aberturas: h.aberturas.map((a, j) => (j === i ? { ...a, ...c } : a)) }))
  // biblioteca de cocina: modelo elegido y sus medidas
  const [modeloSel, setModeloSel] = useState<string | null>(null)
  const [medModelo, setMedModelo] = useState({ ancho: "", alto: "", fondo: "" })
  const modelos = useMemo(() => (enfoque === "cocina" ? MODELOS_COCINA.map((x) => ({ ...x, svg: miniaturaSVG(gabinete(opcionesModelo(x, x.medidas, 18)).tableros, 120, 64).replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"') })) : []), [enfoque])
  const modeloActual = MODELOS_COCINA.find((x) => x.id === modeloSel) || null
  // miniaturas del catálogo (una vez)
  const catalogo = useMemo(() => CATALOGO.filter((c) => c.categoria !== "Cocina").map((c) => ({ ...c, svg: miniaturaSVG(c.generar(18), 120, 64).replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"') })), [])
  const [gab, setGab] = useState<Omit<OpcionesGabinete, "grosor" | "gFrente">>(GABINETE_INICIO.bajo)
  const [gabTxt, setGabTxt] = useState<Record<string, string>>({})
  const campoGab = (k: "ancho" | "alto" | "fondo" | "zoclo" | "zocloRemetido" | "repisas" | "cajones") => ({
    valor: gabTxt[k] ?? String(gab[k]),
    cambiar: (x: string) => {
      setGabTxt((s) => ({ ...s, [k]: x }))
      if (x.trim() !== "" && Number.isFinite(numero(x))) setGab((g) => ({ ...g, [k]: numero(x) }))
    },
  })
  const [hueco, setHueco] = useState({ ancho: "160", alto: "60" })
  const [pagados, setPagados] = useState<Record<string, boolean>>({})
  const [cobrando, setCobrando] = useState(false)
  const [avisoCobro, setAvisoCobro] = useState<{ texto: string; login?: boolean; creditos?: boolean } | null>(null)
  const cambiar = (k: string) => (x: string) => setV((s) => ({ ...s, [k]: x }))

  const fresaCorte = fresas.find((f) => f.id === herr)
  const herramienta: Herramienta = laser ? { tipo: "laser" } : { tipo: "fresa", diametro: fresaCorte?.diametro || 6.35 }
  const opciones = {
    union,
    herraje,
    tirador,
    disenoFrente,
    material,
    patas: Math.max(0, numero(patas) || 0),
    varios,
    ancho: numero(v.ancho) || undefined,
    fondo: numero(v.fondo) || undefined,
    alto: numero(v.alto) || undefined,
    grosor: numero(v.grosor) || TABLEROS_INICIO.grosor,
    holgura: numero(v.holgura) >= 0 ? numero(v.holgura) : TABLEROS_INICIO.holgura,
    saliente: numero(v.saliente) >= 0 ? numero(v.saliente) : 0,
    herramienta,
    alivio,
    numEspigas,
    anchoEspiga: numero(anchoEspiga) || 0,
    esquinas: { tipo: esquinas.tipo, medida: numero(esquinas.medida) || 0 },
  }
  const clave = JSON.stringify({ tableros, opciones })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const m = useMemo(() => muebleCompleto(tableros, opciones), [clave])
  // ---- acomodo en hojas ----
  const [acomodar, setAcomodar] = useState(false)
  const [hojaId, setHojaId] = useState<string>(HOJAS_TABLERO[0].id)
  const [hojaPropia, setHojaPropia] = useState({ largo: "2440", ancho: "1220" })
  const [ah, setAh] = useState({ separacion: "", margen: "10", copias: "1" })
  const [conVeta, setConVeta] = useState(false)
  const [etiquetas, setEtiquetas] = useState(true)
  const [vetas, setVetas] = useState<Record<string, Veta>>({}) // por nombre de pieza
  const hoja = hojaId === "propia" ? { largo: numero(hojaPropia.largo) || 2440, ancho: numero(hojaPropia.ancho) || 1220 } : HOJAS_TABLERO.find((h) => h.id === hojaId) || HOJAS_TABLERO[0]
  const sepAuto = herramienta.tipo === "fresa" ? herramienta.diametro + 2 : 3
  const separacion = ah.separacion.trim() === "" ? sepAuto : Math.max(0, numero(ah.separacion) || 0)
  const copias = Math.max(1, Math.min(50, Math.round(numero(ah.copias) || 1)))
  const vetaDe = (nombre: string): Veta => vetas[nombre] ?? "largo"
  // piezas de distinto material o grosor van en hojas distintas: un acomodo por grupo
  const acomodo = useMemo(() => {
    if (!acomodar || !m.piezas.length || m.errores.length) return null
    const grupos = new Map<string, { nombre: string; idx: number[] }>()
    m.piezas.forEach((p, i) => {
      const g = Math.round(p.grosor * 10) / 10
      const k = `${p.material}|${g}`
      if (!grupos.has(k)) grupos.set(k, { nombre: `${materialDe(p.material).nombre} ${g} mm`, idx: [] })
      grupos.get(k)!.idx.push(i)
    })
    const res: { nombre: string; r: ReturnType<typeof acomodarEnTablero> }[] = []
    const trazos: ReturnType<typeof acomodarEnTablero>["trazos"] = []
    let dy = 0
    let n0 = 0
    for (const g of grupos.values()) {
      const r = acomodarEnTablero(
        g.idx.map((i) => ({ id: `p${i}`, nombre: m.piezas[i].nombre, trazos: piezasTendidas([m.piezas[i]]), veta: vetaDe(m.piezas[i].nombre), cantidad: copias })),
        { largo: hoja.largo, ancho: hoja.ancho, separacion, margen: Math.max(0, numero(ah.margen) || 0), conVeta, etiquetas, desde: n0 },
      )
      n0 += r.piezas
      for (const t of r.trazos) trazos.push({ ...t, pts: t.pts.map(([x, y]) => [x, y + dy] as [number, number]) })
      dy -= r.hojas.length * (hoja.ancho + 150) + (r.hojas.length ? 250 : 0)
      res.push({ nombre: g.nombre, r })
    }
    const hojasTot = res.reduce((t, x) => t + x.r.hojas.length, 0)
    const area = res.reduce((t, x) => t + x.r.aprovechamiento * x.r.hojas.length, 0)
    return {
      grupos: res,
      hojas: res.flatMap((x) => x.r.hojas),
      piezas: res.reduce((t, x) => t + x.r.piezas, 0),
      noCaben: res.flatMap((x) => x.r.noCaben),
      aprovechamiento: hojasTot ? area / hojasTot : 0,
      trazos,
    }
  }, [acomodar, m, hoja.largo, hoja.ancho, separacion, ah.margen, conVeta, etiquetas, copias, vetas]) // eslint-disable-line react-hooks/exhaustive-deps
  const d = useMemo(() => {
    if (!m.piezas.length || m.errores.length) return null
    if (acomodo && acomodo.hojas.length) return dibujo(acomodo.trazos)
    return dibujo(piezasTendidas(m.piezas))
  }, [m, acomodo])
  const bajarLista = () => {
    if (!acomodo) return
    const numeros = new Map<string, number[]>()
    for (const h of acomodo.hojas) for (const c of h.colocadas) numeros.set(c.id, [...(numeros.get(c.id) || []), c.n])
    // orillas con canto: puertas, frentes y cubierta todo el contorno; la estructura, la orilla del frente
    const yFrente = Math.min(...m.piezas.filter((p) => p.rol === "estructura").flatMap((p) => p.contorno.map(([u, v]) => (p.plano === "lateral" ? u : p.plano === "horizontal" ? v : Infinity))))
    const filas = m.piezas.map((p, i) => {
      const us0 = p.contorno.map((q) => q[0]), vs0 = p.contorno.map((q) => q[1])
      const du = Math.max(...us0) - Math.min(...us0), dv = Math.max(...vs0) - Math.min(...vs0)
      const conCanto = materialDe(p.material).canto
      let l1 = false, l2 = false, a1 = false, a2 = false
      if (conCanto && (p.rol === "puerta" || p.rol === "frente" || p.rol === "cubierta")) l1 = l2 = a1 = a2 = true
      else if (conCanto && p.rol === "estructura") {
        // la orilla del frente: en costados es u mínima (orilla paralela a v); en horizontales es v mínima
        const frenteU = p.plano === "lateral" && Math.abs(Math.min(...us0) - yFrente) < 25
        const frenteV = p.plano === "horizontal" && Math.abs(Math.min(...vs0) - yFrente) < 25
        // una orilla paralela a v mide dv: es larga si dv >= du
        if (frenteU) (dv >= du ? (l1 = true) : (a1 = true))
        if (frenteV) (du >= dv ? (l1 = true) : (a1 = true))
      }
      const us = p.contorno.map((q) => q[0]), vs = p.contorno.map((q) => q[1])
      const a = Math.max(...us) - Math.min(...us), b = Math.max(...vs) - Math.min(...vs)
      return { canto: { l1, l2, a1, a2, grosor: cantoG }, nombre: p.nombre, material: materialDe(p.material).nombre, largo: Math.max(a, b), ancho: Math.min(a, b), grosor: p.grosor, cantidad: copias, veta: conVeta ? vetaDe(p.nombre) : ("libre" as Veta), numeros: (numeros.get(`p${i}`) || []).sort((x, y) => x - y) }
    })
    const url = URL.createObjectURL(new Blob(["\ufeff" + listaCorteCSV(filas)], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `lista-de-corte-${m.medidas.ancho}x${m.medidas.alto}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // ---- editor: cada cambio se hace sobre el mueble ya armado (lo que se ve) ----
  const base = useCallback((): TableroC[] => (m.piezas.length ? [...m.tablerosFinales, ...m.sueltos] : tableros), [m, tableros])
  const aplicar = useCallback(
    (cambio: (ts: TableroC[]) => TableroC[], nuevaSel?: number | null) => {
      const antes = base()
      const despues = cambio(antes)
      if (despues === antes) return
      setPasado((h) => [...h.slice(-49), tableros])
      setFuturo([])
      setTableros(despues)
      setTextos({})
      setEsEjemplo(false)
      // el mueble ya armado trae sus medidas: las totales quedan libres
      setV((x) => ({ ...x, ancho: "", fondo: "", alto: "" }))
      if (nuevaSel !== undefined) setSel(nuevaSel)
    },
    [base, tableros],
  )
  const deshacer = useCallback(() => {
    if (!pasado.length) return
    setFuturo((f) => [tableros, ...f])
    setTableros(pasado[pasado.length - 1])
    setPasado((h) => h.slice(0, -1))
    setSel(null)
  }, [pasado, tableros])
  const rehacer = useCallback(() => {
    if (!futuro.length) return
    setPasado((h) => [...h, tableros])
    setTableros(futuro[0])
    setFuturo((f) => f.slice(1))
    setSel(null)
  }, [futuro, tableros])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) rehacer()
        else deshacer()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault()
        rehacer()
      } else if ((e.key === "Delete" || e.key === "Backspace") && sel !== null) {
        e.preventDefault()
        aplicar((ts) => quitar(ts, sel), null)
      } else if (e.key === "Escape") setSel(null)
    }
    window.addEventListener("keydown", tecla)
    return () => window.removeEventListener("keydown", tecla)
  }, [deshacer, rehacer, aplicar, sel])
  const selT = sel !== null ? m.tablerosFinales[sel] : null
  // piezas para el 3D con el color de su material (memo: el visor rehace las mallas si cambia la lista)
  const piezas3D = useMemo(() => m.piezas.map((p) => ({ ...p, color: materialDe(p.material).color, veta: materialDe(p.material).veta })), [m])
  const agregarTablero = (tipo: TipoNuevo) => {
    // los tableros nuevos de estructura se ajustan sólo a la estructura
    const todos = base()
    const est = todos.filter(esEstructura)
    const r = agregar(est, tipo, punto, opciones.grosor)
    const nuevo = r.tableros[r.tableros.length - 1]
    aplicar(() => [...todos, nuevo], todos.length)
  }
  const agregarComp = (tipo: TipoComponente) => {
    const r = agregarComponente(base(), tipo, punto, opciones.grosor)
    aplicar(() => r.tableros, r.indice)
  }
  // cambiar el grosor de un componente: crece hacia afuera del mueble (la cara que toca la estructura no se mueve)
  const cambiarGrosor = (i: number, g: number) =>
    aplicar((ts) =>
      ts.map((t, j) => {
        if (j !== i) return t
        const ext = [t.x1 - t.x0, t.y1 - t.y0, t.z1 - t.z0]
        const k = ext.indexOf(Math.min(...ext))
        const lo = (["x0", "y0", "z0"] as const)[k], hi = (["x1", "y1", "z1"] as const)[k]
        const haciaAbajo = t.rol === "puerta" || t.rol === "frente" // el frente crece hacia adelante (Y menor)
        return haciaAbajo ? { ...t, [lo]: t[hi] - g } : { ...t, [hi]: t[lo] + g }
      }),
    )

  const areaM2 = useMemo(() => {
    let a = 0
    for (const p of m.piezas) {
      let s = 0
      const c = p.contorno
      for (let i = 0, j = c.length - 1; i < c.length; j = i++) s += (c[j][0] - c[i][0]) * (c[j][1] + c[i][1])
      a += Math.abs(s / 2)
    }
    return a / 1e6
  }, [m])
  const hojasEstimadas = Math.max(1, Math.ceil(areaM2 / ((TABLERO.ancho * TABLERO.largo) / 1e6) / 0.8))

  // ---- capas para el CAM del cliente ----
  const [capas, setCapas] = useGuardado<PlantillasCapas>("hetna-capas", CAPAS_INICIO)
  const capasPropias = (Object.keys(CAPAS_INICIO) as (keyof PlantillasCapas)[]).some((k) => capas[k] !== CAPAS_INICIO[k])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const renombrarCapa = useCallback((c: string) => capaFinal(c, capas), [JSON.stringify(capas)])
  const bajarZip = () => {
    const usados = new Set<string>()
    const archivos = m.piezas.map((p, i) => {
      let base = `${String(i + 1).padStart(2, "0")}-${nombreArchivo(p.nombre)}`
      while (usados.has(base)) base += "b"
      usados.add(base)
      const dib = dibujo(piezasTendidas([p]))
      return { nombre: `${base}.dxf`, texto: dibujoDXF({ ...dib, trazos: dib.trazos.map((t) => ({ ...t, capa: renombrarCapa(t.capa) })) }) }
    })
    bajarArchivo(`mueble-${m.medidas.ancho}x${m.medidas.alto}-piezas.zip`, hacerZip(archivos) as BlobPart, "application/zip")
  }

  // ---- costo: tablero por hoja (por material y grosor), canto por metro y herrajes ----
  const [precios, setPrecios] = useGuardado<Record<string, string>>("hetna-precios", {})
  const costo = useMemo(() => {
    const grupos = new Map<string, { nombre: string; area: number }>()
    for (const p of m.piezas) {
      const g = Math.round(p.grosor * 10) / 10
      const k = `${p.material}|${g}`
      if (!grupos.has(k)) grupos.set(k, { nombre: `${materialDe(p.material).nombre} ${g} mm`, area: 0 })
      let a = 0
      const c = p.contorno
      for (let i = 0, j = c.length - 1; i < c.length; j = i++) a += (c[j][0] - c[i][0]) * (c[j][1] + c[i][1])
      grupos.get(k)!.area += Math.abs(a / 2) / 1e6
    }
    const veces = acomodo ? copias : 1
    const hojaM2 = (acomodo ? hoja.largo * hoja.ancho : TABLERO.ancho * TABLERO.largo) / 1e6 || 2.98
    const filas = [...grupos.entries()].map(([k, g]) => {
      const exacto = acomodo?.grupos.find((x) => x.nombre === g.nombre)?.r.hojas.length
      const hojas = exacto ?? Math.max(1, Math.ceil((g.area * veces) / hojaM2 / 0.8))
      const precio = numero(precios[k] || "") || 0
      return { k, nombre: g.nombre, hojas, exacto: exacto !== undefined, precio, total: hojas * precio }
    })
    const metrosCanto = (m.compras.find((c) => c.nombre.startsWith("Canto de PVC"))?.cantidad || 0) * veces
    const pCanto = numero(precios.canto || "") || 0
    const herr = m.compras.filter((c) => c.precio).map((c) => ({ nombre: c.nombre, cantidad: c.cantidad * veces, total: c.cantidad * veces * (c.precio || 0) }))
    const total = filas.reduce((t, f) => t + f.total, 0) + metrosCanto * pCanto + herr.reduce((t, h) => t + h.total, 0)
    const faltan = filas.some((f) => !f.precio) || (metrosCanto > 0 && !pCanto)
    return { filas, metrosCanto, pCanto, herr, total, faltan, veces }
  }, [m, acomodo, copias, hoja.largo, hoja.ancho, precios])
  const pesos = (n: number) => `$${n.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`

  // ---- cotizador: mandar el mueble acomodado en hojas (área y metros de corte reales) con su resumen ----
  const [avisoCotiz, setAvisoCotiz] = useState("")
  const cotizarMueble = () => {
    if (!m.piezas.length || m.errores.length) return
    // piezas iguales juntas: cada una va con su DXF (sólo el corte) y su cantidad
    const filas = listaCorte(m)
    const piezasPaq = filas.map((f) => {
      const p = m.piezas[f.nums[0] - 1]
      const dib = dibujo(piezasTendidas([p]).filter((t) => t.capa === "corte"))
      return { nombre: `${nombreArchivo(f.nombres[0])}-${f.largo}x${f.ancho}x${f.grosor}.dxf`, contenido: dibujoDXF({ ...dib, trazos: dib.trazos.map((t) => ({ ...t, capa: "corte" })) }), cantidad: f.nums.length }
    })
    const hojasTxt = costo.filas.map((f) => `${f.hojas} ${f.hojas === 1 ? "hoja" : "hojas"} de ${f.nombre}`)
    const herr = m.compras.filter((c) => !/^Canto/.test(c.nombre)).slice(0, 6).map((c) => `${c.cantidad} ${c.nombre}`)
    const nota = [`${nombre}: ${m.piezas.length} piezas, ${Math.round(m.medidas.ancho)} × ${Math.round(m.medidas.fondo)} × ${Math.round(m.medidas.alto)} mm.`, `Material: ${hojasTxt.join(", ")}.`, m.cantoMetros ? `Canto: ${m.cantoMetros} m.` : "", herr.length ? `Herrajes: ${herr.join(", ")}.` : ""].filter(Boolean).join(" ")
    // si todo es MDF del mismo grosor, el cotizador ya sabe el material
    const mats = new Set(m.piezas.map((p) => `${p.material}|${Math.round(p.grosor)}`))
    const unico = mats.size === 1 ? [...mats][0].split("|") : null
    const material = unico && unico[0].startsWith("mdf") ? materialRouterMDF(Number(unico[1])) : undefined
    const ok = mandarPaqueteACotizador({ proyecto: nombre, origen: "muebles", servicio: "router", ...(material ? { material } : {}), nota: nota.slice(0, 900), piezas: piezasPaq }, locale)
    if (!ok) setAvisoCotiz("El proyecto es muy grande para mandarlo así. Descarga los archivos y súbelos en el cotizador.")
  }
  // ---- precios: los del cotizador del taller llenan el costo del mueble ----
  const traerPreciosCotizador = async () => {
    setAvisoCotiz("")
    // Precios del cotizador rápido de este navegador (el esquema viejo
    // taller.* que los guardaba por cuenta se retiró)
    let mats: Record<string, number | null> = {}
    try {
      mats = (JSON.parse(localStorage.getItem("hetna-cotizador") || "null")?.materiales || {}) as Record<string, number | null>
    } catch {
      mats = {}
    }
    const grupoDe = (id: string) => (id.startsWith("melamina") ? "Melamina" : id.startsWith("mdf") || id === "hdf" ? "MDF" : id.startsWith("triplay") ? "Triplay" : id === "encino" ? "Madera sólida" : "")
    const hojaM2 = (TABLERO.ancho * TABLERO.largo) / 1e6
    const nuevos: Record<string, string> = {}
    for (const f of costo.filas) {
      const precioM2 = Number(mats[grupoDe(f.k.split("|")[0])]) || 0
      if (precioM2 > 0) nuevos[f.k] = String(Math.round(precioM2 * hojaM2))
    }
    if (!Object.keys(nuevos).length) return setAvisoCotiz("Tu cotizador todavía no tiene precios de material (MDF, melamina, triplay o madera por m²). Ponlos en Cotizador → Precios de materiales.")
    setPrecios((x) => ({ ...x, ...nuevos }))
    setAvisoCotiz(`Listo: ${Object.keys(nuevos).length} ${Object.keys(nuevos).length === 1 ? "precio" : "precios"} por hoja desde tu cotizador (precio por m² × hoja de ${TABLERO.largo} × ${TABLERO.ancho}).`)
  }

  // ---- planos de taller, etiquetas y presupuesto ----
  const [presu, setPresu] = useGuardado<Omit<DatosPresupuesto, "material" | "partidas" | "cliente" | "nota"> & { manoObraTxt: string; margenTxt: string }>("hetna-presupuesto", {
    taller: "",
    telefono: "",
    manoObra: 0,
    manoObraTxt: "",
    margen: 30,
    margenTxt: "30",
    iva: true,
    vigencia: 15,
    anticipo: 50,
    entrega: "10 días hábiles",
    desglose: false,
  })
  const [cliente, setCliente] = useState("")
  const [avisoDoc, setAvisoDoc] = useState("")
  const datosDoc = () => ({ nombre, m, union: nombreUnion, taller: presu.taller || undefined, vetaLarga: (n: string) => vetaDe(n) !== "ancho" })
  const abrir = (html: string) => setAvisoDoc(abrirDocumento(html) ? "" : "Permite las ventanas emergentes para ver el documento.")
  const verPresupuesto = () => {
    const partidas = [
      ...costo.filas.filter((f) => f.precio).map((f) => ({ concepto: `${f.nombre} (${f.hojas} ${f.hojas === 1 ? "hoja" : "hojas"})`, importe: f.total })),
      ...(costo.pCanto && costo.metrosCanto ? [{ concepto: `Canto (${costo.metrosCanto} m)`, importe: costo.metrosCanto * costo.pCanto }] : []),
      ...(costo.herr.length ? [{ concepto: "Herrajes", importe: costo.herr.reduce((t, h) => t + h.total, 0) }] : []),
    ]
    abrir(htmlPresupuesto(datosDoc(), { ...presu, cliente, nota: "", material: costo.total, partidas }))
  }

  const subirImagen = async (archivo?: File | null) => {
    if (!archivo) return
    setLectura(null)
    setLeyendo(true)
    try {
      const datos = await reducirImagen(archivo)
      setFoto(`data:image/jpeg;base64,${datos}`)
      const r = await disenarTablerosDesdeImagen(datos, "image/jpeg")
      if (!r.ok) setLectura({ texto: r.mensaje, tipo: "error", login: r.noAutenticado, creditos: r.saldoInsuficiente })
      else if (r.lectura.tipo !== "tableros")
        setLectura({ texto: `${r.lectura.notas || "La imagen no parece un mueble de tablero."} ${r.cobrado === 0 ? "No se te cobró." : "No pudimos regresarte los créditos solos: escríbenos y te los devolvemos."}`, tipo: "aviso" })
      else {
        setTableros(r.lectura.tableros)
        setVarios(false)
        setPasado([])
        setFuturo([])
        setSel(null)
        setPunto(null)
        setAjustar((n) => n + 1)
        setTextos({})
        setNombre(r.lectura.nombre)
        setEsEjemplo(false)
        setAbierto(null)
        // la lectura trae sus medidas: los campos de medidas totales quedan vacíos (= las de la imagen)
        setV((s) => ({ ...s, ancho: "", fondo: "", alto: "", grosor: String(r.lectura.grosor) }))
        const conf = r.lectura.confianza === "alta" ? "" : r.lectura.confianza === "media" ? " Revisa las medidas: algunas son estimadas." : " Revisa todas las medidas: la imagen no tenía cotas claras."
        setLectura({ texto: `${r.lectura.notas}${conf}`, tipo: "ok" })
      }
    } catch {
      setLectura({ texto: "No se pudo abrir la imagen. Prueba con un JPG o PNG.", tipo: "error" })
    } finally {
      setLeyendo(false)
    }
  }

  const editar = (i: number, cambio: Partial<Tablero>) => setTableros((ts) => ts.map((t, j) => (j === i ? { ...t, ...cambio } : t)))
  const medidasTxt = `${m.medidas.ancho} × ${m.medidas.fondo} × ${m.medidas.alto} mm`
  const avisos = [...m.errores, ...m.avisos]

  // ---- créditos: cuánto cuesta bajar este diseño (según sus piezas) ----
  const herramientaCobro = varios || enfoque === "cocina" ? "cocina" : "mueble"
  const costoCreditos = creditosDescarga(herramientaCobro, m.piezas.length)
  const pagadoEste = !!pagados[claveDiseno(clave)]
  const [recargaSaldo, setRecargaSaldo] = useState(0)

  // ---- el diseño completo, para guardarlo en la cuenta o en el navegador ----
  const datosDiseno = () => ({
    v: 1,
    nombre,
    tableros,
    union,
    herraje,
    material,
    patas,
    medidas: v,
    tirador,
    disenoFrente,
    varios,
    cantoG,
    movibles,
    esquinas,
    alivio,
    numEspigas,
    anchoEspiga,
    laser,
    herr,
    habVista,
  })
  const aplicarDatos = (d: Record<string, unknown>, nombreD?: string) => {
    if (!Array.isArray(d.tableros) || !d.tableros.length) return false
    const ts = (d.tableros as TableroC[]).filter((t) => t && typeof t.nombre === "string" && [t.x0, t.x1, t.y0, t.y1, t.z0, t.z1].every((n) => Number.isFinite(n)))
    if (!ts.length) return false
    setPasado((p) => [...p.slice(-30), tableros])
    setFuturo([])
    setTableros(ts)
    setEsEjemplo(false)
    setNombre(typeof d.nombre === "string" ? d.nombre : nombreD || "Mi diseño")
    if (typeof d.union === "string" && UNIONES.some((x) => x.id === d.union)) setUnion(d.union as TipoUnion)
    if (d.herraje && typeof d.herraje === "object" && typeof (d.herraje as DefHerraje).id === "string") setHerraje(d.herraje as DefHerraje)
    if (typeof d.material === "string") setMaterial(d.material)
    if (typeof d.patas === "string") setPatas(d.patas)
    if (d.medidas && typeof d.medidas === "object") setV((x) => ({ ...x, ...(d.medidas as Record<string, string>) }))
    if (typeof d.tirador === "string") setTirador(d.tirador as Tirador)
    if (typeof d.disenoFrente === "string") setDisenoFrente(d.disenoFrente as DisenoFrente)
    setVarios(!!d.varios)
    if (typeof d.cantoG === "number") setCantoG(d.cantoG)
    setMovibles(!!d.movibles)
    if (d.esquinas && typeof d.esquinas === "object") setEsquinas(d.esquinas as typeof esquinas)
    if (d.alivio === "hueso" || d.alivio === "t" || d.alivio === "ninguno") setAlivio(d.alivio)
    if (typeof d.numEspigas === "number") setNumEspigas(d.numEspigas)
    if (typeof d.anchoEspiga === "string") setAnchoEspiga(d.anchoEspiga)
    setLaser(!!d.laser)
    if (typeof d.herr === "string") setHerr(d.herr)
    setHabVista(d.habVista && typeof d.habVista === "object" ? (d.habVista as typeof habVista) : null)
    setSel(null)
    setPunto(null)
    setVista(undefined)
    setAjustar((n) => n + 1)
    return true
  }
  // borrador en el navegador: se guarda solo y se recupera al volver (p. ej. después de pagar créditos)
  const claveBorrador = `hetna-borrador-${enfoque}`
  const guardarBorrador = () => {
    if (esEjemplo) return
    try {
      localStorage.setItem(claveBorrador, JSON.stringify({ t: Date.now(), datos: datosDiseno() }))
    } catch {
      // sin espacio: no pasa nada
    }
  }
  useEffect(() => {
    try {
      const b = JSON.parse(localStorage.getItem(claveBorrador) || "null") as { t: number; datos: Record<string, unknown> } | null
      if (b && Date.now() - b.t < 14 * 24 * 3600 * 1000 && aplicarDatos(b.datos)) setLectura({ texto: "Recuperamos el diseño en el que estabas trabajando.", tipo: "ok" })
    } catch {
      // borrador dañado
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(guardarBorrador, 1200)
    return () => clearTimeout(t)
  }, [clave, nombre]) // eslint-disable-line react-hooks/exhaustive-deps

  const interruptorMovibles = (
    <label className="flex items-center justify-between gap-2 text-[12.5px] text-[#C9D2E0]">
      <span>
        Repisas movibles <span className="text-[11.5px] text-[#8A97AB]">(sobre pines, barrenos Ø5 cada 32 mm en los costados)</span>
      </span>
      <input type="checkbox" checked={movibles} onChange={(e) => setMovibles(e.target.checked)} className="h-4 w-4 accent-[#C2560A]" />
    </label>
  )

  const panelCuenta = (
    <Seccion titulo="Créditos y mis diseños">
      <PanelCreditos costo={costoCreditos} pagado={pagadoEste} antesDePagar={guardarBorrador} recarga={recargaSaldo} />
      <MisDisenos
        herramienta={herramientaCobro}
        tipos={["mueble", "cocina"]}
        actual={() => ({ nombre, resumen: `${m.piezas.length} piezas · ${Math.round(m.medidas.ancho)} × ${Math.round(m.medidas.alto)} mm`, datos: datosDiseno() })}
        abrir={(d, n) => {
          if (!aplicarDatos(d, n)) setLectura({ texto: "Ese diseño no se pudo abrir.", tipo: "error" })
        }}
      />
      <span className="text-[11.5px] text-[#8A97AB]">Diseñar, editar, ver medidas, costo y presupuesto es gratis. Pagas al bajar los archivos para fabricar: 1 crédito por cada 40 piezas (un mueble, 1; una cocina, unos 5). El mismo diseño no se vuelve a cobrar.</span>
    </Seccion>
  )

  const panel = (
    <div className="flex flex-col gap-4">
      {panelCuenta}
      {enfoque === "imagen" && (
        <>
      <Seccion titulo="Sube la imagen de tu mueble">
        <label className={`flex cursor-pointer flex-col items-center gap-1 rounded-[10px] border-2 border-dashed border-[#2A3546] p-3 text-center hover:border-[#C2560A] ${leyendo ? "pointer-events-none opacity-60" : ""}`}>
          <span className="text-[13.5px] font-semibold text-white">{leyendo ? "Leyendo la imagen…" : "Foto, boceto, render o plano"}</span>
          <span className="text-[12px] text-[#8A97AB]">La IA lo convierte en piezas para maquilar · 2 créditos</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { subirImagen(e.target.files?.[0]); e.target.value = "" }} />
        </label>
        {foto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="Imagen que subiste" className="max-h-40 w-full rounded-[8px] border border-[#2A3546] bg-white object-contain" />
        )}
        {lectura && (
          <p className={`m-0 text-[12.5px] ${lectura.tipo === "ok" ? "text-[#9FE0B5]" : lectura.tipo === "aviso" ? "text-[#F6D58E]" : "text-[#F6B8AE]"}`}>
            {lectura.texto}{" "}
            {lectura.login && <Link href={`/${locale}/login`} className="underline">Iniciar sesión</Link>}
            {lectura.creditos && <Link href={`/${locale}/user/creditos`} className="underline">Comprar créditos</Link>}
          </p>
        )}
        <span className="text-[11.5px] text-[#5B6880]">
          Funciona con muebles de tablero plano a escuadra (libreros, mesas, bancos, repisas, exhibidores). Curvas e inclinaciones se aproximan con rectángulos. Si la imagen no sirve, no se cobra.
        </span>
      </Seccion>

      <Seccion titulo="Catálogo de muebles">
        <div className="grid grid-cols-3 gap-1.5">
          {catalogo.map((c) => (
            <button
              key={c.id}
              type="button"
              title={`${c.nombre} · ${c.nota}`}
              onClick={() => {
                aplicar(() => c.generar(opciones.grosor), null)
                setVarios(!!c.varios)
                setNombre(c.nombre)
                setUnion(c.union)
                setMaterial(c.material)
                setPunto(null)
                setAjustar((k) => k + 1)
                setLectura(null)
              }}
              className="flex flex-col items-center gap-0.5 rounded-[9px] bg-[#141B26] p-1.5 text-center ring-1 ring-[#2A3546] hover:ring-[#C2560A]"
            >
              {/* miniatura generada aquí mismo (no viene de afuera) */}
              <span className="block h-[56px] w-full" dangerouslySetInnerHTML={{ __html: c.svg }} />
              <span className="text-[11px] font-semibold leading-tight text-white">{c.nombre}</span>
              <span className="text-[10px] leading-tight text-[#8A97AB]">{c.nota}</span>
            </button>
          ))}
        </div>
        <span className="text-[11.5px] text-[#8A97AB]">Elige uno y modifícalo: medidas totales, material, uniones, puertas, cajones, repisas y huecos. Reemplaza el mueble actual (puedes deshacer).</span>
      </Seccion>

        </>
      )}

      {enfoque === "cocina" && (
        <>
      <Seccion titulo="Biblioteca de cocina y muebles">
        {GRUPOS_MODELO.map(([g, etiqueta]) => (
          <div key={g} className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-[#C9D2E0]">{etiqueta}</span>
            <div className="grid grid-cols-3 gap-1.5">
              {modelos.filter((x) => x.grupo === g).map((x) => (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={modeloSel === x.id}
                  onClick={() => {
                    setModeloSel(x.id)
                    setMedModelo({ ancho: String(x.medidas.ancho), alto: String(x.medidas.alto), fondo: String(x.medidas.fondo) })
                  }}
                  className={`flex flex-col items-center gap-0.5 rounded-[9px] p-1.5 text-center ring-1 ${modeloSel === x.id ? "bg-[#2A1C12] ring-[#C2560A]" : "bg-[#141B26] ring-[#2A3546] hover:ring-[#3A4A63]"}`}
                >
                  {/* miniatura generada aquí mismo */}
                  <span className="block h-[50px] w-full" dangerouslySetInnerHTML={{ __html: x.svg }} />
                  <span className="text-[11px] font-semibold leading-tight text-white">{x.nombre}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {modeloActual && (
          <div className="flex flex-col gap-2 rounded-[10px] border border-[#C2560A] bg-[#1A1410] p-2.5">
            <b className="text-[13px] text-white">{modeloActual.nombre}</b>
            <div className="grid grid-cols-3 gap-2">
              <CampoNum etiqueta="Ancho" valor={medModelo.ancho} cambiar={(x) => setMedModelo((m0) => ({ ...m0, ancho: x }))} sufijo="mm" />
              <CampoNum etiqueta="Alto" valor={medModelo.alto} cambiar={(x) => setMedModelo((m0) => ({ ...m0, alto: x }))} sufijo="mm" />
              <CampoNum etiqueta="Fondo" valor={medModelo.fondo} cambiar={(x) => setMedModelo((m0) => ({ ...m0, fondo: x }))} sufijo="mm" />
            </div>
            {interruptorMovibles}
            <button
              type="button"
              onClick={() => {
                const med = { ancho: numero(medModelo.ancho) || modeloActual.medidas.ancho, alto: numero(medModelo.alto) || modeloActual.medidas.alto, fondo: numero(medModelo.fondo) || modeloActual.medidas.fondo }
                const g = gabinete({ ...opcionesModelo(modeloActual, med, opciones.grosor), repisasMovibles: movibles })
                aplicar(() => g.tableros, null)
                setVarios(false)
                setNombre(`${modeloActual.nombre} ${Math.round(med.ancho)} mm`)
                if (union === "espiga" || union === "dedos") setUnion("confirmat")
                setPunto(null)
                setAjustar((k) => k + 1)
                setLectura(g.avisos.length ? { texto: g.avisos.join(" "), tipo: "aviso" } : null)
              }}
              className="rounded-[8px] bg-[#C2560A] px-3 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#A84A08]"
            >
              Abrir en el editor
            </button>
            <span className="text-[11.5px] text-[#8A97AB]">Después cambias material, uniones, puertas, cajones, repisas y huecos en 3D. Reemplaza el mueble actual (puedes deshacer).</span>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Cocina en la habitación (L, U, isla)">
        <div className="grid grid-cols-3 gap-1.5">
          {([["recta", "Recta"], ["L", "En L"], ["U", "En U"]] as const).map(([f, n]) => (
            <button key={f} type="button" aria-pressed={hab.forma === f} onClick={() => setHab((h) => ({ ...h, forma: f }))} className={`rounded-[8px] px-2 py-1.5 text-[12px] font-semibold ${hab.forma === f ? "bg-[#243045] text-white ring-1 ring-[#C2560A]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"}`}>
              {n}
            </button>
          ))}
        </div>
        {hab.forma === "L" && (
          <div className="flex items-center gap-1.5 text-[12px] text-[#C9D2E0]">
            Segunda pared:
            {([["izq", "a la izquierda"], ["der", "a la derecha"]] as const).map(([l, n]) => (
              <button key={l} type="button" aria-pressed={hab.ladoL === l} onClick={() => setHab((h) => ({ ...h, ladoL: l }))} className={`rounded-[6px] px-2 py-1 font-semibold ${hab.ladoL === l ? "bg-[#C2560A] text-white" : "bg-[#1C2431] hover:bg-[#243045]"}`}>
                {n}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <CampoNum etiqueta="Pared del fondo" {...numHab("l0", hab.largos[0], (n) => setHab((h) => ({ ...h, largos: [n, h.largos[1], h.largos[2]] })))} sufijo="mm" />
          {hab.forma !== "recta" && <CampoNum etiqueta={hab.forma === "U" ? "Pared izquierda" : "Segunda pared"} {...numHab("l1", hab.largos[1], (n) => setHab((h) => ({ ...h, largos: [h.largos[0], n, h.largos[2]] })))} sufijo="mm" />}
          {hab.forma === "U" && <CampoNum etiqueta="Pared derecha" {...numHab("l2", hab.largos[2], (n) => setHab((h) => ({ ...h, largos: [h.largos[0], h.largos[1], n] })))} sufijo="mm" />}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-white">Ventanas y puertas</span>
          {hab.aberturas.map((a, i) => (
            <div key={i} className="flex flex-wrap items-end gap-1.5 rounded-[8px] bg-[#111821] p-1.5 text-[11px] text-[#8A97AB]">
              <select value={a.tipo} onChange={(e) => setAb(i, { tipo: e.target.value as Abertura["tipo"], ...(e.target.value === "puerta" ? { sobrePiso: 0, alto: 2100, ancho: 900 } : { sobrePiso: 1100, alto: 1000 }) })} className="rounded-[6px] border border-[#2A3546] bg-[#0B0F15] px-1 py-1 text-[12px] text-white" aria-label="Tipo">
                <option value="ventana">Ventana</option>
                <option value="puerta">Puerta</option>
              </select>
              <select value={a.pared} onChange={(e) => setAb(i, { pared: Number(e.target.value) })} className="rounded-[6px] border border-[#2A3546] bg-[#0B0F15] px-1 py-1 text-[12px] text-white" aria-label="Pared">
                <option value={0}>Fondo</option>
                {hab.forma !== "recta" && <option value={1}>{hab.forma === "U" ? "Izquierda" : "Segunda"}</option>}
                {hab.forma === "U" && <option value={2}>Derecha</option>}
              </select>
              {([["desde", "Desde"], ["ancho", "Ancho"], ["alto", "Alto"], ...(a.tipo === "ventana" ? [["sobrePiso", "Sobre piso"]] : [])] as [keyof Abertura, string][]).map(([k, n]) => (
                <label key={k} className="flex w-[3.9rem] flex-col gap-0.5">
                  {n}
                  <input value={habTxt[`a${i}${k}`] ?? String(a[k])} onChange={(e) => { setHabTxt((t) => ({ ...t, [`a${i}${k}`]: e.target.value })); if (Number.isFinite(numero(e.target.value))) setAb(i, { [k]: numero(e.target.value) }) }} inputMode="numeric" className="rounded-[6px] border border-[#2A3546] bg-[#0B0F15] px-1 py-1 text-[12px] text-white" />
                </label>
              ))}
              <button type="button" onClick={() => { setHab((h) => ({ ...h, aberturas: h.aberturas.filter((_, j) => j !== i) })); setHabTxt({}) }} className="px-1 pb-1 text-[#F6B8AE]" aria-label="Quitar">✕</button>
            </div>
          ))}
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setHab((h) => ({ ...h, aberturas: [...h.aberturas, { tipo: "ventana", pared: 0, desde: 800, ancho: 1000, alto: 1000, sobrePiso: 1100 }] }))} className="rounded-[7px] bg-[#1C2431] px-2 py-1 text-[12px] font-semibold text-[#C9D2E0] hover:bg-[#243045]">+ Ventana</button>
            <button type="button" onClick={() => setHab((h) => ({ ...h, aberturas: [...h.aberturas, { tipo: "puerta", pared: h.forma === "recta" ? 0 : 1, desde: 1200, ancho: 900, alto: 2100, sobrePiso: 0 }] }))} className="rounded-[7px] bg-[#1C2431] px-2 py-1 text-[12px] font-semibold text-[#C9D2E0] hover:bg-[#243045]">+ Puerta</button>
          </div>
          <span className="text-[11px] text-[#8A97AB]">«Desde»: en la pared del fondo, desde la esquina izquierda; en las de los lados, desde la esquina con el fondo.</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-[#C9D2E0]">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={hab.conAltos} onChange={(e) => setHab((h) => ({ ...h, conAltos: e.target.checked }))} className="accent-[#C2560A]" /> Gabinetes altos</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={hab.conColumna} onChange={(e) => setHab((h) => ({ ...h, conColumna: e.target.checked }))} className="accent-[#C2560A]" /> Columna (alacena)</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={hab.conIsla} onChange={(e) => setHab((h) => ({ ...h, conIsla: e.target.checked }))} className="accent-[#C2560A]" /> Isla</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!hab.refri} onChange={(e) => setHab((h) => ({ ...h, refri: e.target.checked }))} className="accent-[#C2560A]" /> Refrigerador</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!hab.lavavajillas} onChange={(e) => setHab((h) => ({ ...h, lavavajillas: e.target.checked }))} className="accent-[#C2560A]" /> Lavavajillas</label>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#C9D2E0]">
          Estufa:
          {([["parrilla", "Parrilla empotrada"], ["libre", "De piso"], ["ninguna", "Sin estufa"]] as const).map(([k, n]) => (
            <button key={k} type="button" aria-pressed={hab.estufa === k} onClick={() => setHab((h) => ({ ...h, estufa: k }))} className={`rounded-[6px] px-2 py-1 font-semibold ${hab.estufa === k ? "bg-[#C2560A] text-white" : "bg-[#1C2431] hover:bg-[#243045]"}`}>
              {n}
            </button>
          ))}
        </div>
        {hab.conIsla && (
          <div className="grid grid-cols-2 gap-2">
            <CampoNum etiqueta="Largo de la isla" {...numHab("isla", hab.islaLargo, (n) => setHab((h) => ({ ...h, islaLargo: n })))} sufijo="mm" />
            <CampoNum etiqueta="Pasillo" {...numHab("pasillo", hab.islaPasillo, (n) => setHab((h) => ({ ...h, islaPasillo: n })))} sufijo="mm" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Altura de los altos" {...numHab("altos", hab.alturaAltos, (n) => setHab((h) => ({ ...h, alturaAltos: n })))} sufijo="mm" />
          <CampoNum etiqueta="Alto del techo" {...numHab("techo", hab.altoTecho, (n) => setHab((h) => ({ ...h, altoTecho: n })))} sufijo="mm" />
        </div>
        {interruptorMovibles}
        <button
          type="button"
          onClick={() => {
            const { conIsla, islaLargo, islaPasillo, ...resto } = hab
            const r = habitacion({ ...resto, grosor: opciones.grosor, repisasMovibles: movibles, isla: conIsla ? { largo: islaLargo, distancia: islaPasillo } : undefined })
            aplicar(() => r.tableros, null)
            setVarios(true)
            setHabVista({ firma: r.tableros[0]?.nombre || "", colocacion: r.colocacion, ambiente: { muros: r.muros, vidrios: r.vidrios, aparatos: r.aparatos } })
            setVerHab(true)
            setNombre(`Cocina ${hab.forma === "recta" ? "recta" : `en ${hab.forma}`} ${Math.round(hab.largos[0])} mm${conIsla ? " con isla" : ""}`)
            if (union === "espiga" || union === "dedos") setUnion("confirmat")
            setPunto(null)
            setVista(undefined)
            setAjustar((n) => n + 1)
            setLectura(r.avisos.length ? { texto: r.avisos.join(" "), tipo: "aviso" } : null)
          }}
          className="rounded-[8px] bg-[#C2560A] px-3 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#A84A08]"
        >
          Crear cocina en la habitación
        </button>
        <span className="text-[11.5px] text-[#8A97AB]">Pone esquineros ciegos en las esquinas, el fregadero bajo la ventana, deja libre donde hay puertas y no pone altos frente a las ventanas. En el 3D la ves en el cuarto; con «Ver recto» la editas pared por pared. Cada pared sale en la lista de corte, los planos y el acomodo.</span>
      </Seccion>

      <Seccion titulo="Cocina completa en una pared">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Largo de la pared" valor={pared} cambiar={setPared} sufijo="mm" />
          <CampoNum etiqueta="Altura de los altos" valor={alturaAltos} cambiar={setAlturaAltos} sufijo="mm" />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-[#C9D2E0]">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={conColumna} onChange={(e) => setConColumna(e.target.checked)} className="accent-[#C2560A]" /> Columna (alacena)</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={conAltos} onChange={(e) => setConAltos(e.target.checked)} className="accent-[#C2560A]" /> Gabinetes altos</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={conCubierta} onChange={(e) => setConCubierta(e.target.checked)} className="accent-[#C2560A]" /> Cubierta corrida</label>
        </div>
        <button type="button" onClick={() => setModulos(proponerModulos(numero(pared) || 3000, conColumna))} className="rounded-[8px] bg-[#1C2431] px-3 py-2 text-[12.5px] font-semibold text-[#C9D2E0] hover:bg-[#243045]">
          Proponer módulos para {Math.round(numero(pared) || 0)} mm
        </button>
        <div className="flex flex-col gap-1.5">
          {modulos.map((md, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[12px]">
              <span className="w-6 text-[#8A97AB]">M{i + 1}</span>
              <select value={md.tipo} onChange={(e) => setModulos((ms) => ms.map((x, j) => (j === i ? { ...x, tipo: e.target.value as TipoModulo } : x)))} className="flex-1 rounded-[7px] border border-[#2A3546] bg-[#0B0F15] px-1.5 py-1 text-[12px] text-white" aria-label={`Tipo del módulo ${i + 1}`}>
                {MODULOS.map((x) => (
                  <option key={x.id} value={x.id}>{x.nombre}</option>
                ))}
              </select>
              <input type="number" value={md.ancho} onChange={(e) => setModulos((ms) => ms.map((x, j) => (j === i ? { ...x, ancho: Number(e.target.value) || 0 } : x)))} className="w-20 rounded-[7px] border border-[#2A3546] bg-[#0B0F15] px-1.5 py-1 text-[12px] text-white" aria-label={`Ancho del módulo ${i + 1}`} />
              <button type="button" onClick={() => setModulos((ms) => ms.filter((_, j) => j !== i))} className="px-1 text-[#F6B8AE]" aria-label={`Quitar módulo ${i + 1}`}>✕</button>
            </div>
          ))}
          <div className="flex items-center justify-between text-[12px]">
            <button type="button" onClick={() => setModulos((ms) => [...ms, { tipo: "puertas", ancho: 600 }])} className="rounded-[7px] bg-[#1C2431] px-2 py-1 font-semibold text-[#C9D2E0] hover:bg-[#243045]">+ Módulo</button>
            <span className={Math.abs(sumaModulos - (numero(pared) || 0)) > 1 ? "text-[#F6D58E]" : "text-[#8A97AB]"}>
              Suma: {Math.round(sumaModulos)} mm{Math.abs(sumaModulos - (numero(pared) || 0)) > 1 ? ` (pared ${Math.round(numero(pared) || 0)})` : ""}
            </span>
          </div>
        </div>
        {interruptorMovibles}
        <button
          type="button"
          disabled={!modulos.length}
          onClick={() => {
            const c = cocina({ ...COCINA_INICIO, modulos, grosor: opciones.grosor, conAltos, cubierta: conCubierta, alturaAltos: numero(alturaAltos) || COCINA_INICIO.alturaAltos, repisasMovibles: movibles })
            aplicar(() => c.tableros, null)
            setVarios(true)
            setHabVista(c.aparatos.length ? { firma: c.tableros[0]?.nombre || "", colocacion: [], ambiente: { muros: [], vidrios: [], aparatos: c.aparatos } } : null)
            setNombre(`Cocina de ${Math.round(c.largo)} mm`)
            if (union === "espiga" || union === "dedos") setUnion("confirmat")
            setPunto(null)
            setAjustar((n) => n + 1)
            setLectura(c.avisos.length ? { texto: c.avisos.join(" "), tipo: "aviso" } : null)
          }}
          className="rounded-[8px] bg-[#C2560A] px-3 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#A84A08] disabled:opacity-50"
        >
          Crear cocina
        </button>
        <span className="text-[11.5px] text-[#8A97AB]">Cada módulo es un gabinete completo (zoclo, fondo en ranura, puertas o cajones); los altos van alineados arriba, contra la pared. Todo sale en una sola lista de corte, acomodo y lista de compra.</span>
      </Seccion>

      <Seccion titulo="Gabinete a la medida">
        <div className="grid grid-cols-3 gap-1.5">
          {([["bajo", "Bajo"], ["alto", "Alto (aéreo)"], ["columna", "Columna"]] as const).map(([t, n]) => (
            <button key={t} type="button" aria-pressed={gab.tipo === t} onClick={() => { setGab(GABINETE_INICIO[t as TipoGabinete]); setGabTxt({}) }} className={`rounded-[8px] px-2 py-1.5 text-[12px] font-semibold ${gab.tipo === t ? "bg-[#243045] text-white ring-1 ring-[#C2560A]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"}`}>
              {n}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <CampoNum etiqueta="Ancho" {...campoGab("ancho")} sufijo="mm" />
          <CampoNum etiqueta="Alto" {...campoGab("alto")} sufijo="mm" />
          <CampoNum etiqueta="Fondo" {...campoGab("fondo")} sufijo="mm" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#C9D2E0]">
          Techo:
          {([["completo", "Completo"], ["travesanos", "Travesaños"], ["sin", "Sin techo"]] as const).map(([t, n]) => (
            <button key={t} type="button" aria-pressed={gab.techo === t} onClick={() => setGab((g) => ({ ...g, techo: t }))} className={`rounded-[6px] px-2 py-1 font-semibold ${gab.techo === t ? "bg-[#C2560A] text-white" : "bg-[#1C2431] hover:bg-[#243045]"}`}>{n}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#C9D2E0]">
          Fondo:
          {([["ranura", "HDF en ranura"], ["clavado", "Clavado"], ["sin", "Sin fondo"]] as const).map(([t, n]) => (
            <button key={t} type="button" aria-pressed={gab.fondoTipo === t} onClick={() => setGab((g) => ({ ...g, fondoTipo: t }))} className={`rounded-[6px] px-2 py-1 font-semibold ${gab.fondoTipo === t ? "bg-[#C2560A] text-white" : "bg-[#1C2431] hover:bg-[#243045]"}`}>{n}</button>
          ))}
        </div>
        {gab.tipo !== "alto" && (
          <div className="grid grid-cols-2 gap-2">
            <CampoNum etiqueta="Zoclo (0 = sin)" {...campoGab("zoclo")} sufijo="mm" />
            <CampoNum etiqueta="Remetido del zoclo" {...campoGab("zocloRemetido")} sufijo="mm" />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#C9D2E0]">
          Frente:
          {([["nada", "Abierto"], ["puerta", "1 puerta"], ["puertas", "2 puertas"], ["cajones", "Cajones"]] as const).map(([t, n]) => (
            <button key={t} type="button" aria-pressed={gab.frente === t} onClick={() => setGab((g) => ({ ...g, frente: t }))} className={`rounded-[6px] px-2 py-1 font-semibold ${gab.frente === t ? "bg-[#C2560A] text-white" : "bg-[#1C2431] hover:bg-[#243045]"}`}>{n}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {gab.frente === "cajones" ? <CampoNum etiqueta="Cuántos cajones" {...campoGab("cajones")} /> : <CampoNum etiqueta="Repisas" {...campoGab("repisas")} />}
        </div>
        {interruptorMovibles}
        <button
          type="button"
          onClick={() => {
            const g = gabinete({ ...gab, grosor: opciones.grosor, gFrente: opciones.grosor, repisasMovibles: movibles })
            aplicar(() => g.tableros, null)
            setVarios(false)
            setNombre(`Gabinete ${gab.tipo === "bajo" ? "bajo" : gab.tipo === "alto" ? "alto" : "columna"} ${Math.round(gab.ancho)} mm`)
            // los gabinetes de cocina van con herraje: confirmat si estaba en caja y espiga
            if (union === "espiga" || union === "dedos") setUnion("confirmat")
            setPunto(null)
            setAjustar((n) => n + 1)
            if (g.avisos.length) setLectura({ texto: g.avisos.join(" "), tipo: "aviso" })
          }}
          className="rounded-[8px] bg-[#C2560A] px-3 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#A84A08]"
        >
          Crear gabinete
        </button>
        <span className="text-[11.5px] text-[#8A97AB]">Reemplaza el mueble actual (puedes deshacer). Sale con zoclo, fondo de HDF en ranura de 4 × 8 mm a 11 mm de la orilla, repisas o cajones con corredera, y lo editas en 3D.</span>
      </Seccion>

        </>
      )}

      <div className="rounded-[10px] border border-[#2A3546] bg-[#141B26] p-3 text-[12.5px] text-[#C9D2E0]">
        <b className="text-white">{nombre}.</b> {m.piezas.length} piezas, {m.uniones} uniones {union === "espiga" ? "de caja y espiga, sin tornillos" : union === "dedos" ? "de dedos en las esquinas (y caja y espiga en las T), sin tornillos" : `con ${nombreUnion.toLowerCase()}`}.
        {esEjemplo && " Es un ejemplo: sube tu imagen para reemplazarlo."}
      </div>

      <Seccion titulo="Editar en 3D">
        <span className="text-[12px] text-[#8A97AB]">
          Toca una pieza para seleccionarla. Arrastra una de sus caras para estirarla; la cara grande la mueve completa (Shift = de 1 en 1 mm). El punto azul marca dónde se agrega o se abre un hueco.
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={!pasado.length} onClick={deshacer} className="flex-1 rounded-[8px] bg-[#1C2431] px-2 py-2 text-[12.5px] font-semibold text-[#C9D2E0] hover:bg-[#243045] disabled:opacity-40">↶ Deshacer</button>
          <button type="button" disabled={!futuro.length} onClick={rehacer} className="flex-1 rounded-[8px] bg-[#1C2431] px-2 py-2 text-[12.5px] font-semibold text-[#C9D2E0] hover:bg-[#243045] disabled:opacity-40">↷ Rehacer</button>
        </div>
        <span className="text-[12px] font-semibold text-[#C9D2E0]">Agregar {punto ? "en el punto azul" : "al centro del mueble"}</span>
        <div className="grid grid-cols-2 gap-2">
          {([["repisa", "Repisa"], ["division", "División"], ["respaldo", "Respaldo"], ["travesano", "Travesaño"]] as const).map(([t, n]) => (
            <button key={t} type="button" onClick={() => agregarTablero(t)} className="rounded-[8px] bg-[#243045] px-2 py-2 text-[12.5px] font-semibold text-white ring-1 ring-[#2F3D55] hover:ring-[#C2560A]">
              + {n}
            </button>
          ))}
        </div>
        <span className="text-[12px] font-semibold text-[#C9D2E0]">Componentes</span>
        <div className="grid grid-cols-3 gap-2">
          {([["puerta", "Puerta"], ["puertas", "2 puertas"], ["cajon", "Cajón"], ["fondo", "Fondo"], ["cubierta", "Cubierta"]] as const).map(([t, n]) => (
            <button key={t} type="button" onClick={() => agregarComp(t)} className="rounded-[8px] bg-[#2A1C12] px-2 py-2 text-[12.5px] font-semibold text-white ring-1 ring-[#5A3A1E] hover:ring-[#C2560A]">
              + {n}
            </button>
          ))}
        </div>
        <span className="text-[11.5px] text-[#8A97AB]">Puertas y cajones llenan el hueco donde tocaste: sobrepuestos, con bisagras de cazoleta o correderas. El fondo y la cubierta cubren todo el mueble.</span>
        {selT && sel !== null && (
          <div className="flex flex-col gap-2 rounded-[10px] border border-[#C2560A] bg-[#1A1410] p-2.5">
            <div className="flex items-center justify-between gap-2 text-[12.5px]">
              <b className="truncate text-white">{selT.nombre}</b>
              <span className="text-[#C9D2E0]">{Math.round(selT.x1 - selT.x0)} × {Math.round(selT.y1 - selT.y0)} × {Math.round(selT.z1 - selT.z0)} mm</span>
            </div>
            <label className="flex items-center justify-between gap-2 text-[12px] text-[#C9D2E0]">
              Es
              <select value={selT.rol || "estructura"} onChange={(e) => aplicar((ts) => ts.map((t, j) => (j === sel ? { ...t, rol: e.target.value as Rol } : t)))} className="rounded-[7px] border border-[#2A3546] bg-[#0B0F15] px-2 py-1 text-[12.5px] text-white">
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </label>
            {selT.rol && selT.rol !== "estructura" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-[12px] text-[#C9D2E0]">
                  Material
                  <select value={selT.material || PREDETERMINADO[selT.rol as Exclude<Rol, "estructura">]?.material || material} onChange={(e) => aplicar((ts) => ts.map((t, j) => (j === sel ? { ...t, material: e.target.value } : t)))} className="rounded-[7px] border border-[#2A3546] bg-[#0B0F15] px-2 py-1 text-[12.5px] text-white">
                    {MATERIALES.map((x) => (
                      <option key={x.id} value={x.id}>{x.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-[#C9D2E0]">
                  Grosor
                  <select value={String(Math.round(Math.min(selT.x1 - selT.x0, selT.y1 - selT.y0, selT.z1 - selT.z0)))} onChange={(e) => cambiarGrosor(sel, Number(e.target.value))} className="rounded-[7px] border border-[#2A3546] bg-[#0B0F15] px-2 py-1 text-[12.5px] text-white">
                    {[...new Set([...materialDe(selT.material || PREDETERMINADO[selT.rol as Exclude<Rol, "estructura">]?.material || material).grosores, Math.round(Math.min(selT.x1 - selT.x0, selT.y1 - selT.y0, selT.z1 - selT.z0))])].sort((a, b) => a - b).map((g) => (
                      <option key={g} value={g}>{g} mm</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {selT.rol === "puerta" && (
              <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#C9D2E0]">
                Bisagras:
                {([["izq", "Izquierda"], ["der", "Derecha"], ["arriba", "Arriba"]] as const).map(([b, n]) => (
                  <button key={b} type="button" aria-pressed={(selT.bisagra || "izq") === b} onClick={() => aplicar((ts) => ts.map((t, j) => (j === sel ? { ...t, bisagra: b } : t)))} className={`rounded-[6px] px-2 py-1 font-semibold ${(selT.bisagra || "izq") === b ? "bg-[#C2560A] text-white" : "bg-[#1C2431] hover:bg-[#243045]"}`}>
                    {n}
                  </button>
                ))}
              </div>
            )}
            {(selT.rol === "puerta" || selT.rol === "frente") && (
              <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#C9D2E0]">
                Jaladera:
                {[0, 96, 128, 160].map((j) => (
                  <button key={j} type="button" aria-pressed={(selT.jaladera || 0) === j} onClick={() => aplicar((ts) => ts.map((t, k) => (k === sel ? { ...t, jaladera: j } : t)))} className={`rounded-[6px] px-2 py-1 font-semibold ${(selT.jaladera || 0) === j ? "bg-[#C2560A] text-white" : "bg-[#1C2431] hover:bg-[#243045]"}`}>
                    {j ? `${j} mm` : "Sin"}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-1.5 text-[12px]">
              {([[0, "←", -10], [0, "→", 10], [2, "↑", 10], [2, "↓", -10], [1, "Al frente", -10], [1, "Atrás", 10]] as const).map(([eje, t, d]) => (
                <button key={t} type="button" onClick={() => aplicar((ts) => mover(ts, sel, [eje === 0 ? d : 0, eje === 1 ? d : 0, eje === 2 ? d : 0]))} className="rounded-[7px] bg-[#1C2431] px-1.5 py-1.5 font-semibold text-[#C9D2E0] hover:bg-[#243045]" title={`Mover 10 mm`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => aplicar((ts) => duplicar(ts, sel), base().length)} className="flex-1 rounded-[7px] bg-[#1C2431] px-2 py-1.5 text-[12.5px] font-semibold text-[#C9D2E0] hover:bg-[#243045]">Duplicar</button>
              <button type="button" onClick={() => aplicar((ts) => quitar(ts, sel), null)} className="flex-1 rounded-[7px] bg-[#2A1C1C] px-2 py-1.5 text-[12.5px] font-semibold text-[#F6B8AE] hover:bg-[#3A2222]">Quitar</button>
            </div>
            <span className="text-[12px] font-semibold text-[#C9D2E0]">Hueco (pasacables, ventana, agarradera)</span>
            <div className="grid grid-cols-2 gap-2">
              <CampoNum etiqueta="Ancho" valor={hueco.ancho} cambiar={(x) => setHueco((h) => ({ ...h, ancho: x }))} sufijo="mm" />
              <CampoNum etiqueta="Alto" valor={hueco.alto} cambiar={(x) => setHueco((h) => ({ ...h, alto: x }))} sufijo="mm" />
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => aplicar((ts) => abrirHueco(ts, sel, numero(hueco.ancho) || 160, numero(hueco.alto) || 60, punto))} className="flex-1 rounded-[7px] bg-[#243045] px-2 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#2C3A52]">
                Abrir hueco {punto ? "en el punto" : "al centro"}
              </button>
              {!!selT.aberturas?.length && (
                <button type="button" onClick={() => aplicar((ts) => quitarHuecos(ts, sel))} className="rounded-[7px] px-2 py-1.5 text-[12.5px] font-semibold text-[#F6B8AE] hover:bg-[#2A1C1C]">
                  Quitar huecos
                </button>
              )}
            </div>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Medidas totales">
        <div className="grid grid-cols-3 gap-2">
          <CampoNum etiqueta="Ancho" valor={v.ancho} cambiar={cambiar("ancho")} sufijo="mm" />
          <CampoNum etiqueta="Fondo" valor={v.fondo} cambiar={cambiar("fondo")} sufijo="mm" />
          <CampoNum etiqueta="Alto" valor={v.alto} cambiar={cambiar("alto")} sufijo="mm" />
        </div>
        <span className="text-[12px] text-[#8A97AB]">
          Vacío = las medidas de la imagen ({m.original.ancho} × {m.original.fondo} × {m.original.alto} mm). Al cambiarlas todo el mueble se ajusta y las uniones se recalculan.
        </span>
      </Seccion>

      <Seccion titulo="Uniones">
        <div className="grid grid-cols-2 gap-2">
          {UNIONES.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={union === x.id}
              onClick={() => setUnion(x.id)}
              className={`flex flex-col items-start rounded-[9px] px-2.5 py-2 text-left ${union === x.id ? "bg-[#2A1C12] ring-1 ring-[#C2560A]" : "bg-[#141B26] ring-1 ring-[#2A3546] hover:ring-[#3A4A63]"}`}
            >
              <span className="text-[13px] font-semibold text-white">{x.nombre}</span>
              <span className="text-[11.5px] text-[#8A97AB]">{x.nota}</span>
            </button>
          ))}
        </div>
        {union !== "espiga" && union !== "dedos" && (
          <BibliotecaHerrajes
            valor={herraje}
            lista={herrajes}
            cambiar={(h) => {
              setHerraje(h)
              const u = (Object.keys(HERRAJE_DE_UNION) as TipoUnion[]).find((k) => HERRAJE_DE_UNION[k] === h.id)
              setUnion(u || "biblioteca")
            }}
          />
        )}
        {union !== "espiga" && union !== "dedos" && (
          <span className="text-[12px] text-[#8A97AB]">
            Las piezas van a tope. Los barrenos de cara salen en el archivo, en capas BARRENO con su diámetro y profundidad (ABAJO = voltea la pieza). Los de canto van marcados en la orilla (capas CANTO) y se hacen con taladro y guía.
          </span>
        )}
        {m.compras.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 rounded-[9px] border border-[#2A3546] bg-[#111821] p-2.5 text-[12.5px] text-[#C9D2E0]">
            {m.compras.map((c) => (
              <li key={c.nombre}>
                <b className="text-white">{c.cantidad}</b> × {c.nombre}
                {c.nota && <span className="block text-[11.5px] text-[#8A97AB]">{c.nota}</span>}
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion titulo="Costo del mueble">
        <span className="text-[11.5px] text-[#8A97AB]">
          Pon tus precios: se guardan en este navegador.{" "}
          {costo.filas.some((f) => !f.exacto) ? "Las hojas son una estimación (80 % de aprovechamiento); con «Acomodo en hojas» salen exactas." : `Hojas exactas del acomodo${costo.veces > 1 ? `, para ${costo.veces} muebles` : ""}.`}
        </span>
        <div className="flex flex-col gap-1 text-[12.5px] text-[#C9D2E0]">
          {costo.filas.map((f) => (
            <div key={f.k} className="flex items-center gap-2">
              <span className="min-w-0 flex-1">
                {f.hojas} {f.hojas === 1 ? "hoja" : "hojas"} · {f.nombre}
              </span>
              <label className="flex items-center gap-1 text-[11.5px] text-[#8A97AB]">
                $/hoja
                <input value={precios[f.k] ?? ""} onChange={(e) => setPrecios((x) => ({ ...x, [f.k]: e.target.value }))} inputMode="decimal" className="w-20 rounded-[6px] border border-[#2A3546] bg-[#0B0F15] px-1.5 py-1 text-right text-white" aria-label={`Precio por hoja de ${f.nombre}`} />
              </label>
              <span className="w-20 text-right text-white">{f.precio ? pesos(f.total) : "—"}</span>
            </div>
          ))}
          {costo.metrosCanto > 0 && (
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1">{costo.metrosCanto} m de canto</span>
              <label className="flex items-center gap-1 text-[11.5px] text-[#8A97AB]">
                $/metro
                <input value={precios.canto ?? ""} onChange={(e) => setPrecios((x) => ({ ...x, canto: e.target.value }))} inputMode="decimal" className="w-20 rounded-[6px] border border-[#2A3546] bg-[#0B0F15] px-1.5 py-1 text-right text-white" aria-label="Precio por metro de canto" />
              </label>
              <span className="w-20 text-right text-white">{costo.pCanto ? pesos(costo.metrosCanto * costo.pCanto) : "—"}</span>
            </div>
          )}
          {costo.herr.map((h) => (
            <div key={h.nombre} className="flex items-center gap-2">
              <span className="min-w-0 flex-1">
                {h.cantidad} × {h.nombre}
              </span>
              <span className="w-20 text-right text-white">{pesos(h.total)}</span>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between border-t border-[#2A3546] pt-1.5 text-[13.5px] font-semibold text-white">
            <span>Costo de material{costo.faltan ? " (faltan precios)" : ""}</span>
            <span>{pesos(costo.total)}</span>
          </div>
        </div>
        <button type="button" onClick={traerPreciosCotizador} className="self-start rounded-[7px] bg-[#1C2431] px-2 py-1 text-[12px] font-semibold text-[#C9D2E0] hover:bg-[#243045]">
          Traer precios de mi cotizador
        </button>
        <span className="text-[11.5px] text-[#8A97AB]">El precio de cada herraje se cambia en Uniones → Ajustar medidas. No incluye mano de obra ni corte.</span>
      </Seccion>

      <Seccion titulo="Planos, etiquetas y presupuesto">
        <span className="text-[11.5px] text-[#8A97AB]">Se abren en otra pestaña: de ahí imprimes o guardas en PDF.</span>
        {pagados[claveDiseno(clave)] ? (
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" onClick={() => abrir(htmlPlanos(datosDoc()))} className="rounded-[8px] bg-[#1C2431] px-2 py-2 text-[12.5px] font-semibold text-white hover:bg-[#243045]">
              Planos de taller
              <span className="block text-[11px] font-normal text-[#8A97AB]">Vistas acotadas, lista de corte y plano de cada pieza</span>
            </button>
            <button type="button" onClick={() => abrir(htmlEtiquetas(datosDoc(), acomodo ? copias : 1))} className="rounded-[8px] bg-[#1C2431] px-2 py-2 text-[12.5px] font-semibold text-white hover:bg-[#243045]">
              Etiquetas con QR
              <span className="block text-[11px] font-normal text-[#8A97AB]">Hoja A4 de 24 (70 × 37 mm)</span>
            </button>
          </div>
        ) : (
          <span className="text-[12px] text-[#8A97AB]">Los planos de taller y las etiquetas se activan al descargar el diseño (1 crédito). El presupuesto es gratis.</span>
        )}
        <div className="flex flex-col gap-1.5 rounded-[9px] border border-[#2A3546] bg-[#111821] p-2.5">
          <span className="text-[12.5px] font-semibold text-white">Presupuesto para tu cliente</span>
          <div className="grid grid-cols-2 gap-1.5">
            <label className="flex flex-col gap-0.5 text-[11px] text-[#8A97AB]">
              Tu taller
              <input value={presu.taller} onChange={(e) => setPresu((x) => ({ ...x, taller: e.target.value.slice(0, 60) }))} className="rounded-[6px] border border-[#2A3546] bg-[#0B0F15] px-1.5 py-1 text-[12px] text-white" />
            </label>
            <label className="flex flex-col gap-0.5 text-[11px] text-[#8A97AB]">
              Teléfono
              <input value={presu.telefono} onChange={(e) => setPresu((x) => ({ ...x, telefono: e.target.value.slice(0, 30) }))} className="rounded-[6px] border border-[#2A3546] bg-[#0B0F15] px-1.5 py-1 text-[12px] text-white" />
            </label>
            <label className="col-span-2 flex flex-col gap-0.5 text-[11px] text-[#8A97AB]">
              Cliente
              <input value={cliente} onChange={(e) => setCliente(e.target.value.slice(0, 80))} className="rounded-[6px] border border-[#2A3546] bg-[#0B0F15] px-1.5 py-1 text-[12px] text-white" />
            </label>
            <label className="flex flex-col gap-0.5 text-[11px] text-[#8A97AB]">
              Mano de obra $
              <input value={presu.manoObraTxt} onChange={(e) => setPresu((x) => ({ ...x, manoObraTxt: e.target.value, manoObra: Math.max(0, numero(e.target.value) || 0) }))} inputMode="decimal" className="rounded-[6px] border border-[#2A3546] bg-[#0B0F15] px-1.5 py-1 text-right text-[12px] text-white" />
            </label>
            <label className="flex flex-col gap-0.5 text-[11px] text-[#8A97AB]">
              Utilidad %
              <input value={presu.margenTxt} onChange={(e) => setPresu((x) => ({ ...x, margenTxt: e.target.value, margen: Math.max(0, numero(e.target.value) || 0) }))} inputMode="decimal" className="rounded-[6px] border border-[#2A3546] bg-[#0B0F15] px-1.5 py-1 text-right text-[12px] text-white" />
            </label>
            <label className="flex flex-col gap-0.5 text-[11px] text-[#8A97AB]">
              Anticipo %
              <input value={String(presu.anticipo)} onChange={(e) => setPresu((x) => ({ ...x, anticipo: Math.min(100, Math.max(0, Math.round(numero(e.target.value) || 0))) }))} inputMode="numeric" className="rounded-[6px] border border-[#2A3546] bg-[#0B0F15] px-1.5 py-1 text-right text-[12px] text-white" />
            </label>
            <label className="flex flex-col gap-0.5 text-[11px] text-[#8A97AB]">
              Entrega
              <input value={presu.entrega} onChange={(e) => setPresu((x) => ({ ...x, entrega: e.target.value.slice(0, 40) }))} className="rounded-[6px] border border-[#2A3546] bg-[#0B0F15] px-1.5 py-1 text-[12px] text-white" />
            </label>
          </div>
          <div className="flex flex-wrap gap-3 text-[12px] text-[#C9D2E0]">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={presu.iva} onChange={(e) => setPresu((x) => ({ ...x, iva: e.target.checked }))} className="h-3.5 w-3.5 accent-[#C2560A]" />
              Sumar IVA 16 %
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={presu.desglose} onChange={(e) => setPresu((x) => ({ ...x, desglose: e.target.checked }))} className="h-3.5 w-3.5 accent-[#C2560A]" />
              Desglosar materiales
            </label>
          </div>
          {(() => {
            const sub = (costo.total + presu.manoObra) * (1 + presu.margen / 100)
            const total = sub * (presu.iva ? 1.16 : 1)
            return (
              <div className="flex items-center justify-between text-[13px] text-white">
                <span>Precio al cliente{costo.faltan ? <span className="text-[11.5px] text-[#F6D58E]"> (faltan precios arriba)</span> : null}</span>
                <b>{pesos(Math.round(total * 100) / 100)}</b>
              </div>
            )
          })()}
          <button type="button" disabled={!m.piezas.length} onClick={verPresupuesto} className="rounded-[8px] bg-[#C2560A] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#A84A08] disabled:opacity-50">
            Ver presupuesto
          </button>
          <button type="button" disabled={!m.piezas.length || !!m.errores.length} onClick={cotizarMueble} className="rounded-[8px] bg-[#16794F] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#12623F] disabled:opacity-50">
            Cotizar con mi tarifa (Cotizador CNC)
          </button>
          <span className="text-[11px] text-[#8A97AB]">Manda cada pieza con su cantidad: el cotizador precia el proyecto completo con tus tarifas, con el resumen de piezas, material y herrajes en la nota para el cliente, y lo guarda en tu historial.</span>
          {avisoCotiz && <span className="text-[12px] text-[#F6D58E]">{avisoCotiz}</span>}
        </div>
        {avisoDoc && <span className="text-[12px] text-[#F6D58E]">{avisoDoc}</span>}
      </Seccion>

      <Seccion titulo="Capas para tu CAM">
        <span className="text-[11.5px] text-[#8A97AB]">
          Cómo se llaman las capas en el DXF. {"{d}"} = diámetro, {"{p}"} = profundidad (0 = pasado), {"{cara}"} = ARRIBA o ABAJO.
        </span>
        {(
          [
            ["corte", "Corte"],
            ["barrenoArriba", "Barreno arriba"],
            ["barrenoAbajo", "Barreno abajo"],
            ["ranura", "Ranura"],
            ["canto", "Barreno de canto"],
          ] as const
        ).map(([k, n]) => (
          <label key={k} className="flex items-center gap-2 text-[12.5px] text-[#C9D2E0]">
            <span className="w-32 shrink-0">{n}</span>
            <input value={capas[k]} onChange={(e) => setCapas((x) => ({ ...x, [k]: e.target.value.replace(/[^\w{}\- ]/g, "").slice(0, 40) }))} placeholder={CAPAS_INICIO[k]} className="min-w-0 flex-1 rounded-[6px] border border-[#2A3546] bg-[#0B0F15] px-1.5 py-1 font-mono text-[12px] text-white" />
          </label>
        ))}
        {capasPropias && (
          <button type="button" onClick={() => setCapas(() => CAPAS_INICIO)} className="self-start rounded-[6px] bg-[#1C2431] px-2 py-1 text-[12px] font-semibold text-[#C9D2E0] hover:bg-[#243045]">
            Volver a las de fábrica
          </button>
        )}
      </Seccion>

      <Seccion titulo="Acomodo en hojas">
        <label className="flex items-center justify-between gap-2 text-[13px] font-semibold text-white">
          Acomodar las piezas en hojas
          <input type="checkbox" checked={acomodar} onChange={(e) => setAcomodar(e.target.checked)} className="h-4 w-4 accent-[#C2560A]" />
        </label>
        {acomodar && (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              {[...HOJAS_TABLERO, { id: "propia", nombre: "Otra medida" }].map((h) => (
                <button key={h.id} type="button" aria-pressed={hojaId === h.id} onClick={() => setHojaId(h.id)} className={`rounded-[8px] px-2 py-1.5 text-left text-[11.5px] font-semibold ${hojaId === h.id ? "bg-[#243045] text-white ring-1 ring-[#C2560A]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"}`}>
                  {h.nombre}
                </button>
              ))}
            </div>
            {hojaId === "propia" && (
              <div className="grid grid-cols-2 gap-2">
                <CampoNum etiqueta="Largo de la hoja" valor={hojaPropia.largo} cambiar={(x) => setHojaPropia((h) => ({ ...h, largo: x }))} sufijo="mm" />
                <CampoNum etiqueta="Ancho de la hoja" valor={hojaPropia.ancho} cambiar={(x) => setHojaPropia((h) => ({ ...h, ancho: x }))} sufijo="mm" />
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <CampoNum etiqueta={`Separación (${sepAuto})`} valor={ah.separacion} cambiar={(x) => setAh((s) => ({ ...s, separacion: x }))} sufijo="mm" />
              <CampoNum etiqueta="Margen" valor={ah.margen} cambiar={(x) => setAh((s) => ({ ...s, margen: x }))} sufijo="mm" />
              <CampoNum etiqueta="Muebles" valor={ah.copias} cambiar={(x) => setAh((s) => ({ ...s, copias: x }))} />
            </div>
            <span className="text-[12px] text-[#8A97AB]">Separación vacía = la fresa más 2 mm. Margen = orilla de la hoja que no se usa (la prensa o el canto dañado).</span>
            <label className="flex items-center justify-between gap-2 text-[12.5px] text-[#C9D2E0]">
              El material tiene veta (melamina con diseño, triplay)
              <input type="checkbox" checked={conVeta} onChange={(e) => setConVeta(e.target.checked)} className="h-4 w-4 accent-[#C2560A]" />
            </label>
            <label className="flex items-center justify-between gap-2 text-[12.5px] text-[#C9D2E0]">
              Número en cada pieza (capa ETIQUETA)
              <input type="checkbox" checked={etiquetas} onChange={(e) => setEtiquetas(e.target.checked)} className="h-4 w-4 accent-[#C2560A]" />
            </label>
            {conVeta && (
              <div className="flex flex-col gap-1 rounded-[9px] border border-[#2A3546] bg-[#111821] p-2">
                <span className="text-[12px] text-[#8A97AB]">Veta de cada pieza (la veta de la hoja va a lo largo):</span>
                {[...new Set(m.piezas.map((p) => p.nombre))].map((nom) => (
                  <div key={nom} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="truncate text-[#C9D2E0]">{nom}</span>
                    <span className="flex shrink-0 gap-1">
                      {([["largo", "A lo largo"], ["ancho", "Atravesada"], ["libre", "Libre"]] as const).map(([id, t]) => (
                        <button key={id} type="button" aria-pressed={vetaDe(nom) === id} onClick={() => setVetas((v) => ({ ...v, [nom]: id }))} className={`rounded-[6px] px-1.5 py-0.5 font-semibold ${vetaDe(nom) === id ? "bg-[#C2560A] text-white" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"}`}>
                          {t}
                        </button>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {acomodo && (
              <div className="flex flex-col gap-2 rounded-[9px] bg-[#C2560A]/10 px-2.5 py-2 text-[12.5px] text-[#F2D29B]">
                <span>
                  {acomodo.piezas} piezas en <b className="text-white">{acomodo.hojas.length} {acomodo.hojas.length === 1 ? "hoja" : "hojas"}</b> de {hoja.largo} × {hoja.ancho} mm · aprovechamiento <b className="text-white">{Math.round(acomodo.aprovechamiento * 100)}%</b>
                </span>
                {acomodo.grupos.length > 1 && (
                  <ul className="m-0 list-none p-0 text-[12px]">
                    {acomodo.grupos.map((g) => (
                      <li key={g.nombre}>
                        {g.nombre}: <b className="text-white">{g.r.hojas.length} {g.r.hojas.length === 1 ? "hoja" : "hojas"}</b>
                      </li>
                    ))}
                  </ul>
                )}
                {acomodo.noCaben.length > 0 && (
                  <span className="text-[#F6B8AE]">
                    No caben: {acomodo.noCaben.slice(0, 3).join(", ")}{acomodo.noCaben.length > 3 ? "…" : ""}. {conVeta ? "Prueba con su veta libre o " : ""}Elige una hoja más grande.
                  </span>
                )}
                <button type="button" onClick={bajarLista} className="self-start rounded-[7px] bg-[#1C2431] px-2.5 py-1.5 text-[12.5px] font-semibold text-[#C9D2E0] hover:bg-[#243045]">
                  Descargar lista de corte (CSV)
                </button>
              </div>
            )}
            <span className="text-[12px] text-[#8A97AB]">En «Piezas 2D» ves las hojas; la descarga DXF, SVG o PDF sale ya acomodada.</span>
          </>
        )}
      </Seccion>

      <Seccion titulo="Material y patas">
        <select value={material} onChange={(e) => { setMaterial(e.target.value); const g = materialDe(e.target.value).grosores; if (!g.includes(numero(v.grosor))) setV((x) => ({ ...x, grosor: String(g.includes(18) ? 18 : g[g.length - 1]) })) }} className="rounded-[8px] border border-[#2A3546] bg-[#0B0F15] px-2.5 py-2 text-[13px] text-white" aria-label="Material de la estructura">
          {MATERIALES.map((x) => (
            <option key={x.id} value={x.id}>{x.nombre}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {materialDe(material).grosores.map((g) => (
            <button key={g} type="button" aria-pressed={numero(v.grosor) === g} onClick={() => setV((x) => ({ ...x, grosor: String(g) }))} className={`rounded-[7px] px-2 py-1 text-[12px] font-semibold ${numero(v.grosor) === g ? "bg-[#C2560A] text-white" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"}`}>
              {g} mm
            </button>
          ))}
        </div>
        <CampoNum etiqueta="Patas (alto, 0 = sin patas)" valor={patas} cambiar={setPatas} sufijo="mm" />
        {materialDe(material).canto && (
          <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#C9D2E0]">
            Canto de PVC:
            {[0.45, 1, 2].map((g) => (
              <button key={g} type="button" aria-pressed={cantoG === g} onClick={() => setCantoG(g)} className={`rounded-[6px] px-2 py-1 font-semibold ${cantoG === g ? "bg-[#C2560A] text-white" : "bg-[#1C2431] hover:bg-[#243045]"}`}>
                {g} mm
              </button>
            ))}
          </div>
        )}
        <span className="text-[12.5px] font-semibold text-white">Cómo se abren</span>
        <div className="grid grid-cols-2 gap-1.5">
          {TIRADORES.map((x) => (
            <button key={x.id} type="button" aria-pressed={tirador === x.id} onClick={() => setTirador(x.id)} className={`flex flex-col items-start rounded-[8px] px-2 py-1.5 text-left ${tirador === x.id ? "bg-[#2A1C12] ring-1 ring-[#C2560A]" : "bg-[#141B26] ring-1 ring-[#2A3546] hover:ring-[#3A4A63]"}`}>
              <span className="text-[12.5px] font-semibold text-white">{x.nombre}</span>
              <span className="text-[11px] text-[#8A97AB]">{x.nota}</span>
            </button>
          ))}
        </div>
        <span className="text-[12.5px] font-semibold text-white">Diseño de puertas y frentes</span>
        <div className="grid grid-cols-2 gap-1.5">
          {DISENOS_FRENTE.map((x) => (
            <button key={x.id} type="button" aria-pressed={disenoFrente === x.id} onClick={() => setDisenoFrente(x.id)} className={`flex flex-col items-start rounded-[8px] px-2 py-1.5 text-left ${disenoFrente === x.id ? "bg-[#2A1C12] ring-1 ring-[#C2560A]" : "bg-[#141B26] ring-1 ring-[#2A3546] hover:ring-[#3A4A63]"}`}>
              <span className="text-[12.5px] font-semibold text-white">{x.nombre}</span>
              <span className="text-[11px] text-[#8A97AB]">{x.nota}</span>
            </button>
          ))}
        </div>
        {disenoFrente !== "liso" && <span className="text-[11.5px] text-[#8A97AB]">Los rebajes salen en el DXF en capas RANURA (con su profundidad) para fresarlos en la router. Mejor en MDF para pintar.</span>}
        <span className="text-[12px] text-[#8A97AB]">Material de la estructura. Puertas, frentes, fondo y cubierta pueden llevar otro: selecciónalos en el 3D.{materialDe(material).canto ? " Lleva canto de PVC en las orillas del frente." : ""}</span>
      </Seccion>

      <Seccion titulo="Tablero y máquina">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Grosor real (medido)" valor={v.grosor} cambiar={cambiar("grosor")} sufijo="mm" />
          {(union === "espiga" || union === "dedos") && <CampoNum etiqueta="Holgura de ensamble" valor={v.holgura} cambiar={cambiar("holgura")} sufijo="mm" />}
          {(union === "espiga" || union === "dedos") && <CampoNum etiqueta="Espiga sobresale" valor={v.saliente} cambiar={cambiar("saliente")} sufijo="mm" />}
        </div>
        <span className="text-[12px] text-[#8A97AB]">Mide el grosor con vernier: el MDF de «18 mm» suele medir entre 17.5 y 18.5.</span>
      </Seccion>

      <Seccion titulo="Herramientas de corte">
        <Opciones opciones={[{ id: "router", nombre: "Router CNC" }, { id: "laser", nombre: "Láser" }]} valor={laser ? "laser" : "router"} cambiar={(x) => setLaser(x === "laser")} />
        {!laser && (
          <>
            <SelectorFresa etiqueta="Corte" tipos={["recta", "upcut", "downcut", "compresion", "un_filo"]} valor={herr} cambiar={(f) => setHerr(f.id)} todas={fresas} agregar={agregarFresa} nota="Su diámetro da los alivios de las esquinas y la separación en las hojas." />
            {m.piezas.some((p) => p.ranuras.length) && (
              <SelectorFresa
                etiqueta="Ranura"
                tipos={["recta", "upcut", "downcut"]}
                valor={herrRanura}
                cambiar={(f) => setHerrRanura(f.id)}
                todas={fresas}
                agregar={agregarFresa}
                nota={(fresas.find((f) => f.id === herrRanura)?.diametro || 0) > 4 ? "Esa fresa es más ancha que la ranura del fondo (4 mm): usa una de 3 o 4 mm." : "La ranura del fondo mide 4 mm de ancho y 8 de hondo."}
              />
            )}
            {(etiquetas || m.piezas.some((p) => p.barrenos.length)) && <SelectorFresa etiqueta="Grabado en V" tipos={["v"]} valor={herrV} cambiar={(f) => setHerrV(f.id)} todas={fresas} agregar={agregarFresa} nota="Para los números de las piezas (capa ETIQUETA)." />}
            {(() => {
              // brocas que pide el diseño, y si están en tu base
              const ds = [...new Set(m.piezas.flatMap((p) => [...p.barrenos.map((b) => b.d), ...p.cantos.map((c) => c.d), ...p.huecos.filter((h) => h.length >= 20).map((h) => Math.round((Math.max(...h.map((q) => q[0])) - Math.min(...h.map((q) => q[0]))) * 10) / 10)]))].filter((d) => d <= 40).sort((a, b) => a - b)
              if (!ds.length) return null
              return (
                <div className="flex flex-col gap-1 rounded-[8px] border border-[#2A3546] bg-[#111821] p-2 text-[12px] text-[#C9D2E0]">
                  <span className="font-semibold text-white">Brocas que pide el diseño</span>
                  {ds.map((d) => {
                    const hay = fresas.find((f) => (f.tipo === "broca" || f.tipo === "recta") && Math.abs(f.diametro - d) < 0.3)
                    return (
                      <span key={d}>
                        Ø{d} mm: {hay ? <span className="text-[#9FE0B5]">{hay.nombre}</span> : <span className="text-[#F6D58E]">no está en tu base (agrégala con +)</span>}
                      </span>
                    )
                  })}
                </div>
              )
            })()}
          </>
        )}
      </Seccion>

      <Seccion titulo="Esquinas y espigas">
        <span className="text-[12px] font-semibold text-[#C9D2E0]">Esquinas exteriores de las piezas</span>
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#C9D2E0]">
          {([["recta", "Rectas"], ["redonda", "Redondeadas"], ["chaflan", "Chaflán 45°"]] as const).map(([t, n]) => (
            <button key={t} type="button" aria-pressed={esquinas.tipo === t} onClick={() => setEsquinas((e) => ({ ...e, tipo: t }))} className={`rounded-[6px] px-2 py-1 font-semibold ${esquinas.tipo === t ? "bg-[#C2560A] text-white" : "bg-[#1C2431] hover:bg-[#243045]"}`}>{n}</button>
          ))}
        </div>
        {esquinas.tipo !== "recta" && <CampoNum etiqueta={esquinas.tipo === "redonda" ? "Radio" : "Chaflán"} valor={esquinas.medida} cambiar={(x) => setEsquinas((e) => ({ ...e, medida: x }))} sufijo="mm" />}
        {!laser && (union === "espiga" || union === "dedos") && (
          <>
            <span className="text-[12px] font-semibold text-[#C9D2E0]">Esquinas interiores (mortajas y raíz de las espigas)</span>
            <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#C9D2E0]">
              {([["hueso", "Cabeza de fémur"], ["t", "En T"], ["ninguno", "Sin alivio"]] as const).map(([t, n]) => (
                <button key={t} type="button" aria-pressed={alivio === t} onClick={() => setAlivio(t)} className={`rounded-[6px] px-2 py-1 font-semibold ${alivio === t ? "bg-[#C2560A] text-white" : "bg-[#1C2431] hover:bg-[#243045]"}`}>{n}</button>
              ))}
            </div>
            <span className="text-[11.5px] text-[#8A97AB]">
              {alivio === "hueso" ? "Un círculo de la fresa en cada esquina: la espiga asienta hasta el fondo." : alivio === "t" ? "El círculo se abre hacia un solo lado (la orilla corta): las caras largas quedan limpias." : "Sin alivio: la esquina queda redonda del radio de la fresa; lima la espiga o usa láser."}
            </span>
          </>
        )}
        {(union === "espiga" || union === "dedos") && (
          <>
            <span className="text-[12px] font-semibold text-[#C9D2E0]">Espigas por unión</span>
            <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#C9D2E0]">
              {[0, 1, 2, 3, 4].map((n) => (
                <button key={n} type="button" aria-pressed={numEspigas === n} onClick={() => setNumEspigas(n)} className={`rounded-[6px] px-2 py-1 font-semibold ${numEspigas === n ? "bg-[#C2560A] text-white" : "bg-[#1C2431] hover:bg-[#243045]"}`}>{n === 0 ? "Automático" : n}</button>
              ))}
            </div>
            <CampoNum etiqueta="Ancho de cada espiga (vacío = automático)" valor={anchoEspiga} cambiar={setAnchoEspiga} sufijo="mm" />
          </>
        )}
      </Seccion>

      <Seccion titulo={`Tableros (${tableros.length})`}>
        <div className="flex flex-col gap-1.5">
          {tableros.map((t, i) => {
            const fuera = m.descartados.some((x) => x.startsWith(t.nombre))
            return (
              <div key={i} className={`rounded-[8px] border ${abierto === i ? "border-[#C2560A]" : "border-[#2A3546]"} bg-[#111821]`}>
                <button type="button" onClick={() => setAbierto(abierto === i ? null : i)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12.5px]">
                  <span className={`flex-1 truncate font-semibold ${fuera ? "text-[#F6B8AE] line-through" : "text-white"}`}>{t.nombre}</span>
                  <span className="text-[#8A97AB]">
                    {Math.round(t.x1 - t.x0)} × {Math.round(t.y1 - t.y0)} × {Math.round(t.z1 - t.z0)}
                  </span>
                </button>
                {abierto === i && (
                  <div className="flex flex-col gap-2 border-t border-[#1F2937] p-2.5">
                    <input
                      value={t.nombre}
                      onChange={(e) => editar(i, { nombre: e.target.value })}
                      className="rounded-[7px] border border-[#2A3546] bg-[#0B0F15] px-2 py-1.5 text-[13px] text-white"
                      aria-label="Nombre del tablero"
                    />
                    <Opciones opciones={PLANOS} valor={(t.plano as Plano) || "horizontal"} cambiar={(p) => editar(i, { plano: p })} />
                    <div className="grid grid-cols-2 gap-2">
                      {(["x0", "x1", "y0", "y1", "z0", "z1"] as const).map((k) => (
                        <CampoNum
                          key={k}
                          etiqueta={{ x0: "Izquierda", x1: "Derecha", y0: "Frente", y1: "Atrás", z0: "Abajo", z1: "Arriba" }[k]}
                          valor={textos[`${i}:${k}`] ?? String(t[k])}
                          cambiar={(x) => {
                            // el texto se guarda tal cual (se puede borrar y reescribir); el número sólo cuando es válido
                            setTextos((s) => ({ ...s, [`${i}:${k}`]: x }))
                            if (x.trim() !== "" && Number.isFinite(numero(x))) editar(i, { [k]: numero(x) })
                          }}
                          sufijo="mm"
                        />
                      ))}
                    </div>
                    <button type="button" onClick={() => { setTableros((ts) => ts.filter((_, j) => j !== i)); setTextos({}); setAbierto(null) }} className="self-start rounded-[7px] px-2 py-1 text-[12.5px] font-semibold text-[#F6B8AE] hover:bg-[#2A1C1C]">
                      Quitar tablero
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => { setTableros((ts) => [...ts, tableroNuevo(ts, opciones.grosor)]); setAbierto(tableros.length) }}
          className="rounded-[8px] bg-[#1C2431] px-3 py-2 text-[13px] font-semibold text-[#C9D2E0] hover:bg-[#243045]"
        >
          Agregar tablero
        </button>
        <span className="text-[12px] text-[#8A97AB]">Medidas en mm desde la esquina de abajo, al frente y a la izquierda del mueble. Las uniones se calculan solas.</span>
      </Seccion>
    </div>
  )

  // la cocina en habitación se ve en el cuarto mientras el diseño sea el de la habitación
  const conEscena = !!habVista && tableros.some((t) => t.nombre === habVista.firma)
  const esHabitacion = conEscena && habVista!.colocacion.length > 0
  const enHabitacion = esHabitacion && verHab
  const vista3D = (
    <Visor3D oscuro alto="h-full min-h-[260px]">
      {m.piezas.length ? (
        <Mueble3D
          piezas={piezas3D}
          accesorios={m.accesorios}
          sueltos={m.sueltos.map(cajaVista)}
          seleccion={sel}
          explotar={explotar}
          rayosX={rayosX}
          cotas={verCotas}
          editable={!enHabitacion}
          ajustar={ajustar}
          vista={vista}
          colocacion={enHabitacion ? habVista!.colocacion : undefined}
          ambiente={enHabitacion || (conEscena && !esHabitacion) ? habVista!.ambiente : undefined}
          punto={punto}
          alSeleccionar={(i, p) => {
            setSel(i)
            setPunto(p)
          }}
          alEmpujar={(i, eje, lado, delta) => aplicar((ts) => empujar(ts, i, eje, lado, delta))}
          cajaDe={(i) => (m.tablerosFinales[i] ? cajaVista(m.tablerosFinales[i]) : null)}
        />
      ) : (
        <div className="grid h-full place-items-center text-[14px] text-[#8A97AB]">{m.errores[0] || "Sube la imagen de un mueble."}</div>
      )}
      <div className="absolute top-2 left-2 right-36 flex flex-wrap items-center gap-2 rounded-[10px] bg-[#0B0F15]/85 px-3 py-2 text-[12px] text-[#C9D2E0] sm:right-auto">
        <label className="flex items-center gap-2">
          Explotar
          <input type="range" min={0} max={1} step={0.05} value={explotar} onChange={(e) => setExplotar(Number(e.target.value))} className="w-24 accent-[#C2560A]" aria-label="Separar piezas" />
        </label>
        <button type="button" aria-pressed={rayosX} onClick={() => setRayosX((x) => !x)} className={`rounded-[7px] px-2 py-1 font-semibold ${rayosX ? "bg-[#C2560A] text-white" : "bg-[#1C2431] hover:bg-[#243045]"}`}>
          Rayos X
        </button>
        <button type="button" aria-pressed={verCotas} onClick={() => setVerCotas((x) => !x)} className={`rounded-[7px] px-2 py-1 font-semibold ${verCotas ? "bg-[#C2560A] text-white" : "bg-[#1C2431] hover:bg-[#243045]"}`}>
          Cotas
        </button>
        <button type="button" onClick={() => { setVista(undefined); setAjustar((n) => n + 1) }} className="rounded-[7px] bg-[#1C2431] px-2 py-1 font-semibold hover:bg-[#243045]">
          Ajustar vista
        </button>
        {esHabitacion && (
          <button type="button" aria-pressed={verHab} onClick={() => { setVerHab((x) => !x); setAjustar((n) => n + 1) }} className={`rounded-[7px] px-2 py-1 font-semibold ${verHab ? "bg-[#C2560A] text-white" : "bg-[#1C2431] hover:bg-[#243045]"}`} title="En el cuarto se ve; recto se edita pared por pared">
            {verHab ? "Ver recto (editar)" : "Ver en la habitación"}
          </button>
        )}
        <span className="flex flex-wrap items-center gap-1" role="group" aria-label="Vistas">
          {VISTAS.map(([id, n]) => (
            <button key={id} type="button" onClick={() => setVista((x) => ({ cual: id, n: (x?.n || 0) + 1 }))} title={`Vista ${n.toLowerCase()}`} className={`rounded-[6px] px-1.5 py-1 text-[11.5px] font-semibold ${vista?.cual === id ? "bg-[#243045] text-white ring-1 ring-[#C2560A]" : "bg-[#1C2431] hover:bg-[#243045]"}`}>
              {n}
            </button>
          ))}
        </span>
        {m.sueltos.length > 0 && <span className="text-[#FF9A9A]">En rojo: tableros que no tocan al mueble</span>}
      </div>
    </Visor3D>
  )

  return (
    <Estudio2D
      titulo={enfoque === "cocina" ? "Cocina y muebles de melamina" : "Mueble desde imagen"}
      acento="2D"
      subtitulo={enfoque === "cocina" ? "Gabinetes, libreros, roperos y cómodas a tu medida" : "Tu foto o plano, listo para maquilar"}
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M7 18v2M17 18v2M3 11h18M12 4v7" />
        </svg>
      }
      panel={
        <>
          {cabecera}
          {panel}
        </>
      }
      vista3D={vista3D}
      renombrarCapa={renombrarCapa}
      camBloqueado={pagados[claveDiseno(clave)] ? undefined : "Descarga el diseño (1 crédito) y se activa el envío al CAM 2D."}
      sinAcomodo
      dibujo={d}
      avisos={avisos}
      archivo={`mueble-${m.medidas.ancho}x${m.medidas.alto}-${opciones.grosor}mm`}
      pieza={`${nombre}: ${medidasTxt}, ${m.piezas.length} piezas, unión ${nombreUnion.toLowerCase()}`}
      material={`Triplay o MDF de ${opciones.grosor} mm`}
      datos={[
        ["Armado", medidasTxt],
        ["Piezas", String(m.piezas.length)],
        acomodo
          ? ["Hojas", `${acomodo.hojas.length} de ${hoja.largo} × ${hoja.ancho} · ${Math.round(acomodo.aprovechamiento * 100)}% aprovechado${copias > 1 ? ` · ${copias} muebles` : ""}`]
          : ["Tablero", `${areaM2.toFixed(2)} m² · ~${hojasEstimadas} ${hojasEstimadas === 1 ? "hoja" : "hojas"} de ${TABLERO.largo} × ${TABLERO.ancho}`],
        ["Unión", nombreUnion],
        ["Herramientas", laser ? "Láser" : [fresaCorte?.nombre, m.piezas.some((p) => p.ranuras.length) ? fresas.find((f) => f.id === herrRanura)?.nombre : null, etiquetas ? fresas.find((f) => f.id === herrV)?.nombre : null].filter(Boolean).join(" · ")],
        ...m.compras.map((c) => [c.nombre, String(c.cantidad)] as [string, string]),
      ]}
      descargas={(exportar) => {
        const claveCobro = claveDiseno(clave)
        if (pagados[claveCobro])
          return (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                {(["dxf", "svg", "pdf"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => exportar(t)} className={`flex-1 rounded-[8px] px-3 py-2.5 text-[13px] font-semibold ${t === "dxf" ? "bg-[#C2560A] text-white hover:bg-[#A84A08]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"}`}>
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              <button type="button" onClick={bajarZip} className="rounded-[8px] bg-[#1C2431] px-3 py-2 text-[13px] font-semibold text-[#C9D2E0] hover:bg-[#243045]">
                Una pieza por archivo (ZIP de DXF)
              </button>
              <span className="text-[12px] text-[#9FE0B5]">Pagado. Puedes bajar los tres formatos de este diseño durante 24 horas sin costo extra.</span>
            </div>
          )
        return (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={cobrando || !!m.errores.length || !m.piezas.length}
              onClick={async () => {
                setCobrando(true)
                setAvisoCobro(null)
                const r = await cobrarDescargaMueble(claveCobro, `${nombre} ${medidasTxt}, ${opciones.grosor} mm`, herramientaCobro, m.piezas.length)
                setCobrando(false)
                setRecargaSaldo((n) => n + 1)
                if (!r.ok) return setAvisoCobro({ texto: r.mensaje, login: r.noAutenticado, creditos: r.saldoInsuficiente })
                setPagados((p) => ({ ...p, [claveCobro]: true }))
                exportar("dxf")
              }}
              className="rounded-[8px] bg-[#C2560A] px-3 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#A84A08] disabled:opacity-50"
            >
              {cobrando ? "Cobrando…" : `Descargar archivos, planos y etiquetas · ${textoCreditos(costoCreditos)}`}
            </button>
            {avisoCobro && (
              <span className="text-[12px] text-[#F6B8AE]">
                {avisoCobro.texto}{" "}
                {avisoCobro.login && <Link href={`/${locale}/login`} className="underline">Iniciar sesión</Link>}
                {avisoCobro.creditos && <Link href={`/${locale}/user/creditos`} className="underline">Comprar créditos</Link>}
              </span>
            )}
            <span className="text-[12px] text-[#8A97AB]">Ver el armado, las medidas y el material es gratis. Si no tienes máquina, Fabrícamelo es sin costo.</span>
          </div>
        )
      }}
    />
  )
}
