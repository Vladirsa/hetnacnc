// Lo que el cliente eligió en una pieza de Impresión 3D bajo pedido, para
// mostrarlo junto al renglón del carrito: el color, los colores de cada parte
// (variantes "· 2 colores") y el texto de un llavero o unas letras. El API lo
// revisa al agregarlo (packages/api/src/api/store/carts/texto-personalizado.ts);
// el correo usa la misma regla en packages/api/src/lib/correo-pedidos.ts.
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
