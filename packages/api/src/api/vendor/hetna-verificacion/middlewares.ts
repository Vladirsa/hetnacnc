// Middlewares de la verificación de talleres.
//
// 1) Subida de documentos: lee el formulario con el archivo (máx. 8 MB, uno por vez).
//
// 2) Datos protegidos del taller: desde su panel, un taller guarda su perfil en
//    metadata (POST /vendor/sellers/me). Sin esta protección podría escribir él
//    mismo "verificado: true", "fundador: true" o su calificación. Aquí esas
//    llaves se reemplazan siempre por las que ya tiene guardadas: solo el
//    administrador las cambia.
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http"
import { MercurModules } from "@mercurjs/types"

import { leerMultipart } from "../../cam-multipart"
import { MAX_MB } from "../../../lib/verificacion-archivos"

const PROTEGIDAS = ["verificado", "verificado_desde", "fundador", "fundador_desde", "plan_pro_hasta", "prueba"]
const PROTEGIDAS_PERFIL = ["calificacion", "resenas"]

type Meta = Record<string, unknown>
const objeto = (v: unknown): Meta => (v && typeof v === "object" && !Array.isArray(v) ? (v as Meta) : {})

function blindar(nueva: Meta, guardada: Meta): Meta {
  const out: Meta = { ...nueva }
  for (const k of PROTEGIDAS) {
    if (k in guardada) out[k] = guardada[k]
    else delete out[k]
  }
  if ("perfil" in out) {
    const perfil = { ...objeto(out.perfil) }
    const perfilGuardado = objeto(guardada.perfil)
    for (const k of PROTEGIDAS_PERFIL) {
      if (k in perfilGuardado) perfil[k] = perfilGuardado[k]
      else delete perfil[k]
    }
    out.perfil = perfil
  }
  return out
}

async function protegerMetadata(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  try {
    const r = req as unknown as { body?: Meta; validatedBody?: Meta; session?: { seller_id?: string } }
    const tocaMetadata = (b?: Meta) => !!b && "metadata" in b
    if (!tocaMetadata(r.body) && !tocaMetadata(r.validatedBody)) return next()

    const sellerId = req.get("x-seller-id") || r.session?.seller_id
    if (!sellerId) return next() // sin taller la ruta original responde el error

    const sellers = req.scope.resolve(MercurModules.SELLER) as {
      retrieveSeller: (id: string) => Promise<{ metadata?: Meta | null }>
    }
    const guardada = objeto((await sellers.retrieveSeller(sellerId))?.metadata)

    // Se blinda tanto el cuerpo crudo como el ya validado: así no importa en qué
    // orden corran este middleware y el validador de Mercur.
    if (tocaMetadata(r.body)) r.body!.metadata = blindar(objeto(r.body!.metadata), guardada)
    if (tocaMetadata(r.validatedBody)) r.validatedBody!.metadata = blindar(objeto(r.validatedBody!.metadata), guardada)
    next()
  } catch (e) {
    // Si no se puede leer el taller, no se deja pasar el cambio de metadata
    res.status(503).json({ message: "No se pudo guardar en este momento. Intenta de nuevo." })
  }
}

export const vendorVerificacionMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/vendor/hetna-verificacion/archivos",
    middlewares: [leerMultipart({ campos: { archivo: 1 }, maxMb: MAX_MB, forma: "lista" })],
  },
  {
    method: ["POST"],
    matcher: "/vendor/sellers/me",
    middlewares: [protegerMetadata],
  },
]
