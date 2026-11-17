// Importador de productos de la tienda HETNA: la plantilla de Excel y su lectura.
//
// Esta parte no toca Medusa: arma la plantilla, lee el Excel lleno, agrupa los
// renglones en productos con sus variantes y revisa cada renglón. Lo que sí
// necesita la base (categorías, si el producto ya existe) está en importar.ts.
//
// Un renglón = una variante (una medida, un color…). Los renglones con el mismo
// "Agrupador" (o el mismo nombre, si no hay agrupador) son UN producto con
// varias variantes. Los datos del producto (nombre, descripción, categoría,
// fotos…) se toman del primer renglón del grupo.
import ExcelJS from "exceljs"

export const HOJA = "Productos"

/** Columnas de la plantilla, en orden. `clave` es como la usa el código. */
export const COLUMNAS = [
  { clave: "agrupador", titulo: "Agrupador", ancho: 22, ayuda: "Opcional. Mismo texto en varios renglones = un producto con varias medidas. Si lo dejas vacío se agrupa por nombre." },
  { clave: "nombre", titulo: "Nombre del producto *", ancho: 40, ayuda: "Qué es, marca o material y la medida principal. 3 a 120 letras." },
  { clave: "descripcion", titulo: "Descripción", ancho: 50, ayuda: "Para qué sirve, materiales, compatibilidad. Renglones que empiezan con - se vuelven lista." },
  { clave: "categoria", titulo: "Categoría *", ancho: 28, ayuda: 'Como se llama en la tienda. Si hay dos iguales: "Padre > Hija".' },
  { clave: "marca", titulo: "Marca", ancho: 16, ayuda: "Opcional." },
  { clave: "variante", titulo: "Variante (qué cambia)", ancho: 20, ayuda: 'Ej. "Diámetro", "Color", "Longitud". Igual en todo el grupo. Vacío si sólo hay una presentación.' },
  { clave: "valor", titulo: "Valor de la variante", ancho: 18, ayuda: 'Ej. "6 mm", "Negro", "1 kg". Obligatorio si el grupo tiene más de un renglón.' },
  { clave: "sku", titulo: "SKU *", ancho: 18, ayuda: "Tu código. Único en todo el archivo; sirve para actualizar después." },
  { clave: "precio", titulo: "Precio MXN (IVA incluido) *", ancho: 18, ayuda: "El precio final que ve el cliente. La tienda no le suma IVA." },
  { clave: "existencias", titulo: "Existencias *", ancho: 12, ayuda: "Piezas disponibles (número entero, 0 o más)." },
  { clave: "peso", titulo: "Peso kg *", ancho: 10, ayuda: "Con empaque. La paquetería cotiza con esto." },
  { clave: "largo", titulo: "Largo cm *", ancho: 10, ayuda: "Del paquete." },
  { clave: "ancho", titulo: "Ancho cm *", ancho: 10, ayuda: "Del paquete." },
  { clave: "alto", titulo: "Alto cm *", ancho: 10, ayuda: "Del paquete." },
  { clave: "imagenes", titulo: "Imágenes (ligas)", ancho: 40, ayuda: "Ligas https a las fotos, separadas por coma. La primera es la portada." },
  { clave: "estado", titulo: "Estado", ancho: 12, ayuda: '"publicado" (se ve en la tienda) o "borrador". Vacío = publicado.' },
  { clave: "seo_titulo", titulo: "Título SEO", ancho: 30, ayuda: "Opcional. Lo que sale en Google (máx. 70 letras). Vacío = el nombre." },
  { clave: "seo_descripcion", titulo: "Descripción SEO", ancho: 40, ayuda: "Opcional. El texto bajo el título en Google (máx. 160 letras)." },
  { clave: "etiquetas", titulo: "Etiquetas", ancho: 24, ayuda: "Opcional. Palabras para la búsqueda, separadas por coma." },
] as const
export type Clave = (typeof COLUMNAS)[number]["clave"]

