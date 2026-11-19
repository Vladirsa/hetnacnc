// Revisión automática del archivo antes de cotizar (lo que OSH Cut, RapidDirect
// o Protolabs llaman "DFM"): busca en el dibujo los problemas que más reclamos
// causan con los talleres y le dice al cliente cómo arreglarlos.
//
// Dos partes:
//   analizar2d() — hechos del dibujo, sin saber el proceso (corre en archivo-cad
//                  sobre los trazos completos en mm, antes de simplificarlos)
//   puntosRevision() — los convierte en una lista ✓/⚠ según el proceso
//
// Nunca bloquea el precio ni inventa reglas: lo que depende de la máquina se
// redacta como "puede no salir; confírmalo con el taller".

export type Pt = [number, number]

export type DatosRevision = {
  /** Contornos que casi cierran (hueco pequeño entre el inicio y el fin) */
  casi_cerrados: number
  /** El hueco más grande de esos contornos, en mm */
  hueco_max_mm: number
  /** Líneas sueltas (abiertas a propósito, p. ej. grabado, o mal dibujadas) */
  lineas_sueltas: number
  /** Tramos dibujados dos veces (se cortarían dos veces) y su largo en mm */
  duplicados: number
  duplicado_mm: number
  /** Diámetro del agujero redondo más chico, en mm (0 si no hay) */
  agujero_min_mm: number
  /** Agujeros redondos de menos de 2 mm */
  agujeros_chicos: number
  /** Contornos o líneas diminutos (menos de 0.5 mm): basura del dibujo */
  diminutos: number
  /** Entidades del archivo que no se cortan ni cuentan en el precio */
  textos: number
  rellenos: number
  cotas: number
  otros_omitidos: number
}

export type Omitidos = { textos: number; rellenos: number; cotas: number; otros: number }
export const sinOmitidos = (): Omitidos => ({ textos: 0, rellenos: 0, cotas: 0, otros: 0 })

/** Clasifica una entidad DXF que el lector no convierte en trazo. */
export function contarOmitido(o: Omitidos, tipo: string) {
  if (tipo === "TEXT" || tipo === "MTEXT" || tipo === "ATTRIB" || tipo === "ATTDEF") o.textos++
  else if (tipo === "HATCH" || tipo === "SOLID") o.rellenos++
  else if (tipo === "DIMENSION" || tipo === "LEADER" || tipo === "MLEADER" || tipo === "TOLERANCE") o.cotas++
  else if (["3DFACE", "3DSOLID", "BODY", "REGION", "MESH", "IMAGE", "WIPEOUT", "OLE2FRAME", "SURFACE"].includes(tipo)) o.otros++
}

const d = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1])
const largo = (t: Pt[]) => t.reduce((s, p, i) => (i ? s + d(t[i - 1], p) : 0), 0)
const TOL_CIERRE = 0.05 // mm
const cierra = (t: Pt[]) => t.length > 2 && d(t[0], t[t.length - 1]) <= TOL_CIERRE

function diametroSiCirculo(t: Pt[]): number {
  if (!cierra(t) || t.length < 8) return 0
  const pts = t.slice(0, -1)
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
  const radios = pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy))
  const r = radios.reduce((s, x) => s + x, 0) / radios.length
  return r > 0 && radios.every((x) => Math.abs(x - r) / r < 0.04) ? 2 * r : 0
}

function tamano(t: Pt[]) {
  let a = Infinity, b = Infinity, c = -Infinity, e = -Infinity
  for (const [x, y] of t) {
    if (x < a) a = x
    if (y < b) b = y
    if (x > c) c = x
    if (y > e) e = y
  }
  return Math.max(c - a, e - b)
}

