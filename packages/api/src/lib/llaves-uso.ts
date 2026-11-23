// Llaves API del panel (n8n, bot de WhatsApp…): qué funciones usan de verdad
// (Fase 3.3 de docs/analisis-sap-fase0.md, "primero observar, luego cerrar").
//
// Hoy una clave secreta de admin pasa por todo /admin/* (lib/panel-roles.ts).
// Antes de limitarla hay que saber qué usa cada una, para no romper ninguna
// automatización. Aquí sólo se ANOTA: método, ruta (con los ids cambiados por
// :id), cuántas veces, primera y última vez y el último resultado. Nada se
// bloquea. Con dos semanas de datos se arma la lista blanca de cada llave.
//
// Para no escribir en la base en cada petición, se junta en memoria y se
// guarda cada minuto.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const T_LLAVE_USO = "hetna_llave_uso"

let lista: Promise<void> | null = null
export function asegurarLlaveUso(knex: any): Promise<void> {
  lista ??= (async () => {
    if (!(await knex.schema.hasTable(T_LLAVE_USO))) {
      await knex.schema.createTable(T_LLAVE_USO, (t: any) => {
        t.text("llave").notNullable()
        t.text("metodo").notNullable()
        t.text("ruta").notNullable()
        t.integer("veces").notNullable().defaultTo(0)
        t.integer("ultimo_estado")
        t.timestamp("primera", { useTz: true }).notNullable().defaultTo(knex.fn.now())
        t.timestamp("ultima", { useTz: true }).notNullable().defaultTo(knex.fn.now())
        t.primary(["llave", "metodo", "ruta"])
      })
    }
  })().catch((e) => {
    lista = null
    throw e
  })
  return lista
}

/**
 * Ruta con los ids cambiados por :id, para que /admin/orders/order_01J… y
 * /admin/orders/order_02K… cuenten como la misma función.
 */
export function patronRuta(url: string): string {
  const ruta = String(url || "").split("?")[0].split("#")[0].replace(/\/+$/, "") || "/"
  return ruta
    .split("/")
    .map((s) => {
      if (!s) return s
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return ":id"
      if (/^[a-z]+_[0-9A-Z]{20,}$/.test(s)) return ":id" // ids de Medusa (order_01J…)
      if (/^\d+$/.test(s)) return ":id"
      if (s.length >= 16 && /\d/.test(s) && /^[A-Za-z0-9_-]+$/.test(s)) return ":id" // tokens y folios largos
      return s.slice(0, 80)
    })
    .join("/")
    .slice(0, 200)
}

type Uso = { llave: string; metodo: string; ruta: string; veces: number; estado: number; primera: Date; ultima: Date }
const pendientes = new Map<string, Uso>()
let reloj: NodeJS.Timeout | null = null
let ultimoError = 0

async function guardar(knex: any) {
  if (!pendientes.size) return
  const filas = [...pendientes.values()]
  pendientes.clear()
  try {
    await asegurarLlaveUso(knex)
    for (const f of filas) {
      await knex(T_LLAVE_USO)
        .insert({ llave: f.llave, metodo: f.metodo, ruta: f.ruta, veces: f.veces, ultimo_estado: f.estado, primera: f.primera, ultima: f.ultima })
        .onConflict(["llave", "metodo", "ruta"])
        .merge({ veces: knex.raw(`${T_LLAVE_USO}.veces + excluded.veces`), ultimo_estado: knex.raw("excluded.ultimo_estado"), ultima: knex.raw("excluded.ultima") })
    }
  } catch (e) {
    if (Date.now() - ultimoError > 3_600_000) {
      ultimoError = Date.now()
      console.error(`[llaves-uso] no se pudo guardar: ${(e as Error)?.message || e}`)
    }
  }
}

/** Anota una petición hecha con una clave API (en memoria). */
export function anotarUso(llave: string, metodo: string, url: string, estado: number, ahora = new Date()) {
  const ruta = patronRuta(url)
  const k = `${llave}|${metodo}|${ruta}`
  const u = pendientes.get(k)
  if (u) {
    u.veces++
    u.estado = estado
    u.ultima = ahora
  } else {
    pendientes.set(k, { llave, metodo, ruta, veces: 1, estado, primera: ahora, ultima: ahora })
  }
}

/** Middleware de /admin/*: sólo observa las peticiones con clave API; nunca bloquea. */
export function observarLlaves(req: any, res: any, next: any) {
  res.on("finish", () => {
    try {
      const auth = req.auth_context
      if (auth?.actor_type !== "api-key" || !auth?.actor_id) return
      anotarUso(String(auth.actor_id), String(req.method || "GET").toUpperCase(), String(req.originalUrl || req.url || ""), res.statusCode)
      if (!reloj) {
        const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
        reloj = setTimeout(() => {
          reloj = null
          void guardar(knex)
        }, 60_000)
        reloj.unref?.()
      }
    } catch {
      // Observar nunca tumba una petición
    }
  })
  next()
}

/** Lo observado, con el nombre de cada llave (tabla api_key de Medusa). */
export async function usoDeLlaves(knex: any) {
  await asegurarLlaveUso(knex)
  const filas = await knex(`${T_LLAVE_USO} as u`)
    .leftJoin("api_key as k", "k.id", "u.llave")
    .select("u.llave", "k.title", "k.redacted", "k.revoked_at", "u.metodo", "u.ruta", "u.veces", "u.ultimo_estado", "u.primera", "u.ultima")
    .orderBy([{ column: "k.title" }, { column: "u.veces", order: "desc" }])
    .limit(2000)
  type Ruta = { metodo: string; ruta: string; veces: number; ultimo_estado: number | null; ultima: string }
  type Llave = { llave: string; nombre: string; revocada: boolean; desde: string | null; rutas: Ruta[] }
  const porLlave = new Map<string, Llave>()
  for (const f of filas as any[]) {
    const x: Llave = porLlave.get(f.llave) || { llave: f.llave, nombre: f.title || f.redacted || f.llave, revocada: !!f.revoked_at, desde: null, rutas: [] }
    const primera = new Date(f.primera).toISOString()
    if (!x.desde || primera < x.desde) x.desde = primera
    x.rutas.push({ metodo: f.metodo, ruta: f.ruta, veces: Number(f.veces), ultimo_estado: f.ultimo_estado ?? null, ultima: new Date(f.ultima).toISOString() })
    porLlave.set(f.llave, x)
  }
  return [...porLlave.values()]
}

export function _pendientesParaPruebas() {
  return pendientes
}
