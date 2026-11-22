// POST /vendor/hetna-publicar/excel  (multipart)
//   archivo = plantilla llena (.xlsx)
//   fotos   = JSON { "nombre-de-archivo.jpg": "liga devuelta por /vendor/uploads", ... }
//   modo    = "revisar" (no cambia nada) | "importar" (máx. 10 por hora por taller)
//   solo_validos = "1" para importar sólo los productos sin errores
//
// Lo mismo que el importador del dashboard (lib/importar-productos), pero con la
// tienda del taller y con candados:
//   - sólo se actualizan productos de ESTE taller (revisar + importar lo comprueban);
//   - el identificador de cada producto lleva el handle del taller, para que su
//     agrupador nunca choque con el de otro;
//   - las fotos sólo pueden ser archivos que el taller subió a la tienda;
//   - fondo blanco igual que Publicar producto; máximo MAX_PRODUCTOS_TALLER por archivo.
// El permiso para publicar (taller aprobado) lo pone hetna-alta/middlewares.ts.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { datosTaller, ErrorImportar, importar, revisar, tiendaTaller, type Plan } from "../../../../lib/importar-productos/importar"
import { leerPlantilla, MAX_PRODUCTOS_TALLER } from "../../../../lib/importar-productos/plantilla"
import { MAX_RENGLONES_TALLER, mapaFotos, prefijarHandles, reglasTaller } from "../../../../lib/importar-productos/taller"
import { listaDeArchivos } from "../../../cam-multipart"

// Límite de publicaciones por taller (en memoria: el API corre en un solo proceso)
const PUBLICACIONES_POR_HORA = 10
const publicaciones = new Map<string, number[]>()
function puedePublicar(sellerId: string): boolean {
  const ahora = Date.now()
  const recientes = (publicaciones.get(sellerId) || []).filter((t) => ahora - t < 3_600_000)
  if (recientes.length >= PUBLICACIONES_POR_HORA) return false
  recientes.push(ahora)
  publicaciones.set(sellerId, recientes)
  return true
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const ctx = (req as any).seller_context as { seller_id?: string; seller_member?: { member_id?: string } } | undefined
  const sellerId = ctx?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  const a = listaDeArchivos(req as any)[0]
  if (!a || !/\.xlsx$/i.test(a.originalname)) return res.status(400).json({ message: "Sube la plantilla llena en formato .xlsx." })
  const cuerpo = (req.body || {}) as Record<string, unknown>
  const modo = cuerpo.modo === "importar" ? "importar" : "revisar"
  const soloValidos = cuerpo.solo_validos === "1" || cuerpo.solo_validos === "true"
  try {
    const taller = await datosTaller(req.scope, sellerId)
    const lectura = prefijarHandles(await leerPlantilla(a.buffer, { fotos: mapaFotos(cuerpo.fotos) }), taller.handle)
    const vacio = { modo, renglones: lectura.renglones, productos: lectura.productos.length, crear: [], actualizar: [], avisos: [] }
    if (lectura.productos.length > MAX_PRODUCTOS_TALLER) {
      return res.status(400).json({ ...vacio, errores: [{ fila: null, mensaje: `El archivo trae ${lectura.productos.length} productos. Máximo ${MAX_PRODUCTOS_TALLER} por archivo: divídelo en varios.` }] })
    }
    if (lectura.renglones > MAX_RENGLONES_TALLER) {
      return res.status(400).json({ ...vacio, errores: [{ fila: null, mensaje: `El archivo trae ${lectura.renglones} renglones. Máximo ${MAX_RENGLONES_TALLER} por archivo (contando cada medida o color): divídelo en varios.` }] })
    }
    const plan = await reglasTaller(await revisar(req.scope, lectura, { sellerId }), taller.nombre, { avisar: modo === "revisar" })
    const item = (p: Plan["pasos"][number]) => ({ handle: p.producto.handle, nombre: p.producto.nombre, variantes: p.producto.variantes.length, categoria: p.categoria_nombre, estado: p.producto.estado })
    const resumen = {
      renglones: lectura.renglones,
      productos: lectura.productos.length,
      crear: plan.pasos.filter((p) => p.accion === "crear").map(item),
      actualizar: plan.pasos.filter((p) => p.accion === "actualizar").map(item),
      errores: plan.errores,
      avisos: plan.avisos,
    }
    if (modo === "revisar") return res.json({ modo, ...resumen })
    if (plan.errores.length && !soloValidos) return res.status(400).json({ modo, ...resumen, message: "El archivo tiene errores. Corrígelos o publica sólo los productos sin errores." })
    if (!plan.pasos.length) return res.status(400).json({ modo, ...resumen, message: "No hay productos para publicar." })
    if (!puedePublicar(sellerId)) return res.status(429).json({ modo, ...resumen, message: `Llegaste al límite de ${PUBLICACIONES_POR_HORA} cargas por hora. Intenta más tarde.` })
    // Hasta aquí no se cambió nada; el almacén se crea (si falta) sólo al publicar
    const tienda = await tiendaTaller(req.scope, sellerId, ctx?.seller_member?.member_id || req.auth_context?.actor_id)
    const r = await importar(req.scope, plan, {
      tienda,
      copiarImagenes: false,
      metadata: { seller_id: sellerId, publicado_con: "excel-taller" },
    })
    req.scope.resolve("logger").info(`[excel-taller] ${taller.nombre}: ${r.resultados.filter((x) => x.accion !== "error").length} productos`)
    res.json({ modo, ...resumen, resultados: r.resultados, avisos: [...plan.avisos, ...r.avisos] })
  } catch (e) {
    if (e instanceof ErrorImportar) return res.status(409).json({ message: e.message })
    req.scope.resolve("logger").error(`[excel-taller] ${sellerId}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo procesar el archivo. Intenta de nuevo; si sigue, avísanos por WhatsApp." })
  }
}