/** Une los tramos abiertos por cualquiera de sus extremos (en mm). */
function unirAbiertos(abiertos: Pt[][]): Pt[][] {
  const tol = TOL_CIERRE
  const llave = (p: Pt) => `${Math.round(p[0] / tol)}|${Math.round(p[1] / tol)}`
  const vecinos = (p: Pt) => {
    const [i, j] = [Math.round(p[0] / tol), Math.round(p[1] / tol)]
    const out: string[] = []
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) out.push(`${i + a}|${j + b}`)
    return out
  }
  const porPunto = new Map<string, number[]>()
  abiertos.forEach((t, i) => {
    for (const p of [t[0], t[t.length - 1]]) porPunto.set(llave(p), [...(porPunto.get(llave(p)) || []), i])
  })
  const usado = new Set<number>()
  const buscar = (p: Pt) => {
    for (const k of vecinos(p))
      for (const j of porPunto.get(k) || []) {
        if (usado.has(j)) continue
        const s = abiertos[j]
        if (d(s[0], p) <= tol) return { j, s }
        if (d(s[s.length - 1], p) <= tol) return { j, s: s.slice().reverse() }
      }
    return null
  }
  const res: Pt[][] = []
  for (let i = 0; i < abiertos.length; i++) {
    if (usado.has(i)) continue
    usado.add(i)
    let t = abiertos[i].slice()
    for (let vueltas = 0; vueltas < 100000; vueltas++) {
      const atras = buscar(t[t.length - 1])
      if (atras) {
        usado.add(atras.j)
        t = t.concat(atras.s.slice(1))
        continue
      }
      const adelante = buscar(t[0])
      if (adelante) {
        usado.add(adelante.j)
        t = adelante.s.slice().reverse().concat(t.slice(1))
        continue
      }
      break
    }
    res.push(t)
  }
  return res
}

/** Hechos del dibujo 2D. `trazos` en mm, completos (sin simplificar). */
export function analizar2d(trazos: Pt[][], omitidos: Omitidos = sinOmitidos()): DatosRevision {
  const r: DatosRevision = {
    casi_cerrados: 0, hueco_max_mm: 0, lineas_sueltas: 0, duplicados: 0, duplicado_mm: 0,
    agujero_min_mm: 0, agujeros_chicos: 0, diminutos: 0,
    textos: omitidos.textos, rellenos: omitidos.rellenos, cotas: omitidos.cotas, otros_omitidos: omitidos.otros,
  }
  const validos = trazos.filter((t) => t.length >= 2 && largo(t) > 0)
  if (!validos.length) return r

  // Tamaño de la pieza para medir qué es un hueco "pequeño"
  let diag = 0
  {
    let a = Infinity, b = Infinity, c = -Infinity, e = -Infinity
    for (const t of validos) for (const [x, y] of t) {
      if (x < a) a = x
      if (y < b) b = y
      if (x > c) c = x
      if (y > e) e = y
    }
    diag = Math.hypot(c - a, e - b)
  }

  // Tramos dibujados dos veces: mismo segmento (en cualquier sentido)
  const vistos = new Set<string>()
  const q = (n: number) => Math.round(n * 100) // centésimas de mm
  for (const t of validos)
    for (let i = 1; i < t.length; i++) {
      const a = t[i - 1], b = t[i]
      const L = d(a, b)
      if (L < 0.01) continue
      const ka = `${q(a[0])},${q(a[1])}`, kb = `${q(b[0])},${q(b[1])}`
      const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
      if (vistos.has(k)) {
        r.duplicados++
        r.duplicado_mm += L
      } else vistos.add(k)
    }

  const cerrados: Pt[][] = []
  const abiertos: Pt[][] = []
  for (const t of validos) (cierra(t) ? cerrados : abiertos).push(t)

  // Agujeros redondos y basura
  for (const t of cerrados) {
    if (tamano(t) < 0.5) {
      r.diminutos++
      continue
    }
    const dia = diametroSiCirculo(t)
    if (dia > 0) {
      if (!r.agujero_min_mm || dia < r.agujero_min_mm) r.agujero_min_mm = dia
      if (dia < 2) r.agujeros_chicos++
    }
  }

  // Abiertos: primero se unen por sus extremos; lo que sigue abierto es casi
  // cerrado (hueco chico frente a su tamaño) o línea suelta.
  for (const t of unirAbiertos(abiertos)) {
    const L = largo(t)
    if (L < 0.5) {
      r.diminutos++
      continue
    }
    if (cierra(t)) continue
    const hueco = d(t[0], t[t.length - 1])
    const tam = tamano(t)
    if (hueco <= Math.max(2, Math.min(0.05 * tam, 0.02 * diag))) {
      r.casi_cerrados++
      r.hueco_max_mm = Math.max(r.hueco_max_mm, hueco)
    } else r.lineas_sueltas++
  }
  return r
}

