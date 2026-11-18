// "Te cargamos tu catálogo": el taller manda su lista de precios como la tenga
// (Excel, PDF, foto, Word) desde la app y HETNA se la deja cargada en su
// catálogo del Cotizador.
//
// App (sesión de Supabase del taller):
//   POST /api/cotizador-catalogo   multipart: archivos (hasta 5) y nota
//   GET  /api/cotizador-catalogo   sus solicitudes y en qué van
// Panel de HETNA (Dashboard → Catálogos por cargar):
//   GET  /admin/hetna-catalogos                  todas, con ligas para bajar los archivos
//   POST /admin/hetna-catalogos/<id>             { estado, respuesta }
//   POST /admin/hetna-catalogos/<id>/cargar      multipart "archivo" con la plantilla;
//                                                ?probar=1 sólo muestra lo que entraría
//   GET  /admin/hetna-catalogos/plantilla        plantilla de Excel
//
// Tabla catalogo_solicitudes (supabase/taller_vende_mas.sql del Cotizador).
// Los productos se escriben en `productos` del taller; los que ya existen con
// el mismo nombre no se duplican.
import { randomUUID } from "crypto"
import ExcelJS from "exceljs"

import { avisarTaller } from "./avisos-taller"
import { extension, ligaFirmada, nombreSeguro, subirArchivo } from "./cotizador-archivos"
import { ErrorSuscripcion, supa } from "./cotizador-suscripciones"
import { sendEmail } from "./resend"
import { ADMIN_URL } from "./seguimiento"

const supaUrl = () => (process.env.COTIZADOR_SUPABASE_URL || "https://ldfmkfbhcbsbecfbzsny.supabase.co").replace(/\/$/, "")
const supaKey = () => process.env.COTIZADOR_SUPABASE_SERVICE_KEY || ""
const SITIO = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")

export const EXT_CATALOGO = ["xlsx", "xls", "csv", "ods", "pdf", "doc", "docx", "txt", "jpg", "jpeg", "png", "webp", "heic"]
export const ARCHIVOS_MAX = 5
export const ARCHIVO_MAX_MB = 20
const ABIERTAS_MAX = 3
export const FILAS_MAX = 3000
export const ESTADOS = ["recibida", "en_proceso", "lista", "rechazada"] as const
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string)
const sinTabla = (e: unknown) => /catalogo_solicitudes|42P01|PGRST205/.test((e as Error).message)

