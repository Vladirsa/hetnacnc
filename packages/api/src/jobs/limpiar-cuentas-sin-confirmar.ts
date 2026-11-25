// Todos los días: borra las cuentas de cliente que nunca confirmaron su correo.
//
// Quién: cuentas con contraseña (has_account), creadas desde que se pide
// confirmar el correo (lib/verificar-correo.ts), con más de DIAS_PARA_CONFIRMAR
// días sin abrir la liga ni escribir el código, y SIN ningún pedido. Casi siempre
// son robots o correos inventados (25 nov 2026: happo01@icloud.com, sin nombre).
//
// Cómo: la cuenta de cliente se borra con borrado suave (queda en la base, ya no
// cuenta). Su acceso (correo + contraseña) se borra para que esa persona, si era
// real, pueda volver a registrarse con el mismo correo. Si ese mismo acceso
// también es de un taller o de un administrador, sólo se le quita la parte de
// cliente: el taller sigue entrando a su panel.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { VERIFICAR_DESDE, requiereVerificacion } from "../lib/verificar-correo"

export const DIAS_PARA_CONFIRMAR = 7
const MAX_POR_VUELTA = 300
const DIA = 24 * 60 * 60 * 1000

type Fila = { id: string; email: string | null; has_account: boolean; created_at: Date; metadata: Record<string, unknown> | null }

/** Cuentas que ya se pueden borrar (sólo lectura; también la usa el admin). */
export async function cuentasPorBorrar(knex: any, ahora = Date.now()): Promise<Fila[]> {
  const filas = await knex("customer as c")
    .where("c.has_account", true)
    .whereNull("c.deleted_at")
    .where("c.created_at", ">=", VERIFICAR_DESDE())
    .where("c.created_at", "<", new Date(ahora - DIAS_PARA_CONFIRMAR * DIA))
    .whereRaw("coalesce(c.metadata->>'correo_verificado', '') <> 'true'")
    .whereNotExists(knex("order as o").select(knex.raw("1")).whereRaw("o.customer_id = c.id").whereNull("o.deleted_at"))
    .select("c.id", "c.email", "c.has_account", "c.created_at", "c.metadata")
    .orderBy("c.created_at", "asc")
    .limit(MAX_POR_VUELTA)
  return filas
    .map((f: any) => ({ ...f, metadata: typeof f.metadata === "string" ? JSON.parse(f.metadata) : f.metadata }))
    // Misma regla que el resto del sitio (deja fuera las cuentas de la casa)
    .filter((f: Fila) => requiereVerificacion(f))
}

export default async function limpiarCuentasSinConfirmar(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
    const clientes = container.resolve(Modules.CUSTOMER) as any
    const auth = container.resolve(Modules.AUTH) as any

    const filas = await cuentasPorBorrar(knex)
    if (!filas.length) return

    let borradas = 0
    for (const f of filas) {
      try {
        // Su acceso: borrarlo si sólo era de cliente; si también es de taller o admin, sólo soltar al cliente
        const proveedores = f.email
          ? await auth.listProviderIdentities({ entity_id: f.email, provider: "emailpass" }, { take: 5 })
          : []
        for (const p of proveedores) {
          const [identidad] = await auth.listAuthIdentities({ id: p.auth_identity_id }, { take: 1 })
          if (!identidad) continue
          const app = { ...((identidad.app_metadata || {}) as Record<string, unknown>) }
          if (app.customer_id && app.customer_id !== f.id) continue
          delete app.customer_id
          if (Object.keys(app).length === 0) await auth.deleteAuthIdentities([identidad.id])
          else await auth.updateAuthIdentities([{ id: identidad.id, app_metadata: app }])
        }
        await clientes.softDeleteCustomers([f.id])
        borradas++
      } catch (e) {
        logger.warn(`[cuentas-sin-confirmar] no se pudo borrar ${f.id}: ${(e as Error).message}`)
      }
    }
    logger.info(`[cuentas-sin-confirmar] ${borradas} cuentas borradas (sin confirmar en ${DIAS_PARA_CONFIRMAR} días y sin pedidos)`)
  } catch (e) {
    logger.warn(`[cuentas-sin-confirmar] falló: ${(e as Error).message}`)
  }
}

export const config = {
  name: "limpiar-cuentas-sin-confirmar",
  schedule: "17 11 * * *",
}
