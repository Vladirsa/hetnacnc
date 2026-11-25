// El Texturizador se puede abrir con un diseño ya cargado desde la liga
// (/disenar/texturizador?forma=rodillo&palabras=SOFIA&iconos=estrella,luna…).
// Lo usan las fichas de "Impresión 3D bajo pedido" para "Descargar gratis o
// modificar las medidas", y el catálogo para generar sus piezas.
import { ICONOS_TEXTURA, type IconoTextura } from "./texturizador"

export type DisenoTexturizador = {
  forma: "placa" | "rodillo"
  palabras: string[]
  iconos: IconoTextura[]
  fuente: string
  tamano: number
  espacioX: number
  espacioY: number
  acomodo: "cuadricula" | "intercalado"
  orilla: number
  relieve: number
  modo: "alto" | "bajo"
  espejo: boolean
  // placa
  ancho: number
  alto: number
  radio: number
  grosor: number
  // rodillo
  diametro: number
  largo: number
  eje: number
}

const NUMEROS = ["tamano", "espacioX", "espacioY", "orilla", "relieve", "ancho", "alto", "radio", "grosor", "diametro", "largo", "eje"] as const

/** Sólo lo que se dio (el resto lo pone la herramienta). */
export function aUrl(d: Partial<DisenoTexturizador>): string {
  const q = new URLSearchParams()
  if (d.forma) q.set("forma", d.forma)
  if (d.palabras) q.set("palabras", d.palabras.join(","))
  if (d.iconos) q.set("iconos", d.iconos.join(","))
  if (d.fuente) q.set("fuente", d.fuente)
  if (d.acomodo) q.set("acomodo", d.acomodo)
  if (d.modo) q.set("modo", d.modo)
  if (d.espejo !== undefined) q.set("espejo", d.espejo ? "1" : "0")
  for (const k of NUMEROS) if (typeof d[k] === "number") q.set(k, String(d[k]))
  return q.toString()
}

/** Lee la liga; ignora lo que no sea válido. */
export function deUrl(busqueda: string): Partial<DisenoTexturizador> {
  const q = new URLSearchParams(busqueda)
  const d: Partial<DisenoTexturizador> = {}
  const forma = q.get("forma")
  if (forma === "placa" || forma === "rodillo") d.forma = forma
  if (q.has("palabras")) d.palabras = (q.get("palabras") || "").split(",").map((p) => p.trim().slice(0, 20)).filter(Boolean).slice(0, 6)
  if (q.has("iconos")) {
    const validos = new Set(ICONOS_TEXTURA.map((i) => i.id))
    d.iconos = (q.get("iconos") || "").split(",").filter((i): i is IconoTextura => validos.has(i as IconoTextura))
  }
  const fuente = q.get("fuente")
  if (fuente && /^[a-z0-9-]{2,40}$/.test(fuente)) d.fuente = fuente
  const acomodo = q.get("acomodo")
  if (acomodo === "cuadricula" || acomodo === "intercalado") d.acomodo = acomodo
  const modo = q.get("modo")
  if (modo === "alto" || modo === "bajo") d.modo = modo
  if (q.has("espejo")) d.espejo = q.get("espejo") !== "0"
  for (const k of NUMEROS) {
    const n = Number(q.get(k))
    if (q.has(k) && Number.isFinite(n) && n >= 0 && n <= 1000) d[k] = n
  }
  return d
}