/** Cualquier miembro activo del taller (no sólo el administrador). */
async function tallerDesdeToken(token: string | undefined) {
  if (!token) throw new ErrorSuscripcion("Inicia sesión en el Cotizador.", 401)
  const r = await fetch(`${supaUrl()}/auth/v1/user`, {
    headers: { apikey: supaKey(), Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!r.ok) throw new ErrorSuscripcion("Tu sesión expiró. Vuelve a iniciar sesión.", 401)
  const user = (await r.json()) as { id: string; email?: string }
  const filas = await supa<{ negocio_id: string }[]>(
    `/rest/v1/usuarios_negocio?user_id=eq.${user.id}&activo=eq.true&select=negocio_id&order=id.desc&limit=1`
  )
  if (!filas[0]) throw new ErrorSuscripcion("Tu cuenta no tiene taller.", 403)
  const n = await supa<any[]>(`/rest/v1/negocios?id=eq.${filas[0].negocio_id}&select=id,nombre,telefono&limit=1`)
  if (!n[0]) throw new ErrorSuscripcion("No encontramos tu taller.", 404)
  return { negocio: n[0] as { id: string; nombre: string | null; telefono: string | null }, correo: user.email || "" }
}

export type ArchivoSubido = { originalname: string; mimetype: string; size: number; buffer: Buffer }

const vista = (s: any) => ({
  id: s.id,
  estado: s.estado,
  respuesta: s.respuesta || null,
  productos_cargados: Number(s.productos_cargados || 0),
  archivos: ((s.archivos || []) as any[]).map((a) => a.nombre),
  nota: s.nota || null,
  creada: s.created_at,
  actualizada: s.actualizado_en,
})

export async function misSolicitudes(token: string | undefined) {
  const { negocio } = await tallerDesdeToken(token)
  try {
    const filas = await supa<any[]>(`/rest/v1/catalogo_solicitudes?negocio_id=eq.${negocio.id}&select=*&order=created_at.desc&limit=20`)
    return { disponible: true, solicitudes: filas.map(vista) }
  } catch (e) {
    if (sinTabla(e)) return { disponible: false, solicitudes: [] }
    throw e
  }
}

export async function solicitarCarga(token: string | undefined, campos: Record<string, any>, archivos: ArchivoSubido[], logger?: any) {
  const { negocio, correo } = await tallerDesdeToken(token)
  const lista = (archivos || []).slice(0, ARCHIVOS_MAX)
  if (!lista.length) throw new ErrorSuscripcion("Adjunta al menos un archivo con tu lista de productos.")
  for (const a of lista) {
    if (!EXT_CATALOGO.includes(extension(a.originalname)))
      throw new ErrorSuscripcion(`"${a.originalname}" no se acepta. Usa Excel, PDF, Word o fotos.`)
    if (a.size > ARCHIVO_MAX_MB * 1024 * 1024) throw new ErrorSuscripcion(`Cada archivo puede pesar hasta ${ARCHIVO_MAX_MB} MB.`)
  }
  let abiertas: any[]
  try {
    abiertas = await supa<any[]>(`/rest/v1/catalogo_solicitudes?negocio_id=eq.${negocio.id}&estado=in.(recibida,en_proceso)&select=id`)
  } catch (e) {
    if (sinTabla(e)) throw new ErrorSuscripcion("Esta función se está activando. Intenta más tarde.", 503)
    throw e
  }
  if (abiertas.length >= ABIERTAS_MAX) throw new ErrorSuscripcion("Ya tienes solicitudes en proceso. Te avisamos en cuanto queden listas.")

  const id = randomUUID()
  const guardados: { ruta: string; nombre: string; tamano: number }[] = []
  for (const [i, a] of lista.entries()) {
    const ruta = `${negocio.id}/catalogo/${id}/${i + 1}_${nombreSeguro(a.originalname)}`
    await subirArchivo(ruta, a.buffer, a.mimetype)
    guardados.push({ ruta, nombre: String(a.originalname || "archivo").slice(0, 120), tamano: a.size })
  }
  const nota = String(campos.nota ?? "").trim().slice(0, 1000) || null
  await supa(`/rest/v1/catalogo_solicitudes`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ id, negocio_id: negocio.id, archivos: guardados, nota }),
  })

  const destino = process.env.HETNA_LEADS_EMAIL
  if (destino) {
    const r = await sendEmail({
      to: destino,
      subject: `Catálogo por cargar: ${negocio.nombre || "taller"} (${guardados.length} archivo${guardados.length === 1 ? "" : "s"})`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px">
        <h2 style="color:#142033">Un taller pidió que le carguemos su catálogo</h2>
        <p><strong>${esc(negocio.nombre || "Taller")}</strong>${negocio.telefono ? ` · Tel. ${esc(negocio.telefono)}` : ""}${correo ? ` · ${esc(correo)}` : ""}</p>
        <p>Archivos: ${guardados.map((g) => esc(g.nombre)).join(", ")}</p>
        ${nota ? `<p>Nota: ${esc(nota)}</p>` : ""}
        <p><a href="${ADMIN_URL}/catalogos" style="background:#C2560A;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Abrir Catálogos por cargar</a></p>
      </div>`,
    })
    if (!r.sent) logger?.info?.(`[catalogo] aviso a HETNA no enviado: ${r.reason}`)
  }
  return { ok: true, id }
}

// ── Panel de HETNA ──────────────────────────────────────────────────────
export async function adminListar() {
  let filas: any[]
  try {
    filas = await supa<any[]>(`/rest/v1/catalogo_solicitudes?select=*&order=created_at.desc&limit=200`)
  } catch (e) {
    if (sinTabla(e)) return { disponible: false, solicitudes: [] }
    throw e
  }
  const ids = [...new Set(filas.map((f) => f.negocio_id))]
  const negocios = ids.length
    ? await supa<any[]>(`/rest/v1/negocios?id=in.(${ids.join(",")})&select=id,nombre,telefono,plan`)
    : []
  const porId = new Map(negocios.map((n) => [n.id, n]))
  const solicitudes = await Promise.all(
    filas.map(async (f) => ({
      ...vista(f),
      taller: { id: f.negocio_id, nombre: porId.get(f.negocio_id)?.nombre || "(sin nombre)", telefono: porId.get(f.negocio_id)?.telefono || null, plan: porId.get(f.negocio_id)?.plan || null },
      descargas: await Promise.all(((f.archivos || []) as any[]).map(async (a) => ({ nombre: a.nombre, url: await ligaFirmada(a.ruta, 3600) }))),
    }))
  )
  return { disponible: true, solicitudes }
}

async function solicitud(id: string) {
  if (!UUID.test(id)) throw new ErrorSuscripcion("Solicitud no encontrada.", 404)
  const filas = await supa<any[]>(`/rest/v1/catalogo_solicitudes?id=eq.${id}&select=*&limit=1`)
  if (!filas[0]) throw new ErrorSuscripcion("Solicitud no encontrada.", 404)
  return filas[0]
}

async function avisarLista(s: any, n: number, logger?: any) {
  await avisarTaller(
    {
      negocioId: s.negocio_id,
      tipo: "catalogo_listo",
      titulo: "✅ Tu catálogo ya está cargado",
      cuerpo: n > 0 ? `Cargamos ${n} producto${n === 1 ? "" : "s"} en tu Cotizador. Revisa precios y agrégales fotos.` : "Tu solicitud de catálogo quedó lista. Revísala en Productos.",
      boton: "Abrir el Cotizador",
      liga: `${SITIO}/cotizador/`,
    },
    logger
  )
}

export async function adminCambiar(id: string, b: { estado?: string; respuesta?: string }, logger?: any) {
  const s = await solicitud(id)
  const estado = (ESTADOS as readonly string[]).includes(String(b.estado)) ? String(b.estado) : s.estado
  const respuesta = typeof b.respuesta === "string" ? b.respuesta.trim().slice(0, 1000) || null : s.respuesta
  await supa(`/rest/v1/catalogo_solicitudes?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ estado, respuesta, actualizado_en: new Date().toISOString() }),
  })
  if (estado !== s.estado) {
    if (estado === "lista") await avisarLista(s, Number(s.productos_cargados || 0), logger)
    if (estado === "rechazada")
      await avisarTaller(
        {
          negocioId: s.negocio_id,
          tipo: "catalogo_listo",
          titulo: "Tu solicitud de catálogo necesita algo más",
          cuerpo: respuesta || "No pudimos leer tu lista. Mándanosla de nuevo o escríbenos por WhatsApp.",
          boton: "Abrir el Cotizador",
          liga: `${SITIO}/cotizador/`,
        },
        logger
      )
  }
  return { ok: true, estado }
}

