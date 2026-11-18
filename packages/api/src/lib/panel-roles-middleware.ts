// Middleware de /admin/*: aplica los roles del HETNA Panel en el API.
// La decisión vive en ./panel-roles.ts (función pura, con pruebas); aquí sólo
// se lee la lista de administradores (con cache corto) y se responde 403.
import { Modules } from "@medusajs/framework/utils"

import { type UsuarioAdmin, apagado, decidir, duenosDeEnv, rutaSinConsulta } from "./panel-roles"

const TTL_MS = 60_000

let cache: { usuarios: UsuarioAdmin[]; hasta: number } | null = null
let cargando: Promise<UsuarioAdmin[]> | null = null

/** Olvida la lista (al cambiar usuarios, roles o invitaciones). */
export function invalidarCachePanelRoles() {
  cache = null
}

async function leerUsuarios(scope: any): Promise<UsuarioAdmin[]> {
  const userModule = scope.resolve(Modules.USER)
  const lista = await userModule.listUsers(
    {},
    { select: ["id", "email", "metadata", "created_at"], take: 10_000, order: { created_at: "ASC" } }
  )
  return (lista || []).map((u: any) => ({ id: u.id, email: u.email, metadata: u.metadata, created_at: u.created_at }))
}

async function usuarios(scope: any, actorId: string): Promise<UsuarioAdmin[]> {
  const fresca = cache && cache.hasta > Date.now()
  // Si el administrador no aparece (recién creado), se vuelve a leer una vez
  if (fresca && cache!.usuarios.some((u) => u.id === actorId)) return cache!.usuarios
  cargando ??= leerUsuarios(scope)
    .then((l) => {
      cache = { usuarios: l, hasta: Date.now() + TTL_MS }
      return l
    })
    .finally(() => {
      cargando = null
    })
  return cargando
}

const CAMBIA_USUARIOS = /^\/admin\/(users|invites)(\/|$)/

let ultimoError = 0

export async function panelRolesAdmin(req: any, res: any, next: any) {
  const metodo = String(req.method || "GET").toUpperCase()
  const url = String(req.originalUrl || req.url || "")
  // Un cambio de usuarios o invitaciones (rol, alta, baja) invalida la cache
  if (metodo !== "GET" && CAMBIA_USUARIOS.test(rutaSinConsulta(url))) {
    res.on("finish", () => invalidarCachePanelRoles())
  }
  const auth = req.auth_context
  let lista: UsuarioAdmin[] | null = null
  if (auth?.actor_type === "user" && auth?.actor_id && !apagado(process.env.PANEL_ROLES_API)) {
    try {
      lista = await usuarios(req.scope, auth.actor_id)
    } catch (e) {
      if (Date.now() - ultimoError > 60_000) {
        ultimoError = Date.now()
        console.error(`[panel-roles] no pude leer los administradores: ${(e as Error)?.message || e}`)
      }
      lista = null
    }
  }
  const d = decidir({
    auth,
    metodo,
    url,
    usuarios: lista,
    duenos: duenosDeEnv(process.env.PANEL_DUENOS),
    interruptor: process.env.PANEL_ROLES_API,
  })
  if (d.pasa) return next()
  res.status(d.estado).json({ type: "not_allowed", message: d.mensaje })
}
