// Liga tu cuenta de acceso como DUEÑA de una tienda que ya existe con tu correo.
//
// Para qué: si entras a /seller con tu correo y el panel te pide "crear una
// tienda", pero al crearla dice que ese correo ya lo tiene otra tienda, es que
// la tienda existe y tu usuario no está ligado a ella. Pasaba con la tienda
// HETNA: crear-tienda-hetna.ts llamaba addSellerMemberWorkflow con datos en el
// formato equivocado y el error se tragaba (sólo dejaba un aviso en el registro).
//
// Uso (en packages/api). Primero sin cambiar nada, para ver qué haría:
//   CORREO=tu@correo.com NODE_ENV=production bunx medusa exec ./src/scripts/ligar-dueno-tienda.ts
// Si se ve bien, lo mismo con APLICAR=1 para hacerlo:
//   CORREO=tu@correo.com APLICAR=1 NODE_ENV=production bunx medusa exec ./src/scripts/ligar-dueno-tienda.ts
// Opcional: TIENDA=hetna-cnc (handle) si la tienda tiene otro correo.
//
// Requisito: haber entrado (o intentado) al panel /seller con ese correo y su
// contraseña al menos una vez, para que exista la identidad de acceso.
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MercurModules, SellerRole } from "@mercurjs/types"

export default async function ligarDuenoTienda({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const correo = (process.env.CORREO || "").trim().toLowerCase()
  const handle = (process.env.TIENDA || "").trim()
  const aplicar = process.env.APLICAR === "1"
  const di = (m: string) => logger.info(`[ligar-dueño] ${m}`)

  if (!correo.includes("@")) {
    logger.error("Falta CORREO=... (el correo con el que entras al panel /seller).")
    return
  }

  const auth = container.resolve(Modules.AUTH) as any
  const tiendas = container.resolve(MercurModules.SELLER) as any

  // 1. Identidad de acceso (correo + contraseña)
  const provs = await auth.listProviderIdentities({ entity_id: correo, provider: "emailpass" })
  const prov = provs?.[0]
  if (!prov) {
    logger.error(`No hay identidad de acceso para ${correo}. Entra una vez a /seller con ese correo (o regístrate con él) y vuelve a correr esto.`)
    return
  }
  const identidad = await auth.retrieveAuthIdentity(prov.auth_identity_id)
  const app = (identidad?.app_metadata || {}) as Record<string, unknown>
  di(`identidad ${identidad.id}: ${JSON.stringify(Object.keys(app))} (customer_id ${app.customer_id ? "sí" : "no"}, member_id ${app.member_id ? "sí" : "no"})`)

  // 2. La tienda
  const filtroTienda = handle ? { handle } : { email: correo }
  const [tienda] = await tiendas.listSellers(filtroTienda, { take: 1 })
  if (!tienda) {
    logger.error(`No encontramos la tienda (${handle ? `handle ${handle}` : `correo ${correo}`}). Usa TIENDA=<handle>.`)
    return
  }
  di(`tienda ${tienda.name} (${tienda.id}) estado=${tienda.status} correo=${tienda.email}`)

  // 3. El miembro (la persona): el de la identidad, o uno con ese correo
  let miembro: any = null
  if (app.member_id) [miembro] = await tiendas.listMembers({ id: String(app.member_id) }, { take: 1 })
  if (!miembro) [miembro] = await tiendas.listMembers({ email: correo }, { take: 1 })
  di(miembro ? `miembro ${miembro.id} (${miembro.email})` : "no hay miembro con ese correo: se creará")

  // 4. ¿Ya está ligado?
  const ligas = miembro ? await tiendas.listSellerMembers({ seller_id: tienda.id, member_id: miembro.id }) : []
  const yaLigado = ligas.length > 0
  const identidadApunta = miembro && app.member_id === miembro.id
  if (yaLigado && identidadApunta) {
    di(`ya está todo bien: ${correo} es miembro de ${tienda.name}${ligas[0].is_owner ? " (dueño)" : ""}. Cierra sesión en /seller y vuelve a entrar.`)
    return
  }

  di(
    `haría: ${!miembro ? "crear el miembro; " : ""}${!identidadApunta ? "apuntar la identidad a ese miembro; " : ""}${!yaLigado ? "ligarlo como dueño de la tienda" : ""}`
  )
  if (!aplicar) {
    di("no se cambió nada. Para hacerlo, vuelve a correr con APLICAR=1.")
    return
  }

  if (!miembro) {
    ;[miembro] = await tiendas.createMembers([{ email: correo }])
    di(`miembro creado ${miembro.id}`)
  }
  if (!identidadApunta) {
    await auth.updateAuthIdentities([{ id: identidad.id, app_metadata: { ...app, member_id: miembro.id } }])
    di("identidad apuntada al miembro")
  }
  if (!yaLigado) {
    await tiendas.createSellerMembers([{ seller_id: tienda.id, member_id: miembro.id, role_id: SellerRole.SELLER_ADMINISTRATION, is_owner: true }])
    di(`ligado como dueño de ${tienda.name}`)
  }
  di("listo. Cierra sesión en /seller y vuelve a entrar con tu correo.")
}
