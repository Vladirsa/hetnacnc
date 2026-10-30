// Comprobante de entrega de una compra digital (diseños CNC): un PDF de una
// página con la marca HETNA que va adjunto al correo de entrega y que el
// cliente puede volver a bajar desde Mi cuenta > Mis descargas.
//
// El PDF NO lleva el archivo ni una liga que caduque como única salida: apunta
// a Mis descargas, que genera una liga nueva en cada clic. Así el comprobante
// sigue sirviendo dentro de un año, aunque la liga del correo (7 días) ya no.
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"

export type ArchivoEntrega = { titulo: string; sku?: string | null; formato?: string | null }

export type DatosEntrega = {
  display_id: number | string
  fecha: Date
  correo: string
  archivos: ArchivoEntrega[]
  // Liga permanente a Mis descargas (sólo si la compra está ligada a una cuenta)
  liga_descargas: string | null
  // Liga directa del correo y hasta cuándo sirve (opcional)
  liga_directa_vence?: Date | null
  liga_terminos: string
  contacto: string
}

const NARANJA = rgb(0.761, 0.337, 0.039) // #C2560A
const TINTA = rgb(0.106, 0.106, 0.094) // #1B1B18
const GRIS = rgb(0.42, 0.416, 0.388) // #6B6A63
const LINEA = rgb(0.906, 0.894, 0.863) // #E7E4DC
const FONDO = rgb(0.98, 0.976, 0.965) // #FAF9F6

// Las fuentes estándar de PDF sólo traen WinAnsi (latín 1): acentos, ñ, ¿ y ¡
// sí; flechas, emojis o comillas raras no. Lo que no cabe se cambia o se quita
// para que un título con un símbolo extraño no tumbe la entrega.
export function textoSeguro(t: string): string {
  return String(t ?? "")
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[→⟶]/g, "->")
    .replace(/[‐-–]/g, "-")
    .replace(/[^\x20-\x7E -ÿ—•€]/g, "")
}

function partir(texto: string, fuente: PDFFont, tam: number, ancho: number): string[] {
  const lineas: string[] = []
  for (const parrafo of textoSeguro(texto).split("\n")) {
    let actual = ""
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = actual ? `${actual} ${palabra}` : palabra
      if (fuente.widthOfTextAtSize(prueba, tam) <= ancho || !actual) actual = prueba
      else {
        lineas.push(actual)
        actual = palabra
      }
    }
    lineas.push(actual)
  }
  return lineas
}

function ligar(pagina: PDFPage, x: number, y: number, w: number, h: number, url: string) {
  const anot = pagina.doc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [x, y, x + w, y + h],
    Border: [0, 0, 0],
    A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
  })
  const ref = pagina.doc.context.register(anot)
  const actuales = pagina.node.lookup(PDFName.of("Annots"))
  if (actuales && "push" in (actuales as any)) (actuales as any).push(ref)
  else pagina.node.set(PDFName.of("Annots"), pagina.doc.context.obj([ref]))
}

const fechaLarga = (d: Date) =>
  d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" })

