// Resguardo de la e.firma (FIEL) para la descarga masiva del SAT.
//
//   - Se sube una vez desde el dashboard (nunca por chat ni correo).
//   - El .cer, el .key y la contraseña se guardan CIFRADOS (AES-256-GCM) con
//     una llave que sólo existe en el .env del servidor (CONTA_EFIRMA_KEY).
//     Sin esa llave, lo guardado en la base no sirve para nada.
//   - Antes de guardarla se valida: que sea e.firma (no sello CSD), que esté
//     vigente, que la contraseña abra la llave y que sea del RFC del contribuyente.
//   - Sólo la usa la descarga masiva; cada uso queda en una bitácora.
//   - Se borra con un botón; al vencer deja de usarse.
//
// Generar la llave (una sola vez, en el servidor):  openssl rand -base64 32
import { X509Certificate, createCipheriv, createDecipheriv, randomBytes } from "crypto"
import { satws } from "./satws"

export const T_EFIRMA = "hetna_conta_efirma"
export const T_EFIRMA_USO = "hetna_conta_efirma_uso"

export class ErrorEfirma extends Error {
  constructor(public status: number, mensaje: string) { super(mensaje) }
}

function llave(): Buffer {
  const v = (process.env.CONTA_EFIRMA_KEY || "").trim()
  const b = v ? Buffer.from(v, "base64") : Buffer.alloc(0)
  if (b.length !== 32) throw new ErrorEfirma(503, "Falta configurar CONTA_EFIRMA_KEY en el servidor (32 bytes en base64: openssl rand -base64 32).")
  return b
}

export function cifrar(datos: Buffer, k = llave()): string {
  const iv = randomBytes(12)
  const c = createCipheriv("aes-256-gcm", k, iv)
  const cuerpo = Buffer.concat([c.update(datos), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), cuerpo]).toString("base64")
}

export function descifrar(texto: string, k = llave()): Buffer {
  const b = Buffer.from(texto, "base64")
  const d = createDecipheriv("aes-256-gcm", k, b.subarray(0, 12))
  d.setAuthTag(b.subarray(12, 28))
  return Buffer.concat([d.update(b.subarray(28)), d.final()])
}

let listo = false
export async function asegurarEfirma(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_EFIRMA))) {
    await knex.schema.createTable(T_EFIRMA, (t: any) => {
      t.text("contribuyente_id").primary()
      t.text("rfc").notNullable()
      t.text("numero_certificado").nullable()
      t.timestamp("vence", { useTz: true }).nullable()
      t.text("cer").notNullable()      // cifrado
      t.text("llave").notNullable()    // cifrado
      t.text("clave").notNullable()    // contraseña, cifrada
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("ultimo_uso", { useTz: true }).nullable()
    })
  }
  if (!(await knex.schema.hasTable(T_EFIRMA_USO))) {
    await knex.schema.createTable(T_EFIRMA_USO, (t: any) => {
      t.increments("id")
      t.text("contribuyente_id").notNullable().index()
      t.text("accion").notNullable() // guardada | borrada | descarga
      t.text("detalle").nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  listo = true
}

const bitacora = (knex: any, contribuyenteId: string, accion: string, detalle?: string) =>
  knex(T_EFIRMA_USO).insert({ contribuyente_id: contribuyenteId, accion, detalle: detalle?.slice(0, 500) || null })

/** Abre y valida una e.firma. No guarda nada. */
export async function validarFiel(cer: Buffer, key: Buffer, clave: string, rfcEsperado: string) {
  const { Fiel } = await satws()
  let fiel: any
  try {
    fiel = Fiel.create(cer.toString("binary"), key.toString("binary"), clave)
  } catch {
    throw new ErrorEfirma(400, "No se pudo abrir la e.firma: revisa que sean el .cer y el .key de tu e.firma y que la contraseña sea la correcta.")
  }
  if (!fiel.isValid()) throw new ErrorEfirma(400, "Ese certificado no es una e.firma vigente (puede estar vencido o ser un sello digital CSD, que no sirve para la descarga masiva).")
  const rfc = String(fiel.getRfc() || "").toUpperCase()
  if (rfc !== rfcEsperado.toUpperCase()) throw new ErrorEfirma(400, `La e.firma es del RFC ${rfc}, pero tus datos fiscales dicen ${rfcEsperado}.`)
  let vence: Date | null = null
  let numero: string | null = null
  try {
    const x = new X509Certificate(fiel.getCertificatePemContents())
    vence = new Date(x.validTo)
    numero = fiel.getCertificateSerial()
  } catch { /* datos informativos */ }
  return { fiel, rfc, vence, numero }
}

/** Valida y guarda la e.firma cifrada (reemplaza la anterior). */
export async function guardarEfirma(knex: any, ctb: { id: string; rfc: string }, cer: Buffer, key: Buffer, clave: string) {
  await asegurarEfirma(knex)
  const k = llave()
  const v = await validarFiel(cer, key, clave, ctb.rfc)
  const fila = {
    contribuyente_id: ctb.id, rfc: v.rfc, numero_certificado: v.numero, vence: v.vence,
    cer: cifrar(cer, k), llave: cifrar(key, k), clave: cifrar(Buffer.from(clave, "utf8"), k),
  }
  await knex(T_EFIRMA).insert(fila).onConflict("contribuyente_id").merge()
  await bitacora(knex, ctb.id, "guardada", `certificado ${v.numero || "?"}, vence ${v.vence?.toISOString().slice(0, 10) || "?"}`)
  return { rfc: v.rfc, vence: v.vence }
}

export async function borrarEfirma(knex: any, contribuyenteId: string) {
  await asegurarEfirma(knex)
  const n = await knex(T_EFIRMA).where({ contribuyente_id: contribuyenteId }).delete()
  if (n) await bitacora(knex, contribuyenteId, "borrada")
  return n > 0
}

export async function estadoEfirma(knex: any, contribuyenteId: string) {
  await asegurarEfirma(knex)
  const f = await knex(T_EFIRMA).where({ contribuyente_id: contribuyenteId }).first("rfc", "vence", "created_at", "ultimo_uso")
  const usos = await knex(T_EFIRMA_USO).where({ contribuyente_id: contribuyenteId }).orderBy("id", "desc").limit(15).select("accion", "detalle", "created_at")
  return { guardada: Boolean(f), rfc: f?.rfc || null, vence: f?.vence || null, desde: f?.created_at || null, ultimo_uso: f?.ultimo_uso || null, vencida: f?.vence ? new Date(f.vence) < new Date() : false, usos }
}

/** Abre la e.firma guardada para usarla en la descarga. Deja registro del uso. */
export async function abrirEfirma(knex: any, contribuyenteId: string, motivo: string) {
  await asegurarEfirma(knex)
  const f = await knex(T_EFIRMA).where({ contribuyente_id: contribuyenteId }).first()
  if (!f) return null
  if (f.vence && new Date(f.vence) < new Date()) return null
  const k = llave()
  const { Fiel } = await satws()
  const fiel = Fiel.create(descifrar(f.cer, k).toString("binary"), descifrar(f.llave, k).toString("binary"), descifrar(f.clave, k).toString("utf8"))
  await knex(T_EFIRMA).where({ contribuyente_id: contribuyenteId }).update({ ultimo_uso: knex.fn.now() })
  await bitacora(knex, contribuyenteId, "descarga", motivo)
  return fiel
}
