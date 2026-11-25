// Publica el catálogo de "Impresión 3D bajo pedido" (docs/impresion-bajo-pedido/
// catalogo.json + fotos) como productos maestros de la tienda, y pone las
// ofertas de la tienda HETNA en ABS y PLA-CF (3 días hábiles, al precio
// recomendado, en el color o colores de COLORES). Los demás talleres ponen las
// suyas desde su panel (/seller/imprimir).
//
// Uso (en packages/api):
//   COLORES="ABS=Amarillo dorado;PLA-CF=Negro" ./node_modules/.bin/medusa exec ./src/scripts/sembrar-impresion-bajo-pedido.ts
// COLORES: los colores en que HETNA imprime. Por material ("ABS=Amarillo dorado;
// PLA-CF=Negro", varios colores con coma) o los mismos para todos ("Negro"). Sin COLORES se
// publican los productos pero no la oferta de HETNA (se puede poner después
// desde el panel o volviendo a correr el script con COLORES).
// ACTUALIZAR_COLORES=1: además corrige el color de las ofertas de HETNA que ya
// existen (sin tocar su precio ni sus días).
// ACTUALIZAR_FOTOS="handle1,handle2" (o "todas"): vuelve a subir la foto de esos
// productos desde docs/impresion-bajo-pedido/fotos y la pone de portada.
//
// Es idempotente: un producto que ya existe (mismo handle) sólo actualiza sus
// datos de pieza y la liga a la herramienta; una oferta de HETNA que ya existe
// no se toca (el precio que hayas puesto en tu panel se respeta).
import { createHash } from "crypto"
import { existsSync, readFileSync } from "fs"
import { join, resolve } from "path"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows"

import { camSellerHandle } from "../modules/cam/catalog"
import {
  COLECCION_IMPRESION,
  gramosPieza,
  MATERIALES_IMPRESION,
  OPCION_MATERIAL,
  precioRecomendado,
  TITULO_COLECCION_IMPRESION,
} from "../lib/impresion-bajo-pedido"
import { updateOffersWorkflow } from "@mercurjs/core/workflows"

import { guardarOfertasTaller } from "../lib/impresion-catalogo"

// La oferta de HETNA (Vlado, 25 nov 2026: ABS y PLA-CF, 3 días hábiles). El color
// lo da quien corre el script (COLORES), no se supone.
const MATERIALES_HETNA = ["ABS", "PLA-CF"]
const DIAS_HETNA = 3
const lista = (t: string) => t.split(",").map((c) => c.trim()).filter(Boolean).slice(0, 12)
const TEXTO_COLORES = String(process.env.COLORES || "").trim()
/** Colores de HETNA para un material ([] = no lo ofrece). */
export function coloresHetna(material: string, texto = TEXTO_COLORES): string[] {
  if (!texto) return []
  if (!texto.includes("=")) return lista(texto)
  for (const parte of texto.split(";")) {
    const [mat, colores] = parte.split("=")
    if (mat && colores && mat.trim().toUpperCase() === material.toUpperCase()) return lista(colores)
  }
  return []
}
const ACTUALIZAR_COLORES = process.env.ACTUALIZAR_COLORES === "1"
const FOTOS_A_CAMBIAR = new Set(String(process.env.ACTUALIZAR_FOTOS || "").split(",").map((h) => h.trim()).filter(Boolean))
const COLORES_HETNA = MATERIALES_HETNA.some((m) => coloresHetna(m).length) ? ["ok"] : []
const EMPAQUE_G = 120 // caja y relleno, para el peso del envío

