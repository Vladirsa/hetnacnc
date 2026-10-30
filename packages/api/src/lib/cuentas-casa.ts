// Cuentas de la casa: las cuentas de HETNA (la del dueño) tienen créditos
// ilimitados y el plan más alto de todo, siempre.
//
// Se reconocen por el correo de su cuenta de cliente (CUENTAS_DE_LA_CASA,
// separados por coma; por omisión la del dueño). Es seguro atarlo al correo:
// en la tienda el cliente no puede cambiar su correo (StoreUpdateCustomer no
// lo acepta) y no puede haber dos cuentas registradas con el mismo.
//
// Dónde aplica:
//   - Créditos: spendCreditsStep no descuenta, el escaneo no cobra y el saldo
//     se muestra como "ilimitado".
//   - Plan del Cotizador de la tienda y descargas gratis: como "industrial".
//   - App del Cotizador (Supabase): plan "master", que asegura
//     asegurarPlanesDeLaCasa() en cotizador-suscripciones.ts cada hora.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// En la tienda, el plan más alto: todo lo de Pro y además CFDI, API y usuarios
// ilimitados.
export const PLAN_DE_LA_CASA = "industrial" as const
// En la app del Cotizador existe uno arriba de todos, reservado para HETNA:
// "master" (todo abierto, sin vencimiento ni cobro).
export const PLAN_APP_DE_LA_CASA = "master" as const

export const correosDeLaCasa = (): string[] =>
  (process.env.CUENTAS_DE_LA_CASA ?? "vladirsa@gmail.com")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)

// Los ids se buscan una vez cada 10 minutos, no en cada cobro
const VIGENCIA_MS = 10 * 60 * 1000
let cache: { ids: Set<string>; hasta: number } | null = null

async function idsDeLaCasa(container: MedusaContainer): Promise<Set<string>> {
  if (cache && cache.hasta > Date.now()) return cache.ids
  const correos = correosDeLaCasa()
  let ids = new Set<string>()
  if (correos.length) {
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
    const filas = await knex("customer")
      .select("id")
      .whereIn(knex.raw("lower(email)"), correos)
      .where("has_account", true)
      .whereNull("deleted_at")
    ids = new Set(filas.map((f: { id: string }) => f.id))
  }
  cache = { ids, hasta: Date.now() + VIGENCIA_MS }
  return ids
}

export async function esCuentaDeLaCasa(container: MedusaContainer, customerId: string | null | undefined): Promise<boolean> {
  if (!customerId) return false
  try {
    return (await idsDeLaCasa(container)).has(customerId)
  } catch {
    // Si no se puede saber, se cobra normal: es lo seguro
    return false
  }
}
