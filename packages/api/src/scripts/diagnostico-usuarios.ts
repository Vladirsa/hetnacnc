// Diagnóstico: ¿por qué el panel de administración no muestra usuarios?
// Sólo cuenta (no imprime correos ni datos personales) y prueba la misma
// consulta que hace la lista de Clientes del panel.
//   NODE_ENV=production bunx medusa exec ./src/scripts/diagnostico-usuarios.ts
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function diagnosticoUsuarios({ container }: ExecArgs) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const n = async (sql: string) => {
    try {
      const { rows } = await knex.raw(sql)
      return rows[0]?.n ?? 0
    } catch (e) {
      return `error: ${(e as Error).message}`
    }
  }

  console.log("── Base de datos de la tienda ──")
  console.log("Clientes (todos):            ", await n(`select count(*)::int n from customer where deleted_at is null`))
  console.log("Clientes con cuenta:         ", await n(`select count(*)::int n from customer where deleted_at is null and has_account`))
  console.log("Clientes nuevos (7 días):    ", await n(`select count(*)::int n from customer where deleted_at is null and created_at > now() - interval '7 days'`))
  console.log("Cuentas de acceso (clientes):", await n(`select count(*)::int n from provider_identity pi join auth_identity ai on ai.id = pi.auth_identity_id where ai.app_metadata ? 'customer_id'`))
  console.log("Accesos SIN cliente ligado:  ", await n(`select count(*)::int n from auth_identity ai where not (ai.app_metadata ? 'customer_id') and not (ai.app_metadata ? 'user_id') and not (ai.app_metadata ? 'seller_id') and not (ai.app_metadata ? 'member_id')`))
  console.log("Usuarios del panel (admin):  ", await n(`select count(*)::int n from "user" where deleted_at is null`))
  console.log("Talleres:                    ", await n(`select count(*)::int n from seller where deleted_at is null`))

  console.log("\n── Prueba de la lista de Clientes del panel ──")
  try {
    const svc = container.resolve(Modules.CUSTOMER) as any
    const [lista, total] = await svc.listAndCountCustomers({}, { take: 20, order: { created_at: "DESC" } })
    console.log(`✔ El módulo de clientes responde: ${total} clientes (muestra ${lista.length})`)
  } catch (e) {
    console.log(`✘ El módulo de clientes falló: ${(e as Error).message}`)
  }
  try {
    const { data } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "first_name", "last_name", "has_account", "created_at", "groups.*"],
      pagination: { take: 20, skip: 0 },
    })
    console.log(`✔ La consulta del panel responde: ${data.length} clientes`)
  } catch (e) {
    console.log(`✘ La consulta del panel falló: ${(e as Error).message}`)
  }
}
