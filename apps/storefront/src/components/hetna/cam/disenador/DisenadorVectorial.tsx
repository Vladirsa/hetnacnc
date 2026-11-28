"use client"

// CAM Studio · Diseñar: mesa de dibujo de vectores a pantalla completa.
//
//   ┌ herramientas ┐┌ barra: deshacer · zoom · cuadrícula · imán · X Y ───────┐┌ panel ────────┐
//   │ seleccionar  ││                                                          ││ hoja          │
//   │ nodos        ││   la hoja de material y el dibujo (mm, Y hacia arriba)   ││ selección     │
//   │ línea, curva ││                                                          ││ combinar      │
//   │ rect, círc.  ││                                                          ││ offset, arreg.│
//   │ texto, medir ││                                                          ││ capas · salida│
//   └──────────────┘└──────────────────────────────────────────────────────────┘└───────────────┘
//
// La geometría vive en lib/disenador/geometria.ts (con pruebas). Al terminar, el
// diseño va al CAM 2D con una operación por capa, o directo a cotizar con talleres.
// Se guarda solo en este navegador mientras se dibuja.
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { T, useT } from "@/components/hetna/i18n/Idioma"
import { mandarPaqueteACotizador, materialRouterMDF, slugArchivo } from "@/lib/generador/aCotizador"
import { mandarACam2D } from "@/lib/generador/aLaboratorio"
import { FUENTES, cargarFuente } from "@/lib/generador/fuentes"
import { textoATrazos } from "@/lib/generador/textoTrazos"
import { dibujoDXF, dibujoSVG, leerDXF, leerSVG } from "@/lib/generador/vectores"
import {
  type Alineacion,
  type Caja,
  type Capa,
  type Documento,
  type Forma,
  type P,
  aDibujo,
  ajustarCaja,
  alinear,
  arco3Puntos,
  arregloCircular,
  arregloLineal,
  borrarNodo,
  cajaDe,
  centro,
  circulo,
  copiaForma,
  desdeTrazos,
  distanciaAForma,
  documentoNuevo,
  documentoValido,
  elipse,
  escalar,
  espejo,
  esquinaNodo,
  estrella,
  girar,
  insertarNodo,
  intersectar,
  largo,
  linea,
  mover,
  nuevoId,
  offset,
  partirEnNodo,
  poligono,
  puntoMasCercano,
  rectangulo,
  redondearEsquinas,
  restar,
  rutaSVG,
  soldar,
  suavizarNodo,
  unirAbiertas,
} from "@/lib/disenador/geometria"

type Herramienta = "seleccionar" | "nodos" | "mano" | "linea" | "curva" | "rect" | "circulo" | "elipse" | "poligono" | "estrella" | "arco" | "texto" | "medir"
type Vista = { z: number; tx: number; ty: number }
type NodoSel = { id: string; i: number } | null

const LLAVE = "hetna_disenador_v1"
const PX_TOCAR = 7

const HERRAMIENTAS: { id: Herramienta; nombre: string; tecla: string; icono: string }[] = [
  { id: "seleccionar", nombre: "Seleccionar y mover", tecla: "V", icono: "M5 3l14 8-6 1.5L10 19z" },
  { id: "nodos", nombre: "Editar nodos", tecla: "N", icono: "M4 18C8 6 16 6 20 18M4 18h0M12 9h0M20 18h0" },
  { id: "mano", nombre: "Mover la vista", tecla: "H", icono: "M8 13V5a1.5 1.5 0 013 0v6m0-1V4a1.5 1.5 0 013 0v7m0-5a1.5 1.5 0 013 0v7c0 4-2 7-6 7s-6-3-7-6l-1-3a1.5 1.5 0 012.6-1.4L8 13" },
  { id: "linea", nombre: "Línea y polilínea", tecla: "L", icono: "M4 18l6-10 5 6 5-9" },
  { id: "curva", nombre: "Curva (Bézier)", tecla: "P", icono: "M4 18C6 6 18 18 20 6" },
  { id: "rect", nombre: "Rectángulo", tecla: "R", icono: "M4 6h16v12H4z" },
  { id: "circulo", nombre: "Círculo (desde el centro)", tecla: "C", icono: "M12 4a8 8 0 100 16 8 8 0 100-16z" },
  { id: "elipse", nombre: "Elipse", tecla: "E", icono: "M12 7c5 0 9 2.2 9 5s-4 5-9 5-9-2.2-9-5 4-5 9-5z" },
  { id: "poligono", nombre: "Polígono", tecla: "G", icono: "M12 3l8 6-3 10H7L4 9z" },
  { id: "estrella", nombre: "Estrella", tecla: "S", icono: "M12 3l2.6 6 6.4.6-4.8 4.3 1.4 6.3L12 17l-5.6 3.2 1.4-6.3L3 9.6 9.4 9z" },
  { id: "arco", nombre: "Arco por 3 puntos", tecla: "A", icono: "M4 18A8 8 0 0120 18" },
  { id: "texto", nombre: "Texto", tecla: "T", icono: "M5 5h14M12 5v14M9 19h6" },
  { id: "medir", nombre: "Medir", tecla: "M", icono: "M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2" },
]

const num = (s: string) => parseFloat(String(s).replace(",", "."))
const red = (x: number, d = 2) => {
  const k = 10 ** d
  return Math.round(x * k) / k
}

// ---------------------------------------------------------------------

