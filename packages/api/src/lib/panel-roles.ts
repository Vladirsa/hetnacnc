// HETNA Panel: los roles del panel (user.metadata.panel_rol) también se
// aplican en el API (auditoría de seguridad, 18 nov 2026).
//
// Antes sólo la tienda revisaba el rol: un administrador con rol limitado
// tenía igual un token de admin de Medusa y podía llamar directo a cualquier
// ruta /admin/* (o entrar a /dashboard). Aquí se decide, petición por
// petición, si la sesión de ese administrador puede usar la ruta.
//
// La tabla de roles es COPIA de apps/storefront/src/lib/panel/roles.ts (la
// tienda y el API se despliegan por separado). La prueba
// __tests__/panel-roles.unit.spec.ts lee el archivo de la tienda y falla si
// las dos tablas se separan.
//
// Reglas (mismas que usuarioPanel() en la tienda):
//   - Claves API secretas (actor_type "api-key": bot de WhatsApp, n8n…) y
//     peticiones sin usuario: pasan siempre, sin cambios.
//   - PANEL_ROLES_API=off: interruptor de emergencia, todo pasa.
//   - Correo en PANEL_DUENOS → dueño.
//   - panel_rol "dueno" → dueño (pasa todo).
//   - Sin panel_rol y NINGÚN administrador con panel_rol → dueño (arranque).
//   - Sin panel_rol y ya hay roles → dueño SÓLO si es el administrador más
//     antiguo (evita que el dueño original se quede fuera si el primer rol se
//     asignó por otro lado que no sea Equipo); si no, sin acceso.
//   - Rol limitado: sólo las rutas de su lista blanca; lo demás → 403.

export type Rol = "dueno" | "operaciones" | "ventas" | "finanzas" | "soporte" | "sin_acceso"

/** Páginas que ve cada rol (copia de ROLES[rol].paginas de la tienda). */
export const PAGINAS_ROL: Record<Rol, string[]> = {
  dueno: ["inicio", "pedidos", "licitaciones", "talleres", "cotizador", "equipo"],
  operaciones: ["inicio", "pedidos", "licitaciones", "talleres"],
  ventas: ["inicio", "licitaciones", "cotizador"],
  finanzas: ["inicio", "pedidos"],
  soporte: ["pedidos", "talleres"],
  sin_acceso: [],
}

/** Qué puede HACER cada rol (copia de ACCIONES de la tienda). */
export const ACCIONES: Record<Rol, string[]> = {
  dueno: ["licitaciones", "talleres", "pedidos", "distribuidores"],
  operaciones: ["licitaciones", "talleres", "pedidos"],
  ventas: ["licitaciones", "distribuidores"],
  finanzas: [],
  soporte: ["talleres", "pedidos"],
  sin_acceso: [],
}

export const ROLES_VALIDOS = Object.keys(PAGINAS_ROL) as Rol[]

export const puede = (rol: Rol, pagina: string) => PAGINAS_ROL[rol]?.includes(pagina) ?? false
export const puedeActuar = (rol: Rol, area: string) => ACCIONES[rol]?.includes(area) ?? false

type Regla = { metodo: "GET" | "POST"; patron: RegExp }
const ID = "[\\w-]+"
const r = (metodo: Regla["metodo"], fuente: string): Regla => ({ metodo, patron: new RegExp(`^${fuente}$`) })

/**
 * Lista blanca: rutas /admin que usa cada PÁGINA del panel para leer
 * (sacadas de apps/storefront/src/app/[locale]/(panel)/** y api/app/panel/archivo).
 */
export const RUTAS_PAGINA: Record<string, Regla[]> = {
  inicio: [r("GET", "/admin/hetna-control")],
  pedidos: [r("GET", "/admin/orders")],
  licitaciones: [r("GET", "/admin/hetna-solicitudes")],
  talleres: [
    r("GET", "/admin/hetna-verificacion"),
    r("GET", `/admin/hetna-verificacion/${ID}/archivos/${ID}`),
  ],
  cotizador: [
    r("GET", "/admin/hetna-cotizador"),
    r("GET", "/admin/hetna-crecimiento"),
    r("GET", "/admin/hetna-distribuidores"),
  ],
  // equipo: sólo dueño (que pasa todo); ningún rol limitado la tiene.
}

/**
 * Lista blanca: rutas /admin de cada ACCIÓN del panel (mismas que PERMITIDAS
 * en apps/storefront/src/app/api/app/panel/accion/route.ts).
 */
export const RUTAS_ACCION: Record<string, Regla[]> = {
  licitaciones: [r("POST", `/admin/hetna-solicitudes/${ID}/accion`)],
  talleres: [r("POST", `/admin/hetna-verificacion/${ID}`)],
  pedidos: [r("POST", `/admin/orders/${ID}/(cancel|complete)`)],
  distribuidores: [r("POST", "/admin/hetna-distribuidores")],
}

/** Toda sesión de administrador puede saber quién es (la tienda lo necesita). */
export const RUTAS_TODOS: Regla[] = [r("GET", "/admin/users/me")]

