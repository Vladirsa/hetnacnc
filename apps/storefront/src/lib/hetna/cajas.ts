// Cajas de madera y acrílico: catálogo y parámetros del servicio de cajas
// (infra/cajas, motor Boxes.py). Sólo lo usa el servidor; el navegador pide
// las vistas previas y descargas por /api/cajas/..., que reenvía al servicio.
//
// Sin CAJAS_URL (o con el servicio caído) todo devuelve vacío y las páginas
// muestran "próximamente" en vez de fallar.

export const CAJAS_URL = process.env.CAJAS_URL || ""

export type GrupoCajas = { id: string; nombre: string }
export type GeneradorCajas = {
  id: string
  nombre: string
  descripcion: string
  grupo: string
  grupoNombre: string
  miniatura: string
}
export type ArgCajas = {
  nombre: string
  etiqueta: string
  tipo: "bool" | "borde" | "int" | "float" | "texto"
  default: string | number | boolean | null
  ayuda: string
  opciones: { valor: string; nombre: string }[] | null
}
export type EsquemaCajas = GeneradorCajas & {
  grupos: { titulo: string; args: ArgCajas[] }[]
  formatos: string[]
}

// Descripciones y orden de los grupos en la tienda (lo demás viene del servicio)
export const TEXTO_GRUPOS: Record<string, { texto: string; color: string }> = {
  cajas: { texto: "Con juntas de dedo, bisagras, cajones, tapas corredizas, cierres y divisores.", color: "#FF6A1A" },
  "cajas-curvas": { texto: "Paredes flexibles con cortes vivos: redondas, ovaladas, con persiana.", color: "#F97316" },
  bandejas: { texto: "Organizadores, insertos para cajones, Gridfinity y portabrocas.", color: "#19B374" },
  estantes: { texto: "Repisas, exhibidores, especieros, botelleros y soportes.", color: "#0EA5E9" },
  pared: { texto: "Tableros ranurados, ganchos, portaherramientas y repisas de pared.", color: "#7C3AED" },
  agujeros: { texto: "Patrones de barrenos para ventiladores, motores Nema y paneles.", color: "#64748B" },
  piezas: { texto: "Engranajes, poleas, bisagras, brazos y mecanismos.", color: "#E11D74" },
  varios: { texto: "Lámparas, atriles, torres de dados, casas de pájaros, teclados y más.", color: "#FFC53D" },
}

// Los generadores que más busca la gente, primero en el catálogo
export const DESTACADOS = ["UniversalBox", "ClosedBox", "HingeBox", "SlidingLidBox", "SlidingDrawer", "DividerTray", "TypeTray", "RoundedBox", "FlexBox", "TwoPiece", "DisplayShelf", "Planetary"]

const cabeceras = { headers: { Accept: "application/json" }, next: { revalidate: 3600 } } as const

export async function listarCajas(): Promise<{ grupos: GrupoCajas[]; generadores: GeneradorCajas[] }> {
  if (!CAJAS_URL) return { grupos: [], generadores: [] }
  try {
    const r = await fetch(`${CAJAS_URL}/generadores`, cabeceras)
    if (!r.ok) return { grupos: [], generadores: [] }
    return (await r.json()) as { grupos: GrupoCajas[]; generadores: GeneradorCajas[] }
  } catch {
    return { grupos: [], generadores: [] }
  }
}

export async function esquemaCaja(id: string): Promise<EsquemaCajas | null> {
  if (!CAJAS_URL || !/^[A-Za-z0-9]+$/.test(id)) return null
  try {
    const r = await fetch(`${CAJAS_URL}/generadores/${id}`, cabeceras)
    if (!r.ok) return null
    return (await r.json()) as EsquemaCajas
  } catch {
    return null
  }
}

// Formatos que se ofrecen al cliente, con su nombre y para qué sirven
export const FORMATOS: { id: string; nombre: string; para: string }[] = [
  { id: "dxf", nombre: "DXF", para: "Router CNC, plasma y la mayoría de los programas" },
  { id: "svg", nombre: "SVG", para: "Láser, Inkscape, Illustrator" },
  { id: "pdf", nombre: "PDF", para: "Imprimir a escala o plotter" },
  { id: "lbrn2", nombre: "LightBurn", para: "Abre directo en LightBurn" },
]