export function DisenadorVectorial() {
  const t = useT()
  const params = useParams() as { locale?: string }
  const locale = params?.locale || "mx"

  const [doc, setDoc] = useState<Documento>(documentoNuevo)
  const pasado = useRef<Documento[]>([])
  const futuro = useRef<Documento[]>([])
  const [, setVersionHist] = useState(0)
  const [sel, setSel] = useState<string[]>([])
  const [herr, setHerr] = useState<Herramienta>("seleccionar")
  const [vista, setVista] = useState<Vista>({ z: 1.4, tx: 60, ty: 600 })
  const [capaActiva, setCapaActiva] = useState("corte")
  const [cuadricula, setCuadricula] = useState(true)
  const [paso, setPaso] = useState("10")
  const [iman, setIman] = useState(true)
  const [imanNodos, setImanNodos] = useState(true)
  const [cursor, setCursor] = useState<P>([0, 0])
  const [nodoSel, setNodoSel] = useState<NodoSel>(null)
  const [aviso, setAviso] = useState("")
  // borrador de la herramienta de dibujo
  const [puntos, setPuntos] = useState<{ p: P; a?: P; b?: P }[]>([])
  const [arrastreDibujo, setArrastreDibujo] = useState<{ a: P; b: P } | null>(null)
  const [caja, setCaja] = useState<{ a: P; b: P } | null>(null)
  const [medida, setMedida] = useState<{ a: P; b: P } | null>(null)
  const [imantado, setImantado] = useState<P | null>(null)
  // parámetros de las figuras
  const [radio, setRadio] = useState("0")
  const [lados, setLados] = useState("6")
  const [puntas, setPuntas] = useState("5")
  const [interior, setInterior] = useState("45")
  const [texto, setTexto] = useState("HETNA")
  const [fuenteId, setFuenteId] = useState(FUENTES[0].id)
  const [altoTexto, setAltoTexto] = useState("40")
  // operaciones
  const [dOffset, setDOffset] = useState("3")
  const [ladoOffset, setLadoOffset] = useState<"afuera" | "adentro">("afuera")
  const [esquinasOffset, setEsquinasOffset] = useState<"redondas" | "rectas">("redondas")
  const [rEsquinas, setREsquinas] = useState("5")
  const [giro, setGiro] = useState("90")
  const [filaN, setFilaN] = useState("3")
  const [filaDx, setFilaDx] = useState("50")
  const [filaDy, setFilaDy] = useState("0")
  const [cirN, setCirN] = useState("6")
  const [cirAng, setCirAng] = useState("360")
  const [cirCx, setCirCx] = useState("")
  const [cirCy, setCirCy] = useState("")
  const [proporcional, setProporcional] = useState(true)
  const [espacio, setEspacio] = useState(false)

  const svgRef = useRef<SVGSVGElement>(null)
  const arrastre = useRef<null | {
    tipo: "mover" | "escala" | "girar" | "pan" | "nodo" | "manija" | "caja" | "dibujo" | "curva" | "medir"
    inicio: P
    inicioPx: [number, number]
    original: Forma[]
    caja?: Caja
    asa?: string
    vista?: Vista
    nodo?: { id: string; i: number; cual: "p" | "a" | "b" }
    yaGuardo?: boolean
  }>(null)
  const portapapeles = useRef<Forma[]>([])

  const u = doc.unidades === "in" ? 25.4 : 1
  const enU = (mm: number) => red(mm / u, doc.unidades === "in" ? 3 : 2)
  const deU = (v: string) => num(v) * u
  const sufijo = doc.unidades === "in" ? "in" : "mm"
  const pasoMm = Math.max(0.1, (num(paso) || 10) * u)

  // ---------------- documento e historial ----------------
  const cambiar = useCallback((fn: (d: Documento) => Documento, guardar = true) => {
    setDoc((d) => {
      const nuevo = fn(d)
      if (nuevo === d) return d
      if (guardar) {
        pasado.current.push(d)
        if (pasado.current.length > 150) pasado.current.shift()
        futuro.current = []
        setVersionHist((v) => v + 1)
      }
      return nuevo
    })
  }, [])
  const marcarHistorial = useCallback(() => {
    setDoc((d) => {
      pasado.current.push(d)
      if (pasado.current.length > 150) pasado.current.shift()
      futuro.current = []
      setVersionHist((v) => v + 1)
      return d
    })
  }, [])
  const deshacer = useCallback(() => {
    setDoc((d) => {
      const prev = pasado.current.pop()
      if (!prev) return d
      futuro.current.push(d)
      setVersionHist((v) => v + 1)
      return prev
    })
    setNodoSel(null)
  }, [])
  const rehacer = useCallback(() => {
    setDoc((d) => {
      const sig = futuro.current.pop()
      if (!sig) return d
      pasado.current.push(d)
      setVersionHist((v) => v + 1)
      return sig
    })
  }, [])

  const formasSel = useMemo(() => doc.formas.filter((f) => sel.includes(f.id)), [doc.formas, sel])
  const cajaSel = useMemo(() => cajaDe(formasSel), [formasSel])
  const capasPorId = useMemo(() => Object.fromEntries(doc.capas.map((c) => [c.id, c])) as Record<string, Capa>, [doc.capas])
  const visibles = useMemo(() => doc.formas.filter((f) => capasPorId[f.capa]?.visible !== false), [doc.formas, capasPorId])

  // seleccionar todo el grupo al tocar una forma agrupada
  const conGrupo = useCallback(
    (ids: string[]) => {
      const grupos = new Set(doc.formas.filter((f) => ids.includes(f.id) && f.grupo).map((f) => f.grupo))
      return [...new Set([...ids, ...doc.formas.filter((f) => f.grupo && grupos.has(f.grupo)).map((f) => f.id)])]
    },
    [doc.formas]
  )

  const reemplazarSel = (nuevas: Forma[], quitar: string[] = sel) => {
    cambiar((d) => ({ ...d, formas: [...d.formas.filter((f) => !quitar.includes(f.id)), ...nuevas] }))
    setSel(nuevas.map((f) => f.id))
  }
  const transformarSel = (fn: (f: Forma) => Forma) => {
    if (!sel.length) return
    cambiar((d) => ({ ...d, formas: d.formas.map((f) => (sel.includes(f.id) ? fn(f) : f)) }))
  }
  const agregar = (nuevas: Forma[]) => {
    if (!nuevas.length) return
    cambiar((d) => ({ ...d, formas: [...d.formas, ...nuevas] }))
    setSel(nuevas.map((f) => f.id))
  }

  // ---------------- guardado en el navegador ----------------
  const cargado = useRef(false)
  useEffect(() => {
    try {
      const d = documentoValido(JSON.parse(localStorage.getItem(LLAVE) || "null"))
      if (d) setDoc(d)
    } catch {
      // sin almacenamiento o dato viejo: diseño nuevo
    }
    cargado.current = true
  }, [])
  useEffect(() => {
    if (!cargado.current) return
    const id = setTimeout(() => {
      try {
        localStorage.setItem(LLAVE, JSON.stringify(doc))
      } catch {
        // lleno o sin permiso: se sigue trabajando, sólo no se guarda
      }
    }, 600)
    return () => clearTimeout(id)
  }, [doc])

  // ---------------- vista ----------------
  const tam = useRef<{ w: number; h: number }>({ w: 800, h: 600 })
  const ajustarVista = useCallback(
    (c?: Caja | null) => {
      const r = svgRef.current?.getBoundingClientRect()
      if (!r) return
      tam.current = { w: r.width, h: r.height }
      const b = c || cajaDe(doc.formas) || { x0: 0, y0: 0, x1: doc.hoja.ancho, y1: doc.hoja.alto }
      const caj = c ? b : { x0: Math.min(0, b.x0), y0: Math.min(0, b.y0), x1: Math.max(doc.hoja.ancho, b.x1), y1: Math.max(doc.hoja.alto, b.y1) }
      const w = Math.max(1, caj.x1 - caj.x0), h = Math.max(1, caj.y1 - caj.y0)
      const z = Math.min((r.width - 80) / w, (r.height - 80) / h)
      setVista({ z, tx: (r.width - w * z) / 2 - caj.x0 * z, ty: (r.height + h * z) / 2 + caj.y0 * z })
    },
    [doc.formas, doc.hoja]
  )
  useEffect(() => {
    const id = setTimeout(() => ajustarVista(), 50)
    return () => clearTimeout(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // medida del lienzo (para la cuadrícula) al cambiar la ventana
  const [, setTamVersion] = useState(0)
  useEffect(() => {
    const el = svgRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      tam.current = { w: r.width, h: r.height }
      setTamVersion((v) => v + 1)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const aMundo = (cx: number, cy: number): P => {
    const r = svgRef.current!.getBoundingClientRect()
    return [(cx - r.left - vista.tx) / vista.z, -(cy - r.top - vista.ty) / vista.z]
  }
  const aPx = (p: P): [number, number] => [p[0] * vista.z + vista.tx, -p[1] * vista.z + vista.ty]

  // rueda: zoom alrededor del cursor (sin mover la página)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const rueda = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const sx = e.clientX - r.left, sy = e.clientY - r.top
      setVista((v) => {
        const k = Math.exp(-e.deltaY * 0.0015)
        const z = Math.min(200, Math.max(0.02, v.z * k))
        const f = z / v.z
        return { z, tx: sx - (sx - v.tx) * f, ty: sy - (sy - v.ty) * f }
      })
    }
    el.addEventListener("wheel", rueda, { passive: false })
    return () => el.removeEventListener("wheel", rueda)
  }, [])

  // ---------------- imán ----------------
  const imantar = (p: P, excluir: string[] = []): P => {
    const tol = (PX_TOCAR + 3) / vista.z
    if (imanNodos) {
      let mejor: P | null = null, dm = tol
      for (const f of visibles) {
        if (excluir.includes(f.id)) continue
        for (const n of f.nodos) {
          const d = Math.hypot(n.p[0] - p[0], n.p[1] - p[1])
          if (d < dm) {
            dm = d
            mejor = n.p
          }
        }
      }
      if (puntos.length) {
        const q = puntos[0].p
        if (Math.hypot(q[0] - p[0], q[1] - p[1]) < dm) mejor = q
      }
      if (mejor) {
        setImantado(mejor)
        return [mejor[0], mejor[1]]
      }
    }
    setImantado(null)
    if (iman && cuadricula) return [Math.round(p[0] / pasoMm) * pasoMm, Math.round(p[1] / pasoMm) * pasoMm]
    return p
  }

  // forma bajo el cursor: la línea más cercana; si no, la cerrada más chica que lo contiene
  const formaEn = (p: P): Forma | null => {
    const tol = PX_TOCAR / vista.z
    let mejor: Forma | null = null, dm = tol
    for (const f of visibles) {
      const d = distanciaAForma(p, f)
      if (d <= dm) {
        dm = d
        mejor = f
      }
    }
    if (mejor) return mejor
    let chica: Forma | null = null, am = Infinity
    for (const f of visibles) {
      if (!f.cerrada || distanciaAForma(p, f, true) > 0) continue
      const c = cajaDe([f])!
      const a = (c.x1 - c.x0) * (c.y1 - c.y0)
      if (a < am) {
        am = a
        chica = f
      }
    }
    return chica
  }

  // ---------------- dibujo con el ratón ----------------
  const terminarRuta = (cerrar: boolean) => {
    if (puntos.length >= 2) {
      const f: Forma = { id: nuevoId(), nodos: puntos.map((n) => ({ ...n, p: [n.p[0], n.p[1]] as P })), cerrada: cerrar && puntos.length >= 3, capa: capaActiva }
      if (f.cerrada) {
        // al cerrar sobre el primer punto, ese punto no se repite
        const ult = f.nodos[f.nodos.length - 1]
        if (Math.hypot(ult.p[0] - f.nodos[0].p[0], ult.p[1] - f.nodos[0].p[1]) < 1e-6) {
          f.nodos.pop()
          if (ult.a) f.nodos[0] = { ...f.nodos[0], a: ult.a }
        }
      }
      agregar([f])
    }
    setPuntos([])
  }

  const figuraBorrador = (a: P, b: P): Forma | null => {
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const r = Math.hypot(dx, dy)
    if (herr === "rect") return Math.abs(dx) > 1e-6 && Math.abs(dy) > 1e-6 ? rectangulo(a[0], a[1], dx, dy, Math.max(0, deU(radio) || 0), capaActiva) : null
    if (herr === "circulo") return r > 1e-6 ? circulo(a[0], a[1], r, capaActiva) : null
    if (herr === "elipse") return Math.abs(dx) > 1e-6 && Math.abs(dy) > 1e-6 ? elipse(a[0] + dx / 2, a[1] + dy / 2, dx / 2, dy / 2, capaActiva) : null
    if (herr === "poligono") return r > 1e-6 ? poligono(a[0], a[1], r, num(lados) || 6, Math.atan2(dy, dx), capaActiva) : null
    if (herr === "estrella") return r > 1e-6 ? estrella(a[0], a[1], r, (r * Math.min(95, Math.max(5, num(interior) || 45))) / 100, num(puntas) || 5, Math.atan2(dy, dx), capaActiva) : null
    return null
  }

  const ponerTexto = async (en: P) => {
    const tipo = FUENTES.find((f) => f.id === fuenteId) || FUENTES[0]
    const alto = deU(altoTexto)
    if (!texto.trim() || !(alto > 0)) return setAviso("Escribe el texto y su alto en el panel de la derecha.")
    try {
      const fuente = await cargarFuente(tipo)
      const trazos = textoATrazos(fuente, texto, alto, capaActiva)
      if (!trazos.length) return setAviso("Esa fuente no tiene esas letras.")
      const g = nuevoId()
      const formas = desdeTrazos(trazos, capaActiva, [capaActiva]).map((f) => ({ ...mover(f, en[0], en[1]), grupo: g }))
      agregar(formas)
      setHerr("seleccionar")
    } catch {
      setAviso("No se pudo cargar la fuente. Revisa tu conexión e intenta de nuevo.")
    }
  }

  // ---------------- eventos del lienzo ----------------
  const alBajar = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 2) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const p = aMundo(e.clientX, e.clientY)
    const px: [number, number] = [e.clientX, e.clientY]
    setAviso("")
    if (e.button === 1 || herr === "mano" || espacio) {
      arrastre.current = { tipo: "pan", inicio: p, inicioPx: px, original: [], vista }
      return
    }
    if (herr === "seleccionar") {
      // asas de la caja de selección
      const asa = (e.target as Element).getAttribute?.("data-asa")
      if (asa && cajaSel) {
        arrastre.current = { tipo: asa === "giro" ? "girar" : "escala", inicio: p, inicioPx: px, original: formasSel.map((f) => copiaForma(f)), caja: cajaSel, asa }
        return
      }
      const f = formaEn(p)
      if (f) {
        let ids = sel
        if (e.shiftKey) ids = sel.includes(f.id) ? sel.filter((i) => !conGrupo([f.id]).includes(i)) : conGrupo([...sel, f.id])
        else if (!sel.includes(f.id)) ids = conGrupo([f.id])
        setSel(ids)
        arrastre.current = { tipo: "mover", inicio: imantar(p, ids), inicioPx: px, original: doc.formas.filter((x) => ids.includes(x.id)).map((x) => copiaForma(x)) }
      } else {
        if (!e.shiftKey) setSel([])
        arrastre.current = { tipo: "caja", inicio: p, inicioPx: px, original: [] }
        setCaja({ a: p, b: p })
      }
      return
    }
    if (herr === "nodos") {
      const objetivo = (e.target as Element).getAttribute?.("data-nodo")
      if (objetivo) {
        const [id, i, cual] = objetivo.split("|")
        setNodoSel({ id, i: Number(i) })
        arrastre.current = { tipo: cual === "p" ? "nodo" : "manija", inicio: p, inicioPx: px, original: doc.formas.filter((x) => x.id === id).map((x) => copiaForma(x)), nodo: { id, i: Number(i), cual: cual as "p" | "a" | "b" } }
        return
      }
      const f = formaEn(p)
      setSel(f ? [f.id] : [])
      setNodoSel(null)
      return
    }
    if (herr === "medir") {
      const a = imantar(p)
      arrastre.current = { tipo: "medir", inicio: a, inicioPx: px, original: [] }
      setMedida({ a, b: a })
      return
    }
    if (herr === "texto") {
      ponerTexto(imantar(p))
      return
    }
    if (herr === "linea") {
      const q = imantar(p)
      if (puntos.length >= 3 && Math.hypot(q[0] - puntos[0].p[0], q[1] - puntos[0].p[1]) < PX_TOCAR / vista.z) return terminarRuta(true)
      setPuntos((l) => [...l, { p: q }])
      return
    }
    if (herr === "curva") {
      const q = imantar(p)
      if (puntos.length >= 2 && Math.hypot(q[0] - puntos[0].p[0], q[1] - puntos[0].p[1]) < PX_TOCAR / vista.z) return terminarRuta(true)
      setPuntos((l) => [...l, { p: q }])
      arrastre.current = { tipo: "curva", inicio: q, inicioPx: px, original: [] }
      return
    }
    if (herr === "arco") {
      const q = imantar(p)
      if (puntos.length < 2) setPuntos((l) => [...l, { p: q }])
      else {
        const f = arco3Puntos(puntos[0].p, puntos[1].p, q, capaActiva)
        if (f) agregar([f])
        setPuntos([])
      }
      return
    }
    // figuras por arrastre
    const a = imantar(p)
    arrastre.current = { tipo: "dibujo", inicio: a, inicioPx: px, original: [] }
    setArrastreDibujo({ a, b: a })
  }

  const alMover = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = aMundo(e.clientX, e.clientY)
    setCursor(p)
    const ar = arrastre.current
    if (!ar) {
      if (["linea", "curva", "arco", "rect", "circulo", "elipse", "poligono", "estrella", "texto", "medir"].includes(herr)) imantar(p)
      return
    }
    const movido = Math.hypot(e.clientX - ar.inicioPx[0], e.clientY - ar.inicioPx[1]) > 2
    if (ar.tipo === "pan" && ar.vista) {
      setVista({ ...ar.vista, tx: ar.vista.tx + e.clientX - ar.inicioPx[0], ty: ar.vista.ty + e.clientY - ar.inicioPx[1] })
      return
    }
    if (ar.tipo === "caja") {
      setCaja({ a: ar.inicio, b: p })
      return
    }
    if (ar.tipo === "medir") {
      setMedida({ a: ar.inicio, b: imantar(p) })
      return
    }
    if (ar.tipo === "dibujo") {
      let b = imantar(p)
      if (e.shiftKey && (herr === "rect" || herr === "elipse")) {
        const s = Math.max(Math.abs(b[0] - ar.inicio[0]), Math.abs(b[1] - ar.inicio[1]))
        b = [ar.inicio[0] + Math.sign(b[0] - ar.inicio[0] || 1) * s, ar.inicio[1] + Math.sign(b[1] - ar.inicio[1] || 1) * s]
      }
      setArrastreDibujo({ a: ar.inicio, b })
      return
    }
    if (ar.tipo === "curva") {
      if (!movido) return
      const q = p
      const c = ar.inicio
      setPuntos((l) => {
        if (!l.length) return l
        const base = l[l.length - 1]
        const ult: { p: P; a?: P; b?: P } = l.length === 1 ? { p: base.p, b: q } : { p: base.p, b: q, a: [2 * c[0] - q[0], 2 * c[1] - q[1]] }
        return [...l.slice(0, -1), ult]
      })
      return
    }
    if (!movido) return
    if (!ar.yaGuardo) {
      marcarHistorial()
      ar.yaGuardo = true
    }
    const ids = ar.original.map((f) => f.id)
    const reemplazar = (nuevas: Forma[]) => {
      const m = new Map(nuevas.map((f) => [f.id, f]))
      setDoc((d) => ({ ...d, formas: d.formas.map((f) => m.get(f.id) || f) }))
    }
    if (ar.tipo === "mover") {
      const q = imantar(p, ids)
      let dx = q[0] - ar.inicio[0], dy = q[1] - ar.inicio[1]
      if (e.shiftKey) Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0)
      reemplazar(ar.original.map((f) => mover(f, dx, dy)))
      return
    }
    if (ar.tipo === "escala" && ar.caja && ar.asa) {
      const c = ar.caja
      const asa = ar.asa
      const ancla: P = [asa.includes("w") ? c.x1 : asa.includes("e") ? c.x0 : (c.x0 + c.x1) / 2, asa.includes("s") ? c.y1 : asa.includes("n") ? c.y0 : (c.y0 + c.y1) / 2]
      const q = imantar(p, ids)
      const w0 = c.x1 - c.x0 || 1, h0 = c.y1 - c.y0 || 1
      let kx = asa.includes("e") ? (q[0] - c.x0) / w0 : asa.includes("w") ? (c.x1 - q[0]) / w0 : 1
      let ky = asa.includes("n") ? (q[1] - c.y0) / h0 : asa.includes("s") ? (c.y1 - q[1]) / h0 : 1
      const esquina = asa.length === 2
      if (esquina && proporcional !== e.shiftKey) {
        const k = Math.abs(kx) > Math.abs(ky) ? kx : ky
        kx = k
        ky = k
      }
      if (Math.abs(kx) < 1e-3 || Math.abs(ky) < 1e-3) return
      reemplazar(ar.original.map((f) => escalar(f, kx, ky, ancla)))
      return
    }
    if (ar.tipo === "girar" && ar.caja) {
      const c = centro(ar.caja)
      let ang = Math.atan2(p[1] - c[1], p[0] - c[0]) - Math.atan2(ar.inicio[1] - c[1], ar.inicio[0] - c[0])
      if (e.shiftKey) ang = Math.round(ang / (Math.PI / 12)) * (Math.PI / 12)
      reemplazar(ar.original.map((f) => girar(f, ang, c)))
      return
    }
    if ((ar.tipo === "nodo" || ar.tipo === "manija") && ar.nodo) {
      const f0 = ar.original[0]
      const { i, cual } = ar.nodo
      const q = cual === "p" ? imantar(p, []) : p
      const nodos = f0.nodos.map((n) => ({ ...n }))
      const n = { ...nodos[i] }
      if (cual === "p") {
        const dx = q[0] - n.p[0], dy = q[1] - n.p[1]
        n.p = q
        if (n.a) n.a = [n.a[0] + dx, n.a[1] + dy]
        if (n.b) n.b = [n.b[0] + dx, n.b[1] + dy]
      } else {
        const otra = cual === "a" ? "b" : "a"
        n[cual] = q
        // nodo suave: la otra manija sigue la dirección (Alt la suelta)
        const o = n[otra]
        if (o && !e.altKey) {
          const L = Math.hypot(o[0] - n.p[0], o[1] - n.p[1])
          const v: P = [n.p[0] - q[0], n.p[1] - q[1]]
          const lv = Math.hypot(v[0], v[1]) || 1
          n[otra] = [n.p[0] + (v[0] / lv) * L, n.p[1] + (v[1] / lv) * L]
        }
      }
      nodos[i] = n
      reemplazar([{ ...f0, nodos }])
    }
  }

  const alSubir = (e: React.PointerEvent<SVGSVGElement>) => {
    const ar = arrastre.current
    arrastre.current = null
    if (!ar) return
    if (ar.tipo === "caja") {
      const c = caja
      setCaja(null)
      if (!c) return
      const x0 = Math.min(c.a[0], c.b[0]), x1 = Math.max(c.a[0], c.b[0]), y0 = Math.min(c.a[1], c.b[1]), y1 = Math.max(c.a[1], c.b[1])
      if ((x1 - x0) * vista.z < 3 && (y1 - y0) * vista.z < 3) return
      // de izquierda a derecha: completas adentro; de derecha a izquierda: las que toca
      const completa = c.b[0] >= c.a[0]
      const dentro = visibles.filter((f) => {
        const b = cajaDe([f])
        if (!b) return false
        return completa ? b.x0 >= x0 && b.x1 <= x1 && b.y0 >= y0 && b.y1 <= y1 : b.x1 >= x0 && b.x0 <= x1 && b.y1 >= y0 && b.y0 <= y1
      })
      const ids = conGrupo(dentro.map((f) => f.id))
      setSel((s) => (e.shiftKey ? [...new Set([...s, ...ids])] : ids))
      return
    }
    if (ar.tipo === "medir") return
    if (ar.tipo === "dibujo" && arrastreDibujo) {
      const f = figuraBorrador(arrastreDibujo.a, arrastreDibujo.b)
      setArrastreDibujo(null)
      if (f && Math.hypot(arrastreDibujo.b[0] - arrastreDibujo.a[0], arrastreDibujo.b[1] - arrastreDibujo.a[1]) * vista.z > 3) agregar([f])
    }
  }

  const alDobleClic = (e: React.MouseEvent<SVGSVGElement>) => {
    if (herr === "linea" || herr === "curva") {
      // los dos clics del doble clic agregaron puntos encima del último: se quitan
      const l = puntos.slice()
      while (l.length >= 2 && Math.hypot(l[l.length - 1].p[0] - l[l.length - 2].p[0], l[l.length - 1].p[1] - l[l.length - 2].p[1]) * vista.z < PX_TOCAR) l.pop()
      if (l.length >= 2) agregar([{ id: nuevoId(), nodos: l.map((n) => ({ ...n })), cerrada: false, capa: capaActiva }])
      setPuntos([])
      return
    }
    if (herr === "nodos" && sel.length === 1) {
      const f = doc.formas.find((x) => x.id === sel[0])
      if (!f) return
      const p = aMundo(e.clientX, e.clientY)
      const q = puntoMasCercano(f, p)
      if (q.d * vista.z > PX_TOCAR * 1.5) return
      cambiar((d) => ({ ...d, formas: d.formas.map((x) => (x.id === f.id ? insertarNodo(x, q.tramo, q.u) : x)) }))
      setNodoSel({ id: f.id, i: q.tramo + 1 })
      return
    }
    if (herr === "seleccionar") {
      const f = formaEn(aMundo(e.clientX, e.clientY))
      if (f) {
        setSel([f.id])
        setHerr("nodos")
      }
    }
  }

  // ---------------- acciones ----------------
  const borrarSel = () => {
    if (herr === "nodos" && nodoSel) {
      const f = doc.formas.find((x) => x.id === nodoSel.id)
      if (!f) return
      const g = borrarNodo(f, nodoSel.i)
      cambiar((d) => ({ ...d, formas: g ? d.formas.map((x) => (x.id === f.id ? g : x)) : d.formas.filter((x) => x.id !== f.id) }))
      setNodoSel(null)
      return
    }
    if (!sel.length) return
    cambiar((d) => ({ ...d, formas: d.formas.filter((f) => !sel.includes(f.id)) }))
    setSel([])
  }
  const duplicar = (dx = 10, dy = -10) => {
    if (!formasSel.length) return
    const mapa = new Map<string, string>()
    agregar(
      formasSel.map((f) => {
        const g = f.grupo ? mapa.get(f.grupo) || (mapa.set(f.grupo, nuevoId()), mapa.get(f.grupo)!) : undefined
        return { ...mover(copiaForma(f, true), dx, dy), ...(g ? { grupo: g } : {}) }
      })
    )
  }
  const agrupar = () => {
    if (formasSel.length < 2) return
    const g = nuevoId()
    transformarSel((f) => ({ ...f, grupo: g }))
  }
  const desagrupar = () => transformarSel((f) => ({ ...f, grupo: undefined }))
  const requiereCerradas = (min: number) => {
    const c = formasSel.filter((f) => f.cerrada)
    if (c.length < min) {
      setAviso(min > 1 ? "Elige al menos dos formas cerradas." : "Elige una forma cerrada.")
      return null
    }
    return c
  }
  const hacerSoldar = () => {
    const c = requiereCerradas(2)
    if (c) reemplazarSel(soldar(c), c.map((f) => f.id))
  }
  const hacerRestar = () => {
    const c = requiereCerradas(2)
    if (!c) return
    // a la más grande se le quitan las demás
    const area = (f: Forma) => {
      const b = cajaDe([f])!
      return (b.x1 - b.x0) * (b.y1 - b.y0)
    }
    const orden = c.slice().sort((a, b) => area(b) - area(a))
    reemplazarSel(restar([orden[0]], orden.slice(1)), c.map((f) => f.id))
  }
  const hacerIntersectar = () => {
    const c = requiereCerradas(2)
    if (!c) return
    const r = intersectar(c)
    if (!r.length) return setAviso("Esas formas no se tocan.")
    reemplazarSel(r, c.map((f) => f.id))
  }
  const hacerOffset = () => {
    if (!formasSel.length) return setAviso("Elige las formas para el contorno paralelo.")
    const d = deU(dOffset)
    if (!(d > 0)) return setAviso("Pon la distancia del contorno.")
    const r = offset(formasSel, ladoOffset === "afuera" ? d : -d, esquinasOffset)
    if (!r.length) return setAviso("Con esa distancia hacia adentro la forma desaparece.")
    agregar(r)
  }
  const hacerRedondear = () => {
    const r = deU(rEsquinas)
    if (!(r > 0) || !formasSel.length) return setAviso("Elige formas y pon el radio.")
    transformarSel((f) => redondearEsquinas(f, r))
  }
  const hacerGirar = (grados: number) => {
    if (!cajaSel) return
    const c = centro(cajaSel)
    transformarSel((f) => girar(f, (grados * Math.PI) / 180, c))
  }
  const hacerEspejo = (eje: "h" | "v") => {
    if (!cajaSel) return
    const c = centro(cajaSel)
    transformarSel((f) => espejo(f, eje, c))
  }
  const hacerAlinear = (modo: Alineacion) => {
    if (!formasSel.length) return
    const ref = formasSel.length > 1 && cajaSel ? cajaSel : { x0: 0, y0: 0, x1: doc.hoja.ancho, y1: doc.hoja.alto }
    const nuevas = alinear(formasSel, modo, ref)
    const m = new Map(nuevas.map((f) => [f.id, f]))
    cambiar((d) => ({ ...d, formas: d.formas.map((f) => m.get(f.id) || f) }))
  }
  const centrarEnHoja = () => {
    if (!cajaSel) return
    const [cx, cy] = centro(cajaSel)
    transformarSel((f) => mover(f, doc.hoja.ancho / 2 - cx, doc.hoja.alto / 2 - cy))
  }
  const hacerFila = () => {
    if (!formasSel.length) return
    agregar([...arregloLineal(formasSel, num(filaN) || 0, deU(filaDx) || 0, deU(filaDy) || 0)])
  }
  const hacerCircular = () => {
    if (!formasSel.length) return
    const c: P = [cirCx.trim() ? deU(cirCx) : doc.hoja.ancho / 2, cirCy.trim() ? deU(cirCy) : doc.hoja.alto / 2]
    agregar(arregloCircular(formasSel, num(cirN) || 6, c, num(cirAng) || 360))
  }
  const hacerUnirRutas = () => {
    const abiertas = formasSel.filter((f) => !f.cerrada)
    if (!abiertas.length) return setAviso("Elige rutas abiertas cuyos extremos se toquen.")
    const r = unirAbiertas(abiertas, Math.max(0.05, 2 / vista.z))
    reemplazarSel(r, abiertas.map((f) => f.id))
  }
  const cambiarCapaSel = (capa: string) => transformarSel((f) => ({ ...f, capa }))

  const accionNodo = (accion: "suave" | "esquina" | "partir") => {
    if (!nodoSel) return setAviso("Toca un nodo de la forma.")
    const f = doc.formas.find((x) => x.id === nodoSel.id)
    if (!f) return
    if (accion === "partir") {
      const partes = partirEnNodo(f, nodoSel.i)
      cambiar((d) => ({ ...d, formas: [...d.formas.filter((x) => x.id !== f.id), ...partes] }))
      setSel(partes.map((x) => x.id))
      setNodoSel(null)
      return
    }
    const g = accion === "suave" ? suavizarNodo(f, nodoSel.i) : esquinaNodo(f, nodoSel.i)
    cambiar((d) => ({ ...d, formas: d.formas.map((x) => (x.id === f.id ? g : x)) }))
  }

  // ---------------- archivo y salida ----------------
  const importar = async (archivo?: File | null) => {
    if (!archivo) return
    try {
      const txt = await archivo.text()
      const d = archivo.name.toLowerCase().endsWith(".svg") ? leerSVG(txt) : leerDXF(txt)
      if (!d.trazos.length) return setAviso(d.avisos[0] || "No encontré líneas en el archivo.")
      const formas = desdeTrazos(d.trazos, capaActiva, doc.capas.map((c) => c.id))
      const b = cajaDe(formas)!
      const g = nuevoId()
      const puestas = formas.map((f) => ({ ...mover(f, 10 - b.x0, 10 - b.y0), grupo: formas.length > 1 ? g : undefined }))
      agregar(puestas)
      if (b.x1 - b.x0 > doc.hoja.ancho || b.y1 - b.y0 > doc.hoja.alto) setAviso("El dibujo es más grande que la hoja: revisa la medida de la hoja.")
      setTimeout(() => ajustarVista(cajaDe(puestas)), 30)
    } catch {
      setAviso("No pude leer el archivo. Sube un DXF o un SVG.")
    }
  }

  const nombreArchivo = slugArchivo(doc.nombre, "diseno")
  const descargarTexto = (nombre: string, contenido: string, tipo: string) => {
    const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
    const a = document.createElement("a")
    a.href = url
    a.download = nombre
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
  const dibujoSalida = () => {
    const d = aDibujo(doc)
    if (!d.trazos.length) {
      setAviso("No hay nada que maquinar: dibuja algo en una capa que se maquine.")
      return null
    }
    return d
  }
  const mandarAlCam = async () => {
    const d = dibujoSalida()
    if (!d) return
    const abiertasEnCorte = doc.formas.some((f) => !f.cerrada && f.capa !== "guia" && ["corte", "cajeado"].includes(f.capa))
    if (abiertasEnCorte && !window.confirm(t("Hay líneas abiertas en Corte o Cajeado: esas operaciones sólo usan formas cerradas. ¿Mandar de todos modos?"))) return
    const ok = await mandarACam2D(`${nombreArchivo}.dxf`, dibujoDXF(d), locale, { espesor: doc.hoja.espesor, porCapas: true })
    if (!ok) setAviso("No se pudo pasar al CAM. Descarga el DXF y súbelo en el CAM 2D.")
  }
  const mandarAMaquilar = () => {
    const d = dibujoSalida()
    if (!d) return
    const b = cajaDe(doc.formas.filter((f) => capasPorId[f.capa]?.maquinar))
    const medidas = b ? `${Math.round(b.x1 - b.x0)} × ${Math.round(b.y1 - b.y0)} mm` : ""
    const capasUsadas = [...new Set(d.trazos.map((x) => capasPorId[x.capa]?.nombre || x.capa))].join(", ")
    const ok = mandarPaqueteACotizador(
      {
        proyecto: doc.nombre || "Diseño",
        origen: "disenador",
        servicio: "router",
        material: materialRouterMDF(doc.hoja.espesor),
        nota: `Diseñado en el CAM Studio. Medidas: ${medidas}. Espesor: ${doc.hoja.espesor} mm. Capas: ${capasUsadas}.`.slice(0, 900),
        piezas: [{ nombre: `${nombreArchivo}.dxf`, contenido: dibujoDXF(d) }],
      },
      locale
    )
    if (!ok) setAviso("El diseño es muy grande para mandarlo así. Descarga el DXF y súbelo en el cotizador.")
  }

  // ---------------- teclado ----------------
  useEffect(() => {
    const abajo = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return
      const ctrl = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (k === " ") {
        setEspacio(true)
        e.preventDefault()
        return
      }
      if (ctrl && k === "z") {
        e.preventDefault()
        if (e.shiftKey) rehacer()
        else deshacer()
        return
      }
      if (ctrl && k === "y") {
        e.preventDefault()
        rehacer()
        return
      }
      if (ctrl && k === "a") {
        e.preventDefault()
        setSel(visibles.map((f) => f.id))
        return
      }
      if (ctrl && k === "d") {
        e.preventDefault()
        duplicar()
        return
      }
      if (ctrl && k === "c") {
        portapapeles.current = formasSel.map((f) => copiaForma(f))
        return
      }
      if (ctrl && k === "v") {
        if (portapapeles.current.length) agregar(portapapeles.current.map((f) => mover(copiaForma(f, true), 10, -10)))
        return
      }
      if (ctrl && k === "g") {
        e.preventDefault()
        if (e.shiftKey) desagrupar()
        else agrupar()
        return
      }
      if (k === "delete" || k === "backspace") {
        if ((herr === "linea" || herr === "curva" || herr === "arco") && puntos.length) {
          setPuntos((l) => l.slice(0, -1))
          return
        }
        e.preventDefault()
        borrarSel()
        return
      }
      if (k === "escape") {
        if (puntos.length) setPuntos([])
        else if (herr !== "seleccionar") setHerr("seleccionar")
        else setSel([])
        setMedida(null)
        setNodoSel(null)
        return
      }
      if (k === "enter") {
        if (herr === "linea" || herr === "curva") terminarRuta(false)
        return
      }
      if (k.startsWith("arrow") && sel.length) {
        e.preventDefault()
        const d = e.shiftKey ? 10 : 1
        const dx = k === "arrowleft" ? -d : k === "arrowright" ? d : 0
        const dy = k === "arrowdown" ? -d : k === "arrowup" ? d : 0
        transformarSel((f) => mover(f, dx * u, dy * u))
        return
      }
      if (ctrl || e.altKey) return
      const h = HERRAMIENTAS.find((x) => x.tecla.toLowerCase() === k)
      if (h) {
        setHerr(h.id)
        setPuntos([])
      }
      if (k === "f") ajustarVista()
    }
    const arriba = (e: KeyboardEvent) => {
      if (e.key === " ") setEspacio(false)
    }
    window.addEventListener("keydown", abajo)
    window.addEventListener("keyup", arriba)
    return () => {
      window.removeEventListener("keydown", abajo)
      window.removeEventListener("keyup", arriba)
    }
  })

  // ---------------- dibujo de la pantalla ----------------
  const matriz = `matrix(${vista.z},0,0,${-vista.z},${vista.tx},${vista.ty})`
  const lineasCuadricula = useMemo(() => {
    if (!cuadricula) return null
    const { w, h } = tam.current
    let pasoV = pasoMm
    while (pasoV * vista.z < 8) pasoV *= 5
    const x0 = Math.floor(-vista.tx / vista.z / pasoV) * pasoV
    const x1 = (w - vista.tx) / vista.z
    const y1 = Math.ceil(vista.ty / vista.z / pasoV) * pasoV
    const y0 = -(h - vista.ty) / vista.z
    const ls: React.ReactNode[] = []
    let i = 0
    for (let x = x0; x <= x1 && i < 600; x += pasoV, i++) {
      const [px] = aPx([x, 0])
      ls.push(<line key={`x${i}`} x1={px} y1={0} x2={px} y2={h} stroke={Math.abs(x) < 1e-6 ? "#3B4A61" : "#1A2230"} strokeWidth={1} />)
    }
    for (let y = y1; y >= y0 && i < 1200; y -= pasoV, i++) {
      const [, py] = aPx([0, y])
      ls.push(<line key={`y${i}`} x1={0} y1={py} x2={w} y2={py} stroke={Math.abs(y) < 1e-6 ? "#3B4A61" : "#1A2230"} strokeWidth={1} />)
    }
    return ls
  }, [cuadricula, pasoMm, vista]) // eslint-disable-line react-hooks/exhaustive-deps

  const borrador = useMemo(() => {
    if (arrastreDibujo) return figuraBorrador(arrastreDibujo.a, arrastreDibujo.b)
    if ((herr === "linea" || herr === "curva") && puntos.length) {
      const extra = herr === "linea" || !arrastre.current ? [{ p: imantado || cursor }] : []
      return { id: "borrador", nodos: [...puntos, ...extra], cerrada: false, capa: capaActiva } as Forma
    }
    if (herr === "arco" && puntos.length === 1) return linea([puntos[0].p, imantado || cursor])
    if (herr === "arco" && puntos.length === 2) return arco3Puntos(puntos[0].p, puntos[1].p, imantado || cursor) || linea([puntos[0].p, puntos[1].p])
    return null
  }, [arrastreDibujo, puntos, cursor, imantado, herr, radio, lados, puntas, interior, capaActiva]) // eslint-disable-line react-hooks/exhaustive-deps

  const cajaPx = cajaSel && herr === "seleccionar" ? { a: aPx([cajaSel.x0, cajaSel.y1]), b: aPx([cajaSel.x1, cajaSel.y0]) } : null
  const asas: [string, number, number][] = cajaPx
    ? [
        ["nw", cajaPx.a[0], cajaPx.a[1]],
        ["n", (cajaPx.a[0] + cajaPx.b[0]) / 2, cajaPx.a[1]],
        ["ne", cajaPx.b[0], cajaPx.a[1]],
        ["e", cajaPx.b[0], (cajaPx.a[1] + cajaPx.b[1]) / 2],
        ["se", cajaPx.b[0], cajaPx.b[1]],
        ["s", (cajaPx.a[0] + cajaPx.b[0]) / 2, cajaPx.b[1]],
        ["sw", cajaPx.a[0], cajaPx.b[1]],
        ["w", cajaPx.a[0], (cajaPx.a[1] + cajaPx.b[1]) / 2],
      ]
    : []
  const cursorLienzo = espacio || herr === "mano" ? "grab" : herr === "seleccionar" ? "default" : herr === "nodos" ? "pointer" : "crosshair"
  const formaNodos = herr === "nodos" && sel.length === 1 ? doc.formas.find((f) => f.id === sel[0]) : null
  const largoSel = formasSel.reduce((s, f) => s + largo(f), 0)

  // ---------------- interfaz ----------------
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-[#0D1015] text-white lg:h-[calc(100dvh-3.5rem)] lg:flex-row">
      {/* Herramientas */}
      <nav aria-label={t("Herramientas de dibujo")} className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#1F2937] bg-[#111722] p-1.5 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r">
        {HERRAMIENTAS.map((h) => (
          <button
            key={h.id}
            type="button"
            title={`${t(h.nombre)} (${h.tecla})`}
            aria-label={t(h.nombre)}
            aria-pressed={herr === h.id}
            onClick={() => {
              setHerr(h.id)
              setPuntos([])
              setMedida(null)
            }}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] ${herr === h.id ? "bg-[#F07A1A] text-white" : "text-[#C9D2E0] hover:bg-white/10"}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={h.icono} />
            </svg>
          </button>
        ))}
      </nav>

      {/* Lienzo */}
      <section className="flex min-h-[60vh] min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[#1F2937] bg-[#0F141C] px-2 py-1.5 text-[12.5px]">
          <BotonBarra onClick={deshacer} disabled={!pasado.current.length} titulo="Deshacer (Ctrl+Z)">↶</BotonBarra>
          <BotonBarra onClick={rehacer} disabled={!futuro.current.length} titulo="Rehacer (Ctrl+Y)">↷</BotonBarra>
          <span className="mx-1 h-5 w-px bg-white/10" />
          <BotonBarra onClick={() => ajustarVista()} titulo="Ver todo (F)">⤢</BotonBarra>
          <BotonBarra onClick={() => setVista((v) => zoomCentro(v, 1.25, tam.current))} titulo="Acercar">＋</BotonBarra>
          <BotonBarra onClick={() => setVista((v) => zoomCentro(v, 0.8, tam.current))} titulo="Alejar">－</BotonBarra>
          <span className="mx-1 h-5 w-px bg-white/10" />
          <Casilla activo={cuadricula} cambiar={setCuadricula}><T>Cuadrícula</T></Casilla>
          <label className="flex items-center gap-1 text-[#8A97AB]">
            <input value={paso} onChange={(e) => setPaso(e.target.value)} inputMode="decimal" className="w-12 rounded-[6px] bg-[#1C2431] px-1.5 py-0.5 text-white outline-none" aria-label={t("Paso de la cuadrícula")} />
            {sufijo}
          </label>
          <Casilla activo={iman} cambiar={setIman}><T>Imán a cuadrícula</T></Casilla>
          <Casilla activo={imanNodos} cambiar={setImanNodos}><T>Imán a puntos</T></Casilla>
          <span className="ml-auto font-mono text-[12px] text-[#8A97AB]">
            X {enU(cursor[0])} · Y {enU(cursor[1])} {sufijo}
            {medida && (
              <b className="ml-2 text-[#F7B27A]">
                ↔ {enU(Math.hypot(medida.b[0] - medida.a[0], medida.b[1] - medida.a[1]))} {sufijo} · {red((Math.atan2(medida.b[1] - medida.a[1], medida.b[0] - medida.a[0]) * 180) / Math.PI, 1)}°
              </b>
            )}
          </span>
        </div>

        <div className="relative min-h-0 flex-1">
          <svg
            ref={svgRef}
            className="absolute inset-0 h-full w-full touch-none select-none"
            style={{ cursor: cursorLienzo }}
            onPointerDown={alBajar}
            onPointerMove={alMover}
            onPointerUp={alSubir}
            onDoubleClick={alDobleClic}
            onContextMenu={(e) => e.preventDefault()}
            role="img"
            aria-label={t("Mesa de dibujo")}
          >
            {lineasCuadricula}
            {/* hoja de material */}
            <g transform={matriz}>
              <rect x={0} y={0} width={doc.hoja.ancho} height={doc.hoja.alto} fill="#C9A26B" fillOpacity={0.08} stroke="#C9A26B" strokeOpacity={0.6} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              {visibles.map((f) => {
                const c = capasPorId[f.capa]
                const elegida = sel.includes(f.id)
                return (
                  <path
                    key={f.id}
                    d={rutaSVG(f)}
                    fill={f.cerrada ? c?.color || "#fff" : "none"}
                    fillOpacity={f.cerrada ? (elegida ? 0.18 : 0.06) : 0}
                    stroke={elegida ? "#FFFFFF" : c?.color || "#fff"}
                    strokeWidth={elegida ? 2 : 1.4}
                    strokeDasharray={c?.maquinar === false ? "4 3" : undefined}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                )
              })}
              {borrador && <path d={rutaSVG(borrador)} fill="none" stroke="#F7B27A" strokeWidth={1.5} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
            </g>

            {/* caja de selección con asas */}
            {cajaPx && (
              <g>
                <rect x={cajaPx.a[0]} y={cajaPx.a[1]} width={Math.max(1, cajaPx.b[0] - cajaPx.a[0])} height={Math.max(1, cajaPx.b[1] - cajaPx.a[1])} fill="none" stroke="#F07A1A" strokeDasharray="4 3" pointerEvents="none" />
                <line x1={(cajaPx.a[0] + cajaPx.b[0]) / 2} y1={cajaPx.a[1]} x2={(cajaPx.a[0] + cajaPx.b[0]) / 2} y2={cajaPx.a[1] - 22} stroke="#F07A1A" pointerEvents="none" />
                <circle data-asa="giro" cx={(cajaPx.a[0] + cajaPx.b[0]) / 2} cy={cajaPx.a[1] - 26} r={6} fill="#0D1015" stroke="#F07A1A" strokeWidth={2} style={{ cursor: "grab" }}>
                  <title>{t("Girar (Shift: de 15 en 15°)")}</title>
                </circle>
                {asas.map(([id, x, y]) => (
                  <rect key={id} data-asa={id} x={x - 5} y={y - 5} width={10} height={10} fill="#F07A1A" stroke="#0D1015" style={{ cursor: `${id}-resize` }} />
                ))}
              </g>
            )}

            {/* nodos y manijas */}
            {formaNodos && (
              <g>
                {formaNodos.nodos.map((n, i) => {
                  const p = aPx(n.p)
                  const activo = nodoSel?.id === formaNodos.id && nodoSel.i === i
                  return (
                    <g key={i}>
                      {(["a", "b"] as const).map((k) => {
                        const m = n[k]
                        if (!m || (!activo && formaNodos.nodos.length > 40)) return null
                        const q = aPx(m)
                        return (
                          <g key={k}>
                            <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#7DD3FC" strokeWidth={1} pointerEvents="none" />
                            <circle data-nodo={`${formaNodos.id}|${i}|${k}`} cx={q[0]} cy={q[1]} r={4.5} fill="#0D1015" stroke="#7DD3FC" strokeWidth={1.5} />
                          </g>
                        )
                      })}
                      <rect data-nodo={`${formaNodos.id}|${i}|p`} x={p[0] - 5} y={p[1] - 5} width={10} height={10} fill={activo ? "#F07A1A" : "#FFFFFF"} stroke="#0D1015" strokeWidth={1.5} transform={n.a || n.b ? `rotate(45 ${p[0]} ${p[1]})` : undefined} />
                    </g>
                  )
                })}
              </g>
            )}

            {/* puntos de la ruta que se dibuja */}
            {puntos.map((n, i) => {
              const p = aPx(n.p)
              return <rect key={i} x={p[0] - 3.5} y={p[1] - 3.5} width={7} height={7} fill={i === 0 ? "#F07A1A" : "#F7B27A"} pointerEvents="none" />
            })}
            {caja && (() => {
              const a = aPx(caja.a), b = aPx(caja.b)
              const completa = caja.b[0] >= caja.a[0]
              return <rect x={Math.min(a[0], b[0])} y={Math.min(a[1], b[1])} width={Math.abs(b[0] - a[0])} height={Math.abs(b[1] - a[1])} fill={completa ? "#3B82F633" : "#22C55E22"} stroke={completa ? "#3B82F6" : "#22C55E"} strokeDasharray={completa ? undefined : "5 3"} pointerEvents="none" />
            })()}
            {medida && (() => {
              const a = aPx(medida.a), b = aPx(medida.b)
              return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#F7B27A" strokeWidth={1.5} pointerEvents="none" />
            })()}
            {imantado && (() => {
              const p = aPx(imantado)
              return <circle cx={p[0]} cy={p[1]} r={7} fill="none" stroke="#22C55E" strokeWidth={2} pointerEvents="none" />
            })()}
          </svg>

          {aviso && (
            <div role="status" className="absolute bottom-3 left-1/2 max-w-[90%] -translate-x-1/2 rounded-[10px] bg-[#3A1F12] px-3 py-2 text-[13px] text-[#FBD3B5] shadow-lg">
              <T>{aviso}</T>
              <button type="button" onClick={() => setAviso("")} className="ml-3 text-white/60 hover:text-white" aria-label={t("Cerrar aviso")}>
                ×
              </button>
            </div>
          )}
          <AyudaHerramienta herr={herr} puntos={puntos.length} />
        </div>
      </section>

      {/* Panel */}
      <aside className="flex w-full flex-col gap-4 border-t border-[#1F2937] bg-[#111722] p-3 lg:w-[310px] lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
        <Bloque titulo="Diseño">
          <input value={doc.nombre} onChange={(e) => cambiar((d) => ({ ...d, nombre: e.target.value.slice(0, 80) }), false)} className="campo" aria-label={t("Nombre del diseño")} />
          <div className="grid grid-cols-3 gap-1.5">
            <Num etiqueta="Ancho hoja" valor={String(enU(doc.hoja.ancho))} sufijo={sufijo} cambiar={(v) => deU(v) > 0 && cambiar((d) => ({ ...d, hoja: { ...d.hoja, ancho: deU(v) } }), false)} />
            <Num etiqueta="Alto hoja" valor={String(enU(doc.hoja.alto))} sufijo={sufijo} cambiar={(v) => deU(v) > 0 && cambiar((d) => ({ ...d, hoja: { ...d.hoja, alto: deU(v) } }), false)} />
            <Num etiqueta="Espesor" valor={String(enU(doc.hoja.espesor))} sufijo={sufijo} cambiar={(v) => deU(v) > 0 && cambiar((d) => ({ ...d, hoja: { ...d.hoja, espesor: deU(v) } }), false)} />
          </div>
          <div className="flex gap-1.5">
            {(["mm", "in"] as const).map((un) => (
              <Chip key={un} activo={doc.unidades === un} onClick={() => cambiar((d) => ({ ...d, unidades: un }), false)}>
                {un === "mm" ? t("Milímetros") : t("Pulgadas")}
              </Chip>
            ))}
          </div>
        </Bloque>

        {/* opciones de la herramienta */}
        {herr === "rect" && (
          <Bloque titulo="Rectángulo">
            <Num etiqueta="Radio de las esquinas" valor={radio} sufijo={sufijo} cambiar={setRadio} />
            <Nota>Arrastra en la hoja. Con Shift sale cuadrado.</Nota>
          </Bloque>
        )}
        {herr === "poligono" && (
          <Bloque titulo="Polígono">
            <Num etiqueta="Lados" valor={lados} sufijo="" cambiar={setLados} />
          </Bloque>
        )}
        {herr === "estrella" && (
          <Bloque titulo="Estrella">
            <div className="grid grid-cols-2 gap-1.5">
              <Num etiqueta="Puntas" valor={puntas} sufijo="" cambiar={setPuntas} />
              <Num etiqueta="Radio interior" valor={interior} sufijo="%" cambiar={setInterior} />
            </div>
          </Bloque>
        )}
        {herr === "texto" && (
          <Bloque titulo="Texto">
            <textarea value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 200))} rows={2} className="campo" aria-label={t("Texto")} />
            <div className="grid grid-cols-2 gap-1.5">
              <label className="flex flex-col gap-1 text-[12px] text-[#C9D2E0]">
                <T>Fuente</T>
                <select value={fuenteId} onChange={(e) => setFuenteId(e.target.value)} className="campo">
                  {FUENTES.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <Num etiqueta="Alto" valor={altoTexto} sufijo={sufijo} cambiar={setAltoTexto} />
            </div>
            <Nota>Toca la hoja donde va el centro del texto. Las letras quedan como contornos que se pueden editar.</Nota>
          </Bloque>
        )}
        {formaNodos && (
          <Bloque titulo="Nodos">
            <div className="grid grid-cols-2 gap-1.5">
              <BotonPanel onClick={() => accionNodo("suave")}>Nodo suave</BotonPanel>
              <BotonPanel onClick={() => accionNodo("esquina")}>Nodo esquina</BotonPanel>
              <BotonPanel onClick={() => accionNodo("partir")}>Partir aquí</BotonPanel>
              <BotonPanel onClick={borrarSel}>Borrar nodo</BotonPanel>
            </div>
            <Nota>Doble clic en la línea agrega un nodo. Las manijas mueven la curva (Alt: una sola manija).</Nota>
          </Bloque>
        )}

        {/* selección */}
        <Bloque titulo={sel.length ? `${t("Selección")} · ${sel.length}` : "Selección"}>
          {!cajaSel ? (
            <Nota>Toca una forma o arrastra un recuadro. Ctrl+A elige todo.</Nota>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                <Num etiqueta="X" valor={String(enU(cajaSel.x0))} sufijo={sufijo} cambiar={(v) => Number.isFinite(deU(v)) && reemplazarPos({ x: deU(v) })} />
                <Num etiqueta="Y" valor={String(enU(cajaSel.y0))} sufijo={sufijo} cambiar={(v) => Number.isFinite(deU(v)) && reemplazarPos({ y: deU(v) })} />
                <Num etiqueta="Ancho" valor={String(enU(cajaSel.x1 - cajaSel.x0))} sufijo={sufijo} cambiar={(v) => deU(v) > 0 && reemplazarPos({ ancho: deU(v) })} />
                <Num etiqueta="Alto" valor={String(enU(cajaSel.y1 - cajaSel.y0))} sufijo={sufijo} cambiar={(v) => deU(v) > 0 && reemplazarPos({ alto: deU(v) })} />
              </div>
              <Casilla activo={proporcional} cambiar={setProporcional}><T>Mantener proporción</T></Casilla>
              <label className="flex flex-col gap-1 text-[12px] text-[#C9D2E0]">
                <T>Capa</T>
                <select value={formasSel.every((f) => f.capa === formasSel[0].capa) ? formasSel[0].capa : ""} onChange={(e) => e.target.value && cambiarCapaSel(e.target.value)} className="campo">
                  <option value="">{t("Varias")}</option>
                  {doc.capas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end gap-1.5">
                <Num etiqueta="Girar" valor={giro} sufijo="°" cambiar={setGiro} />
                <BotonPanel onClick={() => hacerGirar(num(giro) || 0)}>Girar</BotonPanel>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <BotonPanel onClick={() => duplicar()}>Duplicar</BotonPanel>
                <BotonPanel onClick={() => hacerEspejo("h")}>Espejo ↔</BotonPanel>
                <BotonPanel onClick={() => hacerEspejo("v")}>Espejo ↕</BotonPanel>
                <BotonPanel onClick={agrupar}>Agrupar</BotonPanel>
                <BotonPanel onClick={desagrupar}>Desagrupar</BotonPanel>
                <BotonPanel onClick={borrarSel} peligro>
                  Borrar
                </BotonPanel>
              </div>
              <Nota>{`${t("Largo de corte")}: ${enU(largoSel)} ${sufijo} · ${formasSel.filter((f) => f.cerrada).length} ${t("cerradas")}, ${formasSel.filter((f) => !f.cerrada).length} ${t("abiertas")}`}</Nota>
            </>
          )}
        </Bloque>

        <Bloque titulo="Alinear">
          <div className="grid grid-cols-3 gap-1.5">
            <BotonPanel onClick={() => hacerAlinear("izq")}>Izquierda</BotonPanel>
            <BotonPanel onClick={() => hacerAlinear("centroH")}>Centro ↔</BotonPanel>
            <BotonPanel onClick={() => hacerAlinear("der")}>Derecha</BotonPanel>
            <BotonPanel onClick={() => hacerAlinear("arriba")}>Arriba</BotonPanel>
            <BotonPanel onClick={() => hacerAlinear("centroV")}>Centro ↕</BotonPanel>
            <BotonPanel onClick={() => hacerAlinear("abajo")}>Abajo</BotonPanel>
          </div>
          <BotonPanel onClick={centrarEnHoja}>Centrar en la hoja</BotonPanel>
          <Nota>Con una forma se alinea con la hoja; con varias, entre ellas.</Nota>
        </Bloque>

        <Bloque titulo="Combinar">
          <div className="grid grid-cols-3 gap-1.5">
            <BotonPanel onClick={hacerSoldar}>Soldar</BotonPanel>
            <BotonPanel onClick={hacerRestar}>Restar</BotonPanel>
            <BotonPanel onClick={hacerIntersectar}>Intersectar</BotonPanel>
          </div>
          <BotonPanel onClick={hacerUnirRutas}>Unir rutas abiertas</BotonPanel>
          <Nota>Restar: a la forma más grande se le quitan las demás.</Nota>
        </Bloque>

        <Bloque titulo="Contorno paralelo (offset)">
          <div className="grid grid-cols-2 gap-1.5">
            <Num etiqueta="Distancia" valor={dOffset} sufijo={sufijo} cambiar={setDOffset} />
            <label className="flex flex-col gap-1 text-[12px] text-[#C9D2E0]">
              <T>Esquinas</T>
              <select value={esquinasOffset} onChange={(e) => setEsquinasOffset(e.target.value as "redondas" | "rectas")} className="campo">
                <option value="redondas">{t("Redondas")}</option>
                <option value="rectas">{t("Rectas")}</option>
              </select>
            </label>
          </div>
          <div className="flex gap-1.5">
            <Chip activo={ladoOffset === "afuera"} onClick={() => setLadoOffset("afuera")}>{t("Afuera")}</Chip>
            <Chip activo={ladoOffset === "adentro"} onClick={() => setLadoOffset("adentro")}>{t("Adentro")}</Chip>
          </div>
          <BotonPanel onClick={hacerOffset}>Crear contorno</BotonPanel>
          <div className="flex items-end gap-1.5">
            <Num etiqueta="Redondear esquinas" valor={rEsquinas} sufijo={sufijo} cambiar={setREsquinas} />
            <BotonPanel onClick={hacerRedondear}>Aplicar</BotonPanel>
          </div>
        </Bloque>

        <Bloque titulo="Copias en fila">
          <div className="grid grid-cols-3 gap-1.5">
            <Num etiqueta="Copias" valor={filaN} sufijo="" cambiar={setFilaN} />
            <Num etiqueta="Cada X" valor={filaDx} sufijo={sufijo} cambiar={setFilaDx} />
            <Num etiqueta="Cada Y" valor={filaDy} sufijo={sufijo} cambiar={setFilaDy} />
          </div>
          <BotonPanel onClick={hacerFila}>Hacer copias</BotonPanel>
        </Bloque>

        <Bloque titulo="Copias en círculo">
          <div className="grid grid-cols-2 gap-1.5">
            <Num etiqueta="Piezas en total" valor={cirN} sufijo="" cambiar={setCirN} />
            <Num etiqueta="Ángulo" valor={cirAng} sufijo="°" cambiar={setCirAng} />
            <Num etiqueta="Centro X" valor={cirCx} sufijo={sufijo} cambiar={setCirCx} />
            <Num etiqueta="Centro Y" valor={cirCy} sufijo={sufijo} cambiar={setCirCy} />
          </div>
          <BotonPanel onClick={hacerCircular}>Hacer copias</BotonPanel>
          <Nota>Sin centro, giran alrededor del centro de la hoja.</Nota>
        </Bloque>

        <Bloque titulo="Capas">
          <Nota>Cada capa es una operación en el CAM: corte, cajeado, grabado en V y barrenos. Lo de la capa Guía no se maquina.</Nota>
          <ul className="flex flex-col gap-1">
            {doc.capas.map((c) => (
              <li key={c.id} className={`flex items-center gap-2 rounded-[8px] px-2 py-1.5 ${capaActiva === c.id ? "bg-white/10" : ""}`}>
                <button type="button" onClick={() => setCapaActiva(c.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-[13px]" aria-pressed={capaActiva === c.id}>
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="truncate">{c.nombre}</span>
                  <span className="ml-auto text-[11px] text-[#8A97AB]">{doc.formas.filter((f) => f.capa === c.id).length}</span>
                </button>
                <button
                  type="button"
                  title={c.visible ? t("Ocultar") : t("Mostrar")}
                  aria-label={c.visible ? t("Ocultar") : t("Mostrar")}
                  onClick={() => cambiar((d) => ({ ...d, capas: d.capas.map((x) => (x.id === c.id ? { ...x, visible: !x.visible } : x)) }), false)}
                  className={`text-[13px] ${c.visible ? "text-white" : "text-white/30"}`}
                >
                  ◉
                </button>
              </li>
            ))}
          </ul>
          <Nota>Lo que dibujas va a la capa marcada.</Nota>
        </Bloque>

        <Bloque titulo="Archivo">
          <label className="cursor-pointer rounded-[8px] bg-[#2B3648] px-3 py-2 text-center text-[13px] font-semibold hover:bg-[#344158]">
            <T>Importar DXF o SVG</T>
            <input type="file" accept=".dxf,.svg" className="hidden" onChange={(e) => {
              importar(e.target.files?.[0])
              e.target.value = ""
            }} />
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <BotonPanel onClick={() => {
              const d = dibujoSalida()
              if (d) descargarTexto(`${nombreArchivo}.dxf`, dibujoDXF(d), "application/dxf")
            }}>Descargar DXF</BotonPanel>
            <BotonPanel onClick={() => {
              const d = dibujoSalida()
              if (d) descargarTexto(`${nombreArchivo}.svg`, dibujoSVG(d), "image/svg+xml")
            }}>Descargar SVG</BotonPanel>
          </div>
          <BotonPanel
            onClick={() => {
              if (!doc.formas.length || window.confirm(t("¿Empezar un diseño nuevo? Se borra el actual de este navegador."))) {
                cambiar(() => documentoNuevo())
                setSel([])
              }
            }}
          >
            Diseño nuevo
          </BotonPanel>
        </Bloque>

        <div className="sticky -bottom-3 -mx-3 -mb-3 flex flex-col gap-1.5 border-t border-[#1F2937] bg-[#111722] p-3">
          <button type="button" onClick={mandarAlCam} className="rounded-[8px] bg-[#C2560A] px-4 py-2.5 text-[14px] font-bold hover:bg-[#A84A08]">
            <T>Mandar al CAM</T> →
          </button>
          <button type="button" onClick={mandarAMaquilar} className="rounded-[8px] bg-[#16794F] px-4 py-2.5 text-[14px] font-bold hover:bg-[#12623F]">
            <T>Mandar a maquilar</T>
          </button>
          <span className="text-center text-[11.5px] text-[#8A97AB]">
            <T>En el CAM eliges fresas y ves la trayectoria; para maquilar, los talleres te cotizan.</T>
          </span>
        </div>
      </aside>
      <style>{`.campo{width:100%;min-width:0;border-radius:8px;background:#1C2431;padding:6px 9px;font-size:13.5px;color:#fff;outline:none}.campo:focus{box-shadow:0 0 0 1px #C2560A}`}</style>
    </div>
  )

  function reemplazarPos(destino: { x?: number; y?: number; ancho?: number; alto?: number }) {
    const nuevas = ajustarCaja(formasSel, destino, proporcional)
    const m = new Map(nuevas.map((f) => [f.id, f]))
    cambiar((d) => ({ ...d, formas: d.formas.map((f) => m.get(f.id) || f) }))
  }
}

// ---------------------------------------------------------------------
// Piezas de la interfaz
// ---------------------------------------------------------------------

function zoomCentro(v: Vista, k: number, tam: { w: number; h: number }): Vista {
  const z = Math.min(200, Math.max(0.02, v.z * k))
  const f = z / v.z
  const sx = tam.w / 2, sy = tam.h / 2
  return { z, tx: sx - (sx - v.tx) * f, ty: sy - (sy - v.ty) * f }
}

function BotonBarra({ onClick, disabled, titulo, children }: { onClick: () => void; disabled?: boolean; titulo: string; children: React.ReactNode }) {
  const t = useT()
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={t(titulo)} aria-label={t(titulo)} className="h-7 min-w-7 rounded-[6px] px-1.5 text-[15px] text-[#C9D2E0] hover:bg-white/10 disabled:opacity-30">
      {children}
    </button>
  )
}