/** Ruta sin consulta ni diagonal final. */
export function rutaSinConsulta(url: string): string {
  const p = String(url || "").split("?")[0].split("#")[0]
  return p.length > 1 ? p.replace(/\/+$/, "") : p
}

const coincide = (reglas: Regla[] | undefined, metodo: string, ruta: string) =>
  (reglas || []).some((x) => x.metodo === metodo && x.patron.test(ruta))

/** ¿El rol puede usar esta ruta /admin? (dueño: todo) */
export function rutaPermitida(rol: Rol, metodo: string, url: string): boolean {
  if (rol === "dueno") return true
  const m = String(metodo || "").toUpperCase()
  const ruta = rutaSinConsulta(url)
  if (coincide(RUTAS_TODOS, m, ruta)) return true
  if (PAGINAS_ROL[rol]?.some((p) => coincide(RUTAS_PAGINA[p], m, ruta))) return true
  if (ACCIONES[rol]?.some((a) => coincide(RUTAS_ACCION[a], m, ruta))) return true
  return false
}

export type UsuarioAdmin = {
  id: string
  email: string
  metadata?: Record<string, unknown> | null
  created_at?: string | Date | null
}

export const tieneRol = (u: UsuarioAdmin) => Boolean(u.metadata?.panel_rol)

export function duenosDeEnv(valor: string | undefined): string[] {
  return String(valor || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean)
}

/** El administrador más antiguo (por fecha de alta; empate → id). */
export function masAntiguo(usuarios: UsuarioAdmin[]): UsuarioAdmin | null {
  let mejor: UsuarioAdmin | null = null
  let tMejor = Infinity
  for (const u of usuarios) {
    const t = u.created_at ? new Date(u.created_at).getTime() : NaN
    const tt = Number.isNaN(t) ? Infinity : t
    if (!mejor || tt < tMejor || (tt === tMejor && u.id < mejor.id)) {
      mejor = u
      tMejor = tt
    }
  }
  return mejor
}

/** Rol efectivo del administrador `id` según la lista completa de administradores. */
export function rolEfectivo(id: string, usuarios: UsuarioAdmin[], duenos: string[]): Rol | null {
  const u = usuarios.find((x) => x.id === id)
  if (!u) return null
  if (duenos.includes(String(u.email || "").toLowerCase())) return "dueno"
  const r = String(u.metadata?.panel_rol || "")
  if (u.metadata?.panel_rol) return (ROLES_VALIDOS as string[]).includes(r) ? (r as Rol) : "sin_acceso"
  // Sin rol asignado
  if (!usuarios.some(tieneRol)) return "dueno" // arranque: nadie tiene rol todavía
  if (masAntiguo(usuarios)?.id === u.id) return "dueno" // el dueño original no se queda fuera
  return "sin_acceso"
}

export type Decision = { pasa: true; rol?: Rol; motivo: string } | { pasa: false; estado: number; mensaje: string; rol?: Rol }

export type Entrada = {
  auth?: { actor_type?: string; actor_id?: string } | null
  metodo: string
  url: string
  usuarios: UsuarioAdmin[] | null // null: no se pudo leer la lista
  duenos: string[]
  interruptor?: string
}

export const MSG_SIN_PERMISO =
  "Tu rol del HETNA Panel no permite usar esta función del sistema de administración. Si la necesitas, pídele al dueño que cambie tu rol en Equipo."
export const MSG_SIN_ACCESO =
  "Tu cuenta de administrador no tiene acceso: aún no tienes un rol del HETNA Panel. Pídele al dueño que te asigne uno en Equipo."

/** ¿El middleware está apagado por el interruptor de emergencia? */
export const apagado = (v: string | undefined) => ["off", "0", "false", "no"].includes(String(v || "").trim().toLowerCase())

/** Decisión pura (sin base de datos): ¿pasa la petición? */
export function decidir(e: Entrada): Decision {
  if (apagado(e.interruptor)) return { pasa: true, motivo: "interruptor_off" }
  // Sólo sesiones de un usuario administrador. Claves API secretas
  // (actor_type "api-key"), invitaciones sin aceptar (sin actor_id) y rutas
  // públicas pasan sin cambios.
  if (e.auth?.actor_type !== "user" || !e.auth?.actor_id) return { pasa: true, motivo: "no_es_usuario" }
  if (!e.usuarios) {
    return { pasa: false, estado: 503, mensaje: "No pude revisar tu rol del HETNA Panel en este momento. Intenta de nuevo en un minuto." }
  }
  const rol = rolEfectivo(e.auth.actor_id, e.usuarios, e.duenos)
  if (!rol) return { pasa: false, estado: 403, mensaje: MSG_SIN_ACCESO }
  if (rol === "dueno") return { pasa: true, rol, motivo: "dueno" }
  if (rutaPermitida(rol, e.metodo, e.url)) return { pasa: true, rol, motivo: "lista_blanca" }
  return { pasa: false, estado: 403, rol, mensaje: rol === "sin_acceso" ? MSG_SIN_ACCESO : MSG_SIN_PERMISO }
}
