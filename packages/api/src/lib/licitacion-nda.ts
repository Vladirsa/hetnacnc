// Acuerdo de confidencialidad (NDA) en las solicitudes de fabricación
// (auditoría del 19 nov 2026, punto 4.1: "proteger archivos con NDA").
//
// Si el cliente lo pide (privacidad.nda = "requerido"), un taller no ve la
// descripción, los planos ni las fotos, ni puede mandar propuesta, hasta
// aceptar este acuerdo desde su panel. Queda registrado: qué versión del
// texto (con su huella SHA-256), quién de su equipo lo aceptó, desde qué IP y
// navegador, y cuándo. El cliente ve la lista de talleres que lo aceptaron.
//
// El texto es una base para el trato entre cliente y taller; HETNA no es parte
// del acuerdo. Pendiente de revisión por un abogado antes de operar fuera de
// México.
import { createHash } from "crypto"

import { T_NDA, asegurarPrivacidad } from "./licitacion-privacidad"

export const VERSION_NDA = "1.0 (21 nov 2026)"

export function textoNda(folio: string): string {
  return [
    `Acuerdo de confidencialidad para la solicitud de fabricación ${folio} en HETNA CNC.`,
    "1. Información confidencial. Son confidenciales la descripción, los planos, modelos, archivos, fotografías, medidas, materiales, cantidades y cualquier otro dato técnico o comercial de esta solicitud que el cliente comparta a través de HETNA.",
    "2. Uso permitido. El taller usará la información sólo para evaluar la solicitud, preparar su propuesta y, si el cliente lo elige, fabricar el trabajo acordado.",
    "3. Prohibiciones. El taller no copiará, publicará, venderá, fabricará para terceros ni compartirá la información con nadie fuera de su equipo que participe en la cotización o la fabricación, y se asegura de que ese equipo cumpla este acuerdo.",
    "4. Devolución y borrado. Si el taller no es elegido, o cuando el cliente lo pida, borrará los archivos y copias que haya descargado.",
    "5. Excepciones. No es confidencial la información que ya era pública sin culpa del taller, la que el taller ya tenía legítimamente o la que una autoridad exija por ley.",
    "6. Vigencia. Este acuerdo vale desde que se acepta y durante 3 años, o mientras la información no sea pública.",
    "7. Partes. El acuerdo es entre el cliente y el taller. HETNA CNC sólo registra la aceptación y la pone a disposición de las partes; no es parte del acuerdo ni garantiza su cumplimiento.",
  ].join("\n\n")
}

export const huellaNda = (texto: string) => createHash("sha256").update(texto, "utf8").digest("hex")

export async function aceptarNda(
  knex: any,
  s: { id: string; folio?: string },
  sellerId: string,
  datos: { quien?: string | null; ip?: string | null; agente?: string | null }
) {
  await asegurarPrivacidad(knex)
  const texto = textoNda(String(s.folio || s.id))
  await knex(T_NDA)
    .insert({
      solicitud_id: s.id,
      seller_id: sellerId,
      version: VERSION_NDA,
      texto_sha256: huellaNda(texto),
      quien: datos.quien ? String(datos.quien).slice(0, 120) : null,
      ip: datos.ip ? String(datos.ip).slice(0, 64) : null,
      agente: datos.agente ? String(datos.agente).slice(0, 300) : null,
    })
    .onConflict(["solicitud_id", "seller_id"])
    .ignore()
}

/** Talleres que aceptaron el acuerdo de una solicitud (para el cliente). */
export async function ndasDe(knex: any, solicitudId: string): Promise<{ taller: string; aceptado_en: string; version: string }[]> {
  await asegurarPrivacidad(knex)
  const filas = await knex(`${T_NDA} as n`)
    .leftJoin("seller as v", "v.id", "n.seller_id")
    .where("n.solicitud_id", solicitudId)
    .orderBy("n.aceptado_en", "asc")
    .select("v.name as taller", "n.aceptado_en", "n.version")
  return filas.map((f: any) => ({ taller: f.taller || "Taller", aceptado_en: new Date(f.aceptado_en).toISOString(), version: f.version }))
}
