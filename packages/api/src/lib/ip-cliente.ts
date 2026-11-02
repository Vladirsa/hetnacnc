// IP real del cliente detrás de nginx.
//
// nginx AGREGA la IP de quien se conectó al final de X-Forwarded-For
// ($proxy_add_x_forwarded_for), así que lo que venga antes lo pudo escribir el
// propio cliente para hacerse pasar por otro. Por eso se toma el ÚLTIMO valor,
// no el primero. Sin cabecera (llamada directa al puerto), req.ip.
export function ipDeCabecera(xff: string | string[] | null | undefined, respaldo?: string | null): string {
  const valor = Array.isArray(xff) ? xff.join(",") : String(xff || "")
  const partes = valor
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const ip = partes[partes.length - 1] || String(respaldo || "").trim()
  return ip.replace(/^::ffff:/, "").slice(0, 64) || "desconocida"
}

export const ipCliente = (req: { headers: Record<string, any>; ip?: string }) =>
  ipDeCabecera(req.headers["x-forwarded-for"], req.ip)
