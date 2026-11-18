// Bitácora de seguridad (auditoría del 18 nov 2026).
//
// Antes no quedaba rastro de quién intentaba entrar con contraseñas malas ni de
// qué cambiaba cada administrador en el panel. Aquí se anota:
//   - login_fallido: cada intento de inicio de sesión rechazado (cliente, taller
//     o administrador), con el correo que se intentó y la IP;
//   - admin: cada cambio (POST, PUT, PATCH, DELETE) hecho en /admin/*, con quién
//     lo hizo, la ruta y el resultado. No se guarda el contenido (puede traer
//     datos de clientes o contraseñas), sólo qué se tocó.
// El Centro de control avisa si hay muchos intentos fallidos al panel.
// Los renglones se borran solos a los 180 días.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ipCliente } from "./ip-cliente"

export const T_BITACORA = "hetna_bitacora_seguridad"
const DIAS = 180

let lista: Promise<void> | null = null
export function asegurarBitacora(knex: any): Promise<void> {
  lista ??= (async () => {
    if (!(await knex.schema.hasTable(T_BITACORA))) {
      await knex.schema.createTable(T_BITACORA, (t: any) => {
        t.bigIncrements("id").primary()
        t.timestamp("creado", { useTz: true }).notNullable().defaultTo(knex.fn.now()).index()
        t.text("tipo").notNullable().index()
        t.text("actor")
        t.text("ip")
        t.text("metodo")
        t.text("ruta")
        t.integer("estado")
      })
    }
  })().catch((e) => {
    lista = null
    throw e
  })
  return lista
}

const corto = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").slice(0, n)

/** Ruta sin la consulta (los ?token=… no se guardan). */
export const rutaLimpia = (url: string) => corto(String(url || "").split("?")[0], 200)

/** ¿Es un inicio de sesión con correo y contraseña? Devuelve el tipo de cuenta. */
export function tipoDeLogin(metodo: string, ruta: string): string | null {
  const m = /^\/auth\/(customer|seller|user|member)\/emailpass\/?$/.exec(rutaLimpia(ruta))
  return metodo === "POST" && m ? m[1] : null
}

let ultimaLimpieza = 0
async function anotar(req: any, fila: Record<string, unknown>) {
  try {
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    await asegurarBitacora(knex)
    await knex(T_BITACORA).insert(fila)
    if (Date.now() - ultimaLimpieza > 24 * 3_600_000) {
      ultimaLimpieza = Date.now()
      await knex(T_BITACORA).where("creado", "<", new Date(Date.now() - DIAS * 86_400_000)).del()
    }
  } catch {
    /* la bitácora nunca tumba una petición */
  }
}

/** /auth/*: anota los inicios de sesión rechazados. */
export function bitacoraLogin(req: any, res: any, next: any) {
  const cuenta = tipoDeLogin(req.method, req.originalUrl || req.url)
  if (!cuenta) return next()
  res.on("finish", () => {
    if (res.statusCode !== 401) return
    void anotar(req, {
      tipo: "login_fallido",
      actor: `${cuenta}:${corto(req.body?.email, 120).toLowerCase()}`,
      ip: ipCliente(req),
      metodo: "POST",
      ruta: rutaLimpia(req.originalUrl || req.url),
      estado: 401,
    })
  })
  next()
}

/** /admin/*: anota cada cambio hecho en el panel de administración. */
export function bitacoraAdmin(req: any, res: any, next: any) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next()
  res.on("finish", () => {
    void anotar(req, {
      tipo: "admin",
      actor: corto(req.auth_context?.actor_id || "sin sesión", 120),
      ip: ipCliente(req),
      metodo: req.method,
      ruta: rutaLimpia(req.originalUrl || req.url),
      estado: res.statusCode,
    })
  })
  next()
}

/** Intentos fallidos de entrar al panel de administración en las últimas horas, por IP. */
export async function intentosFallidosAdmin(knex: any, horas = 24): Promise<{ total: number; ips: number; correos: number }> {
  await asegurarBitacora(knex)
  const [r] = await knex(T_BITACORA)
    .where({ tipo: "login_fallido" })
    .where("actor", "like", "user:%")
    .where("creado", ">", new Date(Date.now() - horas * 3_600_000))
    .select(knex.raw("count(*)::int as total, count(distinct ip)::int as ips, count(distinct actor)::int as correos"))
  return { total: r?.total || 0, ips: r?.ips || 0, correos: r?.correos || 0 }
}
