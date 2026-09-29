// Copiloto IA CNC: lectura de archivos en el navegador (G-code, DXF, STL).
// El archivo NUNCA se sube completo: aqui se mide y se revisa, y a la IA solo
// le llega el resumen y unas lineas de muestra.

export type Analisis = {
  tipo: "gcode" | "dxf" | "stl"
  nombre: string
  titulo: string
  filas: { etiqueta: string; valor: string }[]
  avisos: string[]
  texto: string // lo que se manda a la IA
  datos: Record<string, number | string>
}

const f = (x: number, d = 1) =>
  Number.isFinite(x) ? (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString("es-MX", { maximumFractionDigits: d }) : "—"
const tiempo = (m: number) => {
  if (!Number.isFinite(m) || m <= 0) return "0 min"
  if (m < 1) return `${Math.round(m * 60)} s`
  if (m < 60) return `${f(m, m < 10 ? 1 : 0)} min`
  const h = Math.floor(m / 60)
  return `${h} h ${Math.round(m - h * 60)} min`
}
const kb = (n: number) => (n > 1048576 ? `${f(n / 1048576, 1)} MB` : `${f(n / 1024, 0)} KB`)

type Caja = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
const cajaNueva = (): Caja => ({ x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity })
const enCaja = (c: Caja, x: number, y: number, z = 0) => {
  if (x < c.x0) c.x0 = x
  if (x > c.x1) c.x1 = x
  if (y < c.y0) c.y0 = y
  if (y > c.y1) c.y1 = y
  if (z < c.z0) c.z0 = z
  if (z > c.z1) c.z1 = z
}
const cajaOk = (c: Caja) => Number.isFinite(c.x0)

// ======================================================================
// G-CODE
// ======================================================================
const SOFTWARE: [RegExp, string][] = [
  [/vcarve|aspire|vectric|cut2d/i, "Vectric (VCarve / Aspire / Cut2D)"],
  [/fusion|autodesk|hsm/i, "Autodesk Fusion"],
  [/artcam/i, "ArtCAM"],
  [/mastercam/i, "Mastercam"],
  [/solidcam/i, "SolidCAM"],
  [/lightburn/i, "LightBurn"],
  [/sheetcam/i, "SheetCAM"],
  [/carbide ?create|carbide ?motion/i, "Carbide Create"],
  [/estlcam/i, "Estlcam"],
  [/easel/i, "Easel"],
  [/freecad/i, "FreeCAD"],
  [/kiri/i, "Kiri:Moto"],
  [/prusaslicer|slic3r/i, "PrusaSlicer"],
  [/orcaslicer|bambu/i, "OrcaSlicer / Bambu Studio"],
  [/cura/i, "Ultimaker Cura"],
  [/inkscape/i, "Inkscape (extensión G-code)"],
]
const G_CONOCIDOS = new Set([0, 1, 2, 3, 4, 10, 17, 18, 19, 20, 21, 28, 30, 40, 41, 42, 43, 49, 53, 54, 55, 56, 57, 58, 59, 61, 64, 80, 81, 82, 83, 90, 91, 92, 93, 94, 98, 99])
const M_CONOCIDOS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 30, 82, 83, 84, 104, 105, 106, 107, 109, 140, 190, 117, 201, 203, 204, 220, 221, 107])

