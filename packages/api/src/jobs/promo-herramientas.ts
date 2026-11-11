// Cada madrugada (3:41, centro de México): imagen y video de una herramienta de
// HETNA (lo que se monetiza va primero):
//   México: Cotizador lunes, miércoles y viernes; 3D Studio (imagen a 3D, STL,
//           litofanías, letras 3D, llaveros) martes, jueves y domingo; las demás
//           herramientas el sábado.
//   EE.UU. (en inglés, misma cuenta): Cotizador el martes y 3D Studio el sábado.
// De madrugada para poder hacer el video animado sin frenar la tienda.
import { MedusaContainer } from "@medusajs/framework/types"

import { grupoDelDia, grupoUsDelDia, promoHerramienta } from "../lib/fabrica/promociones"

export default async function promoHerramientas(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const dia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" })).getDay()
  try {
    const g = grupoDelDia(dia)
    await promoHerramienta(container, logger, undefined, { grupo: g, mercado: "mx" })
    logger.info(`[promo] herramienta de hoy (México): ${g}`)
  } catch (e) {
    logger.error(`[promo] herramienta (México): ${(e as Error).message}`)
  }
  const us = grupoUsDelDia(dia)
  if (!us) return
  try {
    await promoHerramienta(container, logger, undefined, { grupo: us, mercado: "us" })
    logger.info(`[promo] herramienta de hoy (EE.UU.): ${us}`)
  } catch (e) {
    logger.error(`[promo] herramienta (EE.UU.): ${(e as Error).message}`)
  }
}

export const config = { name: "promo-herramientas", schedule: "41 9 * * *" }
