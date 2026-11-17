// Cliente mínimo de la API de Stripe (REST con fetch, sin SDK).
//
// Stripe México: la cuenta es de HETNA (persona física con actividad empresarial).
// Las tarjetas mexicanas se cobran en MXN; también hay OXXO, SPEI y meses sin intereses.
//
// Variables (.env de packages/api):
//   STRIPE_SECRET_KEY   sk_live_… (o sk_test_… para probar). Stripe > Desarrolladores > Claves de API.
//
// No se confía en los avisos (webhooks): siempre se vuelve a consultar el objeto
// a Stripe con esta llave, igual que con Mercado Pago y PayPal.
const API = "https://api.stripe.com/v1"

export const stripeKey = () => (process.env.STRIPE_SECRET_KEY || "").trim()
export const stripeListo = () => /^sk_(live|test)_/.test(stripeKey())
export const stripeModoPrueba = () => stripeKey().startsWith("sk_test_")

export class ErrorStripe extends Error {
  constructor(mensaje: string, public status = 502, public codigo?: string) { super(mensaje) }
}

/** Convierte un objeto anidado al formato de formulario de Stripe: a[b][0][c]=1 */
export function formulario(obj: Record<string, unknown>, prefijo = ""): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    const clave = prefijo ? `${prefijo}[${k}]` : k
    if (Array.isArray(v)) {
      v.forEach((x, i) => {
        if (x !== null && typeof x === "object") out.push(...formulario(x as Record<string, unknown>, `${clave}[${i}]`))
        else out.push(`${encodeURIComponent(`${clave}[${i}]`)}=${encodeURIComponent(String(x))}`)
      })
    } else if (typeof v === "object") out.push(...formulario(v as Record<string, unknown>, clave))
    else out.push(`${encodeURIComponent(clave)}=${encodeURIComponent(String(v))}`)
  }
  return out
}

export async function stripe<T = any>(ruta: string, opciones: { metodo?: "GET" | "POST" | "DELETE"; datos?: Record<string, unknown>; idempotencia?: string } = {}): Promise<T> {
  if (!stripeListo()) throw new ErrorStripe("El pago con tarjeta (Stripe) todavía no está activo.", 503)
  const metodo = opciones.metodo || (opciones.datos ? "POST" : "GET")
  const cuerpo = opciones.datos ? formulario(opciones.datos).join("&") : ""
  const url = metodo === "GET" && cuerpo ? `${API}${ruta}${ruta.includes("?") ? "&" : "?"}${cuerpo}` : `${API}${ruta}`
  const r = await fetch(url, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      ...(metodo !== "GET" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(opciones.idempotencia ? { "Idempotency-Key": opciones.idempotencia } : {}),
    },
    body: metodo !== "GET" && cuerpo ? cuerpo : undefined,
    signal: AbortSignal.timeout(20_000),
  })
  const d = (await r.json().catch(() => ({}))) as any
  if (!r.ok) throw new ErrorStripe(d?.error?.message || `Stripe respondió ${r.status}`, r.status >= 500 ? 502 : 400, d?.error?.code)
  return d as T
}
