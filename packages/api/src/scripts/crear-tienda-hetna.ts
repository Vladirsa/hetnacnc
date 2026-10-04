// Crea la tienda oficial "HETNA CNC" (moneda MXN, estado open) y liga como dueño
// a la cuenta de vendedor que ya existe con el correo indicado.
//
// Uso (en packages/api):
//   CORREO=tu-correo-del-panel@dominio.com NODE_ENV=production bunx medusa exec ./src/scripts/crear-tienda-hetna.ts
//
// Es seguro correrlo más de una vez: si la tienda ya existe no la duplica.
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import * as flujos from "@mercurjs/core/workflows"

const HANDLE = "hetna-cnc"

export default async function crearTiendaHetna({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const correo = (process.env.CORREO || "").trim().toLowerCase()

  if (!correo || !correo.includes("@")) {
    logger.error("Falta CORREO=... con el correo con el que entras al panel de vendedor (/seller).")
    return
  }

  const f = flujos as any

  // 1. ¿Ya existe la tienda?
  const { data: existentes } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "handle", "status", "currency_code"],
    filters: { handle: HANDLE } as any,
  })

  let tienda: any = existentes?.[0]

  if (tienda) {
    logger.info(`La tienda ya existía: ${tienda.name} (${tienda.id}) estado=${tienda.status}`)
  } else {
    const { result } = await f.createSellersWorkflow(container).run({
      input: {
        sellers: [
          {
            name: "HETNA CNC",
            handle: HANDLE,
            email: correo,
            currency_code: "mxn",
            status: "open",
            description:
              "Tienda oficial de HETNA CNC: máquinas, herramientas, refacciones y servicios CNC con envío a todo México.",
            member: { email: correo },
          },
        ],
      },
    })
    tienda = Array.isArray(result) ? result[0] : result?.sellers?.[0] ?? result
    logger.info(`Tienda creada: ${tienda?.name} (${tienda?.id}) estado=${tienda?.status}`)
  }

  if (!tienda?.id) {
    logger.error("No se pudo obtener el id de la tienda; revisa el mensaje de arriba.")
    return
  }

  // 2. Ligar la cuenta de vendedor existente como miembro de la tienda
  if (typeof f.addSellerMemberWorkflow === "function") {
    try {
      await f.addSellerMemberWorkflow(container).run({
        input: { seller_id: tienda.id, member: { email: correo } },
      })
      logger.info(`Cuenta ${correo} ligada a la tienda.`)
    } catch (e) {
      // Si ya era miembro, o si aún no existe la cuenta, queda la invitación creada en el paso 1
      logger.warn(`No se pudo ligar directo (${(e as Error).message}). Revisa si ya era miembro o acepta la invitación al entrar al panel.`)
    }
  } else {
    logger.warn("Esta versión de Mercur no expone addSellerMemberWorkflow; se usará la invitación creada con la tienda.")
  }

  // 3. Resumen
  try {
    const { data } = await query.graph({
      entity: "seller",
      fields: ["id", "name", "handle", "status", "currency_code", "members.*"],
      filters: { id: tienda.id } as any,
    })
    logger.info(`Resumen: ${JSON.stringify(data?.[0])}`)
  } catch {
    // el campo members puede llamarse distinto según la versión; no es crítico
  }
}
