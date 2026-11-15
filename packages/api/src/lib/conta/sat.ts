// Conexión con servicios públicos del SAT (no necesitan e.firma):
//
//  1. Estatus de un CFDI (Vigente / Cancelado / No encontrado) con el servicio
//     ConsultaCFDIService, el mismo de la página de verificación de facturas.
//  2. Listas de contribuyentes publicados (datos abiertos del SAT):
//     - Art. 69-B CFF: operaciones presuntamente inexistentes (EFOS): Presunto,
//       Definitivo, Desvirtuado, Sentencia Favorable.
//     - Art. 69 CFF: no localizados.
//     Las listas se bajan completas y se guardan en hetna_conta_lista.
//
// Probado contra el SAT el 15-nov-2026 (respuesta "N - 602: Comprobante no encontrado").
import type { Cfdi } from "./cfdi"

export const T_LISTA = "hetna_conta_lista"
const SERVICIO_ESTATUS = "https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc"
const DATOS_ABIERTOS = "https://wu1agsprosta001.blob.core.windows.net/agsc-publicaciones/Datos_abiertos"
export const LISTAS = {
  "69B": `${DATOS_ABIERTOS}/Documents_AGAFF/Listado_completo_69-B.csv`,
  NO_LOCALIZADO: `${DATOS_ABIERTOS}/Documents_AGR/No_localizados.csv`,
} as const

export type EstatusSat = { estado: "vigente" | "cancelado" | "no_encontrado" | "error"; codigo: string; cancelable: string | null; cancelacion: string | null; efos: string | null }

const etiqueta = (xml: string, nombre: string) => {
  const m = xml.match(new RegExp(`<a:${nombre}>([^<]*)</a:${nombre}>`))
  return m ? m[1].trim() : null
}

/** Consulta el estatus de un CFDI en el SAT. Nunca lanza: si falla devuelve estado "error". */
export async function consultarEstatus(c: Pick<Cfdi, "emisor_rfc" | "receptor_rfc" | "total" | "uuid" | "sello_cfd_final"> & { total_texto?: string }, f: typeof fetch = fetch): Promise<EstatusSat> {
  const esc = (v: string) => v.replace(/&/g, "&amp;")
  const expresion = `?re=${esc(c.emisor_rfc)}&rr=${esc(c.receptor_rfc)}&tt=${c.total_texto || c.total.toFixed(2)}&id=${c.uuid}${c.sello_cfd_final ? `&fe=${c.sello_cfd_final}` : ""}`
  const cuerpo = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/"><soapenv:Header/><soapenv:Body><tem:Consulta><tem:expresionImpresa><![CDATA[${expresion}]]></tem:expresionImpresa></tem:Consulta></soapenv:Body></soapenv:Envelope>`
  try {
    const r = await f(SERVICIO_ESTATUS, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '"http://tempuri.org/IConsultaCFDIService/Consulta"' },
      body: cuerpo,
      signal: AbortSignal.timeout(20_000),
    })
    const xml = await r.text()
    if (!r.ok) return { estado: "error", codigo: `HTTP ${r.status}`, cancelable: null, cancelacion: null, efos: null }
    const estado = (etiqueta(xml, "Estado") || "").toLowerCase()
    return {
      estado: estado === "vigente" ? "vigente" : estado === "cancelado" ? "cancelado" : estado.startsWith("no encontrado") ? "no_encontrado" : "error",
      codigo: etiqueta(xml, "CodigoEstatus") || "",
      cancelable: etiqueta(xml, "EsCancelable") || null,
      cancelacion: etiqueta(xml, "EstatusCancelacion") || null,
      efos: etiqueta(xml, "ValidacionEFOS") || null,
    }
  } catch (e) {
    return { estado: "error", codigo: (e as Error).message, cancelable: null, cancelacion: null, efos: null }
  }
}