type Diseno = {
  handle: string
  titulo: string
  resumen: string
  pieza: "pieza" | "soporte" | "cortador" | "modelo" | "llavero"
  /** llaveros y placas: se piden con el texto del cliente */
  personalizable?: boolean
  etiquetas: string[]
  herramienta_url: string
  foto: string
  /** STL (simplificado) para girar la pieza en la ficha */
  modelo_3d?: string
  volumen_cm3: number
  medidas_mm: [number, number, number]
  /** sólo "modelo": cuántos cuerpos sueltos salen (maceta + plato = 2) */
  piezas?: number
  relleno?: number // 100 en piezas de pura pared (cortadores)
  con_sello?: boolean
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const huella = (b: Buffer) => createHash("sha1").update(b).digest("hex")
const mm = (m: number[]) => m.map((x) => Math.round(x)).join(" × ") + " mm"

function descripcion(d: Diseno): string {
  if (d.pieza === "cortador") {
    return [
      `<p>${esc(d.resumen)}</p>`,
      `<p><strong>Cómo se usa:</strong> extiende la masa (con guías de grosor queda pareja), enharina un poco el filo y presiona el cortador hasta el fondo. La ceja de arriba es para apoyar los dedos.${d.con_sello ? " Antes de sacar la galleta, mete el sello dentro del cortador y presiona: deja el dibujo marcado." : ""}</p>`,
      `<ul><li>Medida del cortador (con la ceja): ${mm(d.medidas_mm)}</li><li>${d.con_sello ? "Incluye el cortador y el sello." : "Incluye el cortador."}</li><li>Impreso en 3D bajo pedido por el taller que elijas: material, color, precio y días según su oferta.</li></ul>`,
      `<p><strong>Para alimentos:</strong> pide un material apto para contacto con alimentos y lávalo a mano con agua tibia; las piezas impresas no van al lavavajillas.</p>`,
      `<p>¿Tienes impresora 3D? Descarga el cortador gratis y cámbiale la medida o el sello en la herramienta de HETNA.</p>`,
    ].join("")
  }
  // Piezas de Modelos 3D: sin instrucciones de masa ni de rodillos
  // Llaveros y placas: el cliente escribe su nombre al agregarlo al carrito
  if (d.pieza === "llavero")
    return [
      `<p>${esc(d.resumen)}</p>`,
      `<ul><li>Medida del modelo de la foto: ${mm(d.medidas_mm)} (cambia según el largo del texto).</li><li>Letras en relieve y argolla para el llavero o el collar.</li><li>Se imprime en 3D bajo pedido con el taller que elijas: material, color, precio y días según su oferta.</li></ul>`,
      `<p><strong>Cómo se pide:</strong> escribe el nombre o el texto al agregarlo al carrito y el taller lo imprime así.</p>`,
      `<p>¿Quieres otra forma, un ícono o tu logo? Ábrelo en la herramienta de llaveros de HETNA, ajústalo y baja el archivo gratis, o pide varios.</p>`,
    ].join("")
  if (d.pieza === "modelo")
    return [
      `<p>${esc(d.resumen)}</p>`,
      `<ul><li>${(d.piezas || 1) > 1 ? `Sale en ${d.piezas} piezas; la más grande mide` : "Medidas de la pieza:"} ${mm(d.medidas_mm)}</li><li>Se imprime en 3D bajo pedido con el taller que elijas: material, color, precio y días según su oferta.</li></ul>`,
      `<p>¿De otro tamaño? Abre el modelo en Modelos 3D de HETNA, cambia las medidas y baja el STL gratis, o pide que te lo impriman así.</p>`,
    ].join("")
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

  const archivos = container.resolve(Modules.FILE)
  const subir = async (filename: string, mimeType: string, bytes: Buffer) =>
    (await archivos.createFiles([{ filename, mimeType, content: bytes.toString("base64"), access: "public" }]))[0]

  let nuevos = 0, actualizados = 0, ofertas = 0, colores = 0, fotosCambiadas = 0
  for (const d of catalogo) {
    const metadata: Record<string, any> = {
      impresion_bajo_pedido: true,
      impresion: { volumen_cm3: d.volumen_cm3, medidas_mm: d.medidas_mm, ...(d.relleno ? { relleno: d.relleno } : {}) },
      herramienta_url: d.herramienta_url,
      medidas: mm(d.medidas_mm),
      palabras_clave: d.etiquetas.join(", "),
      seller_id: hetna.id,
      ...(d.personalizable ? { personalizable: true } : {}),
    }
    const { data: existe } = await query.graph({ entity: "product", fields: ["id", "thumbnail", "images.url", "metadata", "variants.id", "variants.title"], filters: { handle: d.handle } })
    let producto = (existe as any[])[0]
    const previa = (producto?.metadata || {}) as Record<string, any>

    // Foto y vista 3D: se suben sólo si cambiaron (huella sha1 en la metadata)
    // y sólo si las había puesto este script: lo que HETNA ponga a mano se respeta.
    const foto = join(carpeta, d.foto)
    const bytesFoto = existsSync(foto) ? readFileSync(foto) : null
    if (!producto && !bytesFoto) {
      logger.warn(`[impresion] ${d.handle}: falta la foto ${d.foto}; no se publica`)
      continue
    }
    const rutaStl = d.modelo_3d ? join(carpeta, d.modelo_3d) : ""
    const bytesStl = rutaStl && existsSync(rutaStl) ? readFileSync(rutaStl) : null
    if (rutaStl && !bytesStl) logger.warn(`[impresion] ${d.handle}: falta el modelo 3D ${d.modelo_3d}; queda sin vista 3D`)
    const shaFoto = bytesFoto ? huella(bytesFoto) : null
    const shaStl = bytesStl ? huella(bytesStl) : null
    const stlDelScript = !previa.vista_previa || !!previa.vista_previa_sha
    if (bytesStl && shaStl !== previa.vista_previa_sha && stlDelScript) {
      const stl = await subir(`${d.handle}.stl`, "model/stl", bytesStl)
      Object.assign(metadata, { vista_previa: stl.url, vista_previa_sha: shaStl })
    }

    if (producto) {
      const cambios: Record<string, any> = {}
      // Productos sembrados antes de guardar foto_url: la portada del script lleva el handle en el nombre
      // ("<hora>-<handle>.png" o, con ACTUALIZAR_FOTOS de antes, "<hora>-<handle>-<hora>.png")
      const fotoDelScript = previa.foto_url
        ? producto.thumbnail === previa.foto_url
        : new RegExp(`/\\d+-${d.handle}(-\\d+)?\\.png$`).test(String(producto.thumbnail || ""))
      // ACTUALIZAR_FOTOS="handle1,handle2" (o "todas"): sube la foto aunque no haya cambiado o la hayan puesto a mano
      const forzar = FOTOS_A_CAMBIAR.has("todas") || FOTOS_A_CAMBIAR.has(d.handle)
      if (bytesFoto && (forzar || (shaFoto !== previa.foto_sha && fotoDelScript))) {
        const archivo = await subir(`${d.handle}.png`, "image/png", bytesFoto)
        // se cambia sólo la portada; las demás imágenes del producto se quedan
        const otras = ((producto.images || []) as { url: string }[]).filter((i) => i.url !== producto.thumbnail).map((i) => ({ url: i.url }))
        Object.assign(cambios, { thumbnail: archivo.url, images: [{ url: archivo.url }, ...otras] })
        Object.assign(metadata, { foto_url: archivo.url, foto_sha: shaFoto })
        fotosCambiadas++
        logger.info(`[impresion] ${d.handle}: foto nueva`)
      }
      await updateProductsWorkflow(container).run({ input: { selector: { id: producto.id }, update: { ...cambios, metadata: { ...previa, ...metadata } } } as any })
      actualizados++
    } else {
      const archivo = await subir(`${d.handle}.png`, "image/png", bytesFoto as Buffer)
      Object.assign(metadata, { foto_url: archivo.url, foto_sha: shaFoto })
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
                weight: (gramosPieza(d.volumen_cm3, m, d.relleno) + EMPAQUE_G) / 1000, // kg, como publicar-rapido
                ...caja,
              })),
            },
          ],
        } as any,
      })
      producto = result[0]
      // SIN liga producto↔taller: en Mercur esa liga es la lista de quién PUEDE
      // venderlo (vacía = todos). Si se ligara a HETNA, ningún otro taller podría
      // poner su oferta (docs de Mercur: master-products-and-offers).
      nuevos++
      logger.info(`[impresion] publicado ${d.handle}`)
    }

    // 3. Ofertas de HETNA (sólo las que faltan)
    if (!COLORES_HETNA.length) continue
    const { data: mias } = await query.graph({ entity: "offer", fields: ["id", "variant_id", "metadata"], filters: { seller_id: hetna.id, product_id: producto.id } as any })
    const tiene = new Set((mias as any[]).map((o) => o.variant_id))
    // ACTUALIZAR_COLORES=1: corrige sólo los colores de las ofertas de HETNA que ya
    // existen (el precio y los días que pusiste en el panel no se tocan)
    if (ACTUALIZAR_COLORES) {
      const material = new Map(((producto.variants || []) as { id: string; title: string }[]).map((v) => [v.id, v.title]))
      const cambiar = (mias as any[])
        .map((o) => ({ o, colores: coloresHetna(material.get(o.variant_id) || "") }))
        .filter(({ o, colores }) => colores.length && JSON.stringify(o.metadata?.colores || []) !== JSON.stringify(colores))
      if (cambiar.length) {
        await updateOffersWorkflow(container).run({
          input: { offers: cambiar.map(({ o, colores }) => ({ id: o.id, metadata: { ...(o.metadata || {}), colores } })) as any },
        })
        colores += cambiar.length
      }
    }
    const pieza = { volumen_cm3: d.volumen_cm3, medidas_mm: d.medidas_mm, relleno: d.relleno }
    const faltan = ((producto.variants || []) as { id: string; title: string }[])
      .filter((v) => MATERIALES_HETNA.includes(v.title) && !tiene.has(v.id) && coloresHetna(v.title).length)
      .map((v) => ({ variant_id: v.id, activa: true, precio: precioRecomendado(pieza, v.title) || 0, dias: DIAS_HETNA, colores: coloresHetna(v.title) }))
      .filter((o) => o.precio > 0)
    if (faltan.length) {
      await guardarOfertasTaller(container, hetna.id, "sembrar-impresion", faltan)
      ofertas += faltan.length
    }
  }
  if (!COLORES_HETNA.length) logger.warn('[impresion] sin COLORES: no se pusieron ofertas de HETNA (corre con COLORES="ABS=Amarillo dorado;PLA-CF=Negro" o ponlas en /seller/imprimir)')
  logger.info(`[impresion] listo: ${nuevos} nuevos, ${actualizados} actualizados, ${ofertas} ofertas de HETNA${ACTUALIZAR_COLORES ? `, ${colores} con color corregido` : ""}, ${fotosCambiadas} fotos nuevas`)
}
