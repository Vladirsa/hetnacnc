// Licitaciones 3.0 — Fase 1: privacidad inteligente y modalidades.
// (docs/licitaciones-especificacion-maestra.md, sección 1)
//
// El cliente decide, elemento por elemento, qué ven los talleres y qué sale en
// público. TODA salida (tablero público, panel del taller, correos, avisos al
// celular y redes) pasa por las funciones de aquí: así una regla no se olvida
// en un rincón.
//
// Modalidades:
//   publica      cualquier taller compatible la encuentra
//   privada      sólo los talleres invitados (tabla hetna_solicitud_invitado)
//   restringida  sale en el catálogo, pero los planos y archivos completos
//                requieren autorización del cliente (hetna_solicitud_acceso)
// La columna vieja `modo` (abierta | directa) se conserva: directa = un taller
// elegido por el cliente, que cuenta como invitado.
//
// "Participante" = taller invitado, con acceso aprobado, que ya mandó
// propuesta, o el taller al que va dirigida.
import { T_PROPUESTA, T_SOLICITUD, ocultarContacto, recibePropuestas, type Trabajo } from "./licitacion"

export const T_INVITADO = "hetna_solicitud_invitado"
export const T_ACCESO = "hetna_solicitud_acceso"

export type Modalidad = "publica" | "privada" | "restringida"
export type Privacidad = {
  nombre: "publico" | "empresa" | "anonimo"
  presupuesto: "visible" | "confidencial"
  descripcion: "publica" | "participantes"
  archivos: "publicos" | "privados" | "autorizacion"
  fotos: "publicas" | "privadas"
  ubicacion: "ciudad" | "estado" | "confidencial"
  contacto: "oculto" | "autorizacion"
  empresa: "publico" | "confidencial"
}

const OPCIONES: { [K in keyof Privacidad]: Privacidad[K][] } = {
  nombre: ["publico", "empresa", "anonimo"],
  presupuesto: ["visible", "confidencial"],
  descripcion: ["publica", "participantes"],
  archivos: ["publicos", "privados", "autorizacion"],
  fotos: ["publicas", "privadas"],
  ubicacion: ["ciudad", "estado", "confidencial"],
  contacto: ["oculto", "autorizacion"],
  empresa: ["publico", "confidencial"],
}

// Lo que tenían las solicitudes antes de la Fase 1 (así no cambia nada para
// ellas): el taller ve todo menos el contacto, sin nombre del cliente.
export const PRIVACIDAD_ANTERIOR: Privacidad = {
  nombre: "anonimo",
  presupuesto: "visible",
  descripcion: "publica",
  archivos: "publicos",
  fotos: "publicas",
  ubicacion: "ciudad",
  contacto: "oculto",
  empresa: "confidencial",
}

// Lo que propone el formulario a un cliente nuevo
export const PRIVACIDAD_SUGERIDA: Privacidad = { ...PRIVACIDAD_ANTERIOR }

export const MODALIDADES: Modalidad[] = ["publica", "privada", "restringida"]

export function leerPrivacidad(v: unknown): Privacidad {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>
  const r = { ...PRIVACIDAD_ANTERIOR } as Record<string, string>
  for (const k of Object.keys(OPCIONES) as (keyof Privacidad)[]) {
    const x = String(o[k] ?? "")
    if ((OPCIONES[k] as string[]).includes(x)) r[k] = x
  }
  return r as unknown as Privacidad
}

export const leerModalidad = (v: unknown): Modalidad => (MODALIDADES.includes(v as Modalidad) ? (v as Modalidad) : "publica")

export const privacidadDe = (s: any): Privacidad => leerPrivacidad(s?.privacidad)
export const modalidadDe = (s: any): Modalidad => leerModalidad(s?.modalidad)

let lista = false
export async function asegurarPrivacidad(knex: any) {
  if (lista) return
  for (const [col, crear] of [
    ["modalidad", (t: any) => t.text("modalidad").notNullable().defaultTo("publica")],
    ["privacidad", (t: any) => t.jsonb("privacidad").nullable()],
    ["difundir_redes", (t: any) => t.boolean("difundir_redes").notNullable().defaultTo(false)],
    ["compartir_contacto", (t: any) => t.boolean("compartir_contacto").notNullable().defaultTo(false)],
  ] as const) {
    if (!(await knex.schema.hasColumn(T_SOLICITUD, col))) await knex.schema.alterTable(T_SOLICITUD, crear)
  }
  if (!(await knex.schema.hasTable(T_INVITADO))) {
    await knex.schema.createTable(T_INVITADO, (t: any) => {
      t.text("solicitud_id").notNullable().index()
      t.text("seller_id").notNullable().index()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.primary(["solicitud_id", "seller_id"])
    })
  }
  if (!(await knex.schema.hasTable(T_ACCESO))) {
    await knex.schema.createTable(T_ACCESO, (t: any) => {
      t.text("solicitud_id").notNullable().index()
      t.text("seller_id").notNullable().index()
      t.text("estado").notNullable().defaultTo("pendiente") // pendiente | aprobado | rechazado
      t.text("mensaje").nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("resuelto_en", { useTz: true }).nullable()
      t.primary(["solicitud_id", "seller_id"])
    })
  }
  lista = true
}