let listaLista = false
export async function asegurarListas(knex: any) {
  if (listaLista) return
  if (!(await knex.schema.hasTable(T_LISTA))) {
    await knex.schema.createTable(T_LISTA, (t: any) => {
      t.text("rfc").notNullable()
      t.text("lista").notNullable()     // 69B | NO_LOCALIZADO
      t.text("situacion").notNullable() // Presunto | Definitivo | Desvirtuado | Sentencia Favorable | NO LOCALIZADOS
      t.text("nombre").nullable()
      t.timestamp("actualizada", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.primary(["rfc", "lista"])
    })
  }
  listaLista = true
}

/** Lee un renglón CSV con comillas (los archivos del SAT las usan en nombres con comas). */
export function partirCsv(linea: string): string[] {
  const out: string[] = []
  let actual = "", comillas = false
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i]
    if (comillas) {
      if (ch === '"' && linea[i + 1] === '"') { actual += '"'; i++ }
      else if (ch === '"') comillas = false
      else actual += ch
    } else if (ch === '"') comillas = true
    else if (ch === ",") { out.push(actual); actual = "" }
    else actual += ch
  }
  out.push(actual)
  return out
}

const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/

/** Convierte el CSV del SAT en filas {rfc, situacion, nombre}. Busca el encabezado (trae líneas de aviso antes). */
export function leerListaCsv(texto: string, lista: keyof typeof LISTAS) {
  const lineas = texto.split(/\r?\n/)
  const idxEnc = lineas.findIndex((l) => /(^|,)RFC(,|$)/i.test(l))
  if (idxEnc < 0) throw new Error("El archivo del SAT no trae el encabezado esperado (columna RFC).")
  const enc = partirCsv(lineas[idxEnc]).map((x) => x.trim().toLowerCase())
  const iRfc = enc.indexOf("rfc")
  const iSit = lista === "69B" ? enc.findIndex((x) => x.startsWith("situación") || x.startsWith("situacion")) : enc.indexOf("supuesto")
  const iNom = enc.findIndex((x) => x.includes("nombre") || x.includes("razon social") || x.includes("razón social"))
  if (iSit < 0) throw new Error("El archivo del SAT no trae la columna de situación.")
  const filas = new Map<string, { rfc: string; situacion: string; nombre: string | null }>()
  for (const l of lineas.slice(idxEnc + 1)) {
    if (!l.trim()) continue
    const c = partirCsv(l)
    const rfc = (c[iRfc] || "").trim().toUpperCase()
    if (!RFC.test(rfc)) continue
    filas.set(rfc, { rfc, situacion: (c[iSit] || "").trim(), nombre: iNom >= 0 ? (c[iNom] || "").trim().slice(0, 250) : null })
  }
  return [...filas.values()]
}

/** Baja una lista del SAT y reemplaza la guardada (en una transacción). */
export async function actualizarLista(knex: any, lista: keyof typeof LISTAS, f: typeof fetch = fetch) {
  await asegurarListas(knex)
  const r = await f(LISTAS[lista], { signal: AbortSignal.timeout(180_000) })
  if (!r.ok) throw new Error(`El SAT respondió ${r.status} al bajar la lista ${lista}.`)
  const texto = new TextDecoder("latin1").decode(await r.arrayBuffer())
  const filas = leerListaCsv(texto, lista)
  if (filas.length < 100) throw new Error(`La lista ${lista} llegó casi vacía (${filas.length}); no se reemplaza la anterior.`)
  await knex.transaction(async (trx: any) => {
    await trx(T_LISTA).where({ lista }).delete()
    for (let i = 0; i < filas.length; i += 1000) {
      await trx(T_LISTA).insert(filas.slice(i, i + 1000).map((x) => ({ ...x, lista })))
    }
  })
  return filas.length
}

/** Situación de unos RFC en las listas: { RFC: [{lista, situacion}] } */
export async function buscarEnListas(knex: any, rfcs: string[]) {
  await asegurarListas(knex)
  const out: Record<string, { lista: string; situacion: string }[]> = {}
  for (let i = 0; i < rfcs.length; i += 1000) {
    const filas = (await knex(T_LISTA).whereIn("rfc", rfcs.slice(i, i + 1000)).select("rfc", "lista", "situacion")) as any[]
    for (const f of filas) (out[f.rfc] ||= []).push({ lista: f.lista, situacion: f.situacion })
  }
  return out
}

export async function listasActualizadas(knex: any) {
  await asegurarListas(knex)
  return (await knex(T_LISTA).groupBy("lista").select("lista").max("actualizada as fecha").count("* as n")) as { lista: string; fecha: string; n: string }[]
}
