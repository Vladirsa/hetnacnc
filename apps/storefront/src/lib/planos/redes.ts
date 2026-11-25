// Carrusel para redes de un plano HETNA (1080 × 1350, 4:5): portada, vista
// explotada, lista de corte y acomodo en la hoja. Lo pide el promotor semanal
// del backend (lib/fabrica/promociones.ts → promoPlano) por
// /mx/planos/[slug]/redes/[n] y lo publica en Facebook e Instagram.
import { acomodoPorMaterial, hojasNecesarias, listaCorte, medidasGenerales } from "./calculo"
import { cajasRuedas, svgArmado, svgExplotado, svgHoja } from "./dibujo"
import type { Plano } from "./modelos"

const W = 1080, H = 1350
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)
const F = "Inter, DejaVu Sans, Arial, sans-serif"

// mete un <svg> ya hecho (con viewBox) dentro de un rectángulo de la tarjeta
function encajar(svg: string, x: number, y: number, w: number, h: number) {
  return svg.replace(/^<svg[^>]*?viewBox="([^"]+)"[^>]*>/, (_m, vb) => `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">`)
}

function texto(t: string, x: number, y: number, tam: number, o: { peso?: number; color?: string; anclaje?: string } = {}) {
  return `<text x="${x}" y="${y}" font-family="${F}" font-size="${tam}" font-weight="${o.peso ?? 700}" fill="${o.color ?? "#142033"}" text-anchor="${o.anclaje ?? "start"}">${esc(t)}</text>`
}

// parte un texto en renglones de ~n caracteres
function renglones(t: string, n: number) {
  const out: string[] = []
  let r = ""
  for (const p of t.split(" ")) {
    if ((r + " " + p).trim().length > n) { out.push(r.trim()); r = p } else r += " " + p
  }
  if (r.trim()) out.push(r.trim())
  return out
}

// Con una lista y join(""), no con plantillas sumadas: el minificador de Next
// (SWC) plegaba `...${H}">` + `<rect ...` y se comía el texto después de 1350
// (el SVG salía roto sólo en producción).
function marco(cuerpo: string, num: number, total: number) {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="', W, '" height="', H, '" viewBox="0 0 ', W, " ", H, '">',
    '<rect width="', W, '" height="', H, '" fill="#FAF9F6"/>',
    '<rect x="0" y="0" width="', W, '" height="14" fill="#FF6A1A"/>',
    cuerpo,
    '<rect x="0" y="', H - 96, '" width="', W, '" height="96" fill="#142033"/>',
    texto("hetnacnc.com/planos", 60, H - 36, 34, { color: "#FFFFFF", peso: 800 }),
    texto(`${num} / ${total}`, W - 60, H - 36, 30, { color: "#FF9F57", anclaje: "end" }),
    "</svg>",
  ].join("")
}

export function svgRedes(pl: Plano, n: number): string | null {
  const total = 4
  const m = medidasGenerales(pl)
  const { filas } = listaCorte(pl)
  const acs = acomodoPorMaterial(filas)
  const hojas = hojasNecesarias(acs)
  const nHojas = hojas.reduce((s, h) => s + h.hojas, 0)
  const titulo = (t: string, y = 190) => renglones(t, 26).slice(0, 2).map((r, i) => texto(r, 60, y + i * 68, 60, { peso: 800 })).join("")
  const etiqueta = (t: string) => `<rect x="60" y="54" width="${t.length * 19 + 44}" height="54" rx="12" fill="#FF6A1A"/>` + texto(t, 82, 92, 28, { color: "#FFFFFF", peso: 800 })

  if (n === 1) {
    return marco(
      etiqueta("PLANO GRATIS") +
      titulo(pl.nombre, 190) +
      texto(`${m.ancho} × ${m.fondo} × ${m.alto} mm · ${pl.nivel} · ${pl.horas}`, 60, 330, 30, { peso: 500, color: "#40403A" }) +
      encajar(svgArmado(pl.piezas, pl.nombre, cajasRuedas(pl.piezas, pl.ruedas)), 60, 360, W - 120, 760) +
      texto("Lista de corte · acomodo en la hoja · pasos · DXF", W / 2, 1180, 32, { anclaje: "middle", color: "#B34D07", peso: 800 }),
      1, total)
  }
  if (n === 2) {
    return marco(
      etiqueta("VISTA EXPLOTADA") + titulo("Así se arma, pieza por pieza") +
      encajar(svgExplotado(pl.piezas, pl.nombre), 40, 340, W - 80, 860),
      2, total)
  }
  if (n === 3) {
    const filasMostrar = filas.slice(0, 10)
    const y0 = 350, alto = 64
    const tabla = filasMostrar.map((f, i) => {
      const y = y0 + i * alto
      return `<rect x="60" y="${y}" width="${W - 120}" height="${alto - 6}" rx="10" fill="${i % 2 ? "#FFFFFF" : "#F3EEE3"}"/>` +
        texto(f.letra, 90, y + 42, 32, { peso: 800, color: "#FF6A1A" }) +
        texto(renglones(f.nombre.split(" / ")[0], 24)[0], 150, y + 42, 28, { peso: 600 }) +
        texto(`${f.cantidad} ×`, 690, y + 42, 28, { peso: 700, anclaje: "end" }) +
        texto(`${f.largo} × ${f.ancho} × ${f.grosor}`, W - 90, y + 42, 28, { peso: 500, anclaje: "end", color: "#40403A" })
    }).join("")
    const mas = filas.length > filasMostrar.length ? texto(`+ ${filas.length - filasMostrar.length} piezas más en el plano completo`, 60, y0 + filasMostrar.length * alto + 40, 28, { peso: 500, color: "#6B6A63" }) : ""
    return marco(
      etiqueta("LISTA DE CORTE") + titulo("Todas las piezas con su medida") +
      texto("Pieza", 90, 335, 24, { color: "#6B6A63" }) + texto("mm (largo × ancho × espesor)", W - 90, 335, 24, { color: "#6B6A63", anclaje: "end" }) +
      tabla + mas,
      3, total)
  }
  if (n === 4) {
    const hoja = acs[0]?.acomodo.hojas[0]
    return marco(
      etiqueta("ACOMODO EN LA HOJA") +
      titulo(`${nHojas} ${nHojas === 1 ? "hoja" : "hojas"} de triplay de 2440\u00A0×\u00A01220`) +
      (hoja ? encajar(svgHoja(hoja, nHojas > 1 ? `Hoja 1 de ${nHojas}` : "Hoja 1"), 60, 340, W - 120, 560) : "") +
      texto("Bájalo gratis en PDF y DXF", W / 2, 1000, 52, { anclaje: "middle", peso: 800 }) +
      texto("para cortarlo en router CNC", W / 2, 1062, 40, { anclaje: "middle", peso: 600, color: "#40403A" }) +
      texto("o pide que un taller HETNA te lo fabrique", W / 2, 1130, 32, { anclaje: "middle", peso: 600, color: "#B34D07" }),
      4, total)
  }
  return null
}
