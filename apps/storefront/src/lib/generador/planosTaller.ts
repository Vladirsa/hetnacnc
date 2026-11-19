// Documentos para el taller y para el cliente, hechos en el navegador e impresos
// a PDF (sin servidor): planos de taller (vistas acotadas, lista de corte y un
// plano por pieza con sus barrenos), etiquetas con QR por pieza y presupuesto.
import { type MuebleCompleto, type PiezaMueble, type TableroC, materialDe } from "./componentes"
import { svgQR } from "./qr"

type P = [number, number]
const r1 = (n: number) => Math.round(n * 10) / 10
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
const fmt = (n: number) => String(r1(n))
const pesos = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const ROL: Record<string, string> = { estructura: "Estructura", puerta: "Puerta", frente: "Frente de cajón", cajon: "Cajón", fondo: "Fondo", cubierta: "Cubierta", repisa: "Repisa movible" }
const COLOR: Record<string, string> = { estructura: "#EDE6D6", puerta: "#CFE1F3", frente: "#CFE1F3", cajon: "#E4DCC8", fondo: "#D8C6A6", cubierta: "#BDB5A8", repisa: "#E9F0D8" }

// medidas de corte de una pieza: largo ≥ ancho
export function medidasPieza(p: PiezaMueble) {
  const us = p.contorno.map((q) => q[0]), vs = p.contorno.map((q) => q[1])
  const a = Math.max(...us) - Math.min(...us), b = Math.max(...vs) - Math.min(...vs)
  const largo = Math.max(a, b), ancho = Math.min(a, b)
  // canto: u0/u1 son orillas de largo b; v0/v1, de largo a
  let L = 0, C = 0
  for (const l of p.cantoLados || []) {
    const lng = l[0] === "u" ? b : a
    if (Math.abs(lng - largo) < 0.01) L++
    else C++
  }
  const canto = L + C ? [L ? `${L}L` : "", C ? `${C}C` : ""].filter(Boolean).join(" ") : "—"
  return { largo: r1(largo), ancho: r1(ancho), grosor: r1(p.grosor), canto, uEsLargo: a >= b }
}

// lista de corte: piezas iguales (medidas, material, canto y barrenos) juntas
export function listaCorte(m: MuebleCompleto) {
  const filas = new Map<string, { nums: number[]; nombres: string[]; largo: number; ancho: number; grosor: number; material: string; canto: string; barrenos: number; rol: string }>()
  m.piezas.forEach((p, i) => {
    const d = medidasPieza(p)
    const k = [d.largo, d.ancho, d.grosor, p.material, d.canto, p.barrenos.length, p.ranuras.length].join("|")
    const f = filas.get(k)
    if (f) {
      f.nums.push(i + 1)
      if (!f.nombres.includes(p.nombre)) f.nombres.push(p.nombre)
    } else filas.set(k, { nums: [i + 1], nombres: [p.nombre], largo: d.largo, ancho: d.ancho, grosor: d.grosor, material: materialDe(p.material).nombre, canto: d.canto, barrenos: p.barrenos.length, rol: p.rol })
  })
  return [...filas.values()].sort((x, y) => y.largo * y.ancho - x.largo * x.ancho)
}

