// POST /admin/hetna-subir-disenos/publicar { ...ficha, sku, archivo_storage_key, imagen_url, derechos_confirmados: true }
// Publica con lib/publicar-diseno.ts (producto + oferta de la tienda HETNA, descarga automática).
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { STORE_URL } from "../../../../lib/licitacion"
import { publicarDiseno } from "../../../../lib/publicar-diseno"
import { revisarParaPublicar } from "../../../../lib/subir-disenos"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as Record<string, any>
  const error = revisarParaPublicar(b)
  if (error) return res.status(400).json({ message: error })
  try {
    const r = await publicarDiseno(req.scope as any, {
      sku: String(b.sku),
      titulo: String(b.titulo).trim().slice(0, 120),
      handle: String(b.handle),
      descripcion_corta: String(b.descripcion_corta || "").slice(0, 300),
      descripcion_larga: String(b.descripcion_larga).slice(0, 3000),
      caracteristicas: String(b.caracteristicas || "").slice(0, 800),
      formatos: String(b.formatos || "").slice(0, 80),
      subcategoria: String(b.subcategoria || "") || undefined,
      tags: String(b.tags || "").slice(0, 300),
      imagen_url: String(b.imagen_url),
      gratis: b.gratis === true,
      precio_mxn: b.gratis === true ? undefined : Math.round(Number(b.precio_mxn)),
      archivo_storage_key: String(b.archivo_storage_key),
      titulo_seo: String(b.titulo_seo || "").slice(0, 70),
      meta_description: String(b.meta_description || "").slice(0, 160),
      keyword_principal: String(b.keyword_principal || "").slice(0, 80),
      faq: Array.isArray(b.faq) ? b.faq.filter((x: any) => x?.p && x?.r).slice(0, 5) : [],
      licencia: ["personal", "comercial_limitada", "comercial_ampliada"].includes(b.licencia) ? b.licencia : "personal",
    })
    res.json({ ...r, url: `${STORE_URL}/mx/products/${r.handle}` })
  } catch (e) {
    req.scope.resolve("logger").warn(`[subir-disenos] publicar ${b.sku}: ${(e as Error).message}`)
    res.status(400).json({ message: (e as Error).message })
  }
}
