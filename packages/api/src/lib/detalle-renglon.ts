// Lo que el cliente eligió en una pieza de Impresión 3D bajo pedido (metadata
// del renglón): el color, los colores de cada parte (variantes "· 2 colores") y
// el texto de un llavero o unas letras. Lo usan el correo del pedido y el panel
// del taller; la tienda tiene la misma regla en apps/storefront/src/lib/impresion/detalle-renglon.ts.
// Ya viene revisado al agregarlo (api/store/carts/texto-personalizado.ts).
const corto = (v: unknown, n = 40) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "")

export function detalleRenglon(metadata: Record<string, unknown> | null | undefined): [string, string][] {
  const m = metadata || {}
  const filas: [string, string][] = []
  const colores = m.colores && typeof m.colores === "object" && !Array.isArray(m.colores) ? (m.colores as Record<string, unknown>) : null
  if (colores) {
    for (const [parte, c] of Object.entries(colores).slice(0, 4)) if (corto(parte, 30) && corto(c, 24)) filas.push([corto(parte, 30), corto(c, 24)])
  } else if (corto(m.color, 24)) filas.push(["Color", corto(m.color, 24)])
  if (corto(m.texto)) filas.push(["Texto", `«${corto(m.texto)}»`])
  return filas
}