// ---- vistas ortogonales del mueble armado (cajas de los tableros) ----
export type CualVista = "frente" | "lateral" | "planta"
export function svgVista(ts: TableroC[], cual: CualVista, ancho = 520, conCotas = true): string {
  if (!ts.length) return ""
  // ejes en la hoja: h (horizontal), w (vertical, hacia arriba), prof (de lejos a cerca)
  const ej = cual === "frente" ? { h: ["x0", "x1"], w: ["z0", "z1"], prof: (t: TableroC) => -t.y0 } : cual === "lateral" ? { h: ["y0", "y1"], w: ["z0", "z1"], prof: (t: TableroC) => t.x1 } : { h: ["x0", "x1"], w: ["y0", "y1"], prof: (t: TableroC) => t.z1 }
  const g = (t: TableroC, k: string) => (t as unknown as Record<string, number>)[k]
  const h0 = Math.min(...ts.map((t) => g(t, ej.h[0]))), h1 = Math.max(...ts.map((t) => g(t, ej.h[1])))
  const w0 = Math.min(...ts.map((t) => g(t, ej.w[0]))), w1 = Math.max(...ts.map((t) => g(t, ej.w[1])))
  const W = h1 - h0, H = w1 - w0
  const m = Math.max(W, H) * 0.14 + 40
  const vbW = W + m * 2, vbH = H + m * 2
  // en planta el frente queda abajo (y menor abajo)
  const yy = (w: number) => (cual === "planta" ? m + (w - w0) : m + (w1 - w))
  const orden = [...ts].sort((a, b) => ej.prof(a) - ej.prof(b))
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(vbW)} ${fmt(vbH)}" width="${ancho}" height="${Math.round((ancho * vbH) / vbW)}" font-family="Arial,sans-serif">`
  const lw = Math.max(W, H) / 400
  for (const t of orden) {
    const x = m + g(t, ej.h[0]) - h0, wA = g(t, ej.w[0]), wB = g(t, ej.w[1])
    const y = Math.min(yy(wA), yy(wB))
    s += `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(g(t, ej.h[1]) - g(t, ej.h[0]))}" height="${fmt(Math.abs(wB - wA))}" fill="${COLOR[t.rol || "estructura"] || COLOR.estructura}" fill-opacity="0.9" stroke="#2B2B2B" stroke-width="${fmt(lw)}"/>`
  }
  if (conCotas) {
    const fs = Math.max(W, H) / 22
    const cota = (x1: number, y1: number, x2: number, y2: number, texto: string, vertical: boolean) => {
      const tick = fs * 0.4
      s += `<g stroke="#C2560A" stroke-width="${fmt(lw)}"><line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"/>`
      s += vertical
        ? `<line x1="${fmt(x1 - tick)}" y1="${fmt(y1)}" x2="${fmt(x1 + tick)}" y2="${fmt(y1)}"/><line x1="${fmt(x2 - tick)}" y1="${fmt(y2)}" x2="${fmt(x2 + tick)}" y2="${fmt(y2)}"/></g>`
        : `<line x1="${fmt(x1)}" y1="${fmt(y1 - tick)}" x2="${fmt(x1)}" y2="${fmt(y1 + tick)}"/><line x1="${fmt(x2)}" y1="${fmt(y2 - tick)}" x2="${fmt(x2)}" y2="${fmt(y2 + tick)}"/></g>`
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2
      s += vertical
        ? `<text x="${fmt(cx - fs * 0.5)}" y="${fmt(cy)}" font-size="${fmt(fs)}" fill="#C2560A" text-anchor="middle" transform="rotate(-90 ${fmt(cx - fs * 0.5)} ${fmt(cy)})">${texto}</text>`
        : `<text x="${fmt(cx)}" y="${fmt(cy - fs * 0.35)}" font-size="${fmt(fs)}" fill="#C2560A" text-anchor="middle">${texto}</text>`
    }
    cota(m, m + H + m * 0.45, m + W, m + H + m * 0.45, `${fmt(W)}`, false)
    cota(m * 0.55, m, m * 0.55, m + H, `${fmt(H)}`, true)
  }
  return s + "</svg>"
}

