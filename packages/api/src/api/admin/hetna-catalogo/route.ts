// Importar catálogo (panel de administración): HETNA publica de golpe productos
// físicos de distribuidores con los que tiene trato, como vendedor "HETNA CNC"
// (17 nov 2026: la tienda no tenía productos físicos y Google Shopping quedaba
// vacío). Cada renglón pasa por la misma validación y publicación que el
// formulario "Publicar producto" de los talleres (lib/publicar-rapido.ts).
//
//   GET  /admin/hetna-catalogo -> { vendedor, categorias }
//   POST /admin/hetna-catalogo { filas: [...], simular?: true }
//        -> { resultados: [{ fila, ok, titulo, product_id?, handle?, error? }] }
// Con simular sólo se valida (no se publica nada).
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { camSellerHandle } from "../../../modules/cam/catalog"
import { ErrorPublicar, categoriasParaPublicar, publicarRapido, validar } from "../../../lib/publicar-rapido"

const MAX_FILAS = 200

async function vendedorHetna(req: MedusaRequest) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const handle = (process.env.CATALOGO_SELLER_HANDLE || camSellerHandle()).trim()
  const { data } = await query.graph({ entity: "seller", fields: ["id", "name", "handle"], filters: { handle } })
  return (data?.[0] as { id: string; name: string; handle: string } | undefined) || null
}

const normal = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s*›\s*/g, ">")
    .trim()
    .toLowerCase()

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const vendedor = await vendedorHetna(req)
  const categorias = await categoriasParaPublicar(req.scope)
  res.json({ vendedor, categorias: categorias.filter((c) => c.final), max_filas: MAX_FILAS })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as { filas?: unknown; simular?: unknown }
  const filas = Array.isArray(b.filas) ? (b.filas as Record<string, unknown>[]) : []
  if (!filas.length) return res.status(400).json({ message: "No llegó ningún producto." })
  if (filas.length > MAX_FILAS) return res.status(400).json({ message: `Máximo ${MAX_FILAS} productos por importación.` })
  const simular = b.simular === true

  const vendedor = await vendedorHetna(req)
  if (!vendedor) {
    return res.status(409).json({ message: "No encontramos la tienda de HETNA (CATALOGO_SELLER_HANDLE o CAM_SELLER_HANDLE)." })
  }

  // La categoría se puede escribir por nombre o por ruta completa ("Herramientas › Fresas")
  const cats = (await categoriasParaPublicar(req.scope)).filter((c) => c.final)
  const categoriaDe = (v: unknown) => {
    const t = normal(v)
    if (!t) return ""
    const exacta = cats.find((c) => normal(c.ruta) === t || normal(c.nombre) === t || c.id === String(v).trim())
    return exacta?.id || ""
  }

  const logger = req.scope.resolve("logger")
  const resultados: { fila: number; ok: boolean; titulo: string; product_id?: string; handle?: string; error?: string }[] = []
  for (let i = 0; i < filas.length; i++) {
    const f = filas[i] || {}
    const titulo = String(f.titulo || "").trim()
    try {
      const categoria_id = categoriaDe(f.categoria)
      if (!categoria_id) throw new ErrorPublicar(`No encontramos la categoría "${String(f.categoria || "")}". Usa una de la lista.`)
      const fotos = String(f.fotos || "")
        .split(/[|\n;]/)
        .map((x) => x.trim())
        .filter(Boolean)
      const datos = validar({ ...f, categoria_id, fotos })
      if (simular) {
        resultados.push({ fila: i + 1, ok: true, titulo: datos.titulo })
        continue
      }
      const r = await publicarRapido(req.scope, vendedor.id, undefined, datos)
      resultados.push({ fila: i + 1, ok: true, titulo: datos.titulo, product_id: r.product_id, handle: r.handle })
    } catch (e) {
      const mensaje = e instanceof ErrorPublicar ? e.message : "No se pudo publicar (revisa el registro del servidor)."
      if (!(e instanceof ErrorPublicar)) logger.error(`[catalogo] fila ${i + 1} (${titulo}): ${(e as Error).message}`)
      resultados.push({ fila: i + 1, ok: false, titulo, error: mensaje })
    }
  }
  if (!simular) logger.info(`[catalogo] importados ${resultados.filter((r) => r.ok).length} de ${filas.length} para ${vendedor.handle}`)
  res.json({ simulado: simular, vendedor: vendedor.name, resultados })
}
