// Cada madrugada (3:41, centro de México): imagen y video de una herramienta de
// HETNA. El Cotizador (lo que se cobra) sale 4 de cada 7 días (lunes, miércoles,
// viernes y domingo); los otros días, calculadora, diseño, CAM o ranking.
// De madrugada para poder hacer el video animado sin frenar la tienda.
import { MedusaContainer } from "@medusajs/framework/types"

import { promoHerramienta, tocaCotizador } from "../lib/fabrica/promociones"

export default async function promoHerramientas(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    const dia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" })).getDay()
    const cot = tocaCotizador(dia)
    await promoHerramienta(container, logger, undefined, cot ? { soloCotizador: true } : { sinCotizador: true })
    logger.info(`[promo] herramienta de hoy: ${cot ? "Cotizador" : "otra herramienta"}`)
  } catch (e) {
    logger.error(`[promo] herramienta: ${(e as Error).message}`)
  }
}

export const config = { name: "promo-herramientas", schedule: "41 9 * * *" }
