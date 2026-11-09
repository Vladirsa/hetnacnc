// Las llamadas de la tienda al Social Hub llevan el mismo token que usa con n8n.
import { timingSafeEqual } from "crypto"

export function tokenValido(req: any) {
  const esperado = process.env.N8N_REDES_TOKEN || ""
  const dado = String(req.headers?.["x-hetna-token"] || "")
  if (!esperado || dado.length !== esperado.length) return false
  return timingSafeEqual(Buffer.from(dado), Buffer.from(esperado))
}
