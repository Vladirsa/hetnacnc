"use client"

// CAM Studio · 2D (router y láser): de un DXF o SVG al G-code, a pantalla
// completa, con varias operaciones por pieza.
//
//   ┌ ajustes ──────┐┌ vista: pieza · trayectoria ────────────┐┌ resultado ┐
//   │ archivo       ││   el dibujo por capas y, ya calculado,   ││ tiempo    │
//   │ máquina       ││   el recorrido de la herramienta         ││ costo     │
//   │ material      ││ ▶ ─────────────●──────── 06:12 / 09:58   ││ por op.   │
//   │ operaciones   ││                                          ││ avisos    │
//   └───────────────┘└ barra: medidas · capas · unidades ───────┘└ G-code ───┘
//
// El cálculo vive en el servidor (POST /api/cam/gcode con "config" → motor
// infra/cam/bridges/cam2d.py). Las máquinas y fresas se guardan en la cuenta
// del cliente (lib/data/cam-maquinas) o, sin sesión, en este navegador.
import { useEffect, useMemo, useRef, useState } from "react"

import { Aviso, Boton, CampoNum, Datos, Interruptor, Opciones, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import type { DatosCam, FresaCam, MaquinaCam } from "@/lib/data/cam-maquinas"
import { CandadoCam, type NegadoCam, textoCupo, useCupoCam } from "@/components/hetna/cam/CandadoCam"
import { FichaFresa } from "@/components/hetna/cam/FichaFresa"
import { ProyectosCam } from "@/components/hetna/cam/ProyectosCam"
import { acomodarCopias } from "@/lib/cam/acomodar"
import type { Movimiento } from "@/lib/cam/leer-gcode"
import { FRESAS_BASE, guardarBase, leerBase, porGrupo } from "@/lib/hetna/base-herramientas"
import { type Dibujo, dibujoDXF, leerDXF, leerSVG } from "@/lib/generador/vectores"

const MATERIALES = [
  { id: "mdf", nombre: "MDF" },
  { id: "pino", nombre: "Pino" },
  { id: "encino", nombre: "Encino" },
  { id: "acrilico", nombre: "Acrílico" },
  { id: "aluminio", nombre: "Aluminio" },
] as const
type Material = (typeof MATERIALES)[number]["id"]

const MAQUINAS_BASE: MaquinaCam[] = [
  { id: "base-mach3", nombre: "Router · Mach3", tipo: "router", post: "mach3", tarifa: 300, smax: 1000 },
  { id: "base-grbl", nombre: "Router · GRBL", tipo: "router", post: "grbl", tarifa: 250, smax: 1000 },
  { id: "base-linuxcnc", nombre: "Router · LinuxCNC", tipo: "router", post: "linuxcnc", tarifa: 300, smax: 1000 },
  { id: "base-laser", nombre: "Láser · GRBL", tipo: "laser", post: "laser_grbl", tarifa: 200, smax: 1000 },
]
const EXTENSION: Record<MaquinaCam["post"], string> = { mach3: "tap", grbl: "nc", linuxcnc: "ngc", laser_grbl: "nc" }
const POSTS: { id: MaquinaCam["post"]; nombre: string }[] = [
  { id: "mach3", nombre: "Mach3" },
  { id: "grbl", nombre: "GRBL" },
  { id: "linuxcnc", nombre: "LinuxCNC" },
  { id: "laser_grbl", nombre: "Láser GRBL" },
]

type TipoOp = "corte" | "fuera" | "dentro" | "linea" | "cajeado" | "grabado_v" | "barrenado" | "acanalado" | "textura" | "incrustacion_hembra" | "incrustacion_macho" | "laser_corte" | "laser_linea" | "laser_relleno"
const OPS_ROUTER: { id: TipoOp; nombre: string; nota: string }[] = [
  { id: "corte", nombre: "Corte de pieza", nota: "Barrenos por dentro y borde por fuera, con pestañas" },
  { id: "fuera", nombre: "Perfilado por fuera", nota: "La fresa va por fuera de la línea" },
  { id: "dentro", nombre: "Perfilado por dentro", nota: "La fresa va por dentro de la línea" },
  { id: "linea", nombre: "Perfilado sobre la línea", nota: "Sigue la línea; sirve con trazos abiertos" },
  { id: "cajeado", nombre: "Cajeado (desbaste de área)", nota: "Vacía el área a una profundidad" },
  { id: "grabado_v", nombre: "Grabado en V", nota: "Letras y figuras con fresa en V" },
  { id: "barrenado", nombre: "Barrenado", nota: "Barrenos en el centro de cada círculo" },
  { id: "acanalado", nombre: "Acanalado", nota: "Canal sobre la línea que entra y sale en rampa" },
  { id: "textura", nombre: "Textura", nota: "Surcos en ondas, como tallado a mano; mejor con fresa de bola" },
  { id: "incrustacion_hembra", nombre: "Incrustación: caja", nota: "Vacía la figura donde va a embonar la pieza" },
  { id: "incrustacion_macho", nombre: "Incrustación: pieza", nota: "Corta la pieza que embona en la caja, con holgura" },
]
const OPS_LASER: { id: TipoOp; nombre: string; nota: string }[] = [
  { id: "laser_corte", nombre: "Corte", nota: "Corta los contornos cerrados" },
  { id: "laser_linea", nombre: "Línea", nota: "Marca las líneas con poca potencia" },
  { id: "laser_relleno", nombre: "Relleno", nota: "Graba el área con líneas" },
]
const NOMBRE_OP = Object.fromEntries([...OPS_ROUTER, ...OPS_LASER].map((o) => [o.id, o.nombre])) as Record<TipoOp, string>

type Op = {
  id: string
  tipo: TipoOp
  capa: string // "" = todas
  diametro: string
  angulo: string
  profundidad: string
  pestanas: boolean
  potencia: string
  velocidad: string
  pasadas: string
  separacion: string
  // desbaste separado de la línea + una pasada de acabado sobre ella
  acabado: boolean
  sobre: string
  // parámetros de corte de la herramienta; vacío = los del material
  pasada: string
  traslape: string
  rpm: string
  avance: string
  penetracion: string
  // de la ficha de la fresa elegida
  fresa: string
  largoCorte: number
  // acanalado, textura e incrustación
  rampa: string
  sepTextura: string
  onda: string
  anguloTextura: string
  holgura: string
}
const CON_ACABADO: TipoOp[] = ["corte", "fuera", "dentro", "cajeado", "incrustacion_hembra", "incrustacion_macho"]
const CON_PESTANAS: TipoOp[] = ["corte", "fuera", "incrustacion_macho"]
const sinCero = (v?: number) => (v && v > 0 ? String(v) : "")

let contador = 0
const nuevaOp = (tipo: TipoOp, espesor: string): Op => ({
  id: `op${++contador}`,
  tipo,
  capa: "",
  diametro: tipo === "grabado_v" ? "12" : "6",
  angulo: "90",
  profundidad: tipo === "cajeado" || tipo === "acanalado" || tipo === "incrustacion_hembra" ? "3" : tipo === "grabado_v" ? "4" : tipo === "linea" ? "1" : tipo === "textura" ? "2" : espesor,
  pestanas: CON_PESTANAS.includes(tipo),
  potencia: tipo === "laser_corte" ? "90" : tipo === "laser_linea" ? "25" : "40",
  velocidad: tipo === "laser_corte" ? "600" : "2500",
  pasadas: "1",
  separacion: "0.15",
  acabado: false,
  sobre: "0.3",
  pasada: "",
  traslape: "",
  rpm: "",
  avance: "",
  penetracion: "",
  fresa: "",
  largoCorte: 0,
  rampa: "10",
  sepTextura: "5",
  onda: "30",
  anguloTextura: "0",
  holgura: "0.1",
})

type OpPlan = { tipo: TipoOp; nombre: string; capa: string | null; figuras: number; largo_mm: number; minutos: number }
type Plan = {
  operaciones: OpPlan[]
  largo_corte_mm: number
  recorrido_rapido_mm: number
  tiempo_estimado_min: number
  lineas: number
  capas: string[]
  medidas: [number, number]
  post: string
  advertencias: string[]
}


const f2 = (x: number) => String(Math.round(x * 100) / 100)
const COLORES_CAPA = ["#5FA8F5", "#9BE3B8", "#F2D29B", "#C79BF2", "#F6B8AE", "#7FD6E0", "#E6EBF2"]
const nuevoId = () => Math.random().toString(36).slice(2, 9)

function Select({ valor, cambiar, children, etiqueta }: { valor: string; cambiar: (v: string) => void; children: React.ReactNode; etiqueta?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      {etiqueta && <span className="text-[12px] text-[#C9D2E0]">{etiqueta}</span>}
      <select value={valor} onChange={(e) => cambiar(e.target.value)} className="w-full rounded-[8px] bg-[#1C2431] px-2 py-2 text-[13px] text-white outline-none focus:ring-1 focus:ring-[#C2560A]">
        {children}
      </select>
    </label>
  )
}

export function EstudioCam2D() {
  const [archivo, setArchivo] = useState<File | null>(null)
  // La pieza tal como viene en el archivo, y lo que se corta: sus copias acomodadas en la hoja
  const [pieza, setDibujo] = useState<Dibujo | null>(null)
  const [hoja, setHoja] = useState({ copias: "1", ancho: "1220", largo: "2440", separacion: "8" })
  const acomodo = useMemo(
    () => (pieza ? acomodarCopias(pieza, { copias: numero(hoja.copias) || 1, ancho: numero(hoja.ancho) || 1220, largo: numero(hoja.largo) || 2440, separacion: numero(hoja.separacion) || 0 }) : null),
    [pieza, hoja]
  )
  const dibujo = acomodo?.dibujo ?? null
  const variasCopias = (acomodo?.puestas ?? 1) > 1
  const [origen, setOrigen] = useState(true)
  const [material, setMaterial] = useState<Material>("mdf")
  const [espesor, setEspesor] = useState("18")
  const [mias, setMias] = useState<DatosCam>({ maquinas: [], fresas: [] })
  const [sesion, setSesion] = useState(false)
  const [maquinaId, setMaquinaId] = useState("base-mach3")
  const [ops, setOps] = useState<Op[]>(() => [nuevaOp("corte", "18")])
  const [trabajando, setTrabajando] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)
  // Al calcular llega el dibujo de la trayectoria; el programa se pide al descargar
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const gcode = movimientos.length > 0 // "ya hay un programa calculado"
  const setGcode = (_: null) => setMovimientos([])
  const pedido = useRef<FormData | null>(null)
  const [negado, setNegado] = useState<NegadoCam | null>(null)
  const [bajando, setBajando] = useState(false)
  const [versionCupo, setVersionCupo] = useState(0)
  const cupo = useCupoCam(versionCupo)
  const [error, setError] = useState<{ mensaje: string; remedio: string } | null>(null)
  const [vista, setVista] = useState<"pieza" | "trayectoria">("pieza")
  const [avance, setAvance] = useState(1)
  const [corriendo, setCorriendo] = useState(false)
  const [editar, setEditar] = useState(false)
  const [guardado, setGuardado] = useState("")
  const anim = useRef<number | null>(null)

  const maquinas = useMemo(() => [...mias.maquinas, ...MAQUINAS_BASE], [mias])
  const fresas = useMemo(() => [...mias.fresas, ...FRESAS_BASE], [mias])
  const maquina = maquinas.find((m) => m.id === maquinaId) || MAQUINAS_BASE[0]
  const laser = maquina.tipo === "laser"
  const esSVG = !!archivo?.name.toLowerCase().endsWith(".svg")

  // Máquinas y fresas guardadas: de la cuenta o, sin sesión, del navegador
  useEffect(() => {
    leerBase().then((r) => {
      setSesion(r.sesion)
      setMias(r.datos)
      if (r.datos.maquinas[0]) setMaquinaId(r.datos.maquinas[0].id)
    })
  }, [])

  const guardarMias = async (d: DatosCam) => {
    setMias(d)
    setGuardado("")
    setGuardado(await guardarBase(d, sesion))
  }

  // Al cambiar entre router y láser, las operaciones cambian de tipo
  const tipoAnterior = useRef(maquina.tipo)
  useEffect(() => {
    if (tipoAnterior.current === maquina.tipo) return
    tipoAnterior.current = maquina.tipo
    setOps([nuevaOp(maquina.tipo === "laser" ? "laser_corte" : "corte", espesor)])
    setPlan(null)
    setGcode(null)
  }, [maquina.tipo, espesor])

  const capas = useMemo(() => (dibujo ? [...new Set(dibujo.trazos.map((t) => t.capa || "0"))].sort() : []), [dibujo])

  const abrir = async (f?: File | null) => {
    if (!f) return
    setArchivo(f)
    setPlan(null)
    setGcode(null)
    setError(null)
    setVista("pieza")
    const ext = f.name.split(".").pop()?.toLowerCase()
    try {
      const texto = await f.text()
      const d = ext === "svg" ? leerSVG(texto) : leerDXF(texto)
      setDibujo(d.trazos.length ? d : null)
      if (!d.trazos.length) setError({ mensaje: "No encontré líneas en el archivo.", remedio: d.avisos[0] || "Revisa que tenga contornos y no sólo texto o imágenes." })
    } catch {
      setDibujo(null)
      setError({ mensaje: "No pude leer el archivo.", remedio: "Sube un DXF o un SVG." })
    }
  }

  // Proyecto guardado en la cuenta: el dibujo (como DXF) y cómo se va a cortar
  const proyectoActual = () => {
    if (!pieza) return "Sube primero tu DXF o SVG: el proyecto guarda el dibujo y sus operaciones."
    return { version: 1, archivo: (archivo?.name || "pieza").replace(/\.svg$/i, ".dxf"), dxf: dibujoDXF(pieza), material, espesor, maquinaId, origen, ops, hoja }
  }
  const aplicarProyecto = (d: any): boolean => {
    if (!d || typeof d.dxf !== "string" || !Array.isArray(d.ops)) return false
    let leido: Dibujo
    try {
      leido = leerDXF(d.dxf)
    } catch {
      return false
    }
    if (!leido.trazos.length) return false
    const nombre = typeof d.archivo === "string" ? d.archivo.replace(/[^\w.\- ]/g, "").slice(0, 80) || "pieza.dxf" : "pieza.dxf"
    setArchivo(new File([d.dxf], nombre, { type: "application/dxf" }))
    setDibujo(leido)
    if (MATERIALES.some((m) => m.id === d.material)) setMaterial(d.material)
    if (typeof d.espesor === "string" && numero(d.espesor) > 0) setEspesor(d.espesor)
    if (typeof d.maquinaId === "string" && maquinas.some((m) => m.id === d.maquinaId)) setMaquinaId(d.maquinaId)
    setOrigen(d.origen !== false)
    const hj = d.hoja && typeof d.hoja === "object" ? d.hoja : {}
    const txt = (v: unknown, def: string) => (typeof v === "string" && numero(v) >= 0 ? v.slice(0, 8) : def)
    setHoja({ copias: txt(hj.copias, "1"), ancho: txt(hj.ancho, "1220"), largo: txt(hj.largo, "2440"), separacion: txt(hj.separacion, "8") })
    // cada operación parte de la de fábrica de su tipo: lo que falte o venga raro no rompe la pantalla
    const tipos = [...OPS_ROUTER, ...OPS_LASER].map((o) => o.id)
    setOps(
      d.ops
        .filter((o: any) => o && tipos.includes(o.tipo))
        .slice(0, 12)
        .map((o: any) => {
          const base = nuevaOp(o.tipo, typeof d.espesor === "string" ? d.espesor : espesor)
          const limpia: Record<string, unknown> = {}
          for (const k of Object.keys(base) as (keyof Op)[]) if (k !== "id" && typeof o[k] === typeof base[k]) limpia[k] = o[k]
          return { ...base, ...limpia } as Op
        })
    )
    setPlan(null)
    setGcode(null)
    setError(null)
    setVista("pieza")
    return true
  }

  const cambiarOp = (i: number, cambio: Partial<Op>) => setOps((l) => l.map((o, j) => (j === i ? { ...o, ...cambio } : o)))
  const moverOp = (i: number, d: number) =>
    setOps((l) => {
      const j = i + d
      if (j < 0 || j >= l.length) return l
      const c = [...l]
      ;[c[i], c[j]] = [c[j], c[i]]
      return c
    })

  const generar = async () => {
    if (!archivo || !dibujo) return setError({ mensaje: "Falta el archivo.", remedio: "Sube el DXF o SVG que quieres cortar." })
    if (!ops.length) return setError({ mensaje: "No hay operaciones.", remedio: "Agrega al menos una." })
    setTrabajando(true)
    setError(null)
    setPlan(null)
    setGcode(null)
    // con varias copias siempre se manda el dibujo ya acomodado, no el archivo original
    const cuerpo = esSVG || origen || variasCopias ? new Blob([dibujoDXF(dibujo)], { type: "application/dxf" }) : archivo
    const config = {
      maquina: { tipo: maquina.tipo, post: maquina.post, smax: maquina.smax },
      operaciones: ops.map((o) => ({
        tipo: o.tipo,
        capa: o.capa || null,
        diametro: numero(o.diametro) || 6,
        angulo: numero(o.angulo) || 90,
        profundidad: numero(o.profundidad) || numero(espesor),
        pestanas: o.pestanas ? 4 : 0,
        con_pestanas: o.pestanas,
        potencia: numero(o.potencia) || 50,
        velocidad: numero(o.velocidad) || 1000,
        pasadas: Math.max(1, Math.round(numero(o.pasadas) || 1)),
        separacion: numero(o.separacion) || 0.15,
        sobrematerial: o.acabado && CON_ACABADO.includes(o.tipo) ? Math.min(5, Math.max(0, numero(o.sobre) || 0)) : 0,
        ...(numero(o.pasada) > 0 ? { pasada: numero(o.pasada) } : {}),
        ...(numero(o.traslape) > 0 ? { traslape: Math.min(95, numero(o.traslape)) / 100 } : {}),
        ...(numero(o.rpm) > 0 ? { rpm: numero(o.rpm) } : {}),
        ...(numero(o.avance) > 0 ? { avance: numero(o.avance) } : {}),
        ...(numero(o.penetracion) > 0 ? { penetracion: numero(o.penetracion) } : {}),
        ...(o.fresa ? { herramienta: o.fresa, largo_corte: o.largoCorte } : {}),
        ...(o.tipo === "acanalado" ? { rampa: Math.max(0, numero(o.rampa) || 0) } : {}),
        ...(o.tipo === "textura" ? { separacion_textura: numero(o.sepTextura) || 5, onda: numero(o.onda) || 30, angulo_textura: numero(o.anguloTextura) || 0 } : {}),
        ...(o.tipo === "incrustacion_macho" ? { holgura: Math.max(0, numero(o.holgura) || 0) } : {}),
      })),
    }
    const form = new FormData()
    form.append("dxf", cuerpo, "pieza.dxf")
    form.append("material", material)
    form.append("espesor", espesor)
    form.append("config", JSON.stringify(config))
    pedido.current = form
    setNegado(null)
    try {
      const res = await fetch("/api/cam/gcode", { method: "POST", body: form })
      const r = await res.json()
      if (!r.ok) setError({ mensaje: r.mensaje || "No se pudo generar el G-code.", remedio: r.remedio || "" })
      else {
        setPlan(r.plan)
        setMovimientos(r.trayectoria || [])
        setVista("trayectoria")
        setAvance(1)
      }
    } catch {
      setError({ mensaje: "Se cortó la conexión.", remedio: "Vuelve a intentarlo." })
    }
    setTrabajando(false)
  }

  const descargar = async () => {
    if (!pedido.current || bajando) return
    setBajando(true)
    setNegado(null)
    let texto = ""
    try {
      const form = new FormData()
      pedido.current.forEach((v, k) => form.append(k, v))
      form.append("descargar", "1")
      const res = await fetch("/api/cam/gcode", { method: "POST", body: form })
      const r = await res.json()
      if (r.candado) setNegado(r)
      else if (!r.ok || !r.gcode) setError({ mensaje: r.mensaje || "No se pudo preparar la descarga.", remedio: r.remedio || "Vuelve a calcular." })
      else texto = r.gcode
    } catch {
      setError({ mensaje: "Se cortó la conexión.", remedio: "Vuelve a intentarlo." })
    }
    setBajando(false)
    setVersionCupo((v) => v + 1)
    if (!texto) return
    const nombre = (archivo?.name || "pieza").replace(/\.(dxf|svg)$/i, "") + "." + EXTENSION[maquina.post]
    const url = URL.createObjectURL(new Blob([texto], { type: "text/plain" }))
    const a = document.createElement("a")
    a.href = url
    a.download = nombre
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const zMin = useMemo(() => Math.min(-0.1, ...movimientos.filter((m) => m.corte).map((m) => m.z)), [movimientos])

  // Simulación: recorre los movimientos en ~10 segundos
  useEffect(() => {
    if (!corriendo) return
    const inicio = performance.now() - avance * 10000
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / 10000)
      setAvance(p)
      if (p < 1) anim.current = requestAnimationFrame(paso)
      else setCorriendo(false)
    }
    anim.current = requestAnimationFrame(paso)
    return () => {
      if (anim.current) cancelAnimationFrame(anim.current)
    }
  }, [corriendo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Lo que se dibuja: la pieza por capas, o la trayectoria sobre la pieza
  const lienzo = useMemo(() => {
    type Linea = { pts: [number, number][]; color: string; ancho: number; dash?: string }
    const lineas: Linea[] = []
    if (dibujo) {
      // con "mover al origen" el G-code empieza en (0,0): la pieza se dibuja igual
      let dx = 0, dy = 0
      if (origen || esSVG) {
        let x0 = Infinity, y0 = Infinity
        for (const t of dibujo.trazos)
          for (const [x, y] of t.pts) {
            if (x < x0) x0 = x
            if (y < y0) y0 = y
          }
        dx = -x0
        dy = -y0
      }
      for (const t of dibujo.trazos) {
        const i = capas.indexOf(t.capa || "0")
        const pts = (t.cerrado ? [...t.pts, t.pts[0]] : t.pts).map(([x, y]) => [x + dx, y + dy] as [number, number])
        lineas.push({ pts, color: vista === "pieza" ? COLORES_CAPA[i % COLORES_CAPA.length] : "#2C4A6E", ancho: vista === "pieza" ? 1.3 : 1 })
      }
    }
    if (vista === "trayectoria") {
      const hasta = Math.floor(movimientos.length * avance)
      movimientos.forEach((m, i) => {
        if (!m.corte) lineas.push({ pts: m.pts, color: "#3A4658", ancho: 1, dash: "4 4" })
        else {
          // más hondo, más intenso
          const k = Math.max(0.35, Math.min(1, m.z / zMin))
          lineas.push({ pts: m.pts, color: i < hasta ? `rgba(255,122,46,${k.toFixed(2)})` : `rgba(122,74,38,${k.toFixed(2)})`, ancho: i < hasta ? 1.6 : 1.2 })
        }
      })
    }
    const todos = lineas.flatMap((c) => c.pts)
    if (!todos.length) return null
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [x, y] of todos) {
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
    const mar = Math.max(x1 - x0, y1 - y0) * 0.06 + 2
    const W = x1 - x0 + 2 * mar
    const H = y1 - y0 + 2 * mar
    const ult = vista === "trayectoria" && movimientos.length ? movimientos[Math.max(0, Math.min(movimientos.length - 1, Math.floor(movimientos.length * avance) - 1))] : null
    return { lineas, x0, y0, W, H, mar, ancho: x1 - x0, alto: y1 - y0, punta: ult ? ult.pts[ult.pts.length - 1] : null }
  }, [vista, dibujo, movimientos, avance, capas, origen, esSVG, zMin])

  const X = (x: number) => f2(x - (lienzo?.x0 || 0) + (lienzo?.mar || 0))
  const Y = (y: number) => f2((lienzo?.H || 0) - (lienzo?.mar || 0) - (y - (lienzo?.y0 || 0)))
  const minutos = plan ? plan.tiempo_estimado_min : 0
  const reloj = (min: number) => `${Math.floor(min)}:${String(Math.round((min % 1) * 60) % 60).padStart(2, "0")}`
  const costo = plan && maquina.tarifa ? (plan.tiempo_estimado_min / 60) * maquina.tarifa : 0
  const catalogo = laser ? OPS_LASER : OPS_ROUTER

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-[#0D1015] text-white lg:flex-row">
      {/* Ajustes */}
      <aside className="flex w-full flex-col gap-4 border-b border-[#1F2937] bg-[#111722] p-4 lg:sticky lg:top-14 lg:max-h-[calc(100dvh-3.5rem)] lg:w-[330px] lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div>
          <h1 className="m-0 text-[16px] font-bold">
            CAM <span className="text-[#F28A3C]">2D</span>
          </h1>
          <p className="m-0 text-[12px] text-[#8A97AB]">Router y láser: varias operaciones por pieza</p>
        </div>
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            abrir(e.dataTransfer.files?.[0])
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[12px] border-2 border-dashed border-[#2B3648] p-4 text-center hover:border-[#C2560A] hover:bg-[#C2560A]/5"
        >
          <span className="text-[14px] font-semibold">{archivo ? `${archivo.name} (cambiar)` : "Sube tu DXF o SVG"}</span>
          <span className="text-[11.5px] text-[#8A97AB]">Una capa por operación ayuda · no guardamos tu archivo</span>
          <input type="file" accept=".dxf,.svg,image/vnd.dxf,application/dxf,image/svg+xml" className="hidden" onChange={(e) => abrir(e.target.files?.[0])} />
        </label>
        {archivo && !esSVG && <Interruptor etiqueta="Mover el dibujo al origen (0,0)" activo={origen} cambiar={setOrigen} />}
        <ProyectosCam herramienta="2d" obtener={proyectoActual} aplicar={aplicarProyecto} oscuro />

        <Seccion titulo="Máquina">
          <Select valor={maquinaId} cambiar={setMaquinaId}>
            {mias.maquinas.length > 0 && (
              <optgroup label="Mis máquinas">
                {mias.maquinas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Genéricas">
              {MAQUINAS_BASE.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </optgroup>
          </Select>
          <button type="button" onClick={() => setEditar(!editar)} className="self-start text-[12.5px] font-semibold text-[#F28A3C] hover:underline">
            {editar ? "Cerrar mis máquinas y fresas" : "Mis máquinas y fresas"}
          </button>
          {editar && <EditorMias datos={mias} guardar={guardarMias} sesion={sesion} aviso={guardado} />}
        </Seccion>

        <Seccion titulo="Material">
          <Opciones opciones={MATERIALES.map((m) => ({ id: m.id, nombre: m.nombre }))} valor={material} cambiar={setMaterial} columnas={3} />
          <CampoNum etiqueta="Espesor" valor={espesor} cambiar={setEspesor} />
        </Seccion>

        <Seccion titulo="Copias en la hoja" nota="Acomoda varias copias de la pieza en filas y columnas, derecha o girada, para cortarlas en un solo programa.">
          <div className="grid grid-cols-2 gap-2">
            <CampoNum etiqueta="Copias" valor={hoja.copias} cambiar={(v) => { setHoja({ ...hoja, copias: v }); setPlan(null); setGcode(null) }} sufijo="" />
            <CampoNum etiqueta="Separación" valor={hoja.separacion} cambiar={(v) => { setHoja({ ...hoja, separacion: v }); setPlan(null); setGcode(null) }} />
            <CampoNum etiqueta="Hoja: ancho (X)" valor={hoja.ancho} cambiar={(v) => { setHoja({ ...hoja, ancho: v }); setPlan(null); setGcode(null) }} />
            <CampoNum etiqueta="Hoja: largo (Y)" valor={hoja.largo} cambiar={(v) => { setHoja({ ...hoja, largo: v }); setPlan(null); setGcode(null) }} />
          </div>
          {acomodo && (numero(hoja.copias) || 1) > 1 && (
            <span className="text-[12px] leading-snug text-[#C9D2E0]">
              {acomodo.caben > 0 && `Caben ${acomodo.caben} por hoja${acomodo.girada ? " girando la pieza 90°" : ""}. `}
              {variasCopias && `Se acomodaron ${acomodo.puestas}: ocupan ${Math.round(acomodo.ocupa[0])} × ${Math.round(acomodo.ocupa[1])} mm. La separación debe ser mayor que el diámetro de la fresa.`}
            </span>
          )}
          {acomodo?.aviso && <Aviso>{acomodo.aviso}</Aviso>}
        </Seccion>

        <Seccion titulo="Operaciones" nota="Se hacen en este orden. Elige la capa del dibujo que usa cada una.">
          {ops.map((o, i) => {
            const info = catalogo.find((c) => c.id === o.tipo)
            const router = !o.tipo.startsWith("laser")
            return (
              <div key={o.id} className="flex flex-col gap-2 rounded-[10px] border border-[#2B3648] bg-[#151C27] p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#C2560A] text-[11px] font-bold">{i + 1}</span>
                  <select
                    value={o.tipo}
                    onChange={(e) => cambiarOp(i, { ...nuevaOp(e.target.value as TipoOp, espesor), id: o.id, capa: o.capa })}
                    className="min-w-0 flex-1 rounded-[6px] bg-transparent text-[13px] font-semibold text-white outline-none"
                    aria-label="Tipo de operación"
                  >
                    {catalogo.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#1C2431]">
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => moverOp(i, -1)} disabled={i === 0} className="px-1 text-[#8A97AB] hover:text-white disabled:opacity-30" aria-label="Subir">
                    ↑
                  </button>
                  <button type="button" onClick={() => moverOp(i, 1)} disabled={i === ops.length - 1} className="px-1 text-[#8A97AB] hover:text-white disabled:opacity-30" aria-label="Bajar">
                    ↓
                  </button>
                  <button type="button" onClick={() => setOps((l) => l.filter((_, j) => j !== i))} className="px-1 text-[#F6B8AE] hover:text-white" aria-label="Quitar">
                    ✕
                  </button>
                </div>
                {info && <span className="text-[11.5px] text-[#8A97AB]">{info.nota}</span>}
                <Select etiqueta="Capa" valor={o.capa} cambiar={(v) => cambiarOp(i, { capa: v })}>
                  <option value="">Todas las capas</option>
                  {capas.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
                {router ? (
                  <>
                    <Select
                      etiqueta="Herramienta"
                      valor=""
                      cambiar={(v) => {
                        const fr = fresas.find((x) => x.id === v)
                        if (fr)
                          cambiarOp(i, {
                            diametro: String(fr.diametro),
                            angulo: String(fr.angulo),
                            pasada: sinCero(fr.pasada),
                            traslape: sinCero(fr.traslape),
                            rpm: sinCero(fr.rpm),
                            avance: sinCero(fr.avance),
                            penetracion: sinCero(fr.penetracion),
                            fresa: fr.nombre,
                            largoCorte: fr.largoCorte || 0,
                          })
                      }}
                    >
                      <option value="">{o.fresa ? o.fresa : o.tipo === "grabado_v" ? `V ${o.angulo}° · Ø${o.diametro}` : `Ø${o.diametro} mm`} (cambiar…)</option>
                      {porGrupo(fresas.filter((x) => (o.tipo === "grabado_v" ? x.tipo === "v" : x.tipo !== "v" && x.tipo !== "broca"))).map(([g, lista]) => (
                        <optgroup key={g} label={g || "Sin grupo"}>
                          {lista.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.nombre}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                    <div className="grid grid-cols-2 gap-2">
                      <CampoNum etiqueta={o.tipo === "grabado_v" ? "Ø de la V" : "Ø fresa"} valor={o.diametro} cambiar={(v) => cambiarOp(i, { diametro: v, fresa: "", largoCorte: 0 })} />
                      <CampoNum etiqueta={o.tipo === "grabado_v" ? "Prof. máxima" : "Profundidad"} valor={o.profundidad} cambiar={(v) => cambiarOp(i, { profundidad: v })} />
                      {o.tipo === "grabado_v" && <CampoNum etiqueta="Ángulo" valor={o.angulo} cambiar={(v) => cambiarOp(i, { angulo: v })} sufijo="°" />}
                    </div>
                    {o.tipo !== "grabado_v" && o.largoCorte > 0 && numero(o.profundidad) > o.largoCorte && (
                      <span className="rounded-[8px] bg-[#2a1a0c] px-2.5 py-1.5 text-[12px] leading-snug text-[#F6C79B]">
                        La profundidad es mayor que el largo de corte de esta fresa ({o.largoCorte} mm): el zanco rozaría el material.
                      </span>
                    )}
                    {o.tipo === "acanalado" && <CampoNum etiqueta="Largo de la rampa en cada punta" valor={o.rampa} cambiar={(v) => cambiarOp(i, { rampa: v })} />}
                    {o.tipo === "textura" && (
                      <div className="grid grid-cols-2 gap-2">
                        <CampoNum etiqueta="Separación entre surcos" valor={o.sepTextura} cambiar={(v) => cambiarOp(i, { sepTextura: v })} />
                        <CampoNum etiqueta="Largo de cada onda" valor={o.onda} cambiar={(v) => cambiarOp(i, { onda: v })} />
                        <CampoNum etiqueta="Ángulo de los surcos" valor={o.anguloTextura} cambiar={(v) => cambiarOp(i, { anguloTextura: v })} sufijo="°" />
                      </div>
                    )}
                    {o.tipo === "incrustacion_macho" && <CampoNum etiqueta="Holgura para que embone" valor={o.holgura} cambiar={(v) => cambiarOp(i, { holgura: v })} />}
                    {(o.tipo === "incrustacion_hembra" || o.tipo === "incrustacion_macho") && (
                      <span className="text-[11.5px] leading-snug text-[#8A97AB]">Usa la misma figura y el mismo diámetro de fresa en la caja y en la pieza: las esquinas de la pieza salen redondeadas igual que las de la caja.</span>
                    )}
                    {CON_PESTANAS.includes(o.tipo) && <Interruptor etiqueta="Pestañas" activo={o.pestanas} cambiar={(v) => cambiarOp(i, { pestanas: v })} />}
                    {CON_ACABADO.includes(o.tipo) && (
                      <>
                        <Interruptor etiqueta="Desbaste + pasada de acabado" activo={o.acabado} cambiar={(v) => cambiarOp(i, { acabado: v })} />
                        {o.acabado && <CampoNum etiqueta="Material que deja el desbaste" valor={o.sobre} cambiar={(v) => cambiarOp(i, { sobre: v })} />}
                      </>
                    )}
                    <details className="rounded-[8px] bg-[#151C27] px-2.5 py-2">
                      <summary className="cursor-pointer text-[12px] text-[#C9D2E0]">
                        Parámetros de corte{[o.pasada, o.rpm, o.avance, o.penetracion, o.traslape].some((v) => numero(v) > 0) ? " · propios" : " · automáticos por material"}
                      </summary>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <CampoNum etiqueta="Prof. por pasada" valor={o.pasada} cambiar={(v) => cambiarOp(i, { pasada: v })} />
                        {o.tipo === "cajeado" && <CampoNum etiqueta="Traslape" valor={o.traslape} cambiar={(v) => cambiarOp(i, { traslape: v })} sufijo="%" />}
                        <CampoNum etiqueta="Husillo" valor={o.rpm} cambiar={(v) => cambiarOp(i, { rpm: v })} sufijo="rpm" />
                        <CampoNum etiqueta="Avance" valor={o.avance} cambiar={(v) => cambiarOp(i, { avance: v })} sufijo="mm/min" />
                        <CampoNum etiqueta="Bajada" valor={o.penetracion} cambiar={(v) => cambiarOp(i, { penetracion: v })} sufijo="mm/min" />
                      </div>
                      <p className="m-0 mt-1.5 text-[11.5px] leading-snug text-[#8A97AB]">Deja un campo vacío para usar el valor recomendado para el material.</p>
                    </details>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <CampoNum etiqueta="Potencia" valor={o.potencia} cambiar={(v) => cambiarOp(i, { potencia: v })} sufijo="%" />
                    <CampoNum etiqueta="Velocidad" valor={o.velocidad} cambiar={(v) => cambiarOp(i, { velocidad: v })} sufijo="mm/min" />
                    <CampoNum etiqueta="Pasadas" valor={o.pasadas} cambiar={(v) => cambiarOp(i, { pasadas: v })} sufijo="" />
                    {o.tipo === "laser_relleno" && <CampoNum etiqueta="Separación" valor={o.separacion} cambiar={(v) => cambiarOp(i, { separacion: v })} />}
                  </div>
                )}
              </div>
            )
          })}
          {ops.length < 12 && (
            <button
              type="button"
              onClick={() => setOps((l) => [...l, nuevaOp(laser ? "laser_linea" : "cajeado", espesor)])}
              className="rounded-[8px] border border-dashed border-[#3A4A63] px-3 py-2 text-[13px] font-semibold text-[#C9D2E0] hover:border-[#C2560A] hover:text-white"
            >
              + Agregar operación
            </button>
          )}
        </Seccion>

        <button
          type="button"
          onClick={generar}
          disabled={trabajando || !archivo}
          className="rounded-[10px] bg-[#C2560A] px-4 py-3 text-[14px] font-bold text-white hover:bg-[#A84A08] disabled:opacity-50"
        >
          {trabajando ? "Calculando…" : "Calcular trayectoria"}
        </button>
        {error && (
          <Aviso tipo="error">
            <b>{error.mensaje}</b> {error.remedio}
          </Aviso>
        )}
      </aside>

      {/* Vista */}
      <section className="relative flex min-h-[60vh] flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-[#1F2937] bg-[#0F141C] px-3 py-2 text-[12.5px]">
          {(["pieza", "trayectoria"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              disabled={v === "trayectoria" && !gcode}
              aria-pressed={vista === v}
              className={`rounded-[7px] px-3 py-1 font-semibold disabled:opacity-40 ${vista === v ? "bg-[#243045] text-white ring-1 ring-[#C2560A]" : "text-[#8A97AB] hover:text-white"}`}
            >
              {v === "pieza" ? "Pieza" : "Trayectoria"}
            </button>
          ))}
          {vista === "pieza" && capas.length > 1 && (
            <span className="ml-2 flex flex-wrap gap-2 text-[11.5px] text-[#8A97AB]">
              {capas.map((c, i) => (
                <span key={c} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: COLORES_CAPA[i % COLORES_CAPA.length] }} />
                  {c}
                </span>
              ))}
            </span>
          )}
          {plan && (
            <span className="ml-auto flex flex-wrap gap-1.5">
              <span className="rounded-full border border-[#1F5A3A] px-2 py-0.5 text-[11px] text-[#9BE3B8]">
                {plan.operaciones.length} {plan.operaciones.length === 1 ? "operación" : "operaciones"}
              </span>
              {plan.advertencias.length > 0 && (
                <span className="rounded-full border border-[#6a3a14] px-2 py-0.5 text-[11px] text-[#F28A3C]">
                  {plan.advertencias.length} {plan.advertencias.length === 1 ? "aviso" : "avisos"}
                </span>
              )}
            </span>
          )}
        </div>
        <div
          className="relative flex-1 overflow-hidden"
          style={{
            backgroundColor: "#0B0F15",
            backgroundImage: "linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          {lienzo ? (
            <svg viewBox={`0 0 ${f2(lienzo.W)} ${f2(lienzo.H)}`} className="absolute inset-0 h-full w-full p-6" role="img" aria-label={vista === "pieza" ? "Vista de la pieza" : "Trayectoria de la herramienta"}>
              {lienzo.lineas.map((c, i) => (
                <polyline
                  key={i}
                  points={c.pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")}
                  fill="none"
                  stroke={c.color}
                  strokeWidth={c.ancho}
                  strokeDasharray={c.dash}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
              ))}
              {lienzo.punta && <circle cx={X(lienzo.punta[0])} cy={Y(lienzo.punta[1])} r={Math.max(lienzo.W, lienzo.H) / 120} fill="#FFFFFF" />}
            </svg>
          ) : (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-[14px] text-[#8A97AB]">
              Sube un DXF o SVG para ver tu pieza. Luego arma las operaciones, calcula y simula el corte.
            </div>
          )}
          {vista === "trayectoria" && gcode && (
            <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-[10px] border border-[#2B3648] bg-[#111722]/95 px-3 py-2 text-[12px] text-[#8A97AB]">
              <button
                type="button"
                onClick={() => {
                  if (avance >= 1) setAvance(0)
                  setCorriendo(!corriendo)
                }}
                className="grid h-7 w-7 place-items-center rounded-full bg-[#C2560A] text-white"
                aria-label={corriendo ? "Pausar simulación" : "Simular corte"}
              >
                {corriendo ? "❚❚" : "▶"}
              </button>
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(avance * 1000)}
                onChange={(e) => {
                  setCorriendo(false)
                  setAvance(Number(e.target.value) / 1000)
                }}
                className="flex-1 accent-[#F07A1A]"
                aria-label="Avance de la simulación"
              />
              <span className="tabular-nums">
                {reloj(minutos * avance)} / {reloj(minutos)}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-[#1F2937] bg-[#0F141C] px-4 py-2 text-[12.5px] text-[#8A97AB]">
          {lienzo && (
            <span>
              Medidas: <b className="text-white">{Math.round(lienzo.ancho)} × {Math.round(lienzo.alto)} mm</b>
            </span>
          )}
          {dibujo && (
            <span>
              Trazos: <b className="text-white">{dibujo.trazos.length}</b> · Capas: <b className="text-white">{capas.length}</b>
            </span>
          )}
          <span>Unidades: mm</span>
          <span>Origen: {origen || esSVG ? "esquina inferior izquierda de la pieza" : "el del archivo"}, cara superior</span>
        </div>
      </section>

      {/* Resultado */}
      <aside className="flex w-full flex-col gap-4 border-t border-[#1F2937] bg-[#111722] p-4 lg:sticky lg:top-14 lg:max-h-[calc(100dvh-3.5rem)] lg:w-[300px] lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
        <Seccion titulo="Resultado">
          {plan ? (
            <>
              <div className="rounded-[12px] bg-[#1C2431] p-3">
                <span className="block text-[11px] uppercase tracking-wide text-[#8A97AB]">Tiempo estimado</span>
                <span className="text-[26px] font-bold leading-tight">{reloj(plan.tiempo_estimado_min)} min</span>
              </div>
              <Datos
                filas={[
                  ["Corte", `${(plan.largo_corte_mm / 1000).toFixed(2)} m`],
                  ["Rápidos", `${(plan.recorrido_rapido_mm / 1000).toFixed(2)} m`],
                  ...(costo ? ([["Costo de máquina", `$${Math.round(costo).toLocaleString("es-MX")} MXN`]] as [string, string][]) : []),
                  ["Postprocesador", POSTS.find((p) => p.id === maquina.post)?.nombre || maquina.post],
                ]}
              />
              <ol className="m-0 flex flex-col gap-1.5 p-0">
                {plan.operaciones.map((o, i) => (
                  <li key={i} className="flex list-none items-baseline justify-between gap-2 rounded-[8px] bg-[#151C27] px-2.5 py-1.5 text-[12.5px]">
                    <span>
                      <b>{i + 1}.</b> {NOMBRE_OP[o.tipo] || o.nombre}
                      {o.capa && <span className="text-[#8A97AB]"> · {o.capa}</span>}
                      <span className="block text-[11px] text-[#8A97AB]">{o.figuras} figura(s)</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-[#C9D2E0]">{reloj(o.minutos)}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <span className="text-[13px] text-[#8A97AB]">Aquí aparecen el tiempo, el costo de máquina y el detalle de cada operación.</span>
          )}
        </Seccion>
        {plan?.advertencias.map((a) => (
          <Aviso key={a}>{a}</Aviso>
        ))}
        {gcode && (
          <Seccion titulo="G-code" nota="Pruébalo primero en vacío y con avance reducido: los parámetros dependen de tu máquina.">
            <Boton tipo="primario" onClick={descargar}>
              {bajando ? "Preparando…" : `Descargar .${EXTENSION[maquina.post]}`}
            </Boton>
            {negado ? (
              <CandadoCam negado={negado} oscuro regreso="/mx/cam/subir" />
            ) : (
              cupo?.estado && <span className="text-[12px] leading-snug text-[#8A97AB]">{textoCupo(cupo.sesion, cupo.estado.basico, cupo.estado.plan_nombre, "El CAM 2D")}</span>
            )}
          </Seccion>
        )}
        <Seccion titulo="¿Necesitas más?" nota="3D, 4 o 5 ejes, o que un taller te lo corte.">
          <div className="flex flex-col gap-2">
            <Boton href="/mx/cam/lab">CAM 3, 4 y 5 ejes</Boton>
            <Boton tipo="verde" href="/mx/fabricacion">
              Que un taller lo corte
            </Boton>
          </div>
        </Seccion>
      </aside>
    </div>
  )
}

function Fila({ texto, quitar }: { texto: string; quitar: () => void }) {
  return (
    <li className="flex list-none items-center justify-between gap-2 rounded-[6px] bg-[#1C2431] px-2 py-1 text-[12.5px]">
      <span className="min-w-0 truncate">{texto}</span>
      <button type="button" onClick={quitar} className="text-[#F6B8AE] hover:text-white" aria-label="Quitar">
        ✕
      </button>
    </li>
  )
}

// Editor de "Mis máquinas y fresas" (fase C)
function EditorMias({ datos, guardar, sesion, aviso }: { datos: DatosCam; guardar: (d: DatosCam) => void; sesion: boolean; aviso: string }) {
  const [m, setM] = useState<MaquinaCam>({ id: "", nombre: "", tipo: "router", post: "mach3", tarifa: 300, smax: 1000 })
  const [tarifa, setTarifa] = useState("300")
  // null = cerrada, "" = alta nueva, id = edición de esa fresa
  const [ficha, setFicha] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-[#2B3648] bg-[#151C27] p-3">
      <span className="text-[12px] text-[#8A97AB]">{sesion ? "Se guardan en tu cuenta." : "Sin sesión se guardan en este navegador. Inicia sesión para tenerlas en tu cuenta."}</span>
      <b className="text-[12.5px]">Máquinas</b>
      {datos.maquinas.length > 0 && (
        <ul className="m-0 flex flex-col gap-1 p-0">
          {datos.maquinas.map((x) => (
            <Fila key={x.id} texto={`${x.nombre} · ${x.tipo === "laser" ? "láser" : "router"} · $${x.tarifa}/h`} quitar={() => guardar({ ...datos, maquinas: datos.maquinas.filter((y) => y.id !== x.id) })} />
          ))}
        </ul>
      )}
      <input value={m.nombre} onChange={(e) => setM({ ...m, nombre: e.target.value })} placeholder="Nombre (ej. Router 1530)" maxLength={40} className="rounded-[8px] bg-[#1C2431] px-2.5 py-2 text-[13px] text-white outline-none placeholder:text-[#5B6880]" />
      <div className="grid grid-cols-2 gap-2">
        <Select valor={m.post} cambiar={(v) => setM({ ...m, post: v as MaquinaCam["post"], tipo: v === "laser_grbl" ? "laser" : "router" })}>
          {POSTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Select>
        <CampoNum etiqueta="" valor={tarifa} cambiar={setTarifa} sufijo="$/hora" />
      </div>
      <Boton
        onClick={() => {
          if (!m.nombre.trim()) return
          guardar({ ...datos, maquinas: [...datos.maquinas, { ...m, tarifa: numero(tarifa) || 0, id: nuevoId() }] })
          setM({ ...m, nombre: "" })
        }}
      >
        Agregar máquina
      </Boton>
      <b className="text-[12.5px]">Base de herramientas</b>
      {datos.fresas.length > 0 && (
        <ul className="m-0 flex flex-col gap-1 p-0">
          {porGrupo(datos.fresas).flatMap(([g, lista]) => [
            ...(g || porGrupo(datos.fresas).length > 1 ? [<li key={`g-${g}`} className="list-none pt-1 text-[11px] font-bold uppercase tracking-wide text-[#8A97AB]">{g || "Sin grupo"}</li>] : []),
            ...lista.map((x) => (
            <li key={x.id} className="flex list-none items-center justify-between gap-2 rounded-[6px] bg-[#1C2431] px-2 py-1.5 text-[12.5px]">
              <button type="button" onClick={() => setFicha(x.id)} className="min-w-0 flex-1 text-left hover:text-[#F28A3C]" title="Editar">
                <span className="block truncate font-semibold">
                  {x.numero ? `T${x.numero} · ` : ""}
                  {x.nombre}
                </span>
                <span className="block truncate text-[11.5px] text-[#8A97AB]">
                  Ø{x.diametro}
                  {x.tipo === "v" ? ` · ${x.angulo}°` : ""}
                  {x.zanco ? ` · zanco Ø${x.zanco}` : ""}
                  {x.largoCorte ? ` · filo ${x.largoCorte}` : ""}
                  {x.filos ? ` · ${x.filos} ${x.filos === 1 ? "filo" : "filos"}` : ""}
                  {x.rpm ? ` · ${x.rpm} rpm` : ""}
                  {x.avance ? ` · ${x.avance} mm/min` : ""}
                </span>
              </button>
              <button type="button" onClick={() => guardar({ ...datos, fresas: datos.fresas.filter((y) => y.id !== x.id) })} className="text-[#F6B8AE] hover:text-white" aria-label="Quitar">
                ✕
              </button>
            </li>
            )),
          ])}
        </ul>
      )}
      {ficha === null ? (
        <Boton onClick={() => setFicha("")}>Dar de alta una herramienta</Boton>
      ) : (
        <FichaFresa
          key={ficha || "nueva"}
          inicial={datos.fresas.find((x) => x.id === ficha)}
          grupos={[...new Set(datos.fresas.map((x) => x.grupo || "").filter(Boolean))]}
          cancelar={() => setFicha(null)}
          guardar={(f) => {
            const fresas = f.id ? datos.fresas.map((x) => (x.id === f.id ? f : x)) : [...datos.fresas, { ...f, id: nuevoId() }]
            guardar({ ...datos, fresas })
            setFicha(null)
          }}
        />
      )}
      {aviso && <span className="text-[12px] text-[#9BE3B8]">{aviso}</span>}
    </div>
  )
}