/** Relación de un taller con una solicitud. */
export type RelacionTaller = { invitado: boolean; acceso: "ninguno" | "pendiente" | "aprobado" | "rechazado"; propuso: boolean; elegido: boolean }

export async function relacionTaller(knex: any, s: any, sellerId: string): Promise<RelacionTaller> {
  await asegurarPrivacidad(knex)
  const [inv, acc, prop] = await Promise.all([
    knex(T_INVITADO).where({ solicitud_id: s.id, seller_id: sellerId }).first("seller_id"),
    knex(T_ACCESO).where({ solicitud_id: s.id, seller_id: sellerId }).first("estado"),
    knex(T_PROPUESTA).where({ solicitud_id: s.id, seller_id: sellerId }).first("id"),
  ])
  const elegidaId = s.propuesta_elegida
  return {
    invitado: !!inv || s.taller_id === sellerId,
    acceso: (acc?.estado as RelacionTaller["acceso"]) || "ninguno",
    propuso: !!prop,
    elegido: !!(prop && elegidaId && prop.id === elegidaId),
  }
}

/** Relaciones de un taller con varias solicitudes (para listas). */
export async function relacionesTaller(knex: any, filas: any[], sellerId: string): Promise<Map<string, RelacionTaller>> {
  await asegurarPrivacidad(knex)
  const ids = filas.map((f) => f.id)
  const mapa = new Map<string, RelacionTaller>()
  if (!ids.length) return mapa
  const [inv, acc, prop] = await Promise.all([
    knex(T_INVITADO).whereIn("solicitud_id", ids).where({ seller_id: sellerId }).select("solicitud_id"),
    knex(T_ACCESO).whereIn("solicitud_id", ids).where({ seller_id: sellerId }).select("solicitud_id", "estado"),
    knex(T_PROPUESTA).whereIn("solicitud_id", ids).where({ seller_id: sellerId }).select("solicitud_id", "id"),
  ])
  const sInv = new Set(inv.map((x: any) => x.solicitud_id))
  const mAcc = new Map(acc.map((x: any) => [x.solicitud_id, x.estado]))
  const mProp = new Map(prop.map((x: any) => [x.solicitud_id, x.id]))
  for (const f of filas) {
    mapa.set(f.id, {
      invitado: sInv.has(f.id) || f.taller_id === sellerId,
      acceso: (mAcc.get(f.id) as RelacionTaller["acceso"]) || "ninguno",
      propuso: mProp.has(f.id),
      elegido: !!(f.propuesta_elegida && mProp.get(f.id) === f.propuesta_elegida),
    })
  }
  return mapa
}

/** ¿Puede este taller ver la solicitud en su panel? */
export const tallerPuedeVer = (s: any, r: RelacionTaller) => modalidadDe(s) !== "privada" || r.invitado || r.propuso

const esParticipante = (r: RelacionTaller) => r.invitado || r.acceso === "aprobado" || r.propuso || r.elegido

const EXT_FOTO = /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i
export const esFoto = (nombre: string) => EXT_FOTO.test(nombre || "")

/** ¿Este taller puede descargar este archivo? */
export function puedeDescargar(s: any, r: RelacionTaller, nombreArchivo: string): boolean {
  if (r.elegido) return true
  const p = privacidadDe(s)
  if (esFoto(nombreArchivo)) {
    if (p.fotos === "privadas") return false
    return modalidadDe(s) === "restringida" ? r.acceso === "aprobado" || r.invitado : true
  }
  if (p.archivos === "privados") return false
  if (p.archivos === "autorizacion" || modalidadDe(s) === "restringida") return r.acceso === "aprobado" || r.invitado
  return true
}

/** Nombre con el que el taller ve al cliente. */
export function clienteVisible(s: any): string {
  const p = privacidadDe(s)
  const c = s?.contacto || {}
  const empresa = p.empresa === "publico" ? String(c.empresa || "").trim() : ""
  if (p.nombre === "publico" && c.nombre) return empresa ? `${c.nombre} · ${empresa}` : String(c.nombre)
  if (p.nombre === "empresa" && empresa) return empresa
  return "Cliente HETNA"
}

function ubicacion(p: Privacidad): Partial<Trabajo> {
  if (p.ubicacion === "confidencial") return { ciudad: "", estado_mx: "", cp: "" }
  if (p.ubicacion === "estado") return { ciudad: "", cp: "" }
  return {}
}

