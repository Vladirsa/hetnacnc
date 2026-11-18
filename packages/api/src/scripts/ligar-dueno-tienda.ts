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
// Requisito: que exista la identidad de acceso (correo + contraseña): que puedas
// entrar a /seller, o que te hayas registrado ahí con ese correo.
//
// También borra la invitación pendiente que dejó crear-tienda-hetna.ts (si no,
// al aceptarla después daría un error) y, si ya estabas ligado pero no como
// dueño, te deja como dueño con el rol de administración.
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MercurModules, SellerRole } from "@mercurjs/types"

export default async function ligarDuenoTienda({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  // Tal como se escribió: emailpass guarda el correo con sus mayúsculas
  const correoCrudo = (process.env.CORREO || "").trim()
  const correo = correoCrudo.toLowerCase()
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
  let provs = await auth.listProviderIdentities({ entity_id: correoCrudo, provider: "emailpass" })
  if (!provs?.length && correoCrudo !== correo) provs = await auth.listProviderIdentities({ entity_id: correo, provider: "emailpass" })
  const prov = provs?.[0]
  if (!prov) {
    logger.error(`No hay identidad de acceso para ${correoCrudo}. Regístrate en /seller con ese correo (escrito igual, con las mismas mayúsculas) y vuelve a correr esto.`)
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

  // 4. ¿Ya está ligado? ¿como dueño? ¿quedó una invitación pendiente?
  const ligas = miembro ? await tiendas.listSellerMembers({ seller_id: tienda.id, member_id: miembro.id }) : []
  const liga = ligas[0]
  const yaLigado = !!liga
  const esDueno = !!liga && liga.is_owner === true && !!liga.role_id
  const identidadApunta = miembro && app.member_id === miembro.id
  const invitaciones = await tiendas.listMemberInvites({ seller_id: tienda.id, email: [correoCrudo, correo] }).catch(() => [])
  const pendientes = (invitaciones || []).filter((i: any) => !i.accepted)
  if (yaLigado && esDueno && identidadApunta && !pendientes.length) {
    di(`ya está todo bien: ${correo} es dueño de ${tienda.name}. Cierra sesión en /seller y vuelve a entrar.`)
    return
  }

  const pasos = [
    !miembro && "crear el miembro",
    !identidadApunta && "apuntar la identidad a ese miembro",
    !yaLigado && "ligarlo como dueño de la tienda",
    yaLigado && !esDueno && "dejarlo como dueño con rol de administración",
    pendientes.length && `borrar ${pendientes.length} invitación(es) pendiente(s) a ese correo`,
  ].filter(Boolean)
  di(`haría: ${pasos.join("; ")}`)
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
  } else if (!esDueno) {
    await tiendas.updateSellerMembers([{ id: liga.id, is_owner: true, role_id: liga.role_id || SellerRole.SELLER_ADMINISTRATION }])
    di("ahora es dueño con rol de administración")
  }
  if (pendientes.length) {
    await tiendas.deleteMemberInvites(pendientes.map((i: any) => i.id))
    di("invitaciones pendientes borradas")
  }
  di("listo. Cierra sesión en /seller y vuelve a entrar con tu correo.")
}