export const analizarGcode = (nombre: string, textoArchivo: string, rapidoMmMin = 5000): Analisis => {
  const lineas = textoArchivo.split(/\r?\n/)
  const comentariosIni: string[] = []
  let abs = true
  let arcAbs = false
  let escala = 1 // G20 -> 25.4
  let unidades = ""
  let mov = -1
  let F = 0
  let S = 0
  let spindle = false
  let x = 0, y = 0, z = 0
  let eAbs = true
  let filamento = 0
  let eAnt = 0
  const caja = cajaNueva()
  const cajaTodo = cajaNueva()
  let largoCorte = 0, largoRapido = 0, tCorte = 0
  let rapidosEnMaterial = 0
  let lineaRapidoMaterial = 0
  let cortesSinF = 0
  let cortesSinSpindle = 0
  let fMin = Infinity, fMax = 0
  let sMax = 0
  let cambiosHerramienta = 0
  let hayFin = false
  let usaE = false
  let esLaserGrbl = false
  let zMovs = 0
  const herramientas = new Map<string, { n: number; largo: number; fMin: number; fMax: number; zMin: number }>()
  let hAct = "T?"
  const codigosEspeciales = new Set<string>()
  const desconocidos = new Set<string>()
  const problemas: string[] = []
  let validas = 0

  const regPal = /([A-Z])\s*([-+]?\d*\.?\d+)/gi
  for (let i = 0; i < lineas.length; i++) {
    const cruda = lineas[i]
    if (i < 60) {
      const com = cruda.match(/\(([^)]*)\)|;(.*)$/)
      if (com) comentariosIni.push((com[1] || com[2] || "").trim())
    }
    const l = cruda.replace(/\([^)]*\)/g, "").replace(/;.*$/, "").trim().toUpperCase()
    if (!l || l === "%") continue
    validas++
    const pal: Record<string, number> = {}
    const gs: number[] = []
    const ms: number[] = []
    let m: RegExpExecArray | null
    regPal.lastIndex = 0
    while ((m = regPal.exec(l))) {
      const letra = m[1].toUpperCase()
      const v = parseFloat(m[2])
      if (letra === "G") gs.push(v)
      else if (letra === "M") ms.push(v)
      else pal[letra] = v
    }
    for (const g of gs) {
      const gi = Math.round(g * 10) / 10
      if (gi === 0 || gi === 1 || gi === 2 || gi === 3) mov = gi
      else if (gi === 90) abs = true
      else if (gi === 91) abs = false
      else if (gi === 90.1) arcAbs = true
      else if (gi === 91.1) arcAbs = false
      else if (gi === 20) { escala = 25.4; unidades = "pulgadas (G20)" }
      else if (gi === 21) { escala = 1; unidades = "milímetros (G21)" }
      if ([41, 42, 43, 28, 30, 53, 92, 93, 81, 82, 83, 54, 55, 56, 57, 58, 59, 64, 61].includes(Math.floor(gi))) codigosEspeciales.add(`G${gi}`)
      if (!G_CONOCIDOS.has(Math.floor(gi))) desconocidos.add(`G${gi}`)
    }
    for (const mm of ms) {
      if (mm === 3 || mm === 4) { spindle = true; if (mm === 4) esLaserGrbl = true }
      if (mm === 5) spindle = false
      if (mm === 6) { cambiosHerramienta++; codigosEspeciales.add("M6") }
      if (mm === 7 || mm === 8) codigosEspeciales.add(`M${mm}`)
      if (mm === 2 || mm === 30) hayFin = true
      if (mm === 82) eAbs = true
      if (mm === 83) eAbs = false
      if (!M_CONOCIDOS.has(mm)) desconocidos.add(`M${mm}`)
    }
    if (pal.T !== undefined) hAct = `T${pal.T}`
    if (pal.F !== undefined) F = pal.F * escala
    if (pal.S !== undefined) { S = pal.S; if (S > sMax) sMax = S }
    if (pal.E !== undefined) {
      usaE = true
      if (eAbs) { if (pal.E > eAnt) filamento += pal.E - eAnt; eAnt = pal.E } else if (pal.E > 0) filamento += pal.E
      if (gs.includes(92)) eAnt = pal.E
    }
    const tieneEje = pal.X !== undefined || pal.Y !== undefined || pal.Z !== undefined
    if (!tieneEje || mov < 0 || gs.includes(92) || gs.includes(28) || gs.includes(53)) continue
    const nx = pal.X === undefined ? x : abs ? pal.X * escala : x + pal.X * escala
    const ny = pal.Y === undefined ? y : abs ? pal.Y * escala : y + pal.Y * escala
    const nz = pal.Z === undefined ? z : abs ? pal.Z * escala : z + pal.Z * escala
    if (pal.Z !== undefined && nz !== z) zMovs++
    let largo = 0
    if (mov === 2 || mov === 3) {
      let cx: number, cy: number, rad: number
      if (pal.R !== undefined) {
        rad = Math.abs(pal.R * escala)
        const dx = nx - x, dy = ny - y
        const d = Math.hypot(dx, dy)
        const h = Math.sqrt(Math.max(0, rad * rad - (d * d) / 4))
        const s = (mov === 2 ? -1 : 1) * (pal.R < 0 ? -1 : 1)
        cx = (x + nx) / 2 - (s * h * dy) / (d || 1)
        cy = (y + ny) / 2 + (s * h * dx) / (d || 1)
      } else {
        const I = (pal.I || 0) * escala, J = (pal.J || 0) * escala
        cx = arcAbs ? I : x + I
        cy = arcAbs ? J : y + J
        rad = Math.hypot(x - cx, y - cy)
      }
      const a0 = Math.atan2(y - cy, x - cx)
      const a1 = Math.atan2(ny - cy, nx - cx)
      let barrido = mov === 3 ? a1 - a0 : a0 - a1
      while (barrido <= 1e-9) barrido += Math.PI * 2
      const planar = rad * barrido
      largo = Math.hypot(planar, nz - z)
      // caja aproximada del arco con 16 puntos
      for (let k = 0; k <= 16; k++) {
        const a = mov === 3 ? a0 + (barrido * k) / 16 : a0 - (barrido * k) / 16
        enCaja(caja, cx + rad * Math.cos(a), cy + rad * Math.sin(a), z + ((nz - z) * k) / 16)
      }
    } else {
      largo = Math.hypot(nx - x, ny - y, nz - z)
    }
    enCaja(cajaTodo, nx, ny, nz)
    if (mov === 0) {
      largoRapido += largo
      if ((nx !== x || ny !== y) && Math.min(z, nz) < -0.01) {
        rapidosEnMaterial++
        if (!lineaRapidoMaterial) lineaRapidoMaterial = i + 1
      }
    } else {
      largoCorte += largo
      enCaja(caja, x, y, z)
      enCaja(caja, nx, ny, nz)
      if (F > 0) {
        tCorte += largo / F
        if (F < fMin) fMin = F
        if (F > fMax) fMax = F
      } else cortesSinF++
      if (!spindle && !usaE) cortesSinSpindle++
      const h = herramientas.get(hAct) || { n: 0, largo: 0, fMin: Infinity, fMax: 0, zMin: Infinity }
      h.n++
      h.largo += largo
      if (F > 0) { h.fMin = Math.min(h.fMin, F); h.fMax = Math.max(h.fMax, F) }
      h.zMin = Math.min(h.zMin, nz, z)
      herramientas.set(hAct, h)
    }
    x = nx; y = ny; z = nz
  }

  const cabecera = comentariosIni.join(" ")
  const soft = SOFTWARE.find(([re]) => re.test(cabecera))
  const tipoMaq = usaE ? "Impresora 3D" : esLaserGrbl || (zMovs === 0 && sMax > 0 && sMax <= 1000) ? "Láser (modo GRBL)" : "Router / fresadora / plasma"
  const tRapido = largoRapido / Math.max(500, rapidoMmMin)
  const tTotal = (tCorte + tRapido) * 1.1

  const avisos: string[] = []
  if (!unidades) avisos.push("El programa no dice si está en mm (G21) o pulgadas (G20): la máquina usará lo último que tenía. Agrega G21 al inicio.")
  if (escala === 25.4) avisos.push("Está en pulgadas (G20). Revisa que tu máquina y tu CAM trabajen en las mismas unidades.")
  if (rapidosEnMaterial) avisos.push(`Hay ${rapidosEnMaterial} movimientos rápidos (G0) en X/Y con Z por debajo de 0 (primera vez en la línea ${lineaRapidoMaterial}): riesgo de chocar con el material o romper la fresa. Revisa la altura segura.`)
  if (cortesSinF) avisos.push(`${cortesSinF} movimientos de corte sin avance (F) definido: algunos controladores marcan error y otros usan un avance anterior.`)
  if (cortesSinSpindle && !tipoMaq.startsWith("Láser")) avisos.push(`${cortesSinSpindle} movimientos de corte con el spindle apagado (no hay M3 antes). Si tu spindle no lo controla la máquina, enciéndelo a mano antes de arrancar.`)
  if (!hayFin) avisos.push("No termina con M30 o M2: el programa puede quedar a medias o no regresar al inicio.")
  if (codigosEspeciales.has("M6")) avisos.push(`Tiene ${cambiosHerramienta} cambio(s) de herramienta (M6). GRBL no lo soporta; en Mach3 necesitas configurar el cambio manual o partir el programa por herramienta.`)
  if (codigosEspeciales.has("G41") || codigosEspeciales.has("G42")) avisos.push("Usa compensación de radio (G41/G42). GRBL no la soporta; en Mach3 la tabla de herramientas debe tener el diámetro correcto.")
  if (codigosEspeciales.has("G43")) avisos.push("Usa compensación de largo de herramienta (G43): la tabla de herramientas de tu controlador debe tener los largos medidos.")
  if (fMax > 30000) avisos.push(`Hay avances muy altos (${f(fMax, 0)} mm/min). Revisa que la máquina los alcance.`)
  if (fMin < 30 && Number.isFinite(fMin)) avisos.push(`Hay avances muy bajos (${f(fMin, 0)} mm/min): pueden quemar el material.`)
  if (desconocidos.size) avisos.push(`Códigos poco comunes que tu controlador quizá no entienda: ${[...desconocidos].slice(0, 12).join(", ")}.`)

  const filas = [
    { etiqueta: "Programa que lo generó", valor: soft ? soft[1] : "no se identifica" },
    { etiqueta: "Máquina probable", valor: tipoMaq },
    { etiqueta: "Unidades", valor: unidades || "no indicadas" },
    { etiqueta: "Líneas", valor: f(validas, 0) },
    { etiqueta: "Tamaño del trabajo (X × Y)", valor: cajaOk(caja) ? `${f(caja.x1 - caja.x0)} × ${f(caja.y1 - caja.y0)} mm` : "—" },
    { etiqueta: "Z mínima (profundidad)", valor: cajaOk(caja) ? `${f(caja.z0, 2)} mm` : "—" },
    { etiqueta: "Recorrido de corte", valor: `${f(largoCorte / 1000, 2)} m` },
    { etiqueta: "Recorrido rápido", valor: `${f(largoRapido / 1000, 2)} m` },
    { etiqueta: "Avances usados", valor: fMax ? `${f(fMin, 0)}–${f(fMax, 0)} mm/min` : "—" },
    { etiqueta: "Tiempo estimado", valor: tiempo(tTotal) },
  ]
  if (sMax) filas.push({ etiqueta: tipoMaq.startsWith("Láser") ? "Potencia máxima (S)" : "RPM máximas (S)", valor: f(sMax, 0) })
  if (usaE) filas.push({ etiqueta: "Filamento", valor: `${f(filamento / 1000, 2)} m (≈ ${f(filamento * 2.98 * 1.24 / 1000, 0)} g de PLA 1.75)` })
  if (herramientas.size > 1 || cambiosHerramienta) filas.push({ etiqueta: "Herramientas", valor: [...herramientas.keys()].join(", ") })

  // lineas de muestra: inicio, final y la primera linea con problema
  const muestra: string[] = []
  const agregar = (a: number, b: number) => {
    for (let i = a; i < Math.min(b, lineas.length); i++) muestra.push(`${i + 1}: ${lineas[i].slice(0, 120)}`)
  }
  agregar(0, 40)
  if (lineaRapidoMaterial > 40) { muestra.push("..."); agregar(lineaRapidoMaterial - 4, lineaRapidoMaterial + 2) }
  if (lineas.length > 60) { muestra.push("..."); agregar(lineas.length - 15, lineas.length) }

  const herrTxt = [...herramientas.entries()]
    .map(([t, h]) => `${t}: ${f(h.largo / 1000, 2)} m de corte, F ${f(h.fMin, 0)}–${f(h.fMax, 0)}, Z mín ${f(h.zMin, 2)}`)
    .join("; ")
  const texto = [
    `ARCHIVO G-CODE "${nombre}" (${kb(textoArchivo.length)}). Análisis automático hecho por HETNA:`,
    ...filas.map((r) => `- ${r.etiqueta}: ${r.valor}`),
    `- Rápidos calculados a ${rapidoMmMin} mm/min; tiempo incluye 10% por aceleraciones.`,
    herrTxt ? `- Por herramienta: ${herrTxt}` : "",
    codigosEspeciales.size ? `- Códigos especiales: ${[...codigosEspeciales].join(", ")}` : "",
    avisos.length ? `AVISOS DETECTADOS:\n${avisos.map((a) => `- ${a}`).join("\n")}` : "Sin problemas detectados.",
    `ENCABEZADO/COMENTARIOS: ${cabecera.slice(0, 600)}`,
    `LÍNEAS DE MUESTRA:\n${muestra.join("\n")}`,
  ].filter(Boolean).join("\n")

  return {
    tipo: "gcode",
    nombre,
    titulo: `G-code: ${nombre}`,
    filas,
    avisos,
    texto,
    datos: { tiempo_min: Math.round(tTotal * 10) / 10, corte_m: Math.round(largoCorte) / 1000, ancho: caja.x1 - caja.x0, alto: caja.y1 - caja.y0 },
  }
}

