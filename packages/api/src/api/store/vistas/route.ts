// @ts-nocheck
// POST /store/vistas  { product_id, seller_id? }
//
// Registra que alguien abrió la ficha de un producto. Es de dónde va a salir
// "qué productos visitan" y "a cuáles conviene bajarles el precio" en el
// tablero del taller: GA4 y el Pixel de Meta viven en el navegador, sus datos
// están en Google y en Meta, y no se pueden desglosar por vendedor.
//
// Qué cuenta y qué no, para que nadie lea el número como otra cosa: cuenta
// APERTURAS DE FICHA, no visitantes únicos. No se guarda IP, ni cuenta, ni
// sesión, así que no hay con qué distinguir dos aperturas de la misma persona.
// Para decidir a qué producto bajarle el precio eso alcanza, y no guardar datos
// personales que no se necesitan es lo correcto por omisión.
//
// Nunca falla hacia afuera: si no se puede contar, se contesta 200 igual. Una
// ficha de producto no se debe caer porque falló una estadística.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { VISTAS_MODULE } from "../../../modules/vistas"

const diaDeHoy = () => new Date().toISOString().slice(0, 10)

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const cuerpo = (req.body || {}) as { product_id?: unknown; seller_id?: unknown }
  const productId = typeof cuerpo.product_id === "string" ? cuerpo.product_id : ""
  const sellerId = typeof cuerpo.seller_id === "string" ? cuerpo.seller_id : null

  if (!productId) {
    return res.json({ ok: false })
  }

  try {
    const vistas = req.scope.resolve(VISTAS_MODULE)
    const dia = diaDeHoy()

    const existentes = await vistas.listProductoVistas({ product_id: productId, dia })

    if (existentes.length) {
      const fila = existentes[0]
      await vistas.updateProductoVistas({
        id: fila.id,
        total: (Number(fila.total) || 0) + 1,
        // Si la fila se creó sin taller (porque la ficha no lo sabía todavía)
        // y ahora sí viene, se completa. No se sobreescribe uno existente.
        ...(sellerId && !fila.seller_id ? { seller_id: sellerId } : {}),
      })
    } else {
      await vistas.createProductoVistas({
        product_id: productId,
        seller_id: sellerId,
        dia,
        total: 1,
      })
    }
  } catch (e) {
    // Leer-y-escribir tiene una carrera: dos aperturas simultáneas del mismo
    // producto pueden intentar crear la misma fila y el índice único rechaza la
    // segunda. Se pierde UNA vista en ese caso, y eso es preferible a cualquiera
    // de las alternativas -- transacciones por vista, o una fila por visita que
    // haría crecer la tabla sin techo. Si algún día el tráfico lo amerita, esto
    // se cambia por un UPSERT en SQL.
    const logger = req.scope.resolve("logger")
    logger.debug(`[vistas] no se pudo contar ${productId}: ${e?.message || e}`)
  }

  res.json({ ok: true })
}
