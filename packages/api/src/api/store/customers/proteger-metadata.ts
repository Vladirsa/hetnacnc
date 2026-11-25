// Datos de la cuenta del cliente que sólo escribe el servidor.
//
// Medusa deja que el cliente mande "metadata" libre al crear su cuenta
// (POST /store/customers) y al editarla (POST /store/customers/me). Sin esto,
// cualquiera se registraba con un correo ajeno y mandaba
// metadata.correo_verificado = true: se saltaba la confirmación de correo y,
// con ella, entraba al taller del Cotizador ligado a ese correo
// (lib/cotizador-vinculo.ts) y a las descargas gratis.
//
// Aquí esas llaves se reemplazan siempre por las que ya tiene guardadas la
// cuenta (al crear, se quitan). Sólo las pone el servidor, al abrir la liga
// firmada (api/hooks/verificar-correo).
import { authenticate } from "@medusajs/framework/http"
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

const PROTEGIDAS = [
  "correo_verificado",
  "correo_verificado_en",
  // Intentos fallidos del código de 6 dígitos (lib/verificar-correo.ts)
  "codigo_fallos",
  // Recomienda y gana (lib/cupones.ts): quién lo recomendó y su recompensa
  "codigo_recomienda",
  "referido_por",
  "referido_en",
  "recompensa_referido_en",
  "recompensa_referido_cupon",
  // Número de afiliación (lib/afiliacion.ts)
  "afiliacion",
  // Membresía Empresarial (lib/confianza.ts): la activa HETNA, no el cliente
  // (auditoría Thermos, 15 nov 2026)
  "membresia_empresarial",
]

type Meta = Record<string, unknown>
const objeto = (v: unknown): Meta => (v && typeof v === "object" && !Array.isArray(v) ? (v as Meta) : {})

function blindar(nueva: Meta, guardada: Meta): Meta {
  const out: Meta = { ...nueva }
  for (const k of PROTEGIDAS) {
    if (k in guardada) out[k] = guardada[k]
    else delete out[k]
  }
  return out
}

function proteger(conCuenta: boolean) {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const r = req as unknown as {
      body?: Meta
      validatedBody?: Meta
      auth_context?: { actor_id?: string }
    }
    const toca = (b?: Meta) => !!b && "metadata" in b
    if (!toca(r.body) && !toca(r.validatedBody)) return next()
    try {
      let guardada: Meta = {}
      const id = r.auth_context?.actor_id
      if (conCuenta && id) {
        const clientes = req.scope.resolve(Modules.CUSTOMER) as {
          retrieveCustomer: (id: string) => Promise<{ metadata?: Meta | null }>
        }
        guardada = objeto((await clientes.retrieveCustomer(id))?.metadata)
      }
      // Se blinda el cuerpo crudo y el ya validado: no importa en qué orden
      // corran este middleware y el validador de Medusa.
      if (toca(r.body)) r.body!.metadata = blindar(objeto(r.body!.metadata), guardada)
      if (toca(r.validatedBody)) r.validatedBody!.metadata = blindar(objeto(r.validatedBody!.metadata), guardada)
      next()
    } catch {
      // Si no se puede leer la cuenta, no se deja pasar el cambio de metadata
      res.status(503).json({ message: "No se pudo guardar en este momento. Intenta de nuevo." })
    }
  }
}

// Nombre y apellidos obligatorios al crear la cuenta (25 nov 2026). El
// formulario ya los pedía, pero sólo en el navegador: un robot que llamaba
// directo a la API (o una cuenta que quedó a medias y se completaba al iniciar
// sesión) quedaba registrada sin nombre. Debe traer al menos una letra.
const LETRA = /\p{L}/u
export function nombreValido(v: unknown): boolean {
  const t = typeof v === "string" ? v.trim() : ""
  return t.length >= 1 && t.length <= 80 && LETRA.test(t) && !/[<>{}]|https?:|www\./i.test(t)
}

function exigirNombre(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const b = ((req as unknown as { body?: Meta }).body ?? {}) as Meta
  if (!nombreValido(b.first_name) || !nombreValido(b.last_name)) {
    return res.status(400).json({ type: "invalid_data", message: "Escribe tu nombre y tus apellidos para crear tu cuenta." })
  }
  b.first_name = String(b.first_name).trim()
  b.last_name = String(b.last_name).trim()
  next()
}

export const storeCustomersMiddlewares: MiddlewareRoute[] = [
  { method: ["POST"], matcher: "/store/customers", middlewares: [exigirNombre, proteger(false)] },
  { method: ["POST"], matcher: "/store/customers/me", middlewares: [authenticate("customer", ["session", "bearer"]), proteger(true)] },
]