// ---- plano de una pieza: contorno, huecos, ranuras y barrenos, acotada ----
export function svgPieza(p: PiezaMueble, ancho = 520, maxAlto = 330): string {
  const us = p.contorno.map((q) => q[0]), vs = p.contorno.map((q) => q[1])
  const u0 = Math.min(...us), v0 = Math.min(...vs), W = Math.max(...us) - u0, H = Math.max(...vs) - v0
  const m = Math.max(W, H) * 0.12 + 30
  const X = (u: number) => m + u - u0, Y = (v: number) => m + H - (v - v0)
  const camino = (pts: P[]) => "M" + pts.map(([u, v]) => `${fmt(X(u))},${fmt(Y(v))}`).join("L") + "Z"
  const lw = Math.max(W, H) / 450
  const fs = Math.max(W, H) / 30
  const anchoReal = Math.min(ancho, (maxAlto * (W + 2 * m)) / (H + 2 * m))
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(W + 2 * m)} ${fmt(H + 2 * m)}" width="${Math.round(anchoReal)}" height="${Math.round((anchoReal * (H + 2 * m)) / (W + 2 * m))}" font-family="Arial,sans-serif" style="display:block;margin:0 auto">`
  s += `<path d="${camino(p.contorno)}${p.huecos.map(camino).join("")}" fill="#F4EFE4" fill-rule="evenodd" stroke="#1F1F1F" stroke-width="${fmt(lw * 1.6)}"/>`
  for (const r of p.ranuras) s += `<rect x="${fmt(X(Math.min(r.u0, r.u1)))}" y="${fmt(Y(Math.max(r.v0, r.v1)))}" width="${fmt(Math.abs(r.u1 - r.u0))}" height="${fmt(Math.abs(r.v1 - r.v0))}" fill="#F5C451" fill-opacity="0.6" stroke="#B88A12" stroke-width="${fmt(lw)}" ${r.cara === 0 ? `stroke-dasharray="${fmt(lw * 6)} ${fmt(lw * 4)}"` : ""}/>`
  for (const b of p.barrenos) s += `<circle cx="${fmt(X(b.u))}" cy="${fmt(Y(b.v))}" r="${fmt(Math.max(b.d / 2, lw * 3))}" fill="${b.cara === 1 ? "#5FA8F5" : "none"}" fill-opacity="0.55" stroke="${b.cara === 1 ? "#1E5FA8" : "#7A4FD0"}" stroke-width="${fmt(lw)}" ${b.cara === 0 ? `stroke-dasharray="${fmt(lw * 4)} ${fmt(lw * 3)}"` : ""}/>`
  for (const c of p.cantos) s += `<line x1="${fmt(X(c.u))}" y1="${fmt(Y(c.v))}" x2="${fmt(X(c.u + c.du * c.prof))}" y2="${fmt(Y(c.v + c.dv * c.prof))}" stroke="#2E9E62" stroke-width="${fmt(Math.max(c.d, lw * 2))}" stroke-opacity="0.6"/>`
  // orillas con canto: línea gruesa por fuera
  const off = lw * 5
  for (const l of p.cantoLados || []) {
    const [x1, y1, x2, y2] = l === "u0" ? [X(u0) - off, Y(v0), X(u0) - off, Y(v0 + H)] : l === "u1" ? [X(u0 + W) + off, Y(v0), X(u0 + W) + off, Y(v0 + H)] : l === "v0" ? [X(u0), Y(v0) + off, X(u0 + W), Y(v0) + off] : [X(u0), Y(v0 + H) - off, X(u0 + W), Y(v0 + H) - off]
    s += `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="#C2560A" stroke-width="${fmt(lw * 3)}"/>`
  }
  s += `<text x="${fmt(m + W / 2)}" y="${fmt(m + H + m * 0.62)}" font-size="${fmt(fs)}" text-anchor="middle" fill="#333">${fmt(W)} mm</text>`
  s += `<text x="${fmt(m * 0.45)}" y="${fmt(m + H / 2)}" font-size="${fmt(fs)}" text-anchor="middle" fill="#333" transform="rotate(-90 ${fmt(m * 0.45)} ${fmt(m + H / 2)})">${fmt(H)} mm</text>`
  return s + "</svg>"
}

const CSS = `@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font:11px/1.35 Arial,sans-serif;color:#1d1d1b;margin:0}
h1{font-size:20px;margin:0 0 2px}h2{font-size:14px;margin:14px 0 6px;border-bottom:2px solid #C2560A;padding-bottom:2px}h3{font-size:12px;margin:8px 0 4px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:3px 5px;text-align:left;vertical-align:top}th{background:#f1ece2}td.n{text-align:right;white-space:nowrap}
.hoja{page-break-after:always}.hoja:last-child{page-break-after:auto}.gris{color:#666}.fila{display:flex;gap:12px;flex-wrap:wrap}.fila>div{flex:1;min-width:46%}
.pieza{page-break-inside:avoid;border:1px solid #ddd;border-radius:6px;padding:6px 8px;margin-bottom:8px}svg{max-width:100%;height:auto}
.nota{font-size:10px;color:#555}.aviso{background:#fff7e6;border:1px solid #f0c27a;padding:6px 8px;border-radius:6px;margin:6px 0}
@media screen{body{background:#e9e6df}.hoja{background:#fff;max-width:210mm;margin:10px auto;padding:10mm;box-shadow:0 1px 4px #0002}.barra{position:sticky;top:0;background:#1d1d1b;color:#fff;padding:8px 12px;text-align:center}.barra button{font:600 13px Arial;padding:6px 14px;margin-left:8px;cursor:pointer}}
@media print{.barra{display:none}}`
const barra = (t: string) => `<div class="barra">${esc(t)} <button onclick="print()">Imprimir o guardar PDF</button></div>`
const envolver = (titulo: string, cuerpo: string, css = CSS) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${css}</style></head><body>${cuerpo}</body></html>`

export type DatosDoc = {
  nombre: string
  m: MuebleCompleto
  union: string
  taller?: string
  fecha?: string
  vetaLarga?: (nombre: string) => boolean // la veta corre a lo largo (si el material tiene veta)
}

const encabezado = (d: DatosDoc, sub: string) =>
  `<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px"><div><h1>${esc(d.nombre)}</h1><div class="gris">${esc(sub)}</div></div><div class="gris" style="text-align:right">${d.taller ? `<b>${esc(d.taller)}</b><br>` : ""}${esc(d.fecha || new Date().toLocaleDateString("es-MX"))}</div></div>`

