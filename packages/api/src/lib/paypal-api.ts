// Llamadas a la API REST de PayPal con las credenciales de la tienda
// (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET y PAYPAL_SANDBOX, las mismas del
// proveedor de pago de modules/paypal). Lo usan las suscripciones del Cotizador.

const base = () =>
  process.env.PAYPAL_SANDBOX === "true" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com"

export const paypalListo = () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)

let token: { valor: string; vence: number } | null = null

async function tokenPaypal(): Promise<string> {
  if (token && token.vence > Date.now() + 60_000) return token.valor
  const credencial = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64")
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${credencial}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000),
  })
  const cuerpo = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string }
  if (!res.ok || !cuerpo.access_token) throw new Error(`PayPal: ${cuerpo.error_description || `HTTP ${res.status}`}`)
  token = { valor: cuerpo.access_token, vence: Date.now() + (cuerpo.expires_in || 3000) * 1000 }
  return token.valor
}

/** Llama a PayPal; devuelve el JSON (o {} si la respuesta viene vacía, p. ej. 204). */
export async function paypal<T = any>(ruta: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${base()}${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await tokenPaypal()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15_000),
  })
  const texto = await res.text()
  let cuerpo: any = {}
  try {
    cuerpo = texto ? JSON.parse(texto) : {}
  } catch {
    cuerpo = {}
  }
  if (!res.ok) {
    const detalle = cuerpo?.details?.[0]?.description || cuerpo?.message || cuerpo?.name || `HTTP ${res.status}`
    throw new Error(`PayPal: ${detalle}`)
  }
  return cuerpo as T
}