/** El trabajo tal como lo ve un taller (panel, correo, aviso). */
export function trabajoParaTaller(s: any, r: RelacionTaller) {
  const t = (s?.trabajo || {}) as Trabajo
  const p = privacidadDe(s)
  const participante = esParticipante(r)
  const archivos = (t.archivos || []).map((a) => ({
    nombre: a.nombre,
    tamano: a.tamano,
    descargable: puedeDescargar(s, r, a.nombre),
  }))
  const verDescripcion = p.descripcion === "publica" || participante
  return {
    ...t,
    ...ubicacion(p),
    descripcion: verDescripcion ? ocultarContacto(t.descripcion || "") : "",
    descripcion_restringida: !verDescripcion,
    presupuesto: p.presupuesto === "visible" ? t.presupuesto || "" : "",
    presupuesto_confidencial: p.presupuesto === "confidencial" && !!t.presupuesto,
    archivo: "",
    archivos,
    cliente: clienteVisible(s),
  }
}

/** El trabajo como sale en el tablero público /trabajos (más estricto). */
export function trabajoPublicoPrivado(s: any) {
  const t = (s?.trabajo || {}) as Trabajo
  const p = privacidadDe(s)
  const u = ubicacion(p)
  return {
    ciudad: u.ciudad ?? t.ciudad ?? "",
    estado_mx: u.estado_mx ?? t.estado_mx ?? "",
    descripcion: p.descripcion === "publica" ? ocultarContacto(t.descripcion || "").slice(0, 1200) : "",
    descripcion_restringida: p.descripcion !== "publica",
    presupuesto: p.presupuesto === "visible" ? t.presupuesto || "" : "",
    modalidad: modalidadDe(s),
    tipo: s?.tipo === "suministro" ? "suministro" : "fabricacion",
    cliente: clienteVisible(s),
  }
}

/** Texto corto y sin datos sensibles para redes sociales (sección 1.3). */
export function resumenRedes(s: any): string {
  const t = (s?.trabajo || {}) as Trabajo
  const p = privacidadDe(s)
  const quien = p.nombre === "empresa" && p.empresa === "publico" && s?.contacto?.empresa ? String(s.contacto.empresa) : "Un cliente"
  const que = [t.servicio, t.material && `en ${t.material}`].filter(Boolean).join(" ")
  const lote = t.frecuencia && !/una vez|única|unica/i.test(t.frecuencia) ? "Producción recurrente." : t.cantidad ? `Cantidad: ${t.cantidad}.` : ""
  const donde = p.ubicacion === "confidencial" ? "" : p.ubicacion === "estado" ? t.estado_mx || "" : [t.ciudad, t.estado_mx].filter(Boolean).join(", ")
  return [
    `${quien} busca talleres CNC${que ? ` para ${que.toLowerCase()}` : ""}.`,
    lote,
    donde ? `Ubicación: ${donde}.` : "",
    "Proyecto disponible para cotización en HETNA CNC.",
  ]
    .filter(Boolean)
    .join(" ")
}

/** Los ids de los talleres invitados a una solicitud privada (y el directo). */
export async function invitadosDe(knex: any, s: any): Promise<string[]> {
  await asegurarPrivacidad(knex)
  const filas = await knex(T_INVITADO).where({ solicitud_id: s.id }).select("seller_id")
  const ids = new Set<string>(filas.map((f: any) => f.seller_id))
  if (s.taller_id) ids.add(s.taller_id)
  return [...ids]
}

/** Invita talleres por su handle (nombre de tienda). Devuelve los que existían. */
export async function invitarTalleres(knex: any, solicitudId: string, handles: unknown): Promise<{ id: string; name: string; email: string | null }[]> {
  await asegurarPrivacidad(knex)
  const lista = (Array.isArray(handles) ? handles : String(handles || "").split(/[,\s]+/))
    .map((h) => String(h || "").trim().toLowerCase())
    .filter((h) => /^[a-z0-9-]{2,120}$/.test(h))
    .slice(0, 20)
  if (!lista.length) return []
  const talleres = await knex("seller").whereIn("handle", lista).whereNull("deleted_at").select("id", "name", "email")
  for (const t of talleres) {
    await knex(T_INVITADO).insert({ solicitud_id: solicitudId, seller_id: t.id }).onConflict(["solicitud_id", "seller_id"]).ignore()
  }
  return talleres
}

/** ¿Puede descargar AHORA? Igual que puedeDescargar, pero en cuanto el cliente
 *  elige taller o la solicitud deja de recibir propuestas, sólo el elegido
 *  conserva el acceso: los que cotizaron y no ganaron ya no bajan los planos.
 *  Se revisa al dar la liga y otra vez al abrirla (lib/archivo-acceso). */
export function puedeDescargarAhora(s: any, r: RelacionTaller, nombreArchivo: string): boolean {
  if (r.elegido) return true
  if (s.propuesta_elegida || !recibePropuestas(s)) return false
  return tallerPuedeVer(s, r) && puedeDescargar(s, r, nombreArchivo)
}
