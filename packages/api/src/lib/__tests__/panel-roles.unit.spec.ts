import fs from "fs"
import path from "path"

import {
  ACCIONES,
  PAGINAS_ROL,
  type UsuarioAdmin,
  decidir,
  duenosDeEnv,
  rolEfectivo,
  rutaPermitida,
} from "../panel-roles"

// Archivo de la tienda con la tabla original de roles
const ROLES_TIENDA = path.resolve(__dirname, "../../../../../apps/storefront/src/lib/panel/roles.ts")

const user = (id: string) => ({ actor_type: "user", actor_id: id })
const u = (id: string, email: string, creado: string, panel_rol?: string): UsuarioAdmin => ({
  id,
  email,
  created_at: creado,
  metadata: panel_rol ? { panel_rol } : {},
})

describe("panel-roles: misma tabla que la tienda", () => {
  it("roles, páginas y acciones coinciden con apps/storefront/src/lib/panel/roles.ts", () => {
    expect(fs.existsSync(ROLES_TIENDA)).toBe(true)
    // roles.ts no importa nada: se carga tal cual (jest lo transforma con swc)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tienda = require(ROLES_TIENDA)
    const paginasTienda = Object.fromEntries(
      Object.entries(tienda.ROLES as Record<string, { paginas: string[] }>).map(([k, v]) => [k, [...v.paginas].sort()])
    )
    const paginasApi = Object.fromEntries(Object.entries(PAGINAS_ROL).map(([k, v]) => [k, [...v].sort()]))
    expect(paginasApi).toEqual(paginasTienda)
    expect(ACCIONES).toEqual(tienda.ACCIONES)
    // Toda página de la tienda (salvo Equipo, sólo dueño) tiene rutas en la lista blanca
    const claves = (tienda.PAGINAS as { clave: string }[]).map((p) => p.clave)
    expect(claves.sort()).toEqual([...PAGINAS_ROL.dueno].sort())
  })
})

