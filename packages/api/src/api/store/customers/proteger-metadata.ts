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
  // Recomienda y gana (lib/cupones.ts): quién lo recomendó y su recompensa
  "codigo_recomienda",
  "referido_por",
  "referido_en",
  "recompensa_referido_en",
  "recompensa_referido_cupon",
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

export const storeCustomersMiddlewares: MiddlewareRoute[] = [
  { method: ["POST"], matcher: "/store/customers", middlewares: [proteger(false)] },
  { method: ["POST"], matcher: "/store/customers/me", middlewares: [authenticate("customer", ["session", "bearer"]), proteger(true)] },
]
