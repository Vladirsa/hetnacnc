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

const PROTEGIDAS = [
  "verificado",
  "verificado_desde",
  "fundador",
  "fundador_desde",
  "plan_pro_hasta",
  "prueba",
  // Constancias legales: cuándo aceptó los términos y autorizó sus datos bancarios
  "terminos_vendedor_en",
  "consentimiento_bancario_en",
  "consentimiento_bancario_fuente",
  // Confirmación de correo del alta (lib/alta-taller.ts)
  "correo_confirmado",
  "correo_confirmado_en",
]
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

// Datos bancarios del taller (LFPDPPP art. 7: consentimiento expreso para datos
// patrimoniales). El formulario del panel muestra la autorización por escrito
// junto al botón de guardar (textos en apps/vendor/src/i18n). Al guardar datos de
// cuenta, aquí se deja constancia de la fecha en los datos del taller.
const CAMPOS_BANCARIOS = ["holder_name", "account_number", "iban", "routing_number", "bic"]

async function constanciaBancaria(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  try {
    const cuerpo = objeto((req as unknown as { body?: unknown }).body)
    const trae = CAMPOS_BANCARIOS.some((k) => typeof cuerpo[k] === "string" && (cuerpo[k] as string).trim() !== "")
    const sellerId = (req.params as { id?: string })?.id
    if (trae && sellerId) await registrarConstancia(req.scope, sellerId, { bancario: "panel" })
  } catch (e) {
    req.scope.resolve("logger").warn(`[constancias] no se registró el consentimiento bancario: ${(e as Error).message}`)
  }
  next()
}

export async function registrarConstancia(
  container: MedusaRequest["scope"],
  sellerId: string,
  que: { bancario?: string; terminos?: boolean },
) {
  const sellers = container.resolve(MercurModules.SELLER) as {
    retrieveSeller: (id: string) => Promise<{ metadata?: Meta | null }>
    updateSellers: (d: { id: string; metadata: Meta }) => Promise<unknown>
  }
  const actual = objeto((await sellers.retrieveSeller(sellerId))?.metadata)
  const ahora = new Date().toISOString()
  await sellers.updateSellers({
    id: sellerId,
    metadata: {
      ...actual,
      ...(que.terminos ? { terminos_vendedor_en: ahora } : {}),
      ...(que.bancario ? { consentimiento_bancario_en: ahora, consentimiento_bancario_fuente: que.bancario } : {}),
    },
  })
}

export const vendorVerificacionMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/vendor/sellers/:id/payment-details",
    middlewares: [constanciaBancaria],
  },
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
