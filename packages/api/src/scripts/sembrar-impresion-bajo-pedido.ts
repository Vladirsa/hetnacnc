// Publica el catálogo de "Impresión 3D bajo pedido" (docs/impresion-bajo-pedido/
// catalogo.json + fotos) como productos maestros de la tienda, y pone las
// ofertas de la tienda HETNA en ABS y PLA-CF (3 días hábiles, color Negro, al
// precio recomendado). Los demás talleres ponen las suyas desde su panel
// (/seller/imprimir).
//
// Uso (en packages/api):
//   ./node_modules/.bin/medusa exec ./src/scripts/sembrar-impresion-bajo-pedido.ts
//
// Es idempotente: un producto que ya existe (mismo handle) sólo actualiza sus
// datos de pieza y la liga a la herramienta; una oferta de HETNA que ya existe
// no se toca (el precio que hayas puesto en tu panel se respeta).
import { existsSync, readFileSync } from "fs"
import { join, resolve } from "path"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { MercurModules } from "@mercurjs/types"

import { camSellerHandle } from "../modules/cam/catalog"
import {
  COLECCION_IMPRESION,
  gramosPieza,
  MATERIALES_IMPRESION,
  OPCION_MATERIAL,
  precioRecomendado,
  TITULO_COLECCION_IMPRESION,
} from "../lib/impresion-bajo-pedido"
import { guardarOfertasTaller } from "../lib/impresion-catalogo"

// La oferta de HETNA (lo que dijo Vlado el 25 nov 2026)
const MATERIALES_HETNA = ["ABS", "PLA-CF"]
const DIAS_HETNA = 3
const COLORES_HETNA = ["Negro"]
const EMPAQUE_G = 120 // caja y relleno, para el peso del envío

