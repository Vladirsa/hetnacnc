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
import { GABINETE_INICIO, type OpcionesGabinete, type TipoGabinete, gabinete } from "@/lib/generador/gabinete"
import { MATERIALES, PREDETERMINADO, ROLES, type Rol, type TableroC, type TipoComponente, agregarComponente, esEstructura, materialDe, muebleCompleto } from "@/lib/generador/componentes"
import { cobrarDescargaMueble, disenarTablerosDesdeImagen } from "@/lib/muebles/acciones"

import { type TipoNuevo, abrirHueco, agregar, duplicar, empujar, mover, quitar, quitarHuecos } from "@/lib/generador/editorTableros"

import { claveDiseno, piezasTendidas, reducirImagen } from "./GeneradorEnsamble"
import type { CajaVista } from "./Mueble3D"
import { Visor3D } from "./Visor3D"

const Mueble3D = dynamic(() => import("./Mueble3D"), { ssr: false })
type Pt = [number, number, number]
const cajaVista = (t: Tablero): CajaVista => ({ lo: [t.x0, t.y0, t.z0], hi: [t.x1, t.y1, t.z1] })
const TABLERO = { ancho: 1220, largo: 2440 }
const FRESAS = [
  { id: "laser", nombre: "Láser" },
  { id: "3.175", nombre: "Fresa 1/8″" },
  { id: "6.35", nombre: "Fresa 1/4″" },
] as const
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
function tableroNuevo(ts: Tablero[], g: number): Tablero {
  const x1 = Math.max(400, ...ts.map((t) => t.x1)), y1 = Math.max(250, ...ts.map((t) => t.y1)), z1 = Math.max(400, ...ts.map((t) => t.z1))
  const z = Math.round(z1 / 2)
  return { nombre: `Tablero ${ts.length + 1}`, plano: "horizontal", x0: 0, x1, y0: 0, y1, z0: z, z1: z + g }
}

export function GeneradorTableros({ cabecera }: { cabecera?: React.ReactNode }) {
  const { locale } = useParams<{ locale: string }>()
  const [nombre, setNombre] = useState(EJEMPLO.nombre)
  const [tableros, setTableros] = useState<TableroC[]>(EJEMPLO.tableros)
  const [esEjemplo, setEsEjemplo] = useState(true)
  const [foto, setFoto] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [lectura, setLectura] = useState<{ texto: string; tipo: "ok" | "aviso" | "error"; login?: boolean; creditos?: boolean } | null>(null)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [textos, setTextos] = useState<Record<string, string>>({}) // lo que el cliente escribe en las medidas de cada tablero
  const [v, setV] = useState<Record<string, string>>({ ancho: "", fondo: "", alto: "", grosor: String(EJEMPLO.grosor), holgura: "0.3", saliente: "0" })
  const [herr, setHerr] = useState<(typeof FRESAS)[number]["id"]>("6.35")
  const [union, setUnion] = useState<TipoUnion>("espiga")
  const nombreUnion = UNIONES.find((x) => x.id === union)?.nombre || ""
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

  const herramienta: Herramienta = herr === "laser" ? { tipo: "laser" } : { tipo: "fresa", diametro: Number(herr) }
  const opciones = {
    union,
    material,
    patas: Math.max(0, numero(patas) || 0),
    ancho: numero(v.ancho) || undefined,
    fondo: numero(v.fondo) || undefined,
    alto: numero(v.alto) || undefined,
    grosor: numero(v.grosor) || TABLEROS_INICIO.grosor,
    holgura: numero(v.holgura) >= 0 ? numero(v.holgura) : TABLEROS_INICIO.holgura,
    saliente: numero(v.saliente) >= 0 ? numero(v.saliente) : 0,
    herramienta,
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

  const panel = (
    <div className="flex flex-col gap-4">
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

      <Seccion titulo="O arma un gabinete de cocina">
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
        <button
          type="button"
          onClick={() => {
            const g = gabinete({ ...gab, grosor: opciones.grosor, gFrente: opciones.grosor })
            aplicar(() => g.tableros, null)
            setNombre(`Gabinete ${gab.tipo === "bajo" ? "bajo" : gab.tipo === "alto" ? "alto" : "columna"} ${Math.round(gab.ancho)} mm`)
            // los gabinetes de cocina van con herraje: confirmat si estaba en caja y espiga
            if (union === "espiga") setUnion("confirmat")
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

      <div className="rounded-[10px] border border-[#2A3546] bg-[#141B26] p-3 text-[12.5px] text-[#C9D2E0]">
        <b className="text-white">{nombre}.</b> {m.piezas.length} piezas, {m.uniones} uniones {union === "espiga" ? "de caja y espiga, sin tornillos" : `con ${nombreUnion.toLowerCase()}`}.
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
        {union !== "espiga" && (
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
        <span className="text-[12px] text-[#8A97AB]">Material de la estructura. Puertas, frentes, fondo y cubierta pueden llevar otro: selecciónalos en el 3D.{materialDe(material).canto ? " Lleva canto de PVC en las orillas del frente." : ""}</span>
      </Seccion>

      <Seccion titulo="Tablero y máquina">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Grosor real (medido)" valor={v.grosor} cambiar={cambiar("grosor")} sufijo="mm" />
          {union === "espiga" && <CampoNum etiqueta="Holgura de ensamble" valor={v.holgura} cambiar={cambiar("holgura")} sufijo="mm" />}
          {union === "espiga" && <CampoNum etiqueta="Espiga sobresale" valor={v.saliente} cambiar={cambiar("saliente")} sufijo="mm" />}
        </div>
        <Opciones opciones={FRESAS.map((f) => ({ id: f.id, nombre: f.nombre }))} valor={herr} cambiar={setHerr} />
        <span className="text-[12px] text-[#8A97AB]">Mide el grosor con vernier: el MDF de «18 mm» suele medir entre 17.5 y 18.5. Con fresa, las esquinas llevan alivio para que asienten.</span>
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
          editable
          ajustar={ajustar}
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
        <button type="button" onClick={() => setAjustar((n) => n + 1)} className="rounded-[7px] bg-[#1C2431] px-2 py-1 font-semibold hover:bg-[#243045]">
          Ajustar vista
        </button>
        {m.sueltos.length > 0 && <span className="text-[#FF9A9A]">En rojo: tableros que no tocan al mueble</span>}
      </div>
    </Visor3D>
  )

  return (
    <Estudio2D
      titulo="Mueble desde imagen"
      acento="2D"
      subtitulo="Tu foto o plano, listo para maquilar"
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
                const r = await cobrarDescargaMueble(claveCobro, `${nombre} ${medidasTxt}, ${opciones.grosor} mm`)
                setCobrando(false)
                if (!r.ok) return setAvisoCobro({ texto: r.mensaje, login: r.noAutenticado, creditos: r.saldoInsuficiente })
                setPagados((p) => ({ ...p, [claveCobro]: true }))
                exportar("dxf")
              }}
              className="rounded-[8px] bg-[#C2560A] px-3 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#A84A08] disabled:opacity-50"
            >
              {cobrando ? "Cobrando…" : "Descargar DXF, SVG y PDF · 1 crédito"}
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