export function htmlPlanos(d: DatosDoc): string {
  const { m } = d
  const lista = listaCorte(m)
  const mats = [...new Set(m.piezas.map((p) => `${materialDe(p.material).nombre} ${r1(p.grosor)} mm`))]
  const ts = m.tablerosFinales
  let c = barra(`Planos de taller · ${m.piezas.length} piezas`)
  // hoja 1: vistas y datos
  c += `<section class="hoja">${encabezado(d, `Planos de taller · ${fmt(m.medidas.ancho)} × ${fmt(m.medidas.fondo)} × ${fmt(m.medidas.alto)} mm (ancho × fondo × alto)`)}`
  c += `<table style="margin-top:8px"><tr><th>Piezas</th><td>${m.piezas.length}</td><th>Unión</th><td>${esc(d.union)}</td></tr><tr><th>Material</th><td colspan="3">${mats.map(esc).join(" · ")}</td></tr>${m.cantoMetros ? `<tr><th>Canto</th><td colspan="3">${m.cantoMetros} m (sin desperdicio)</td></tr>` : ""}</table>`
  c += `<h2>Vistas</h2><div class="fila"><div><h3>Frente</h3>${svgVista(ts, "frente", 340)}</div><div><h3>Lateral</h3>${svgVista(ts, "lateral", 340)}</div></div><div class="fila"><div><h3>Planta (frente abajo)</h3>${svgVista(ts, "planta", 340)}</div><div><h3>Herrajes y compras</h3>`
  c += m.compras.length ? `<table><tr><th>Cant.</th><th>Concepto</th></tr>${m.compras.map((x) => `<tr><td class="n">${x.cantidad}</td><td>${esc(x.nombre)}${x.nota ? `<div class="nota">${esc(x.nota)}</div>` : ""}</td></tr>`).join("")}</table>` : `<p class="gris">Sin herrajes (caja y espiga).</p>`
  c += `</div></div><p class="nota">Medidas en milímetros. Colores: estructura, puertas y frentes (azul), fondo (café), cubierta (gris).</p></section>`
  // hoja 2: lista de corte
  c += `<section class="hoja">${encabezado(d, "Lista de corte")}<table style="margin-top:8px"><tr><th>#</th><th>Pieza</th><th>Cant.</th><th>Largo</th><th>Ancho</th><th>Grosor</th><th>Material</th><th>Canto</th><th>Barr.</th></tr>`
  c += lista.map((f) => `<tr><td>${f.nums.join(", ")}</td><td>${esc(f.nombres.join(" / "))}<div class="nota">${esc(ROL[f.rol] || f.rol)}</div></td><td class="n">${f.nums.length}</td><td class="n">${f.largo}</td><td class="n">${f.ancho}</td><td class="n">${f.grosor}</td><td>${esc(f.material)}</td><td>${f.canto}</td><td class="n">${f.barrenos || ""}</td></tr>`).join("")
  c += `</table><p class="nota">Canto: L = orillas largas, C = orillas cortas con canto. Las medidas son finales (sin descontar el grueso del canto). El número de pieza (#) es el de las etiquetas y los planos.</p></section>`
  // planos por pieza (dos por hoja)
  for (let i = 0; i < m.piezas.length; i += 2) {
    c += `<section class="hoja">${i === 0 ? encabezado(d, "Plano de cada pieza") : ""}`
    for (const k of [i, i + 1]) {
      const p = m.piezas[k]
      if (!p) continue
      const md = medidasPieza(p)
      const veta = materialDe(p.material).veta ? (d.vetaLarga?.(p.nombre) === false ? "a lo ancho" : "a lo largo") : ""
      c += `<div class="pieza"><h3>#${k + 1} · ${esc(p.nombre)} <span class="gris">— ${md.largo} × ${md.ancho} × ${md.grosor} mm · ${esc(materialDe(p.material).nombre)} · canto ${md.canto}${veta ? ` · veta ${veta}` : ""}</span></h3>${svgPieza(p, 560)}`
      if (p.barrenos.length) {
        const grupos = new Map<string, { n: number; pts: string[] }>()
        const us = p.contorno.map((q) => q[0]), vs = p.contorno.map((q) => q[1])
        const u0 = Math.min(...us), v0 = Math.min(...vs)
        for (const b of p.barrenos) {
          const kk = `Ø${fmt(b.d)} × ${b.prof <= 0 || b.prof >= p.grosor ? "pasado" : `${fmt(b.prof)} mm`} · ${b.cara === 1 ? "cara de arriba" : "cara de abajo (voltear)"}`
          const g = grupos.get(kk) || { n: 0, pts: [] }
          g.n++
          if (g.pts.length < 24) g.pts.push(`(${fmt(b.u - u0)}, ${fmt(b.v - v0)})`)
          grupos.set(kk, g)
        }
        c += `<table style="margin-top:4px"><tr><th>Barreno</th><th>Cant.</th><th>Posición desde la esquina de abajo a la izquierda (mm)</th></tr>${[...grupos.entries()].map(([kk, g]) => `<tr><td>${kk}</td><td class="n">${g.n}</td><td class="nota">${g.pts.join(" ")}${g.n > g.pts.length ? " …" : ""}</td></tr>`).join("")}</table>`
      }
      if (p.cantos.length) c += `<p class="nota">${p.cantos.length} barrenos de canto (verde): con taladro y guía.</p>`
      c += `</div>`
    }
    c += `</section>`
  }
  return envolver(`Planos ${d.nombre}`, c)
}

