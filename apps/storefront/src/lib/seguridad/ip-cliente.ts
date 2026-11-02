// IP real del cliente detrás de nginx: el ÚLTIMO valor de X-Forwarded-For
// (el que agrega nginx). Los anteriores los puede inventar el propio cliente.
export function ipDeCabecera(xff: string | null | undefined): string {
  const partes = String(xff || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  return (partes[partes.length - 1] || "").replace(/^::ffff:/, "").slice(0, 64)
}

export const ipDe = (h: { get(n: string): string | null }) => ipDeCabecera(h.get("x-forwarded-for"))