// ======================================================================
// DXF
// ======================================================================
type Ent = { tipo: string; capa: string; c: [number, string][] }

export const analizarDxf = (nombre: string, textoArchivo: string): Analisis => {
  const ls = textoArchivo.split(/\r?\n/)
  const pares: [number, string][] = []
  for (let i = 0; i + 1 < ls.length; i += 2) pares.push([parseInt(ls[i].trim(), 10), ls[i + 1].trim()])
  let insunits = -1
  let version = ""
  for (let i = 0; i < pares.length - 1; i++) {
    if (pares[i][0] === 9 && pares[i][1] === "$INSUNITS") insunits = parseInt(pares[i + 1][1], 10)
    if (pares[i][0] === 9 && pares[i][1] === "$ACADVER") version = pares[i + 1][1]
    if (pares[i][0] === 2 && pares[i][1] === "ENTITIES") break
  }
  // entidades de la seccion ENTITIES
  const ents: Ent[] = []
  let dentro = false
  let act: Ent | null = null
  for (let i = 0; i < pares.length; i++) {
    const [c, v] = pares[i]
    if (c === 2 && v === "ENTITIES" && i > 0 && pares[i - 1][1] === "SECTION") { dentro = true; continue }
    if (!dentro) continue
    if (c === 0) {
      if (act) ents.push(act)
      if (v === "ENDSEC") { act = null; break }
      act = { tipo: v, capa: "0", c: [] }
    } else if (act) {
      if (c === 8) act.capa = v
      act.c.push([c, v])
    }
  }
  const esc = insunits === 1 ? 25.4 : insunits === 5 ? 10 : insunits === 6 ? 1000 : 1
  const unidades = insunits === 4 ? "mm" : insunits === 1 ? "pulgadas" : insunits === 5 ? "cm" : insunits === 6 ? "m" : insunits === 0 ? "sin unidades (se asume mm)" : "no indicadas (se asume mm)"
  const caja = cajaNueva()
  const conteo: Record<string, number> = {}
  const capas: Record<string, number> = {}
  let largo = 0
  let cerrados = 0
  let abiertos = 0
  const puntas = new Map<string, number>()
  const clave = (x: number, y: number) => `${Math.round(x * 100)},${Math.round(y * 100)}`
  const punta = (x: number, y: number) => { const k = clave(x, y); puntas.set(k, (puntas.get(k) || 0) + 1) }
  const segs = new Set<string>()
  let duplicados = 0

  const vals = (e: Ent, code: number) => e.c.filter((p) => p[0] === code).map((p) => parseFloat(p[1]) * esc)
  const val = (e: Ent, code: number, def = 0) => { const p = e.c.find((q) => q[0] === code); return p ? parseFloat(p[1]) : def }

  const polilinea = (pts: [number, number, number][], cerrada: boolean) => {
    let L = 0
    const n = pts.length
    for (let i = 0; i < (cerrada ? n : n - 1); i++) {
      const [x0, y0, b] = pts[i]
      const [x1, y1] = pts[(i + 1) % n]
      const d = Math.hypot(x1 - x0, y1 - y0)
      if (b) { const th = 4 * Math.atan(Math.abs(b)); const rr = d / (2 * Math.sin(th / 2) || 1); L += rr * th } else L += d
      enCaja(caja, x0, y0)
    }
    if (n) enCaja(caja, pts[n - 1][0], pts[n - 1][1])
    if (cerrada) cerrados++
    else if (n > 1) { abiertos++; punta(pts[0][0], pts[0][1]); punta(pts[n - 1][0], pts[n - 1][1]) }
    return L
  }

  for (let i = 0; i < ents.length; i++) {
    const e = ents[i]
    conteo[e.tipo] = (conteo[e.tipo] || 0) + 1
    capas[e.capa] = (capas[e.capa] || 0) + 1
    if (e.tipo === "LINE") {
      const x0 = val(e, 10) * esc, y0 = val(e, 20) * esc, x1 = val(e, 11) * esc, y1 = val(e, 21) * esc
      largo += Math.hypot(x1 - x0, y1 - y0)
      enCaja(caja, x0, y0); enCaja(caja, x1, y1)
      punta(x0, y0); punta(x1, y1); abiertos++
      const k = [clave(x0, y0), clave(x1, y1)].sort().join("|")
      if (segs.has(k)) duplicados++
      else segs.add(k)
    } else if (e.tipo === "CIRCLE") {
      const cx = val(e, 10) * esc, cy = val(e, 20) * esc, rr = val(e, 40) * esc
      largo += 2 * Math.PI * rr
      enCaja(caja, cx - rr, cy - rr); enCaja(caja, cx + rr, cy + rr)
      cerrados++
      const k = `C${clave(cx, cy)}${Math.round(rr * 100)}`
      if (segs.has(k)) duplicados++
      else segs.add(k)
    } else if (e.tipo === "ARC") {
      const cx = val(e, 10) * esc, cy = val(e, 20) * esc, rr = val(e, 40) * esc
      const a0 = (val(e, 50) * Math.PI) / 180, a1 = (val(e, 51) * Math.PI) / 180
      let sw = a1 - a0
      while (sw <= 0) sw += Math.PI * 2
      largo += rr * sw
      for (let k = 0; k <= 12; k++) { const a = a0 + (sw * k) / 12; enCaja(caja, cx + rr * Math.cos(a), cy + rr * Math.sin(a)) }
      punta(cx + rr * Math.cos(a0), cy + rr * Math.sin(a0)); punta(cx + rr * Math.cos(a1), cy + rr * Math.sin(a1)); abiertos++
    } else if (e.tipo === "LWPOLYLINE") {
      const pts: [number, number, number][] = []
      let cur: [number, number, number] | null = null
      for (const [c, v] of e.c) {
        if (c === 10) { if (cur) pts.push(cur); cur = [parseFloat(v) * esc, 0, 0] }
        else if (c === 20 && cur) cur[1] = parseFloat(v) * esc
        else if (c === 42 && cur) cur[2] = parseFloat(v)
      }
      if (cur) pts.push(cur)
      largo += polilinea(pts, (val(e, 70) & 1) === 1)
    } else if (e.tipo === "POLYLINE") {
      const cerrada = (val(e, 70) & 1) === 1
      const pts: [number, number, number][] = []
      let j = i + 1
      while (j < ents.length && ents[j].tipo === "VERTEX") { pts.push([val(ents[j], 10) * esc, val(ents[j], 20) * esc, val(ents[j], 42)]); j++ }
      largo += polilinea(pts, cerrada)
    } else if (e.tipo === "SPLINE") {
      const xs = vals(e, 11).length ? vals(e, 11) : vals(e, 10)
      const ys = vals(e, 11).length ? vals(e, 21) : vals(e, 20)
      const pts: [number, number, number][] = xs.map((x, k) => [x, ys[k] || 0, 0])
      const L = polilinea(pts, (val(e, 70) & 1) === 1)
      largo += vals(e, 11).length ? L : L * 0.9
    } else if (e.tipo === "ELLIPSE") {
      const cx = val(e, 10) * esc, cy = val(e, 20) * esc
      const mx = val(e, 11) * esc, my = val(e, 21) * esc
      const a = Math.hypot(mx, my), b = a * val(e, 40, 1)
      const p0 = val(e, 41, 0), p1 = val(e, 42, Math.PI * 2)
      const frac = Math.min(1, Math.abs(p1 - p0) / (Math.PI * 2))
      largo += Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))) * frac
      enCaja(caja, cx - a, cy - a); enCaja(caja, cx + a, cy + a)
      if (frac > 0.999) cerrados++
      else abiertos++
    }
  }
  let sueltas = 0
  puntas.forEach((n) => { if (n % 2 === 1) sueltas++ })

  const avisos: string[] = []
  if (!ents.length) avisos.push("No encontré dibujo en la sección ENTITIES. Puede estar en bloques o ser un DXF binario; vuelve a exportarlo como DXF ASCII (R12 o 2000).")
  if (insunits < 0 || insunits === 0) avisos.push("El DXF no dice en qué unidades está. Revisa en tu CAM que el tamaño salga correcto.")
  if (sueltas) avisos.push(`Hay ${sueltas} puntas sueltas: contornos que no cierran. Muchos CAM no pueden hacer corte por dentro/fuera ni cajeado en vectores abiertos. Únelos (Join) antes de programar.`)
  if (duplicados) avisos.push(`Hay ${duplicados} líneas o círculos duplicados (uno encima de otro): la máquina cortaría dos veces. Borra duplicados.`)
  if (conteo.TEXT || conteo.MTEXT) avisos.push(`Tiene ${(conteo.TEXT || 0) + (conteo.MTEXT || 0)} textos: conviértelos a curvas/contornos o el CAM no los verá igual.`)
  if (conteo.INSERT) avisos.push(`Tiene ${conteo.INSERT} bloques: explótalos (Explode) para que el CAM vea todas las líneas.`)
  if (conteo.DIMENSION || conteo.HATCH) avisos.push("Tiene cotas o rellenos (hatch): bórralos o ponlos en otra capa para no cortarlos.")
  if (conteo.SPLINE) avisos.push(`Tiene ${conteo.SPLINE} curvas spline: algunos CAM y controladores las manejan mal; conviértelas a polilínea o arcos si da problemas.`)
  if (conteo["3DFACE"] || conteo["3DSOLID"] || conteo.MESH) avisos.push("Contiene objetos 3D; para corte 2D solo se usan líneas, arcos y polilíneas.")

  const ancho = caja.x1 - caja.x0
  const alto = caja.y1 - caja.y0
  const filas = [
    { etiqueta: "Tamaño", valor: cajaOk(caja) ? `${f(ancho)} × ${f(alto)} mm` : "—" },
    { etiqueta: "Unidades", valor: unidades },
    { etiqueta: "Longitud total de corte", valor: `${f(largo / 1000, 2)} m` },
    { etiqueta: "Contornos cerrados", valor: f(cerrados, 0) },
    { etiqueta: "Líneas y arcos sueltos", valor: f(abiertos, 0) },
    { etiqueta: "Puntas sueltas", valor: f(sueltas, 0) },
    { etiqueta: "Capas", valor: Object.keys(capas).slice(0, 8).join(", ") || "—" },
  ]
  const texto = [
    `ARCHIVO DXF "${nombre}" (${kb(textoArchivo.length)}, versión ${version || "?"}). Análisis automático hecho por HETNA:`,
    ...filas.map((r) => `- ${r.etiqueta}: ${r.valor}`),
    `- Entidades: ${Object.entries(conteo).map(([k, v]) => `${k} ${v}`).join(", ")}`,
    `- Capas con conteo: ${Object.entries(capas).slice(0, 20).map(([k, v]) => `${k} (${v})`).join(", ")}`,
    avisos.length ? `AVISOS DETECTADOS:\n${avisos.map((a) => `- ${a}`).join("\n")}` : "Sin problemas detectados.",
  ].join("\n")
  return { tipo: "dxf", nombre, titulo: `DXF: ${nombre}`, filas, avisos, texto, datos: { corte_m: Math.round(largo) / 1000, ancho, alto, cerrados, sueltas } }
}