// ---- etiquetas: A4, 3 × 8 de 70 × 37 mm, con QR ----
export function htmlEtiquetas(d: DatosDoc, copias = 1): string {
  const css = `@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font:9px/1.2 Arial,sans-serif;color:#111}
.hoja{width:210mm;height:296mm;display:grid;grid-template-columns:repeat(3,70mm);grid-auto-rows:37mm;page-break-after:always;overflow:hidden}.hoja:last-child{page-break-after:auto}
.e{display:flex;gap:2mm;padding:2.5mm 3mm;overflow:hidden;border:0.1mm dashed #ccc}.e svg{width:24mm;height:24mm;flex:none}.t{min-width:0;display:flex;flex-direction:column;gap:0.6mm}
.n{font-size:13px;font-weight:700}.p{font-size:10.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.m{font-size:12px;font-weight:700}.g{color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media screen{body{background:#e9e6df}.hoja{background:#fff;margin:10px auto;box-shadow:0 1px 4px #0002}.barra{position:sticky;top:0;background:#1d1d1b;color:#fff;padding:8px 12px;text-align:center;font:13px Arial}.barra button{font:600 13px Arial;padding:6px 14px;margin-left:8px;cursor:pointer}}
@media print{.barra{display:none}.e{border-color:transparent}}`
  const ets: string[] = []
  for (let c = 0; c < Math.max(1, copias); c++)
    d.m.piezas.forEach((p, i) => {
      const md = medidasPieza(p)
      const mat = materialDe(p.material).nombre
      const veta = materialDe(p.material).veta ? (d.vetaLarga?.(p.nombre) === false ? " · veta ↕" : " · veta ↔") : ""
      const texto = `HETNA|${d.nombre.slice(0, 40)}|#${i + 1}|${p.nombre.slice(0, 40)}|${md.largo}x${md.ancho}x${md.grosor}|${mat}|canto ${md.canto}`
      ets.push(`<div class="e">${svgQR(texto, 90)}<div class="t"><span class="n">#${i + 1}${copias > 1 ? ` <span class="g">(${c + 1}/${copias})</span>` : ""}</span><span class="p">${esc(p.nombre)}</span><span class="m">${md.largo} × ${md.ancho}</span><span class="g">${md.grosor} mm · ${esc(mat)}</span><span class="g">Canto ${md.canto}${veta}${p.barrenos.length ? ` · ${p.barrenos.length} barr.` : ""}</span><span class="g">${esc(d.nombre)}</span></div></div>`)
    })
  let c = `<div class="barra">${ets.length} etiquetas de 70 × 37 mm (hoja A4 de 24) <button onclick="print()">Imprimir</button></div>`
  for (let i = 0; i < ets.length; i += 24) c += `<section class="hoja">${ets.slice(i, i + 24).join("")}</section>`
  return envolver(`Etiquetas ${d.nombre}`, c, css)
}