// ── Plantilla y cargador ───────────────────────────────────────────────
export const COLUMNAS = [
  { clave: "nombre", titulo: "Nombre *", ancho: 40 },
  { clave: "precio", titulo: "Precio de venta *", ancho: 16 },
  { clave: "descripcion", titulo: "Descripción", ancho: 50 },
  { clave: "unidad", titulo: "Unidad", ancho: 12 },
  { clave: "categoria", titulo: "Categoría", ancho: 20 },
  { clave: "sku", titulo: "SKU / Clave", ancho: 16 },
  { clave: "costo", titulo: "Costo", ancho: 12 },
  { clave: "marca", titulo: "Marca", ancho: 16 },
  { clave: "iva", titulo: "Aplica IVA (Sí/No)", ancho: 16 },
] as const
type Clave = (typeof COLUMNAS)[number]["clave"]

const normal = (t: unknown) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[*()/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const SINONIMOS: Record<Clave, string[]> = {
  nombre: ["nombre", "producto", "articulo", "concepto", "servicio"],
  precio: ["precio de venta", "precio venta", "precio", "precio unitario", "p u", "pu"],
  descripcion: ["descripcion", "detalle", "detalles"],
  unidad: ["unidad", "unidad de medida", "um", "u m"],
  categoria: ["categoria", "familia", "linea", "grupo"],
  sku: ["sku clave", "sku", "clave", "codigo", "modelo"],
  costo: ["costo", "costo unitario"],
  marca: ["marca"],
  iva: ["aplica iva si no", "aplica iva", "iva"],
}

function claveDe(encabezado: unknown): Clave | null {
  const n = normal(encabezado)
  if (!n) return null
  for (const c of COLUMNAS) if (SINONIMOS[c.clave].includes(n)) return c.clave
  for (const c of COLUMNAS) if (SINONIMOS[c.clave].some((s) => s.length > 3 && n.startsWith(s))) return c.clave
  return null
}

/** "$1,250.50 MXN" -> 1250.5 */
export function numero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  const t = String(v ?? "").replace(/[^0-9.,-]/g, "")
  if (!t) return null
  // 1.250,50 (coma decimal) vs 1,250.50
  const s = /,\d{1,2}$/.test(t) && !/\.\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "")
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const texto = (v: unknown, max: number) => {
  if (v && typeof v === "object" && "text" in (v as any)) v = (v as any).text
  if (v && typeof v === "object" && "result" in (v as any)) v = (v as any).result
  if (v && typeof v === "object" && "richText" in (v as any)) v = ((v as any).richText as any[]).map((r) => r.text).join("")
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max)
}