export async function generarPdfEntrega(d: DatosEntrega): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(textoSeguro(`Comprobante de entrega - pedido #${d.display_id}`))
  pdf.setAuthor("HETNA")
  pdf.setCreator("hetnacnc.com")
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold)

  const A4: [number, number] = [595.28, 841.89]
  const M = 48
  const ANCHO = A4[0] - M * 2
  let pagina = pdf.addPage(A4)
  let y = A4[1]

  const nuevaSiFalta = (alto: number) => {
    if (y - alto < M + 30) {
      pagina = pdf.addPage(A4)
      y = A4[1] - M
    }
  }
  const parrafo = (texto: string, o: { tam?: number; fuente?: PDFFont; color?: ReturnType<typeof rgb>; sangria?: number; despues?: number } = {}) => {
    const tam = o.tam ?? 10.5
    const fuente = o.fuente ?? normal
    const x = M + (o.sangria ?? 0)
    for (const l of partir(texto, fuente, tam, ANCHO - (o.sangria ?? 0))) {
      nuevaSiFalta(tam + 4)
      y -= tam + 4
      pagina.drawText(l, { x, y, size: tam, font: fuente, color: o.color ?? TINTA })
    }
    y -= o.despues ?? 6
  }
  const titulo = (t: string) => {
    nuevaSiFalta(40)
    y -= 14
    pagina.drawText(textoSeguro(t), { x: M, y: y - 12, size: 12.5, font: negrita, color: NARANJA })
    y -= 20
  }
  const liga = (texto: string, url: string) => {
    const tam = 10.5
    nuevaSiFalta(tam + 6)
    y -= tam + 4
    const t = textoSeguro(texto)
    const w = Math.min(negrita.widthOfTextAtSize(t, tam), ANCHO)
    pagina.drawText(t, { x: M + 12, y, size: tam, font: negrita, color: NARANJA })
    pagina.drawLine({ start: { x: M + 12, y: y - 1.5 }, end: { x: M + 12 + w, y: y - 1.5 }, thickness: 0.6, color: NARANJA })
    ligar(pagina, M + 12, y - 3, w, tam + 4, url)
    y -= 6
  }

  // Encabezado
  pagina.drawRectangle({ x: 0, y: A4[1] - 92, width: A4[0], height: 92, color: NARANJA })
  pagina.drawText("HETNA", { x: M, y: A4[1] - 50, size: 26, font: negrita, color: rgb(1, 1, 1) })
  pagina.drawText("Comprobante de entrega digital", { x: M, y: A4[1] - 72, size: 12, font: normal, color: rgb(1, 1, 1) })
  const sitio = "hetnacnc.com"
  pagina.drawText(sitio, { x: A4[0] - M - normal.widthOfTextAtSize(sitio, 11), y: A4[1] - 50, size: 11, font: normal, color: rgb(1, 1, 1) })
  y = A4[1] - 92 - 26

  // Datos del pedido
  const datos: [string, string][] = [
    ["Pedido", `#${d.display_id}`],
    ["Fecha", fechaLarga(d.fecha)],
    ["Correo", d.correo],
  ]
  const altoCaja = datos.length * 18 + 16
  pagina.drawRectangle({ x: M, y: y - altoCaja, width: ANCHO, height: altoCaja, color: FONDO, borderColor: LINEA, borderWidth: 1 })
  let yy = y - 22
  for (const [k, v] of datos) {
    pagina.drawText(k, { x: M + 14, y: yy, size: 10, font: normal, color: GRIS })
    pagina.drawText(textoSeguro(v), { x: M + 90, y: yy, size: 10.5, font: negrita, color: TINTA })
    yy -= 18
  }
  y -= altoCaja + 4

  titulo(d.archivos.length === 1 ? "Tu archivo" : `Tus archivos (${d.archivos.length})`)
  for (const a of d.archivos) {
    const extra = [a.formato, a.sku ? `SKU ${a.sku}` : ""].filter(Boolean).join(" · ")
    parrafo(`•  ${a.titulo}`, { fuente: negrita, despues: extra ? 0 : 4 })
    if (extra) parrafo(extra, { tam: 9.5, color: GRIS, sangria: 12, despues: 4 })
  }

  titulo("Cómo descargarlo")
  if (d.liga_descargas) {
    parrafo("Entra a tu cuenta en hetnacnc.com, sección Mis descargas. Ahí están todas tus compras digitales y las puedes bajar las veces que quieras: cada clic genera una liga nueva.")
    liga("Abrir Mis descargas", d.liga_descargas)
  } else {
    parrafo(`Usa el botón del correo con el que te llegó este comprobante. Si ya no funciona, escríbenos a ${d.contacto} con tu número de pedido y te mandamos una liga nueva.`)
  }
  if (d.liga_directa_vence)
    parrafo(`El botón del correo funciona hasta el ${fechaLarga(d.liga_directa_vence)}.`, { tam: 9.5, color: GRIS })

  titulo("Antes de maquinar")
  for (const t of [
    "Abre el archivo en tu CAM y revisa que las unidades sean milímetros y la escala 1:1.",
    "Mide una cota conocida del dibujo antes de generar trayectorias.",
    "Ajusta la compensación de herramienta (o el kerf en láser y plasma) a tu máquina.",
    "Haz la primera pieza en material de prueba.",
  ])
    parrafo(`•  ${t}`, { despues: 2 })

  titulo("Licencia de uso")
  parrafo("Puedes fabricar las piezas según la descripción del producto. No se permite revender ni compartir el archivo en sí. El detalle está en los Términos y condiciones.")
  liga("Ver Términos y condiciones", d.liga_terminos)

  titulo("¿Algún problema con tu archivo?")
  parrafo(`Escríbenos a ${d.contacto} con tu número de pedido. Te ayudamos a abrirlo o lo resolvemos con el taller que lo publicó.`)

  // Pie en cada página
  for (const p of pdf.getPages()) {
    p.drawLine({ start: { x: M, y: M }, end: { x: A4[0] - M, y: M }, thickness: 0.6, color: LINEA })
    p.drawText(textoSeguro(`HETNA · hetnacnc.com · Pedido #${d.display_id}`), { x: M, y: M - 14, size: 8.5, font: normal, color: GRIS })
  }

  return pdf.save()
}