// ======================================================================
// STL
// ======================================================================
export const analizarStl = (nombre: string, buf: ArrayBuffer): Analisis => {
  const dv = new DataView(buf)
  const caja = cajaNueva()
  let vol = 0
  let area = 0
  let tris = 0
  const aristas = new Map<string, number>()
  const revisarAristas = buf.byteLength < 20_000_000
  const k = (x: number, y: number, z: number) => `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`
  const tri = (a: number[], b: number[], c: number[]) => {
    tris++
    enCaja(caja, a[0], a[1], a[2]); enCaja(caja, b[0], b[1], b[2]); enCaja(caja, c[0], c[1], c[2])
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2
    if (revisarAristas) {
      const ka = k(a[0], a[1], a[2]), kb2 = k(b[0], b[1], b[2]), kc = k(c[0], c[1], c[2])
      for (const [p, q] of [[ka, kb2], [kb2, kc], [kc, ka]]) {
        const e = p < q ? p + "|" + q : q + "|" + p
        aristas.set(e, (aristas.get(e) || 0) + 1)
      }
    }
  }
  const n = buf.byteLength >= 84 ? dv.getUint32(80, true) : 0
  const binario = buf.byteLength === 84 + n * 50
  if (binario) {
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12
      const p = (j: number) => [dv.getFloat32(o + j * 12, true), dv.getFloat32(o + j * 12 + 4, true), dv.getFloat32(o + j * 12 + 8, true)]
      tri(p(0), p(1), p(2))
    }
  } else {
    const t = new TextDecoder().decode(buf)
    const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g
    const vs: number[][] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(t))) {
      vs.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])])
      if (vs.length === 3) { tri(vs[0], vs[1], vs[2]); vs.length = 0 }
    }
  }
  let abiertas = 0
  aristas.forEach((c) => { if (c !== 2) abiertas++ })
  const X = caja.x1 - caja.x0, Y = caja.y1 - caja.y0, Z = caja.z1 - caja.z0
  const avisos: string[] = []
  if (revisarAristas && abiertas) avisos.push(`La malla no está cerrada (${abiertas} aristas con problema): el volumen puede salir mal y el laminador o el CAM pueden fallar. Repárala (Meshmixer, PrusaSlicer, Windows 3D Builder).`)
  if (Math.max(X, Y, Z) < 5) avisos.push("La pieza mide menos de 5 mm: el STL quizá está en metros o pulgadas. Revisa la escala al importarlo.")
  if (vol < 0) avisos.push("Las caras están invertidas (volumen negativo); casi todos los programas lo corrigen solos.")
  const V = Math.abs(vol) / 1000
  const filas = [
    { etiqueta: "Tamaño (X × Y × Z)", valor: `${f(X)} × ${f(Y)} × ${f(Z)} mm` },
    { etiqueta: "Volumen", valor: `${f(V, 2)} cm³` },
    { etiqueta: "Superficie", valor: `${f(area / 100, 1)} cm²` },
    { etiqueta: "Triángulos", valor: f(tris, 0) },
    { etiqueta: "Malla cerrada", valor: revisarAristas ? (abiertas ? "No" : "Sí") : "no revisada (archivo grande)" },
  ]
  const texto = [
    `ARCHIVO STL "${nombre}" (${kb(buf.byteLength)}, ${binario ? "binario" : "texto"}). Análisis automático hecho por HETNA (unidades asumidas en mm):`,
    ...filas.map((r) => `- ${r.etiqueta}: ${r.valor}`),
    `- Peso aproximado si fuera sólido: PLA ${f(V * 1.24, 0)} g, aluminio ${f(V * 2.7, 0)} g, MDF ${f(V * 0.75, 0)} g.`,
    avisos.length ? `AVISOS DETECTADOS:\n${avisos.map((a) => `- ${a}`).join("\n")}` : "Sin problemas detectados.",
  ].join("\n")
  return { tipo: "stl", nombre, titulo: `STL: ${nombre}`, filas, avisos, texto, datos: { volumen_cm3: Math.round(V * 100) / 100, x: X, y: Y, z: Z } }
}

export const EXT_GCODE = ["nc", "tap", "gcode", "gc", "ngc", "cnc", "txt", "mpf", "nci", "ncc", "iso"]
export const tipoArchivo = (nombre: string): "gcode" | "dxf" | "stl" | "imagen" | null => {
  const ext = (nombre.split(".").pop() || "").toLowerCase()
  if (ext === "dxf") return "dxf"
  if (ext === "stl") return "stl"
  if (["jpg", "jpeg", "png", "webp", "heic", "gif"].includes(ext)) return "imagen"
  if (EXT_GCODE.includes(ext)) return "gcode"
  return null
}
