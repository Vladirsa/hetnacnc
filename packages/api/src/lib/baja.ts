// Baja de correos promocionales (carrito abandonado, invitación a reseñar y
// cualquier correo que no sea indispensable para un pedido o una cuenta).
//
// Cada correo promocional lleva una liga personal para darse de baja con un
// clic, sin iniciar sesión, y el encabezado List-Unsubscribe que usan Gmail y
// Outlook para mostrar su botón "Cancelar suscripción" (RFC 8058).
// La liga lleva una firma (HMAC) para que nadie pueda dar de baja a otra persona.
// Los correos de baja se guardan en la tabla hetna_correo_baja y se consultan
// antes de mandar cualquier correo promocional.
import { createHmac, timingSafeEqual } from "crypto"

import { STORE_URL } from "./licitacion"

export const T_BAJA = "hetna_correo_baja"

const secreto = () => process.env.BAJA_SECRET || process.env.COOKIE_SECRET || process.env.JWT_SECRET || ""

const normal = (correo: string) => correo.trim().toLowerCase()

export const firmaBaja = (correo: string) =>
  createHmac("sha256", secreto()).update(`baja:${normal(correo)}`).digest("base64url").slice(0, 32)

export const firmaValida = (correo: string, firma: string) => {
  const a = Buffer.from(firmaBaja(correo))
  const b = Buffer.from(String(firma || ""))
  return a.length === b.length && timingSafeEqual(a, b)
}

// Liga pública (pasa por la tienda, que la reenvía a la API)
export const ligaBaja = (correo: string) =>
  `${STORE_URL}/api/baja?e=${encodeURIComponent(normal(correo))}&t=${firmaBaja(correo)}`

let lista = false
export async function asegurarTablaBaja(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_BAJA))) {
    await knex.schema.createTable(T_BAJA, (t: any) => {
      t.text("correo").primary()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  lista = true
}

export async function estaDeBaja(knex: any, correo: string): Promise<boolean> {
  await asegurarTablaBaja(knex)
  return !!(await knex(T_BAJA).where({ correo: normal(correo) }).first())
}

export async function darDeBaja(knex: any, correo: string) {
  await asegurarTablaBaja(knex)
  await knex(T_BAJA).insert({ correo: normal(correo) }).onConflict("correo").ignore()
}
