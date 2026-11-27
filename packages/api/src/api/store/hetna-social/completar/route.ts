// POST /store/hetna-social/completar  (Bearer: el token que regresó la red social)
// Termina la entrada con Google, Facebook o LinkedIn: entra a la cuenta de esa
// identidad, la une a una cuenta existente (sólo con correo verificado por la red
// y cuenta confirmada) o crea la cuenta nueva. El correo sale de la identidad, nunca
// de lo que mande el navegador. Responde { accion, nueva } o 409 { message }.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows"

import { PROVEEDORES_SOCIALES, decidirVinculo, nombreDePerfil } from "../../../../lib/auth-social"
import { clientesConCorreoConfiable } from "../../../../lib/verificar-correo"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const idIdentidad = req.auth_context?.auth_identity_id
  if (!idIdentidad) return res.status(401).json({ message: "Sin sesión de la red social." })
  const auth: any = req.scope.resolve(Modules.AUTH)
  const clientesMod: any = req.scope.resolve(Modules.CUSTOMER)
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve("logger")

  const identidad = await auth.retrieveAuthIdentity(idIdentidad, { relations: ["provider_identities"] })
  const pi = (identidad.provider_identities || []).find((p: any) => (PROVEEDORES_SOCIALES as readonly string[]).includes(p.provider))
  if (!pi) return res.status(400).json({ message: "Esta sesión no viene de una red social." })
  const meta = (pi.user_metadata || {}) as Record<string, any>
  const email = String(meta.email || "").trim().toLowerCase()
  // Google sólo deja pasar correos verificados; LinkedIn lo dice; Facebook no (se trata como no verificado)
  const verificado = pi.provider === "google" ? true : meta.email_verified === true

  const idCliente = identidad.app_metadata?.customer_id as string | undefined
  const clienteDeLaIdentidad = idCliente ? await clientesMod.retrieveCustomer(idCliente).catch(() => null) : null
  const cuentas = email
    ? await knex("customer").whereRaw("lower(email) = ?", [email]).whereNull("deleted_at").where({ has_account: true }).select("id")
    : []
  const confiables = new Set(email ? await clientesConCorreoConfiable(knex, email) : [])
  const decision = decidirVinculo({
    proveedor: pi.provider,
    email,
    verificado,
    clienteDeLaIdentidad: clienteDeLaIdentidad ? { id: clienteDeLaIdentidad.id, email: clienteDeLaIdentidad.email } : null,
    cuentasConEseCorreo: cuentas.map((c: any) => ({ id: c.id, confiable: confiables.has(c.id) })),
  })

  const marcarVerificado = async (id: string) => {
    const c = await clientesMod.retrieveCustomer(id)
    if (c?.metadata?.correo_verificado === true) return
    await clientesMod.updateCustomers(id, { metadata: { ...(c?.metadata || {}), correo_verificado: true } })
  }

  try {
    if (decision.accion === "rechazar") return res.status(409).json({ message: decision.motivo })
    if (decision.accion === "entrar") {
      if (decision.marcarVerificado) await marcarVerificado(decision.customer_id)
      return res.json({ accion: "entrar", nueva: false })
    }
    if (decision.accion === "vincular") {
      await auth.updateAuthIdentities([{ id: identidad.id, app_metadata: { ...(identidad.app_metadata || {}), customer_id: decision.customer_id } }])
      await marcarVerificado(decision.customer_id)
      logger.info(`[social] ${pi.provider} unida a la cuenta ${decision.customer_id}`)
      return res.json({ accion: "vincular", nueva: false })
    }
    // Cuenta nueva: con el correo de la red; verificada sólo si la red lo verificó
    const nombre = nombreDePerfil(meta)
    await createCustomerAccountWorkflow(req.scope).run({
      input: {
        authIdentityId: identidad.id,
        customerData: {
          email,
          first_name: nombre.first_name || undefined,
          last_name: nombre.last_name || undefined,
          metadata: { registro_social: pi.provider, ...(decision.verificado ? { correo_verificado: true } : {}) },
        } as any,
      },
    })
    logger.info(`[social] cuenta nueva con ${pi.provider}`)
    return res.json({ accion: "crear", nueva: true })
  } catch (e) {
    logger.warn(`[social] ${pi.provider}: ${(e as Error).message}`)
    return res.status(400).json({ message: "No se pudo terminar el registro. Intenta de nuevo o crea tu cuenta con correo." })
  }
}
