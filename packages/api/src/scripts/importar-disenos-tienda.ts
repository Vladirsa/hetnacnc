// Pasa a la tienda, EN BORRADOR, los diseños generados por scripts/disenos/ (27 nov 2026).
// Hace por cada <nombre>.zip lo mismo que la pantalla «Subir diseños»:
//   1. revisa el ZIP y lo guarda en el bucket privado (originales/<sku>/)
//   2. prepara la foto a partir de la vista previa <nombre>.png: foto realista con IA
//      (pieza cortada sobre un banco de trabajo) si hay FAL_KEY; si no, la vista tal cual
//   3. Claude escribe la ficha (título, descripción, FAQ, etiquetas, precio $30–$250)
//      con la foto y las medidas del LEEME.txt del ZIP
//   4. crea el producto con su oferta en la tienda HETNA, en BORRADOR
// Nada se publica: el dueño revisa cada ficha en el admin y la publica.
// No duplica: si ya hay un producto con el mismo SKU (HCNC-G-<NOMBRE>), lo salta.
//
// Uso (desde packages/api; normalmente lo llama scripts/disenos/subir_a_tienda.sh):
//   ./node_modules/.bin/medusa exec ./src/scripts/importar-disenos-tienda.ts <carpeta> [nombre-a-saltar,...]
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { unzipSync } from "fflate"
import { existsSync, readFileSync, readdirSync } from "fs"
import { join } from "path"

import { publicarDiseno } from "../lib/publicar-diseno"
import { problemaArchivoDiseno } from "../lib/revisar-archivo-diseno"
import { falListo, guardarArchivo, prepararImagen, proponerFicha, slug } from "../lib/subir-disenos"

/** SKU fijo por diseño, para no duplicar si se vuelve a correr. */
export function skuGenerado(nombre: string) {
  return `HCNC-G-${nombre.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`.slice(0, 40).replace(/-+$/, "")
}

/** Texto del LEEME.txt dentro del ZIP (medidas y uso), para que la IA no invente. */
function leemeDe(buf: Buffer): string {
  try {
    const dentro = unzipSync(new Uint8Array(buf), { filter: (f) => /leeme\.txt$/i.test(f.name) })
    const f = Object.values(dentro)[0]
    return f ? Buffer.from(f).toString("utf8") : ""
  } catch {
    return ""
  }
}

/** Formatos que trae el ZIP (DXF, STL...). */
function formatosDe(buf: Buffer): string {
  try {
    const nombres = Object.keys(unzipSync(new Uint8Array(buf)))
    const ext = [...new Set(nombres.map((n) => (n.split(".").pop() || "").toUpperCase()).filter((e) => e && e !== "TXT"))]
    return ext.join(", ")
  } catch {
    return ""
  }
}

export default async function importarDisenosTienda({ container, args }: ExecArgs) {
  const [carpeta, saltarTxt] = args || []
  if (!carpeta || !existsSync(carpeta)) {
    console.log("Uso: medusa exec ./src/scripts/importar-disenos-tienda.ts <carpeta> [nombre-a-saltar,...]")
    return
  }
  const saltar = new Set(String(saltarTxt || "").split(",").map((s) => s.trim()).filter(Boolean))
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const zips = readdirSync(carpeta).filter((f) => f.toLowerCase().endsWith(".zip")).sort()
  let creados = 0

  for (const z of zips) {
    const nombre = z.replace(/\.zip$/i, "")
    if (saltar.has(nombre)) {
      console.log(`· ${nombre}: se salta (ya tiene producto)`)
      continue
    }
    const sku = skuGenerado(nombre)
    const ya = await knex("product").whereNull("deleted_at").whereRaw("metadata->>'digital_factory_sku' = ?", [sku]).first("handle", "status")
    if (ya) {
      console.log(`· ${nombre}: ya está en la tienda (${ya.handle}, ${ya.status})`)
      continue
    }
    try {
      const buf = readFileSync(join(carpeta, z))
      const problema = problemaArchivoDiseno(z, buf)
      if (problema) throw new Error(problema)
      const leeme = leemeDe(buf)
      const formatos = formatosDe(buf)

      // 1. Archivo al bucket privado
      const archivo = await guardarArchivo(buf, z, sku)

      // 2. Foto: realista con IA si se puede; si no, la vista previa tal cual
      const png = join(carpeta, `${nombre}.png`)
      if (!existsSync(png)) throw new Error("falta la vista previa .png")
      const contexto = (leeme.split("\n")[0] || nombre).slice(0, 180)
      let imagen: { url: string }
      try {
        imagen = await prepararImagen(container, readFileSync(png), `${nombre}.png`, falListo() ? "escena" : "original", contexto)
      } catch {
        imagen = await prepararImagen(container, readFileSync(png), `${nombre}.png`, "original")
      }

      // 3. Ficha con IA (las medidas salen del LEEME)
      const ficha = await proponerFicha(container, {
        imagen_url: imagen.url,
        nombre_archivo: z,
        formatos,
        sku,
        nota: `Diseño original de HETNA. Usa estas medidas y datos tal cual, no inventes otros: ${leeme.replace(/\s+/g, " ").slice(0, 480)}`,
      })

      // 4. Producto en borrador. Dirección corta a partir del título (la de la IA lleva el SKU
      // pegado); si ya la usa otro producto, se le agrega "-hetna" para no pisarlo.
      let handle = slug(ficha.titulo) || slug(nombre)
      if (await knex("product").whereNull("deleted_at").where({ handle }).first("id")) handle = `${handle}-hetna`.slice(0, 95)
      const r = await publicarDiseno(container, {
        sku,
        titulo: ficha.titulo,
        handle,
        descripcion_corta: ficha.descripcion_corta,
        descripcion_larga: ficha.descripcion_larga || leeme.slice(0, 2000),
        caracteristicas: ficha.caracteristicas,
        formatos: formatos || ficha.formatos,
        subcategoria: ficha.subcategoria || undefined,
        tags: ficha.tags,
        imagen_url: imagen.url,
        precio_mxn: ficha.precio_mxn,
        archivo_storage_key: archivo.storage_key,
        titulo_seo: ficha.titulo_seo,
        meta_description: ficha.meta_description,
        keyword_principal: ficha.keyword_principal,
        faq: ficha.faq,
        licencia: ficha.licencia,
        borrador: true,
      })
      creados++
      console.log(`✔ ${nombre} → «${ficha.titulo}» $${ficha.precio_mxn} (borrador: /mx/products/${r.handle})${ficha.nota ? `\n    nota: ${ficha.nota}` : ""}`)
    } catch (e) {
      console.log(`✘ ${nombre}: ${(e as Error).message}`)
    }
  }
  console.log(`\n${creados} diseños nuevos en la tienda, en borrador. Revísalos en Admin → Productos y publícalos.`)
}