type Diseno = {
  handle: string
  titulo: string
  resumen: string
  pieza: "pieza" | "soporte"
  etiquetas: string[]
  herramienta_url: string
  foto: string
  volumen_cm3: number
  medidas_mm: [number, number, number]
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const mm = (m: number[]) => m.map((x) => Math.round(x)).join(" × ") + " mm"

function descripcion(d: Diseno): string {
  const uso =
    d.pieza === "soporte"
      ? `<p><strong>Cómo se usa:</strong> mete el rodillo en el eje, ponle el seguro en C en la punta y rueda. Para cambiar de diseño quitas el seguro y cambias el rodillo. Trae 2 seguros (uno de repuesto).</p>`
      : `<p><strong>Cómo se usa:</strong> aplana la masa (con guías de grosor queda pareja), pon un poco de fécula o desmoldante y ${d.handle.startsWith("rodillo") ? "rueda el rodillo con presión pareja" : "presiona la placa"}. El diseño va en espejo para que en la masa se lea al derecho.</p>`
  return [
    `<p>${esc(d.resumen)}</p>`,
    uso,
    `<ul><li>Medidas de la pieza: ${mm(d.medidas_mm)}</li><li>Impreso en 3D bajo pedido por el taller que elijas: material, color, precio y días según su oferta.</li>${d.handle.startsWith("rodillo") ? "<li>Hueco de 12 mm: entra en el soporte con eje de HETNA (se vende aparte).</li>" : ""}</ul>`,
    `<p><strong>Para alimentos</strong> (fondant, galletas): pide un material apto para contacto con alimentos y lávalo a mano; el PLA y el ABS no van al lavavajillas.</p>`,
    `<p>¿Tienes impresora 3D? Descarga el archivo gratis y cámbiale el texto o las medidas en la herramienta de HETNA.</p>`,
  ].join("")
}

export default async function sembrarImpresion({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productos = container.resolve(Modules.PRODUCT) as any

  const carpeta = [resolve(process.cwd(), "../../docs/impresion-bajo-pedido"), resolve(__dirname, "../../../../docs/impresion-bajo-pedido")].find((c) =>
    existsSync(join(c, "catalogo.json"))
  )
  if (!carpeta) {
    logger.error("[impresion] no encontré docs/impresion-bajo-pedido/catalogo.json")
    return
  }
  const catalogo = JSON.parse(readFileSync(join(carpeta, "catalogo.json"), "utf8")) as Diseno[]

  // 1. La colección
  let { data: cols } = await query.graph({ entity: "product_collection", fields: ["id"], filters: { handle: COLECCION_IMPRESION } })
  let coleccionId = (cols as { id: string }[])[0]?.id
  if (!coleccionId) {
    const [c] = await productos.createProductCollections([{ title: TITULO_COLECCION_IMPRESION, handle: COLECCION_IMPRESION }])
    coleccionId = c.id
    logger.info(`[impresion] colección creada (${coleccionId})`)
  }

  // 2. La tienda HETNA, el perfil de envío, los canales y la categoría
  const { data: sellers } = await query.graph({ entity: "seller", fields: ["id", "name"], filters: { handle: camSellerHandle() } })
  const hetna = (sellers as { id: string; name: string }[])[0]
  if (!hetna) {
    logger.error(`[impresion] no existe la tienda ${camSellerHandle()} (corre crear-tienda-hetna.ts)`)
    return
  }
  const { data: perfiles } = await query.graph({ entity: "shipping_profile", fields: ["id", "name"] })
  const perfil = ((perfiles as any[]).find((x) => x.name === "Marketplace Shipping") || (perfiles as any[]).find((x) => x.name !== "Producto digital")) as { id: string }
  const { data: canales } = await query.graph({ entity: "sales_channel", fields: ["id"] })
  const { data: cats } = await query.graph({ entity: "product_category", fields: ["id", "name", "handle", "is_active", "is_internal"] })
  const categoria = (cats as any[]).find((c) => c.is_active !== false && !c.is_internal && (/impresi[oó]n[- ]3d/i.test(c.handle) || /impresi[oó]n 3d/i.test(c.name)))
  if (!categoria) logger.warn("[impresion] no hay categoría de Impresión 3D: los productos quedan sólo en la colección")

  let nuevos = 0, actualizados = 0, ofertas = 0
  for (const d of catalogo) {
    const metadata = {
      impresion_bajo_pedido: true,
      impresion: { volumen_cm3: d.volumen_cm3, medidas_mm: d.medidas_mm },
      herramienta_url: d.herramienta_url,
      medidas: mm(d.medidas_mm),
      palabras_clave: d.etiquetas.join(", "),
      seller_id: hetna.id,
    }
    const { data: existe } = await query.graph({ entity: "product", fields: ["id", "metadata", "variants.id", "variants.title"], filters: { handle: d.handle } })
    let producto = (existe as any[])[0]

    if (producto) {
      await updateProductsWorkflow(container).run({ input: { selector: { id: producto.id }, update: { metadata: { ...(producto.metadata || {}), ...metadata } } } as any })
      actualizados++
    } else {
      const foto = join(carpeta, d.foto)
      if (!existsSync(foto)) {
        logger.warn(`[impresion] ${d.handle}: falta la foto ${d.foto}; no se publica`)
        continue
      }
      const [archivo] = await container.resolve(Modules.FILE).createFiles([
        { filename: `${d.handle}.png`, mimeType: "image/png", content: readFileSync(foto).toString("base64"), access: "public" },
      ])
      const [x, y, z] = d.medidas_mm
      const caja = { length: Math.ceil(Math.max(x, y, z) / 10) + 2, width: Math.ceil([x, y, z].sort((a, b) => b - a)[1] / 10) + 2, height: Math.ceil(Math.min(x, y, z) / 10) + 2 }
      const valores = MATERIALES_IMPRESION.map((m) => m.valor)
      const corto = d.handle.replace(/-impres[oa]-3d$/, "").replace(/[^a-z0-9]+/g, "-").slice(0, 28).toUpperCase()
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: d.titulo,
              subtitle: "Impresión 3D bajo pedido",
              description: descripcion(d),
              handle: d.handle,
              status: "published" as const,
              discountable: true,
              thumbnail: archivo.url,
              images: [{ url: archivo.url }],
              shipping_profile_id: perfil.id,
              collection_id: coleccionId,
              ...(categoria ? { category_ids: [categoria.id] } : {}),
              sales_channels: (canales as { id: string }[]).map((c) => ({ id: c.id })),
              metadata,
              options: [{ title: OPCION_MATERIAL, values: valores }],
              variants: valores.map((m) => ({
                title: m,
                sku: `HETNA-3D-${corto}-${m.replace(/[^A-Za-z0-9]/g, "")}`,
                manage_inventory: false, // las existencias viven en cada oferta (Mercur)
                options: { [OPCION_MATERIAL]: m },
                prices: [],
                weight: (gramosPieza(d.volumen_cm3, m) + EMPAQUE_G) / 1000, // kg, como publicar-rapido
                ...caja,
              })),
            },
          ],
        } as any,
      })
      producto = result[0]
      await container.resolve(ContainerRegistrationKeys.LINK).create([
        { [Modules.PRODUCT]: { product_id: producto.id }, [MercurModules.SELLER]: { seller_id: hetna.id } },
      ])
      nuevos++
      logger.info(`[impresion] publicado ${d.handle}`)
    }

    // 3. Ofertas de HETNA (sólo las que faltan)
    const { data: mias } = await query.graph({ entity: "offer", fields: ["id", "variant_id"], filters: { seller_id: hetna.id, product_id: producto.id } as any })
    const tiene = new Set((mias as any[]).map((o) => o.variant_id))
    const pieza = { volumen_cm3: d.volumen_cm3, medidas_mm: d.medidas_mm }
    const faltan = ((producto.variants || []) as { id: string; title: string }[])
      .filter((v) => MATERIALES_HETNA.includes(v.title) && !tiene.has(v.id))
      .map((v) => ({ variant_id: v.id, activa: true, precio: precioRecomendado(pieza, v.title) || 0, dias: DIAS_HETNA, colores: COLORES_HETNA }))
      .filter((o) => o.precio > 0)
    if (faltan.length) {
      await guardarOfertasTaller(container, hetna.id, "sembrar-impresion", faltan)
      ofertas += faltan.length
    }
  }
  logger.info(`[impresion] listo: ${nuevos} nuevos, ${actualizados} actualizados, ${ofertas} ofertas de HETNA`)
}