export type FilaProducto = {
  nombre: string
  precio: number
  descripcion: string | null
  unidad: string
  categoria: string | null
  sku: string | null
  costo: number
  marca: string | null
  iva: boolean
}

function separarCsv(linea: string, sep: string): string[] {
  const out: string[] = []
  let actual = ""
  let comillas = false
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (comillas) {
      if (c === '"' && linea[i + 1] === '"') { actual += '"'; i++ }
      else if (c === '"') comillas = false
      else actual += c
    } else if (c === '"') comillas = true
    else if (c === sep) { out.push(actual); actual = "" }
    else actual += c
  }
  out.push(actual)
  return out
}

/** Lee la plantilla (xlsx o csv). Busca el renglón de encabezados en los primeros 10. */
export async function leerPlantilla(buffer: Buffer, nombre: string): Promise<{ filas: FilaProducto[]; errores: string[] }> {
  let renglones: unknown[][] = []
  const ext = extension(nombre)
  if (ext === "csv" || ext === "txt") {
    const t = buffer.toString("utf8").replace(/^﻿/, "")
    const lineas = t.split(/\r?\n/).filter((l) => l.trim())
    const sep = (lineas[0] || "").split(";").length > (lineas[0] || "").split(",").length ? ";" : ","
    renglones = lineas.map((l) => separarCsv(l, sep))
  } else if (ext === "xlsx") {
    const wb = new ExcelJS.Workbook()
    try {
      await wb.xlsx.load(buffer as any)
    } catch {
      throw new ErrorSuscripcion("No se pudo abrir el Excel. Guárdalo como .xlsx con la plantilla.")
    }
    const hoja = wb.worksheets.find((h) => h.actualRowCount > 0)
    if (!hoja) throw new ErrorSuscripcion("El Excel está vacío.")
    hoja.eachRow({ includeEmpty: false }, (row) => {
      const vals = row.values as unknown[]
      renglones.push(Array.isArray(vals) ? vals.slice(1) : [])
    })
  } else {
    throw new ErrorSuscripcion("Sube la plantilla en .xlsx o .csv.")
  }

  let idxEnc = -1
  let mapa: (Clave | null)[] = []
  for (let i = 0; i < Math.min(10, renglones.length); i++) {
    const m = renglones[i].map((c) => claveDe(texto(c, 80)))
    if (m.includes("nombre") && m.includes("precio")) { idxEnc = i; mapa = m; break }
  }
  if (idxEnc < 0) throw new ErrorSuscripcion('No encontré los encabezados "Nombre" y "Precio de venta". Usa la plantilla.')

  const filas: FilaProducto[] = []
  const errores: string[] = []
  const vistos = new Set<string>()
  for (let i = idxEnc + 1; i < renglones.length; i++) {
    const r: Partial<Record<Clave, unknown>> = {}
    mapa.forEach((k, j) => { if (k && r[k] === undefined) r[k] = renglones[i][j] })
    const nombreP = texto(r.nombre, 200)
    if (!nombreP) continue
    const precio = numero(texto(r.precio, 40) || r.precio)
    if (precio == null || precio < 0) { errores.push(`Renglón ${i + 1}: "${nombreP}" sin precio válido`); continue }
    const llave = normal(nombreP)
    if (vistos.has(llave)) { errores.push(`Renglón ${i + 1}: "${nombreP}" repetido en el archivo`); continue }
    vistos.add(llave)
    const iva = normal(texto(r.iva, 10))
    filas.push({
      nombre: nombreP,
      precio: Math.round(precio * 100) / 100,
      descripcion: texto(r.descripcion, 2000) || null,
      unidad: texto(r.unidad, 30) || "Pieza",
      categoria: texto(r.categoria, 60) || null,
      sku: texto(r.sku, 60) || null,
      costo: Math.max(0, numero(texto(r.costo, 40) || r.costo) || 0),
      marca: texto(r.marca, 80) || null,
      iva: !["no", "n", "0", "false", "exento"].includes(iva),
    })
    if (filas.length >= FILAS_MAX) { errores.push(`Sólo se cargan ${FILAS_MAX} productos por archivo.`); break }
  }
  return { filas, errores }
}