export type VarianteImport = {
  fila: number
  sku: string
  valor: string | null
  precio: number
  existencias: number
  peso_kg: number
  largo_cm: number
  ancho_cm: number
  alto_cm: number
}
export type ProductoImport = {
  handle: string
  agrupador_explicito: boolean // false = el handle salió del nombre (se reconoce por SKU si ya existe)
  nombre: string
  descripcion: string
  categoria: string
  marca: string | null
  opcion: string // nombre de la opción ("Presentación" si no hay variantes)
  imagenes: string[]
  estado: "published" | "draft"
  seo_titulo: string | null
  seo_descripcion: string | null
  etiquetas: string[]
  filas: number[]
  variantes: VarianteImport[]
}
export type Problema = { fila: number | null; columna?: string; mensaje: string }
export type Lectura = { productos: ProductoImport[]; errores: Problema[]; avisos: Problema[]; renglones: number }

export const PRESENTACION = "Presentación"
export const UNICA = "Única"

const EJEMPLOS: Partial<Record<Clave, string | number>>[] = [
  { agrupador: "fresa-recta-2-filos", nombre: "Fresa recta de carburo 2 filos para router CNC", descripcion: "Fresa de carburo sólido para MDF, triplay y acrílico.\n- Zanco de 1/4\"\n- Recubrimiento TiAlN", categoria: "Fresas", marca: "HETNA", variante: "Diámetro", valor: "3.175 mm", sku: "FR2F-3175", precio: 189, existencias: 25, peso: 0.05, largo: 12, ancho: 4, alto: 2, imagenes: "https://ejemplo.com/fresa-3175.jpg", estado: "publicado", seo_titulo: "Fresa recta 2 filos carburo para router CNC", seo_descripcion: "Fresa de carburo sólido de 2 filos para MDF, triplay y acrílico. Envío a todo México.", etiquetas: "fresa, carburo, router" },
  { agrupador: "fresa-recta-2-filos", nombre: "Fresa recta de carburo 2 filos para router CNC", categoria: "Fresas", variante: "Diámetro", valor: "6 mm", sku: "FR2F-6", precio: 249, existencias: 15, peso: 0.06, largo: 12, ancho: 4, alto: 2 },
  { nombre: "Aceite soluble para corte CNC 1 L", descripcion: "Refrigerante soluble para maquinado de aluminio y acero.", categoria: "Consumibles", marca: "HETNA", sku: "REF-1L", precio: 320, existencias: 40, peso: 1.1, largo: 10, ancho: 10, alto: 25, imagenes: "https://ejemplo.com/refrigerante.jpg" },
  { agrupador: "pla-1kg", nombre: "Filamento PLA 1.75 mm 1 kg", categoria: "Filamentos", variante: "Color", valor: "Negro", sku: "PLA-175-NEG", precio: 379, existencias: 30, peso: 1.3, largo: 21, ancho: 21, alto: 8, estado: "borrador" },
  { agrupador: "pla-1kg", nombre: "Filamento PLA 1.75 mm 1 kg", categoria: "Filamentos", variante: "Color", valor: "Blanco", sku: "PLA-175-BLA", precio: 379, existencias: 0, peso: 1.3, largo: 21, ancho: 21, alto: 8 },
]

function encabezado(ws: ExcelJS.Worksheet) {
  ws.columns = COLUMNAS.map((c) => ({ header: c.titulo, key: c.clave, width: c.ancho }))
  const f = ws.getRow(1)
  f.font = { bold: true, color: { argb: "FFFFFFFF" } }
  f.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF142033" } }
  f.alignment = { vertical: "middle", wrapText: true }
  f.height = 32
  ws.views = [{ state: "frozen", ySplit: 1 }]
  COLUMNAS.forEach((c, i) => { f.getCell(i + 1).note = c.ayuda })
}

