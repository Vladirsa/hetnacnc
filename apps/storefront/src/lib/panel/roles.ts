// HETNA Panel: qué página ve cada rol. El rol vive en el usuario administrador
// de Medusa (metadata.panel_rol); lo asigna un "dueño" desde Equipo.
export type Rol = "dueno" | "operaciones" | "ventas" | "finanzas" | "soporte" | "sin_acceso"

export type Pagina = { clave: string; nombre: string; icono: string; ruta: string; que: string }

export const PAGINAS: Pagina[] = [
  { clave: "inicio", nombre: "Inicio", icono: "📊", ruta: "/panel", que: "Ventas, saldos y avisos del día" },
  { clave: "pedidos", nombre: "Pedidos", icono: "📦", ruta: "/panel/pedidos", que: "Últimos pedidos de la tienda y su estado" },
  { clave: "licitaciones", nombre: "Licitaciones", icono: "📋", ruta: "/panel/licitaciones", que: "Solicitudes de fabricación por revisar y en curso" },
  { clave: "talleres", nombre: "Talleres", icono: "🏭", ruta: "/panel/talleres", que: "Verificaciones pendientes de talleres" },
  { clave: "cotizador", nombre: "App", icono: "📱", ruta: "/panel/cotizador", que: "Talleres del Cotizador: prueba, gratis, pagando" },
  { clave: "equipo", nombre: "Equipo", icono: "👥", ruta: "/panel/equipo", que: "Quién entra al panel y qué ve" },
]

export const ROLES: Record<Rol, { nombre: string; paginas: string[]; que: string }> = {
  dueno: { nombre: "Dueño", paginas: PAGINAS.map((p) => p.clave), que: "Todo, incluido Equipo" },
  operaciones: { nombre: "Operaciones", paginas: ["inicio", "pedidos", "licitaciones", "talleres"], que: "Pedidos, licitaciones y talleres" },
  ventas: { nombre: "Ventas", paginas: ["inicio", "licitaciones", "cotizador"], que: "Licitaciones y talleres de la app" },
  finanzas: { nombre: "Finanzas", paginas: ["inicio", "pedidos"], que: "Ventas, saldos y pedidos" },
  soporte: { nombre: "Soporte", paginas: ["pedidos", "talleres"], que: "Pedidos y verificaciones" },
  sin_acceso: { nombre: "Sin acceso", paginas: [], que: "No entra al panel" },
}

export function rolDe(metadata: Record<string, unknown> | null | undefined, arranque = false): Rol {
  const r = String(metadata?.panel_rol || "")
  if (r in ROLES) return r as Rol
  // Sin rol asignado: dueño sólo durante el arranque (nadie tiene rol todavía)
  return arranque ? "dueno" : "sin_acceso"
}

export const puede = (rol: Rol, pagina: string) => ROLES[rol]?.paginas.includes(pagina) ?? false
