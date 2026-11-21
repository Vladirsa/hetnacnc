// Lo que la API pública de la tienda NUNCA debe mostrar de un taller
// (auditoría legal del 20 nov 2026, punto C: "no basta con escribir que un
// dato es privado: el servidor debe impedir el acceso").
//
// Las rutas públicas de Mercur (/store/sellers, /store/products, /store/offers…)
// aceptan ?fields= libre: con `*seller` o `fields=email,payment_details.*` se
// podían pedir el correo, el teléfono, la cuenta bancaria y la metadata
// privada del taller (IP y navegador con que aceptó los términos, datos de la
// tarjeta verificada, consentimiento bancario…). Aquí se limpia la respuesta,
// pida lo que pida el cliente: el taller sólo se ve con sus datos públicos.
// Los pedidos del propio cliente (/store/orders) no pasan por aquí.
import type { MedusaNextFunction, MedusaRequest, MedusaResponse, MiddlewareRoute } from "@medusajs/framework/http"

// Columnas y relaciones del taller que se quitan siempre
const CAMPOS_PRIVADOS = ["email", "phone", "payment_details", "members", "member_invites", "onboarding", "address", "tax_id"]

// Llaves de metadata que sólo escribe y lee el servidor o el propio taller
const METADATA_PRIVADA =
  /^(terminos_|consentimiento_|correo|tarjeta|requisitos_|referido_|aviso_|encuesta_|bienvenida_|felicitado_|whatsapp|telefono|tel$|email|rfc|curp|clabe|cuenta|banco|ip$|direccion|domicilio|plan_vence)/i

type Obj = Record<string, unknown>
const esObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v)

export function limpiarTaller(s: unknown): unknown {
  if (!esObj(s)) return s
  const out: Obj = { ...s }
  for (const k of CAMPOS_PRIVADOS) delete out[k]
  if (esObj(out.metadata)) {
    const m: Obj = {}
    for (const [k, v] of Object.entries(out.metadata)) if (!METADATA_PRIVADA.test(k)) m[k] = v
    out.metadata = m
  }
  return out
}

/** Recorre la respuesta y limpia todo objeto que esté bajo "seller" o "sellers". */
export function limpiarRespuesta(v: unknown, esTaller = false, prof = 0): unknown {
  if (prof > 8 || v == null || typeof v !== "object") return v
  if (Array.isArray(v)) return v.map((x) => limpiarRespuesta(x, esTaller, prof + 1))
  const base = esTaller ? (limpiarTaller(v) as Obj) : (v as Obj)
  const out: Obj = {}
  for (const [k, x] of Object.entries(base)) {
    const hijoTaller = k === "seller" || k === "sellers"
    out[k] = hijoTaller ? limpiarRespuesta(x, true, prof + 1) : esTaller && k === "metadata" ? x : limpiarRespuesta(x, false, prof + 1)
  }
  return out
}

function proteger(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const original = res.json.bind(res)
  res.json = ((cuerpo: unknown) => {
    try {
      return original(limpiarRespuesta(cuerpo))
    } catch {
      // Si algo falla al limpiar, no se manda nada del taller
      return original({ message: "No se pudo cargar en este momento." })
    }
  }) as typeof res.json
  next()
}

export const storeVendedoresMiddlewares: MiddlewareRoute[] = ["/store/sellers*", "/store/products*", "/store/offers*", "/store/product-categories*", "/store/collections*"].map(
  (matcher) => ({ matcher, method: ["GET"], middlewares: [proteger] })
)