/** La plantilla: hoja "Productos" vacía para llenar, "Ejemplos" (no se importa) e "Instrucciones". */
export async function plantillaProductos(categorias: string[] = []): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "HETNA CNC"
  const ws = wb.addWorksheet(HOJA)
  encabezado(ws)
  const ej = wb.addWorksheet("Ejemplos (no se importan)")
  encabezado(ej)
  for (const e of EJEMPLOS) ej.addRow(e)
  ej.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6B675C" } }

  const ins = wb.addWorksheet("Instrucciones")
  ins.getColumn(1).width = 34
  ins.getColumn(2).width = 100
  const t = ins.addRow(["Cómo llenar la plantilla"])
  t.font = { bold: true, size: 14 }
  for (const linea of [
    ["1.", 'Llena la hoja "Productos". La hoja "Ejemplos" es sólo para ver cómo se llena: NO se importa.'],
    ["2.", "Un renglón = una variante (una medida o un color). Si un producto viene en varias medidas, pon un renglón por medida con el mismo Agrupador."],
    ["3.", "Las columnas con * son obligatorias. Precio: el final con IVA incluido (la tienda no le suma IVA)."],
    ["4.", "Peso y medidas son del paquete ya empacado: con eso se cotiza el envío."],
    ["5.", "Al subir el archivo primero se revisa todo y ves los errores renglón por renglón. Nada se publica hasta que confirmas."],
    ["6.", "Si vuelves a subir un producto con el mismo Agrupador, se actualiza (nombre, descripción, precio, existencias…), no se duplica."],
    ["7.", "Las fotos se copian a la tienda desde las ligas que pongas. Usa ligas directas a la imagen (terminan en .jpg, .png o .webp)."],
  ]) ins.addRow(linea)
  ins.addRow([])
  ins.addRow(["Columna", "Qué poner"]).font = { bold: true }
  for (const c of COLUMNAS) ins.addRow([c.titulo, c.ayuda])
  if (categorias.length) {
    ins.addRow([])
    ins.addRow(["Categorías de la tienda", "Escríbelas tal cual (sin importar acentos ni mayúsculas)"]).font = { bold: true }
    for (const c of categorias) ins.addRow(["", c])
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}

// ── Lectura ──────────────────────────────────────────────────────────────

export const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()

export const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80)

const valorCelda = (v: unknown): unknown => {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>
    if ("result" in o) return o.result
    if ("text" in o) return o.text
    if ("richText" in o && Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((x) => x.text).join("")
    if ("hyperlink" in o) return o.text ?? o.hyperlink
  }
  return v
}
const texto = (v: unknown) => {
  const x = valorCelda(v)
  return x === null || x === undefined ? "" : String(x).trim()
}
/** "$1,234.50", "1234,5", 189 → número; null si no es número. */
export function numero(v: unknown): number | null {
  const x = valorCelda(v)
  if (typeof x === "number") return Number.isFinite(x) ? x : null
  let s = String(x ?? "").trim().replace(/[$\s]|mxn/gi, "")
  if (!s) return null
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "")
  else if (/^\d+,\d+$/.test(s)) s = s.replace(",", ".")
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const URL_OK = /^https?:\/\/[^\s]+$/i

