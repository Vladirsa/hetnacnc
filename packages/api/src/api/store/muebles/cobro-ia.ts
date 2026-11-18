// Cobro de las lecturas con IA de /store/muebles/*: valida la imagen, cobra
// los créditos antes de llamar a la IA y los regresa si la lectura falla o si
// la imagen no sirve para diseñar (así el cliente nunca paga por un "no pude").
import { randomUUID } from "node:crypto"

import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

import { ErrorLectura, MEDIOS_IMAGEN, type MedioImagen, hayIaMuebles } from "../../../lib/muebles-ia"
import { grantCreditsWorkflow } from "../../../workflows/grant-credits"
import { spendCreditsWorkflow } from "../../../workflows/spend-credits"

export const CREDITOS_IMAGEN_MUEBLE = 2
const MAX_BYTES = 5 * 1024 * 1024

const Cuerpo = z.object({
  imagen: z.string().min(100),
  medio: z.enum(MEDIOS_IMAGEN),
})

type Fallo = { ok: false; mensaje: string; saldoInsuficiente?: boolean }

export async function lecturaConCobro<L>(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse<({ ok: true; lectura: L; cobrado: number; saldo: number | null }) | Fallo>,
  opciones: {
    descripcion: string
    leer: (base64: string, medio: MedioImagen) => Promise<L>
    // la lectura salió bien pero no sirve para diseñar: se regresa el cobro
    inutil: (l: L) => boolean
  },
) {
  if (!hayIaMuebles()) return res.status(503).json({ ok: false, mensaje: "El diseño desde imagen todavía no está disponible. Intenta más tarde." })
  const datos = Cuerpo.safeParse(req.body)
  if (!datos.success) return res.status(400).json({ ok: false, mensaje: "Sube una imagen JPG, PNG o WEBP." })
  const base64 = datos.data.imagen.replace(/^data:[^,]+,/, "")
  if (!/^[A-Za-z0-9+/=]+$/.test(base64)) return res.status(400).json({ ok: false, mensaje: "La imagen llegó dañada." })
  if ((base64.length * 3) / 4 > MAX_BYTES) return res.status(413).json({ ok: false, mensaje: "La imagen pesa más de 5 MB. Prueba con una más chica." })

  const customerId = req.auth_context.actor_id
  const referencia = `mueble-ia:${randomUUID()}`
  const logger = req.scope.resolve("logger") as { error: (m: string) => void }
  let saldo: number | null = null
  try {
    const { result } = await spendCreditsWorkflow(req.scope).run({
      input: { customer_id: customerId, amount: CREDITOS_IMAGEN_MUEBLE, reference_id: referencia, description: opciones.descripcion },
    })
    saldo = (result as { saldo_restante?: number }).saldo_restante ?? null
  } catch (e) {
    if (e instanceof MedusaError && e.type === MedusaError.Types.NOT_ALLOWED) {
      return res.status(402).json({ ok: false, mensaje: `Necesitas ${CREDITOS_IMAGEN_MUEBLE} créditos para diseñar desde una imagen. Compra créditos en tu cuenta.`, saldoInsuficiente: true })
    }
    throw e
  }
  const reembolsar = async (motivo: string) => {
    try {
      await grantCreditsWorkflow(req.scope).run({
        input: { customer_id: customerId, amount: CREDITOS_IMAGEN_MUEBLE, type: "reembolso", reference_id: referencia, description: `Reembolso: ${motivo}` },
      })
      if (saldo !== null) saldo += CREDITOS_IMAGEN_MUEBLE
    } catch (r) {
      logger.error(`[muebles-ia] falló el reembolso de ${referencia}: ${r}`)
    }
  }

  try {
    const lectura = await opciones.leer(base64, datos.data.medio)
    if (opciones.inutil(lectura)) {
      await reembolsar("la imagen no era un mueble que se pueda diseñar")
      return res.json({ ok: true, lectura, cobrado: 0, saldo })
    }
    res.json({ ok: true, lectura, cobrado: CREDITOS_IMAGEN_MUEBLE, saldo })
  } catch (e) {
    logger.error(`[muebles-ia] ${referencia}: ${e instanceof Error ? e.message : String(e)}`)
    await reembolsar("no se pudo leer la imagen del mueble")
    res.status(502).json({ ok: false, mensaje: e instanceof ErrorLectura ? `${e.message} No se te cobró.` : "No se pudo leer la imagen. No se te cobró." })
  }
}