export async function plantillaXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const h = wb.addWorksheet("Productos")
  h.columns = COLUMNAS.map((c) => ({ header: c.titulo, key: c.clave, width: c.ancho }))
  h.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
  h.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A3A5C" } }
  h.addRow({ nombre: "Corte láser MDF 3 mm (por hoja 60×90)", precio: 180, descripcion: "Incluye material", unidad: "Hoja", categoria: "Corte láser", sku: "LAS-MDF3", costo: 95, marca: "", iva: "Sí" })
  h.addRow({ nombre: "Maquinado CNC aluminio (hora)", precio: 650, descripcion: "", unidad: "Hora", categoria: "Maquinado", sku: "", costo: 0, marca: "", iva: "Sí" })
  h.views = [{ state: "frozen", ySplit: 1 }]
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/** Busca o crea las categorías del taller. Si la tabla no tiene negocio_id, sólo usa las que ya existen. */
async function categorias(negocioId: string, nombres: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!nombres.length) return out
  let propias = true
  let existentes: any[] = []
  try {
    existentes = await supa<any[]>(`/rest/v1/categorias_producto?negocio_id=eq.${negocioId}&select=id,nombre`)
  } catch {
    propias = false
    existentes = await supa<any[]>(`/rest/v1/categorias_producto?select=id,nombre`).catch(() => [])
  }
  for (const c of existentes) out.set(normal(c.nombre), c.id)
  if (!propias) return out
  for (const n of nombres) {
    if (out.has(normal(n))) continue
    try {
      const nueva = await supa<any[]>(`/rest/v1/categorias_producto`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ negocio_id: negocioId, nombre: n }),
      })
      if (nueva?.[0]?.id) out.set(normal(n), nueva[0].id)
    } catch {
      // sin categoría: el producto entra igual
    }
  }
  return out
}

export async function adminCargar(id: string, archivo: ArchivoSubido | undefined, probar: boolean, logger?: any) {
  const s = await solicitud(id)
  if (!archivo) throw new ErrorSuscripcion("Sube la plantilla llena (.xlsx o .csv).")
  const { filas, errores } = await leerPlantilla(archivo.buffer, archivo.originalname)
  const negocio = (await supa<any[]>(`/rest/v1/negocios?id=eq.${s.negocio_id}&select=id,nombre&limit=1`))[0]
  if (!negocio) throw new ErrorSuscripcion("No encontramos el taller de esta solicitud.", 404)

  const ya = await supa<any[]>(`/rest/v1/productos?negocio_id=eq.${negocio.id}&activo=eq.true&select=nombre&limit=10000`)
  const existentes = new Set(ya.map((p) => normal(p.nombre)))
  const nuevas = filas.filter((f) => !existentes.has(normal(f.nombre)))
  const repetidos = filas.length - nuevas.length

  if (probar) {
    return { taller: negocio.nombre, total: filas.length, nuevos: nuevas.length, ya_existian: repetidos, errores: errores.slice(0, 50), ejemplos: nuevas.slice(0, 8) }
  }

  const cats = await categorias(negocio.id, [...new Set(nuevas.map((f) => f.categoria).filter(Boolean) as string[])])
  const fila = (f: FilaProducto, conSku = true) => ({
    negocio_id: negocio.id,
    nombre: f.nombre,
    descripcion: f.descripcion,
    precio_venta: f.precio,
    costo: f.costo,
    unidad_medida: f.unidad,
    sku: conSku ? f.sku : null,
    marca: f.marca,
    aplica_iva: f.iva,
    categoria_id: f.categoria ? cats.get(normal(f.categoria)) || null : null,
    activo: true,
  })
  const insertar = (lote: any[]) =>
    supa(`/rest/v1/productos`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(lote) })

  let cargados = 0
  const fallidos: string[] = []
  for (let i = 0; i < nuevas.length; i += 100) {
    const lote = nuevas.slice(i, i + 100)
    try {
      await insertar(lote.map((f) => fila(f)))
      cargados += lote.length
    } catch {
      // Uno por uno; si choca la clave (SKU repetido con otro taller), entra sin SKU
      for (const f of lote) {
        try {
          await insertar([fila(f)])
          cargados++
        } catch (e) {
          if (f.sku && /23505|duplicate|sku/i.test((e as Error).message)) {
            try {
              await insertar([fila(f, false)])
              cargados++
              continue
            } catch {}
          }
          fallidos.push(f.nombre)
        }
      }
    }
  }

  const total = Number(s.productos_cargados || 0) + cargados
  await supa(`/rest/v1/catalogo_solicitudes?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ productos_cargados: total, estado: "lista", actualizado_en: new Date().toISOString() }),
  })
  if (cargados > 0 || s.estado !== "lista") await avisarLista(s, cargados, logger)
  logger?.info?.(`[catalogo] ${negocio.nombre}: ${cargados} productos cargados, ${repetidos} ya existían, ${fallidos.length} fallaron`)
  return { taller: negocio.nombre, cargados, ya_existian: repetidos, fallidos: fallidos.slice(0, 50), errores: errores.slice(0, 50) }
}