function Casilla({ activo, cambiar, children }: { activo: boolean; cambiar: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 rounded-[6px] px-1.5 py-0.5 text-[12.5px] text-[#C9D2E0] hover:bg-white/5">
      <input type="checkbox" checked={activo} onChange={(e) => cambiar(e.target.checked)} className="h-3.5 w-3.5 accent-[#F07A1A]" />
      {children}
    </label>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-[11.5px] font-bold uppercase tracking-wider text-[#8A97AB]">
        <T>{titulo}</T>
      </h2>
      {children}
    </section>
  )
}

function Nota({ children }: { children: string }) {
  return (
    <p className="m-0 text-[11.5px] leading-snug text-[#8A97AB]">
      <T>{children}</T>
    </p>
  )
}

function Num({ etiqueta, valor, cambiar, sufijo }: { etiqueta: string; valor: string; cambiar: (v: string) => void; sufijo: string }) {
  // se escribe libre y se aplica al salir del campo o con Enter
  const [local, setLocal] = useState(valor)
  const [editando, setEditando] = useState(false)
  useEffect(() => {
    if (!editando) setLocal(valor)
  }, [valor, editando])
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[12px] text-[#C9D2E0]">
      <T>{etiqueta}</T>
      <span className="flex items-center rounded-[8px] bg-[#1C2431] focus-within:ring-1 focus-within:ring-[#C2560A]">
        <input
          type="text"
          inputMode="decimal"
          value={local}
          onFocus={() => setEditando(true)}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => {
            setEditando(false)
            if (local !== valor) cambiar(local)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
          }}
          className="w-full min-w-0 bg-transparent px-2 py-1.5 text-[13.5px] text-white outline-none"
        />
        {sufijo && <span className="pr-2 text-[11.5px] text-[#8A97AB]">{sufijo}</span>}
      </span>
    </label>
  )
}

function BotonPanel({ onClick, children, peligro }: { onClick: () => void; children: string; peligro?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-[8px] px-2 py-1.5 text-[12.5px] font-semibold ${peligro ? "bg-[#4A1D1D] text-[#FCA5A5] hover:bg-[#5C2424]" : "bg-[#2B3648] hover:bg-[#344158]"}`}>
      <T>{children}</T>
    </button>
  )
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activo} className={`flex-1 rounded-[8px] px-2 py-1.5 text-[12.5px] font-semibold ${activo ? "bg-[#F07A1A] text-white" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#252F3F]"}`}>
      {children}
    </button>
  )
}

const AYUDA: Partial<Record<Herramienta, string>> = {
  seleccionar: "Toca para elegir (Shift suma). Arrastra para mover; las asas cambian la medida y el círculo gira. Doble clic edita los nodos.",
  nodos: "Arrastra los nodos y manijas. Doble clic en la línea agrega un nodo; Supr lo borra.",
  mano: "Arrastra para mover la vista. También: barra espaciadora o botón de en medio. La rueda acerca y aleja.",
  linea: "Clic para cada punto. Enter o doble clic termina; clic en el primer punto la cierra. Retroceso quita el último.",
  curva: "Clic para un punto recto o clic y arrastra para una curva. Enter termina; clic en el primer punto la cierra.",
  rect: "Arrastra de esquina a esquina. Shift: cuadrado.",
  circulo: "Arrastra desde el centro.",
  elipse: "Arrastra de esquina a esquina. Shift: círculo.",
  poligono: "Arrastra desde el centro; el ángulo del arrastre gira la figura.",
  estrella: "Arrastra desde el centro; el ángulo del arrastre gira la figura.",
  arco: "Clic en el inicio, clic en el fin y clic en un punto por donde pasa.",
  texto: "Toca la hoja donde va el centro del texto.",
  medir: "Arrastra para medir distancia y ángulo.",
}

function AyudaHerramienta({ herr, puntos }: { herr: Herramienta; puntos: number }) {
  const texto = AYUDA[herr]
  if (!texto) return null
  return (
    <div className="pointer-events-none absolute left-3 top-3 max-w-[360px] rounded-[8px] bg-black/55 px-2.5 py-1.5 text-[12px] leading-snug text-white/80">
      <T>{texto}</T>
      {puntos > 0 && herr !== "arco" && <span className="text-[#F7B27A]"> · {puntos} pts</span>}
    </div>
  )
}