export type Proceso = "laser" | "router" | "plasma" | "3d" | "otro"
export type PuntoRevision = { nivel: "ok" | "revisar" | "problema"; titulo: string; detalle?: string }

const mm = (n: number) => `${n.toLocaleString("es-MX", { maximumFractionDigits: n < 10 ? 1 : 0 })} mm`

/** Detecta el proceso a partir del nombre del servicio (láser, router, plasma, 3D). */
export function procesoDe(texto?: string | null): Proceso {
  const t = String(texto || "").toLowerCase()
  if (/l[aá]ser/.test(t)) return "laser"
  if (/router|fresad|madera|mdf/.test(t)) return "router"
  if (/plasma/.test(t)) return "plasma"
  if (/3d|impresi/.test(t)) return "3d"
  return "otro"
}

type GeoParaRevisar = {
  tipo: "2d" | "3d"
  largo: number
  ancho: number
  alto: number
  volumen_cm3: number
  revision?: DatosRevision
}

/** Lista ✓/⚠ para mostrar al cliente (y mandar al taller). */
export function puntosRevision(geo: GeoParaRevisar, ctx: { proceso?: Proceso; espesor_mm?: number } = {}): PuntoRevision[] {
  const out: PuntoRevision[] = []
  const proceso = ctx.proceso || "otro"
  const mayor = Math.max(geo.largo, geo.ancho, geo.alto || 0)
  const menor2d = Math.min(geo.largo, geo.ancho)

  // Unidades sospechosas (las dos medidas absurdas)
  if (mayor > 0 && mayor < 5)
    out.push({ nivel: "problema", titulo: `Tu pieza mide sólo ${mm(mayor)}`, detalle: "Puede que el archivo esté en pulgadas o centímetros. Revisa las medidas antes de pedir precio." })
  else if (mayor > 6000)
    out.push({ nivel: "problema", titulo: `Tu pieza mide ${mm(mayor)}`, detalle: "Es enorme; puede que el archivo esté en otra unidad. Revisa las medidas antes de pedir precio." })

  if (geo.tipo === "3d") {
    if (!(geo.volumen_cm3 > 0))
      out.push({ nivel: "revisar", titulo: "La malla 3D no está cerrada", detalle: "Tiene huecos en la superficie. Repárala (por ejemplo con la función de reparar de tu programa o del laminador) para que el precio y la impresión salgan bien." })
    else out.push({ nivel: "ok", titulo: "Malla 3D cerrada" })
    if (mayor > 300)
      out.push({ nivel: "revisar", titulo: `La pieza mide ${mm(mayor)} de largo`, detalle: "Muchas impresoras 3D de taller no llegan a ese tamaño: se puede imprimir en partes. Confírmalo con el taller." })
    return out
  }

  const r = geo.revision
  if (!r) return out

  if (r.casi_cerrados)
    out.push({
      nivel: "problema",
      titulo: `${r.casi_cerrados} ${r.casi_cerrados === 1 ? "contorno no cierra" : "contornos no cierran"} (hueco de hasta ${mm(r.hueco_max_mm)})`,
      detalle: "La máquina no puede cortar una pieza que no está cerrada. Une los extremos en tu programa (unir / juntar nodos) y vuelve a subir el archivo.",
    })
  else out.push({ nivel: "ok", titulo: "Todos los contornos cierran" })

  if (r.duplicados)
    out.push({
      nivel: "problema",
      titulo: `Hay líneas dibujadas dos veces (${(r.duplicado_mm / 1000).toLocaleString("es-MX", { maximumFractionDigits: 2 })} m)`,
      detalle: "Se cortarían dos veces: quema la orilla y sube el precio. Borra los duplicados (en muchos programas: \"Overkill\" o \"eliminar duplicados\").",
    })
  else out.push({ nivel: "ok", titulo: "Sin líneas duplicadas" })

  if (r.textos)
    out.push({ nivel: "problema", titulo: `${r.textos} ${r.textos === 1 ? "texto sin convertir" : "textos sin convertir"} a curvas`, detalle: "Los textos no se cortan ni cuentan en el precio. Conviértelos a contornos (explotar / convertir a curvas) y vuelve a subir el archivo." })
  if (r.rellenos)
    out.push({ nivel: "revisar", titulo: `${r.rellenos} ${r.rellenos === 1 ? "relleno" : "rellenos"} (sombreado)`, detalle: "No se cortan. Si es para grabar, dile al taller qué área va grabada." })
  if (r.cotas)
    out.push({ nivel: "revisar", titulo: `${r.cotas} ${r.cotas === 1 ? "cota o anotación" : "cotas o anotaciones"} en el dibujo`, detalle: "Bórralas del archivo de corte para que el taller no las confunda con piezas." })
  if (r.otros_omitidos)
    out.push({ nivel: "revisar", titulo: `${r.otros_omitidos} ${r.otros_omitidos === 1 ? "elemento que no pudimos leer" : "elementos que no pudimos leer"}`, detalle: "Imágenes, sólidos o superficies no se cortan. Deja sólo las líneas de corte." })

  if (r.agujero_min_mm) {
    const e = ctx.espesor_mm || 0
    const chico = r.agujero_min_mm < 2 || (e > 0 && r.agujero_min_mm < e)
    const porProceso =
      proceso === "plasma"
        ? "En plasma, un agujero más chico que el grueso de la lámina normalmente no sale limpio."
        : proceso === "router"
          ? "En router necesitas una fresa más delgada que el agujero."
          : proceso === "laser"
            ? "En láser, un agujero más chico que el grueso del material puede no salir limpio."
            : ""
    out.push(
      chico
        ? { nivel: "revisar", titulo: `Agujero más chico: ${mm(r.agujero_min_mm)}${r.agujeros_chicos > 1 ? ` (${r.agujeros_chicos} de menos de 2 mm)` : ""}`, detalle: `${porProceso} Confírmalo con el taller.`.trim() }
        : { nivel: "ok", titulo: `Agujero más chico: ${mm(r.agujero_min_mm)}` }
    )
  }

  if (r.diminutos)
    out.push({ nivel: "revisar", titulo: `${r.diminutos} ${r.diminutos === 1 ? "trazo diminuto" : "trazos diminutos"} (menos de 0.5 mm)`, detalle: "Suelen ser puntos o restos del dibujo. Bórralos para que la máquina no haga perforaciones de más." })
  if (r.lineas_sueltas)
    out.push({ nivel: "revisar", titulo: `${r.lineas_sueltas} ${r.lineas_sueltas === 1 ? "línea abierta" : "líneas abiertas"}`, detalle: "Si son para grabar o marcar, está bien: díselo al taller. Si son parte del corte, ciérralas." })

  // Hoja estándar de 1.22 × 2.44 m (4 × 8 pies), la más común en MDF, triplay y lámina
  if (geo.largo > 0 && (Math.max(geo.largo, geo.ancho) > 2440 || menor2d > 1220))
    out.push({ nivel: "revisar", titulo: "Más grande que una hoja de 1.22 × 2.44 m", detalle: "Es la medida más común de MDF, triplay y lámina. Se puede hacer en partes o con un taller de mesa grande; confírmalo con el taller." })

  return out
}

/** Resumen de una línea para mandarle al taller junto con el archivo. */
export function resumenRevision(puntos: PuntoRevision[]): string {
  const malos = puntos.filter((p) => p.nivel !== "ok")
  if (!malos.length) return "archivo revisado sin problemas"
  return malos.map((p) => `${p.nivel === "problema" ? "⚠" : "•"} ${p.titulo}`).join("; ")
}
