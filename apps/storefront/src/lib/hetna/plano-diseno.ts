// Esquema de medidas de un diseño digital: un dibujo de la esquina del panel
// con las medidas que el vendedor declaró (marco, hueco, nervio, barreno).
// Es un ESQUEMA, no una vista del archivo: la galería lo rotula así, para no
// hacer pasar por foto o por el DXF algo que se dibujó aquí. Si el producto no
// trae sus medidas, no se dibuja nada.
//
// De dónde salen las medidas:
//   1. metadata.esquema (JSON) del producto, p. ej.
//      {"patron":"panal","marco":48,"hueco":76,"nervio":10,"radio":14,"barreno":6.5}
//      (hueco = hexágono de punta a punta, en mm)
//   2. ESQUEMAS_INICIALES, para diseños publicados antes de metadata.esquema;
//      copian lo que ya dice su descripción. Al cargarlo en el admin, manda el admin.

export type Esquema = { patron: "panal"; marco: number; hueco: number; nervio: number; radio: number; barreno: number | null }

const ESQUEMAS_INICIALES: Record<string, Esquema> = {
  // Su descripción: marco sólido de 48 mm, hexágonos de 76 mm de punta a punta,
  // nervio de 10 mm, esquinas redondeadas a 14 mm, barrenos de 6.5 mm
  "celosia-hexagonal-600-dxf-router-cnc": { patron: "panal", marco: 48, hueco: 76, nervio: 10, radio: 14, barreno: 6.5 },
}

const num = (v: unknown, min: number, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

export function esquemaDe(producto: { handle?: string | null; metadata?: Record<string, unknown> | null }): Esquema | null {
  let crudo = producto.metadata?.esquema as unknown
  if (typeof crudo === "string") {
    try {
      crudo = JSON.parse(crudo)
    } catch {
      crudo = null
    }
  }
  if (crudo && typeof crudo === "object") {
    const o = crudo as Record<string, unknown>
    const marco = num(o.marco, 0, 500)
    const hueco = num(o.hueco, 5, 500)
    const nervio = num(o.nervio, 1, 100)
    if (o.patron === "panal" && marco != null && hueco && nervio)
      return { patron: "panal", marco, hueco, nervio, radio: num(o.radio, 0, 200) ?? 0, barreno: num(o.barreno, 1, 50) }
  }
  return ESQUEMAS_INICIALES[producto.handle || ""] || null
}

// ------------------------------------------------------------------ SVG

const f = (n: number) => (Math.round(n * 10) / 10).toString()
const C = { madera: "#E9C9A0", borde: "#7A5A36", fondo: "#F4F5F7", cota: "#E85D04", texto: "#1E2329" }
const MONO = "ui-monospace,Menlo,Consolas,monospace"

function cota(x1: number, y1: number, x2: number, y2: number, texto: string, tx: number, ty: number, ancla = "middle") {
  return (
    `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${C.cota}" stroke-width="1.8" marker-start="url(#fl)" marker-end="url(#fl)"/>` +
    `<text x="${f(tx)}" y="${f(ty)}" font-family="${MONO}" font-size="13" font-weight="700" fill="${C.texto}" text-anchor="${ancla}" paint-order="stroke" stroke="${C.fondo}" stroke-width="5">${texto}</text>`
  )
}

/** La esquina superior izquierda del panel, a escala, con sus medidas. */
export function svgEsquema(e: Esquema): string {
  const R = e.hueco / 2 // hexágono con puntas a los lados
  const a = (Math.sqrt(3) / 2) * R // medio alto (de cara plana a cara plana)
  const k = R + e.nervio / Math.sqrt(3) // radio de la celda (hueco + medio nervio)
  const dx = 1.5 * k
  const dy = Math.sqrt(3) * k
  const ver = Math.round(e.marco + 3.3 * dx + R) // lo que se ve de la esquina
  // Primera columna pegada al marco; la siguiente baja media celda
  const x0 = e.marco + R
  const y0 = e.marco + a
  const hex = (cx: number, cy: number) =>
    "M" + [0, 1, 2, 3, 4, 5].map((i) => `${f(cx + R * Math.cos((i * Math.PI) / 3))} ${f(cy + R * Math.sin((i * Math.PI) / 3))}`).join("L") + "Z"
  let huecos = ""
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 4; j++) {
      const cx = x0 + i * dx
      const cy = y0 + j * dy + (i % 2 ? dy / 2 : 0)
      if (cx - R < ver + 40 && cy - a < ver + 40) huecos += hex(cx, cy)
    }
  const r = e.radio
  // Panel: sólo la esquina (se sale del cuadro por la derecha y por abajo)
  const panel = `M${f(r)} 0H${ver + 60}V${ver + 60}H0V${f(r)}${r ? `A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0` : ""}Z`
  const marcoInterior = e.marco
    ? `<path d="M${e.marco} ${ver + 60}V${e.marco}H${ver + 60}" fill="none" stroke="${C.borde}" stroke-width="1" stroke-dasharray="5 5" opacity=".55"/>`
    : ""
  const barreno = e.barreno ? `<circle cx="${f(e.marco / 2)}" cy="${f(e.marco / 2)}" r="${f(e.barreno / 2)}" fill="${C.fondo}" stroke="${C.borde}" stroke-width="1.2"/>` : ""

  let cotas = ""
  // Marco: abajo, donde ya no estorba a las demás medidas
  const ym = y0 + 2.5 * dy
  if (e.marco) cotas += cota(0, ym, e.marco, ym, `marco ${f(e.marco)}`, e.marco / 2, ym + 18)
  // Hueco de punta a punta (el primero de la columna)
  cotas += cota(x0 - R, y0, x0 + R, y0, `${f(e.hueco)} mm`, x0, y0 - 8)
  // Nervio: entre el 2.º y el 3.er hueco de la misma columna (caras planas)
  const yn1 = y0 + dy + a
  const yn2 = y0 + 2 * dy - a
  cotas += cota(x0 + R * 0.15, yn1, x0 + R * 0.15, yn2, `nervio ${f(e.nervio)}`, x0 + R * 0.15 + 8, (yn1 + yn2) / 2 + 4, "start")
  if (e.barreno) cotas += `<text x="${f(e.marco / 2 + e.barreno / 2 + 5)}" y="${f(e.marco / 2 + 4)}" font-family="${MONO}" font-size="12" font-weight="700" fill="${C.texto}">⌀${f(e.barreno)}</text>`
  if (r) cotas += `<text x="${f(r + 26)}" y="-6" font-family="${MONO}" font-size="11" font-weight="700" fill="${C.texto}" text-anchor="start">R${f(r)}</text>`

  const titulo = "Esquema de medidas de la esquina del panel"
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -22 ${ver + 32} ${ver + 38}" role="img" aria-label="${titulo}"><title>${titulo}</title>` +
    `<defs><marker id="fl" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 1L10 5L0 9z" fill="${C.cota}"/></marker>` +
    `<clipPath id="cv"><rect x="-16" y="-22" width="${ver + 32}" height="${ver + 38}"/></clipPath></defs>` +
    `<rect x="-16" y="-22" width="${ver + 32}" height="${ver + 38}" fill="${C.fondo}"/>` +
    `<g clip-path="url(#cv)"><path d="${panel}${huecos}" fill="${C.madera}" fill-rule="evenodd" stroke="${C.borde}" stroke-width="1.4" stroke-linejoin="round"/>${marcoInterior}${barreno}</g>` +
    cotas +
    `</svg>`
  )
}