describe("panel-roles: decisión", () => {
  const dueno = u("user_1", "dueno@hetna.mx", "2025-01-01T00:00:00Z")
  const ana = u("user_2", "ana@hetna.mx", "2025-06-01T00:00:00Z")
  const beto = u("user_3", "beto@hetna.mx", "2025-07-01T00:00:00Z")
  const base = { duenos: [] as string[] }

  it("clave API secreta pasa siempre, aunque haya roles", () => {
    const usuarios = [dueno, u("user_2", "ana@hetna.mx", "2025-06-01", "soporte")]
    for (const url of ["/admin/users", "/admin/api-keys", "/admin/products?limit=5"]) {
      expect(decidir({ ...base, auth: { actor_type: "api-key", actor_id: "apk_1" }, metodo: "POST", url, usuarios }).pasa).toBe(true)
    }
    // Ni siquiera necesita la lista de usuarios
    expect(decidir({ ...base, auth: { actor_type: "api-key", actor_id: "apk_1" }, metodo: "DELETE", url: "/admin/users/x", usuarios: null }).pasa).toBe(true)
  })

  it("sin sesión de usuario (invitación sin aceptar, ruta pública) pasa", () => {
    expect(decidir({ ...base, auth: { actor_type: "user", actor_id: "" }, metodo: "POST", url: "/admin/invites/accept", usuarios: null }).pasa).toBe(true)
    expect(decidir({ ...base, auth: undefined, metodo: "GET", url: "/admin/feature-flags", usuarios: null }).pasa).toBe(true)
  })

  it("arranque: nadie tiene rol → todos son dueño", () => {
    const usuarios = [dueno, ana, beto]
    expect(rolEfectivo("user_3", usuarios, [])).toBe("dueno")
    expect(decidir({ ...base, auth: user("user_3"), metodo: "POST", url: "/admin/api-keys", usuarios }).pasa).toBe(true)
  })

  it("PANEL_DUENOS da dueño aunque tenga rol limitado o no tenga rol", () => {
    const usuarios = [dueno, u("user_2", "Ana@Hetna.mx", "2025-06-01", "soporte"), beto]
    const duenos = duenosDeEnv(" ana@hetna.mx , beto@hetna.mx")
    expect(rolEfectivo("user_2", usuarios, duenos)).toBe("dueno")
    expect(rolEfectivo("user_3", usuarios, duenos)).toBe("dueno")
    expect(decidir({ auth: user("user_3"), metodo: "POST", url: "/admin/users/user_2", usuarios, duenos }).pasa).toBe(true)
  })

  it("rol dueño pasa todo", () => {
    const usuarios = [dueno, u("user_2", "ana@hetna.mx", "2025-06-01", "dueno")]
    expect(decidir({ ...base, auth: user("user_2"), metodo: "DELETE", url: "/admin/users/user_1", usuarios }).pasa).toBe(true)
  })

  it("rol limitado: lo que usa su panel pasa (con consulta en la URL)", () => {
    const usuarios = [dueno, u("user_2", "ana@hetna.mx", "2025-06-01", "operaciones")]
    const pasa = (metodo: string, url: string) => decidir({ ...base, auth: user("user_2"), metodo, url, usuarios }).pasa
    expect(pasa("GET", "/admin/users/me")).toBe(true)
    expect(pasa("GET", "/admin/hetna-control?dias=7")).toBe(true)
    expect(pasa("GET", "/admin/orders?limit=30&order=-created_at&fields=id,*items")).toBe(true)
    expect(pasa("POST", "/admin/orders/order_01ABC/cancel")).toBe(true)
    expect(pasa("GET", "/admin/hetna-solicitudes?etapa=revision")).toBe(true)
    expect(pasa("POST", "/admin/hetna-solicitudes/sol_1/accion")).toBe(true)
    expect(pasa("GET", "/admin/hetna-verificacion?estado=pendiente")).toBe(true)
    expect(pasa("GET", "/admin/hetna-verificacion/sel_1/archivos/arc_1")).toBe(true)
    expect(pasa("POST", "/admin/hetna-verificacion/sel_1")).toBe(true)
  })

  it("rol limitado: lo que no le toca → 403 con mensaje en español", () => {
    const usuarios = [dueno, u("user_2", "ana@hetna.mx", "2025-06-01", "finanzas"), u("user_3", "beto@hetna.mx", "2025-07-01", "ventas")]
    const d = decidir({ ...base, auth: user("user_2"), metodo: "POST", url: "/admin/orders/o_1/cancel", usuarios })
    expect(d).toMatchObject({ pasa: false, estado: 403 })
    expect((d as any).mensaje).toMatch(/rol del HETNA Panel/)
    // Finanzas sólo lee: no distribuidores, no licitaciones
    expect(decidir({ ...base, auth: user("user_2"), metodo: "GET", url: "/admin/hetna-solicitudes", usuarios }).pasa).toBe(false)
    // Ventas: cotizador y distribuidores sí, pedidos no
    expect(decidir({ ...base, auth: user("user_3"), metodo: "POST", url: "/admin/hetna-distribuidores", usuarios }).pasa).toBe(true)
    expect(decidir({ ...base, auth: user("user_3"), metodo: "GET", url: "/admin/orders", usuarios }).pasa).toBe(false)
    // Soporte no tiene Inicio
    expect(rutaPermitida("soporte", "GET", "/admin/hetna-control")).toBe(false)
    // Patrón anclado: no se cuela por prefijo o sufijo
    expect(rutaPermitida("operaciones", "GET", "/admin/orders/o_1")).toBe(false)
    expect(rutaPermitida("operaciones", "POST", "/admin/orders/o_1/cancel/extra")).toBe(false)
    expect(rutaPermitida("operaciones", "GET", "/admin/hetna-controlx")).toBe(false)
  })

  it("rutas prohibidas para cualquier rol limitado", () => {
    const prohibidas: [string, string][] = [
      ["GET", "/admin/users"],
      ["POST", "/admin/users/user_2"], // cambiar su metadata (asignarse panel_rol)
      ["POST", "/admin/users/me"],
      ["DELETE", "/admin/users/user_1"],
      ["GET", "/admin/invites"],
      ["POST", "/admin/invites"],
      ["POST", "/admin/api-keys"],
      ["GET", "/admin/api-keys"],
      ["GET", "/admin/payouts"],
      ["POST", "/admin/hetna-pagos"],
      ["POST", "/admin/stores/store_1"],
      ["POST", "/admin/regions"],
      ["GET", "/admin/products"],
      ["DELETE", "/admin/hetna-solicitudes/sol_1/accion"],
    ]
    for (const rol of ["operaciones", "ventas", "finanzas", "soporte", "sin_acceso"] as const) {
      const usuarios = [dueno, u("user_2", "ana@hetna.mx", "2025-06-01", rol)]
      for (const [metodo, url] of prohibidas) {
        expect({ rol, metodo, url, pasa: decidir({ ...base, auth: user("user_2"), metodo, url, usuarios }).pasa }).toEqual({ rol, metodo, url, pasa: false })
      }
    }
  })

  it("sin_acceso sólo puede saber quién es", () => {
    const usuarios = [dueno, u("user_2", "ana@hetna.mx", "2025-06-01", "sin_acceso")]
    expect(decidir({ ...base, auth: user("user_2"), metodo: "GET", url: "/admin/users/me", usuarios }).pasa).toBe(true)
    expect(decidir({ ...base, auth: user("user_2"), metodo: "GET", url: "/admin/hetna-control", usuarios }).pasa).toBe(false)
  })

  it("panel_rol desconocido cuenta como rol asignado y da sin acceso", () => {
    const usuarios = [dueno, u("user_2", "ana@hetna.mx", "2025-06-01", "superadmin")]
    expect(rolEfectivo("user_2", usuarios, [])).toBe("sin_acceso")
    expect(rolEfectivo("user_1", usuarios, [])).toBe("dueno") // más antiguo
  })

  it("interruptor PANEL_ROLES_API=off: todo pasa", () => {
    const usuarios = [dueno, u("user_2", "ana@hetna.mx", "2025-06-01", "soporte")]
    expect(decidir({ ...base, auth: user("user_2"), metodo: "POST", url: "/admin/api-keys", usuarios, interruptor: "off" }).pasa).toBe(true)
    expect(decidir({ ...base, auth: user("user_2"), metodo: "POST", url: "/admin/api-keys", usuarios, interruptor: "OFF " }).pasa).toBe(true)
    expect(decidir({ ...base, auth: user("user_2"), metodo: "POST", url: "/admin/api-keys", usuarios, interruptor: "on" }).pasa).toBe(false)
    expect(decidir({ ...base, auth: user("user_2"), metodo: "POST", url: "/admin/api-keys", usuarios, interruptor: undefined }).pasa).toBe(false)
  })

  it("caso de bloqueo: el dueño sin rol asigna el PRIMER rol limitado y sigue siendo dueño", () => {
    // Antes: nadie tiene rol → los tres son dueño
    expect(rolEfectivo("user_1", [dueno, ana, beto], [])).toBe("dueno")
    // El dueño (más antiguo, sin panel_rol) le pone "soporte" a Ana por /dashboard o API
    const despues = [dueno, u("user_2", "ana@hetna.mx", "2025-06-01", "soporte"), beto]
    expect(rolEfectivo("user_1", despues, [])).toBe("dueno")
    expect(decidir({ ...base, auth: user("user_1"), metodo: "POST", url: "/admin/users/user_2", usuarios: despues }).pasa).toBe(true)
    // Beto (sin rol, no es el más antiguo) deja de ser dueño: sin acceso
    expect(rolEfectivo("user_3", despues, [])).toBe("sin_acceso")
    const d = decidir({ ...base, auth: user("user_3"), metodo: "GET", url: "/admin/orders", usuarios: despues })
    expect(d).toMatchObject({ pasa: false, estado: 403 })
    // Un invitado nuevo sin rol tampoco es dueño (el más antiguo es de TODOS)
    const nuevo = u("user_9", "nuevo@hetna.mx", "2026-11-01T00:00:00Z")
    expect(rolEfectivo("user_9", [...despues, nuevo], [])).toBe("sin_acceso")
    // Si el dueño original no es el más antiguo, PANEL_DUENOS lo rescata
    expect(rolEfectivo("user_3", despues, ["beto@hetna.mx"])).toBe("dueno")
  })

  it("administrador que no está en la lista → 403; lista ilegible → 503", () => {
    const usuarios = [dueno]
    expect(decidir({ ...base, auth: user("user_x"), metodo: "GET", url: "/admin/users/me", usuarios })).toMatchObject({ pasa: false, estado: 403 })
    expect(decidir({ ...base, auth: user("user_1"), metodo: "GET", url: "/admin/orders", usuarios: null })).toMatchObject({ pasa: false, estado: 503 })
  })
})
