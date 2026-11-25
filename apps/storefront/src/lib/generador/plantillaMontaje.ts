// Plantilla de montaje a tamaño real (PDF) para colgar letras en la pared:
// el contorno de cada letra en su lugar, con la cruz de cada barreno donde va
// el clavo o la pija. Si no cabe en una hoja se reparte en varias hojas carta
// con 1 cm de traslape, numeradas (A1, A2…) y con marcas para empatarlas.
// Una barra de 10 cm en cada hoja sirve para revisar que se imprimió al 100 %.
import type { MarcaMontaje } from "@/lib/generador/letras3dImpresion"
import type { P } from "@/lib/generador/vectores"

const MM = 72 / 25.4 // puntos PDF por mm
const HOJA = { w: 215.9, h: 279.4 } // carta, mm
const ORILLA = 10 // mm sin imprimir en la orilla de la hoja
const TRASLAPE = 10 // mm que se repiten entre hojas vecinas

export type Plantilla = { letras: { letra: string; contornos: P[][] }[]; barrenos: MarcaMontaje[]; titulo: string }

/** Cómo se reparte el dibujo en hojas (puro, para probarlo). */
export function repartoHojas(ancho: number, alto: number) {
  const utilW = HOJA.w - 2 * ORILLA, utilH = HOJA.h - 2 * ORILLA - 14 // 14 mm para el pie de la hoja
  const paso = (u: number) => u - TRASLAPE
  const columnas = Math.max(1, Math.ceil((ancho - TRASLAPE) / paso(utilW)))
  const filas = Math.max(1, Math.ceil((alto - TRASLAPE) / paso(utilH)))
  return { columnas, filas, utilW, utilH, pasoX: paso(utilW), pasoY: paso(utilH) }
}

export async function plantillaMontaje(p: Plantilla): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")
  const doc = await PDFDocument.create()
  const letra = await doc.embedFont(StandardFonts.Helvetica)
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold)

  const todos = p.letras.flatMap((l) => l.contornos.flat())
  const x0 = Math.min(...todos.map((q) => q[0])) - 15, x1 = Math.max(...todos.map((q) => q[0])) + 15
  const y0 = Math.min(...todos.map((q) => q[1])) - 15, y1 = Math.max(...todos.map((q) => q[1])) + 15
  const r = repartoHojas(x1 - x0, y1 - y0)
  const filas = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

  for (let f = 0; f < r.filas; f++)
    for (let c = 0; c < r.columnas; c++) {
      const hoja = doc.addPage([HOJA.w * MM, HOJA.h * MM])
      // ventana del dibujo que cae en esta hoja (filas de arriba hacia abajo)
      const vx0 = x0 + c * r.pasoX
      const vy1 = y1 - f * r.pasoY
      const aHoja = ([x, y]: P) => ({ x: (ORILLA + (x - vx0)) * MM, y: (ORILLA + 14 + (y - (vy1 - r.utilH))) * MM })
      const dentro = ([x, y]: P) => x >= vx0 - 1 && x <= vx0 + r.utilW + 1 && y <= vy1 + 1 && y >= vy1 - r.utilH - 1

      // contornos (recortados a la ventana: se dibuja cada lado con algún punto dentro)
      for (const l of p.letras)
        for (const cont of l.contornos)
          for (let i = 0; i < cont.length; i++) {
            const a = cont[i], b = cont[(i + 1) % cont.length]
            if (!dentro(a) && !dentro(b)) continue
            hoja.drawLine({ start: aHoja(a), end: aHoja(b), thickness: 0.8, color: rgb(0.1, 0.13, 0.2) })
          }
      // barrenos: cruz y círculo de 6 mm
      for (const m of p.barrenos) {
        if (!dentro([m.x, m.y])) continue
        const q = aHoja([m.x, m.y])
        const d = 8 * MM
        hoja.drawLine({ start: { x: q.x - d, y: q.y }, end: { x: q.x + d, y: q.y }, thickness: 0.8, color: rgb(0.76, 0.34, 0.04) })
        hoja.drawLine({ start: { x: q.x, y: q.y - d }, end: { x: q.x, y: q.y + d }, thickness: 0.8, color: rgb(0.76, 0.34, 0.04) })
        hoja.drawCircle({ x: q.x, y: q.y, size: 3 * MM, borderColor: rgb(0.76, 0.34, 0.04), borderWidth: 0.8 })
      }
      // marco del área útil y marcas de empate en las esquinas
      hoja.drawRectangle({ x: ORILLA * MM, y: (ORILLA + 14) * MM, width: r.utilW * MM, height: r.utilH * MM, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.4, borderDashArray: [3, 3] })
      // pie: nombre de la hoja, cómo empatar y la barra de 10 cm
      const nombre = `${filas[f % 26]}${c + 1}`
      hoja.drawText(nombre, { x: ORILLA * MM, y: (ORILLA + 4) * MM, size: 14, font: negrita })
      hoja.drawText(`${p.titulo} · hoja ${nombre} de ${r.filas * r.columnas} · imprime al 100 % (sin "ajustar a la hoja"); las hojas se enciman 1 cm`, {
        x: (ORILLA + 12) * MM, y: (ORILLA + 5.5) * MM, size: 7, font: letra, color: rgb(0.3, 0.3, 0.3),
      })
      hoja.drawText("Cruz naranja: ahí va el clavo o la pija. Mide la barra: debe dar 10 cm.", { x: (ORILLA + 12) * MM, y: (ORILLA + 1.5) * MM, size: 7, font: letra, color: rgb(0.3, 0.3, 0.3) })
      const bx = HOJA.w - ORILLA - 100
      hoja.drawRectangle({ x: bx * MM, y: (ORILLA + 2) * MM, width: 100 * MM, height: 3 * MM, color: rgb(0.1, 0.13, 0.2) })
      hoja.drawText("10 cm", { x: (bx + 42) * MM, y: (ORILLA + 6.5) * MM, size: 7, font: negrita })
    }
  return doc.save()
}