/** Lee el Excel lleno: agrupa en productos y revisa cada renglón (sin tocar la base). */
export async function leerPlantilla(datos: Buffer): Promise<Lectura> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(datos as any)
  } catch {
    return { productos: [], errores: [{ fila: null, mensaje: "No se pudo abrir el archivo. Usa la plantilla en formato .xlsx." }], avisos: [], renglones: 0 }
  }
  const ws = wb.getWorksheet(HOJA) || wb.worksheets.find((w) => !/ejemplo|instrucc/i.test(w.name))
  if (!ws) return { productos: [], errores: [{ fila: null, mensaje: `No encontré la hoja "${HOJA}".` }], avisos: [], renglones: 0 }

  // Columnas por su título (aunque las hayan movido de lugar)
  const indice: Partial<Record<Clave, number>> = {}
  ws.getRow(1).eachCell((celda, col) => {
    const t = normalizar(texto(celda.value)).replace(/\s*\*$/, "")
    const c = COLUMNAS.find((x) => normalizar(x.titulo).replace(/\s*\*$/, "") === t || normalizar(x.clave) === t)
    if (c && !indice[c.clave]) indice[c.clave] = col
  })
  const errores: Problema[] = []
  const avisos: Problema[] = []
  for (const c of ["nombre", "categoria", "sku", "precio", "existencias", "peso", "largo", "ancho", "alto"] as Clave[]) {
    if (!indice[c]) errores.push({ fila: 1, columna: COLUMNAS.find((x) => x.clave === c)!.titulo, mensaje: "Falta esta columna en el archivo. Usa la plantilla." })
  }
  if (errores.length) return { productos: [], errores, avisos, renglones: 0 }

  type Renglon = Record<Clave, unknown> & { _fila: number }
  const renglones: Renglon[] = []
  ws.eachRow((row, n) => {
    if (n === 1) return
    const r = { _fila: n } as Renglon
    let vacio = true
    for (const c of COLUMNAS) {
      const col = indice[c.clave]
      r[c.clave] = col ? valorCelda(row.getCell(col).value) : null
      if (col && texto(r[c.clave])) vacio = false
    }
    if (!vacio) renglones.push(r)
  })
  if (!renglones.length) return { productos: [], errores: [{ fila: null, mensaje: 'La hoja "Productos" está vacía.' }], avisos, renglones: 0 }
  if (renglones.length > 2000) return { productos: [], errores: [{ fila: null, mensaje: "Máximo 2,000 renglones por archivo. Divídelo en varios." }], avisos, renglones: renglones.length }

  const skus = new Map<string, number>()
  const grupos = new Map<string, Renglon[]>()
  const err = (fila: number, clave: Clave, mensaje: string) => errores.push({ fila, columna: COLUMNAS.find((x) => x.clave === clave)!.titulo, mensaje })

  for (const r of renglones) {
    const f = r._fila
    const nombre = texto(r.nombre)
    if (nombre.length < 3 || nombre.length > 120) err(f, "nombre", "El nombre debe tener de 3 a 120 letras.")
    if (!texto(r.categoria)) err(f, "categoria", "Falta la categoría.")
    const sku = texto(r.sku).toUpperCase()
    if (!sku) err(f, "sku", "Falta el SKU.")
    else if (!/^[A-Z0-9][A-Z0-9._\-/]{1,59}$/.test(sku)) err(f, "sku", "El SKU sólo puede llevar letras, números, punto, guion y diagonal (2 a 60).")
    else if (skus.has(sku)) err(f, "sku", `SKU repetido (también está en el renglón ${skus.get(sku)}).`)
    else skus.set(sku, f)
    const precio = numero(r.precio)
    if (precio === null || precio <= 0) err(f, "precio", "El precio debe ser un número mayor a cero.")
    else if (precio > 1_000_000) err(f, "precio", "El precio es demasiado alto; revisa que no falte el punto decimal.")
    const ex = numero(r.existencias)
    if (ex === null || ex < 0 || !Number.isInteger(ex)) err(f, "existencias", "Las existencias deben ser un número entero, 0 o más.")
    const peso = numero(r.peso)
    if (peso === null || peso <= 0) err(f, "peso", "El peso (kg) debe ser mayor a cero.")
    else if (peso > 70) avisos.push({ fila: f, columna: "Peso kg", mensaje: "Más de 70 kg: las paqueterías normales no lo llevan; revisa que el peso esté en kg." })
    for (const d of ["largo", "ancho", "alto"] as Clave[]) {
      const v = numero(r[d])
      if (v === null || v <= 0) err(f, d, "La medida (cm) debe ser mayor a cero.")
    }
    for (const u of texto(r.imagenes).split(",").map((x) => x.trim()).filter(Boolean)) {
      if (!URL_OK.test(u)) err(f, "imagenes", `"${u.slice(0, 60)}" no es una liga https válida.`)
    }
    const est = normalizar(texto(r.estado))
    if (est && !["publicado", "borrador", "published", "draft"].includes(est)) err(f, "estado", 'Escribe "publicado" o "borrador".')
    const agrupador = texto(r.agrupador)
    if (agrupador && !slug(agrupador)) err(f, "agrupador", "El agrupador debe tener letras o números.")
    const clave = agrupador ? `a:${slug(agrupador)}` : `n:${normalizar(nombre)}`
    if (!grupos.has(clave)) grupos.set(clave, [])
    grupos.get(clave)!.push(r)
  }

  const productos: ProductoImport[] = []
  const handles = new Map<string, number>()
  for (const [, filas] of grupos) {
    const p0 = filas[0]
    const opcionTxt = texto(p0.variante)
    const varios = filas.length > 1
    if (varios && !opcionTxt) err(p0._fila, "variante", 'Este producto tiene varios renglones: di qué cambia entre ellos (ej. "Diámetro").')
    const valores = new Map<string, number>()
    for (const r of filas) {
      if (r !== p0) {
        if (texto(r.variante) && normalizar(texto(r.variante)) !== normalizar(opcionTxt)) err(r._fila, "variante", `En el mismo producto la variante debe ser igual a la del renglón ${p0._fila} ("${opcionTxt}").`)
        for (const c of ["nombre", "categoria", "descripcion", "imagenes", "marca"] as Clave[]) {
          const a = texto(p0[c]), b = texto(r[c])
          if (b && a && normalizar(a) !== normalizar(b)) avisos.push({ fila: r._fila, columna: COLUMNAS.find((x) => x.clave === c)!.titulo, mensaje: `Distinto al renglón ${p0._fila}; se usa el del renglón ${p0._fila} para todo el producto.` })
        }
      }
      const v = texto(r.valor)
      if (varios || opcionTxt) {
        if (!v) err(r._fila, "valor", "Falta el valor de la variante (ej. 6 mm, Negro).")
        else if (valores.has(normalizar(v))) err(r._fila, "valor", `Valor repetido en el mismo producto (renglón ${valores.get(normalizar(v))}).`)
        else valores.set(normalizar(v), r._fila)
      }
    }
    const handle = slug(texto(p0.agrupador) || texto(p0.nombre)) || "producto"
    if (handles.has(handle)) err(p0._fila, "agrupador", `Choca con el producto del renglón ${handles.get(handle)} (mismo identificador "${handle}"). Usa un agrupador distinto.`)
    handles.set(handle, p0._fila)
    const seoT = texto(p0.seo_titulo), seoD = texto(p0.seo_descripcion)
    if (seoT.length > 70) avisos.push({ fila: p0._fila, columna: "Título SEO", mensaje: "Más de 70 letras: Google lo corta." })
    if (seoD.length > 160) avisos.push({ fila: p0._fila, columna: "Descripción SEO", mensaje: "Más de 160 letras: Google lo corta." })
    const est = normalizar(texto(p0.estado))
    productos.push({
      handle,
      agrupador_explicito: Boolean(texto(p0.agrupador)),
      nombre: texto(p0.nombre),
      descripcion: texto(p0.descripcion),
      categoria: texto(p0.categoria),
      marca: texto(p0.marca) || null,
      opcion: opcionTxt || PRESENTACION,
      imagenes: texto(p0.imagenes).split(",").map((x) => x.trim()).filter((u) => URL_OK.test(u)).slice(0, 10),
      estado: est === "borrador" || est === "draft" ? "draft" : "published",
      seo_titulo: seoT || null,
      seo_descripcion: seoD || null,
      etiquetas: texto(p0.etiquetas).split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 10),
      filas: filas.map((r) => r._fila),
      variantes: filas.map((r) => ({
        fila: r._fila,
        sku: texto(r.sku).toUpperCase(),
        valor: opcionTxt || varios ? texto(r.valor) || null : null,
        precio: Math.round((numero(r.precio) ?? 0) * 100) / 100,
        existencias: Math.max(0, Math.trunc(numero(r.existencias) ?? 0)),
        peso_kg: numero(r.peso) ?? 0,
        largo_cm: numero(r.largo) ?? 0,
        ancho_cm: numero(r.ancho) ?? 0,
        alto_cm: numero(r.alto) ?? 0,
      })),
    })
  }
  errores.sort((a, b) => (a.fila ?? 0) - (b.fila ?? 0))
  return { productos, errores, avisos, renglones: renglones.length }
}
