// Descargas de los archivos de una solicitud: con permiso revisado al momento
// del clic y registradas. Auditoría del 12 nov 2026, problema 4.
//
// Quien puede ver un archivo (el taller en su panel, HETNA en el dashboard)
// recibe una liga de HETNA, no de Backblaze:
//
//   https://hetnacnc.com/api/hetna-archivo/<token>
//
// El token está firmado (HMAC) y dice qué archivo, de qué solicitud, para
// quién y hasta cuándo (1 hora). Al abrirla, GET /api/hetna-archivo/:token
// vuelve a revisar el permiso (un taller que no fue elegido ya no puede),
// anota la descarga en T_ACCESO_ARCHIVO y redirige a una liga de Backblaze que
// dura 2 minutos y siempre descarga (no abre el archivo en el navegador). Así
// una liga reenviada deja de servir pronto y cada descarga queda con nombre.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

import { STORE_URL } from "./licitacion"

export const T_ACCESO_ARCHIVO = "hetna_archivo_acceso"
export const MINUTOS_LIGA = 60
export const SEGUNDOS_LIGA_B2 = 120

export type ActorArchivo = "taller" | "hetna" | "cliente"
export type PermisoArchivo = {
  s: string // solicitud
  k: string // clave en el bucket
  a: ActorArchivo
  i: string // id del taller, del admin o "cliente"
  e: number // vence (epoch ms)
}

const secreto = () => {
  const s = process.env.ARCHIVOS_SECRETO || process.env.JWT_SECRET || ""
  // Sin secreto propio no se emiten ligas: con "supersecret" cualquiera
  // podría fabricar una.
  if (!s || s === "supersecret") throw new Error("Falta ARCHIVOS_SECRETO o JWT_SECRET para firmar ligas de archivos")
  return s
}

const firma = (cuerpo: string) => createHmac("sha256", secreto()).update(cuerpo).digest("base64url")

export function tokenArchivo(p: Omit<PermisoArchivo, "e">, minutos = MINUTOS_LIGA): string {
  const cuerpo = Buffer.from(JSON.stringify({ ...p, e: Date.now() + minutos * 60_000, r: randomBytes(4).toString("hex") })).toString("base64url")
  return `${cuerpo}.${firma(cuerpo)}`
}

export function leerTokenArchivo(token: string): PermisoArchivo | null {
  const [cuerpo, f] = String(token || "").split(".")
  if (!cuerpo || !f) return null
  let esperada: Buffer
  try {
    esperada = Buffer.from(firma(cuerpo))
  } catch {
    return null
  }
  const recibida = Buffer.from(f)
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null
  try {
    const p = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")) as PermisoArchivo
    if (!p.s || !p.k || !p.a || typeof p.e !== "number" || p.e < Date.now()) return null
    return p
  } catch {
    return null
  }
}

/** Liga de descarga. `ver` = la abre el visor de planos (se anota como vista). */
export function ligaArchivo(p: Omit<PermisoArchivo, "e">, ver = false): string | null {
  try {
    return `${STORE_URL}/api/hetna-archivo/${tokenArchivo(p)}${ver ? "?ver=1" : ""}`
  } catch {
    return null
  }
}

let tablaLista = false
export async function asegurarAccesos(knex: any) {
  if (tablaLista) return
  if (!(await knex.schema.hasTable(T_ACCESO_ARCHIVO))) {
    await knex.schema.createTable(T_ACCESO_ARCHIVO, (t: any) => {
      t.text("id").primary()
      t.text("solicitud_id").notNullable().index()
      t.text("clave").notNullable()
      t.text("nombre").notNullable()
      t.text("actor").notNullable() // taller | hetna | cliente
      t.text("actor_id").nullable()
      t.text("actor_nombre").nullable()
      t.text("accion").notNullable() // descarga | vista | negada
      t.text("ip").nullable()
      t.text("agente").nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  tablaLista = true
}

export async function anotarAcceso(
  knex: any,
  r: { solicitud_id: string; clave: string; nombre: string; actor: ActorArchivo; actor_id?: string | null; actor_nombre?: string | null; accion: string; ip?: string | null; agente?: string | null }
) {
  await asegurarAccesos(knex)
  await knex(T_ACCESO_ARCHIVO).insert({
    id: `acc_${randomBytes(10).toString("hex")}`,
    ...r,
    agente: r.agente ? String(r.agente).slice(0, 300) : null,
  })
}

export async function accesosDe(knex: any, solicitudId: string, limite = 200) {
  await asegurarAccesos(knex)
  return knex(T_ACCESO_ARCHIVO)
    .where({ solicitud_id: solicitudId })
    .orderBy("created_at", "desc")
    .limit(limite)
    .select("nombre", "actor", "actor_id", "actor_nombre", "accion", "ip", "created_at")
}
