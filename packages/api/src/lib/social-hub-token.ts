// Las llamadas de la tienda al Social Hub llevan el mismo token que usa con n8n.
import { timingSafeEqual } from "crypto"

export function tokenValido(req: any) {
  // Sin espacios ni comillas de sobra (en un .env es fácil que se cuelen)
  const limpio = (v: string) => String(v || "").trim().replace(/^["']|["']$/g, "")
  const esperado = limpio(process.env.N8N_REDES_TOKEN || "")
  const dado = limpio(String(req.headers?.["x-hetna-token"] || ""))
  if (!esperado || dado.length !== esperado.length) return false
  return timingSafeEqual(Buffer.from(dado), Buffer.from(esperado))
}