// ---- presupuesto para el cliente ----
export type DatosPresupuesto = {
  cliente: string
  taller: string
  telefono: string
  material: number // costo de tablero, canto y herrajes
  manoObra: number
  margen: number // % de utilidad sobre el costo
  iva: boolean
  vigencia: number // días
  anticipo: number // %
  entrega: string // p. ej. "10 días hábiles"
  nota: string
  desglose: boolean // mostrar materiales al cliente
  partidas?: { concepto: string; importe: number }[] // desglose de materiales
}
export function htmlPresupuesto(d: DatosDoc, p: DatosPresupuesto): string {
  const { m } = d
  const costo = p.material + p.manoObra
  const subtotal = costo * (1 + p.margen / 100)
  const iva = p.iva ? subtotal * 0.16 : 0
  const total = subtotal + iva
  const mats = [...new Set(m.piezas.filter((x) => x.rol !== "fondo").map((x) => materialDe(x.material).nombre))]
  const folio = `P-${Date.now().toString(36).toUpperCase().slice(-6)}`
  let c = barra("Presupuesto")
  c += `<section class="hoja"><div style="display:flex;justify-content:space-between;gap:10px"><div><h1>${esc(p.taller || "Presupuesto")}</h1>${p.telefono ? `<div class="gris">${esc(p.telefono)}</div>` : ""}</div><div style="text-align:right"><b>PRESUPUESTO</b><br>Folio ${folio}<br>${esc(d.fecha || new Date().toLocaleDateString("es-MX"))}</div></div>`
  if (p.cliente) c += `<p style="margin-top:12px"><b>Cliente:</b> ${esc(p.cliente)}</p>`
  c += `<h2>${esc(d.nombre)}</h2><div class="fila"><div>${svgVista(m.tablerosFinales, "frente", 300)}</div><div><table>`
  c += `<tr><th>Medidas</th><td>${fmt(m.medidas.ancho)} × ${fmt(m.medidas.fondo)} × ${fmt(m.medidas.alto)} mm<div class="nota">ancho × fondo × alto</div></td></tr>`
  c += `<tr><th>Material</th><td>${mats.map(esc).join(", ")}</td></tr><tr><th>Armado</th><td>${esc(d.union)}</td></tr>`
  const incl = m.compras.filter((x) => !/^Canto|^Tornillo para madera|^Clavo/.test(x.nombre))
  if (incl.length) c += `<tr><th>Incluye</th><td>${incl.map((x) => `${x.cantidad} ${esc(x.nombre)}`).join("<br>")}</td></tr>`
  c += `</table></div></div><h2>Importe</h2><table>`
  if (p.desglose && p.partidas?.length) {
    const k = subtotal / Math.max(costo, 0.01)
    for (const x of p.partidas) c += `<tr><td>${esc(x.concepto)}</td><td class="n">${pesos(x.importe * k)}</td></tr>`
    if (p.manoObra) c += `<tr><td>Fabricación e instalación</td><td class="n">${pesos(p.manoObra * k)}</td></tr>`
  } else c += `<tr><td>Fabricación de ${esc(d.nombre)}, con materiales y herrajes</td><td class="n">${pesos(subtotal)}</td></tr>`
  c += `<tr><th style="text-align:right">Subtotal</th><td class="n">${pesos(subtotal)}</td></tr>`
  if (p.iva) c += `<tr><th style="text-align:right">IVA 16 %</th><td class="n">${pesos(iva)}</td></tr>`
  c += `<tr><th style="text-align:right;font-size:13px">Total</th><td class="n" style="font-size:13px"><b>${pesos(total)}</b></td></tr></table>`
  c += `<h2>Condiciones</h2><ul style="margin:0;padding-left:18px">`
  if (p.anticipo > 0) c += `<li>Anticipo del ${p.anticipo} % (${pesos((total * p.anticipo) / 100)}) para empezar; el resto a la entrega.</li>`
  if (p.entrega) c += `<li>Entrega: ${esc(p.entrega)} a partir del anticipo.</li>`
  c += `<li>Precio válido por ${p.vigencia} días.</li>${p.iva ? "" : "<li>Precio sin IVA.</li>"}</ul>`
  if (p.nota) c += `<p>${esc(p.nota).replace(/\n/g, "<br>")}</p>`
  c += `<p class="nota" style="margin-top:24px">Diseño hecho con HETNA · hetnacnc.com</p></section>`
  return envolver(`Presupuesto ${d.nombre}`, c)
}

// abre el documento en otra pestaña (desde ahí se imprime o se guarda en PDF)
export function abrirDocumento(html: string): boolean {
  const w = window.open("", "_blank")
  if (!w) return false
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.focus()
  return true
}
