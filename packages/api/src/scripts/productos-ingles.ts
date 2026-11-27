// @ts-nocheck
// Guarda la traducción al inglés de los productos (fase 3 del inglés).
//
// Lee src/scripts/datos/productos-en/*.json y pone en product.metadata:
//   en_title, en_subtitle, en_description, en_seo_title, en_meta_description
// La tienda los muestra en /us (apps/storefront/src/i18n/datos.ts). El texto en
// español no se toca.
//
// Uso (en /root/hetnacnc/packages/api):
//   1) VER qué se haría (no cambia nada):
//        NODE_ENV=production bunx medusa exec ./src/scripts/productos-ingles.ts
//   2) Guardar:
//        APLICAR=1 NODE_ENV=production bunx medusa exec ./src/scripts/productos-ingles.ts
//   Opciones:
//        FORZAR=1   también guarda los productos cuyo texto en español cambió
//                   después de traducirlos (por defecto se saltan y se avisan).
//        PISAR=1    reemplaza también el inglés que un taller escribió a mano
//                   (por defecto no se toca).
//
// Es seguro repetirlo.
import { existsSync, readdirSync, readFileSync } from "fs"
import { join } from "path"
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { limpiarCacheTienda } from "../lib/planos-catalogo"
import { CAMPOS_EN as CAMPOS, huellaEs } from "../lib/productos-ingles"

function carpetaDatos() {
  const opciones = [join(process.cwd(), "src/scripts/datos/productos-en"), join(__dirname, "datos/productos-en")]
  const c = opciones.find((d) => existsSync(d))
  if (!c) throw new Error("No encontré la carpeta src/scripts/datos/productos-en (corre el script dentro de packages/api)")
  return c
}

export default async function productosIngles({ container }: ExecArgs) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const log = (m: string) => console.log("[ingles] " + m)
  const aplicar = process.env.APLICAR === "1"
  const forzar = process.env.FORZAR === "1"
  const pisar = process.env.PISAR === "1"

  const dir = carpetaDatos()
  const filas: any[] = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
  log(`Traducciones en archivo: ${filas.length}`)

  const ids = filas.map((f) => f.id)
  const actuales = await knex("product").whereIn("id", ids).whereNull("deleted_at").select("id", "handle", "title", "description", "metadata")
  const porId = new Map(actuales.map((p: any) => [p.id, p]))

  let listos = 0
  let cambiados = 0
  let sinCambio = 0
  const saltados: string[] = []
  const handles: string[] = []

  for (const t of filas) {
    const p: any = porId.get(t.id)
    if (!p) {
      saltados.push(`${t.handle}: ya no existe`)
      continue
    }
    if (t.es_hash && huellaEs(p.title, p.description) !== t.es_hash && !forzar) {
      saltados.push(`${p.handle}: el texto en español cambió después de traducirlo`)
      continue
    }
    const meta = p.metadata || {}
    // Lo que el taller escribió a mano no se pisa (salvo PISAR=1)
    const manual = typeof meta.en_title === "string" && meta.en_title.trim() && meta.en_auto !== true
    if (manual && !pisar) {
      sinCambio++
      listos++
      continue
    }
    const nuevo: Record<string, any> = {}
    for (const k of CAMPOS) {
      const v = typeof t[k] === "string" ? t[k].trim() : ""
      if (!v) continue
      const ya = typeof meta[k] === "string" ? meta[k].trim() : ""
      if (ya === v) continue
      nuevo[k] = v
    }
    if (Object.keys(nuevo).length) {
      nuevo.en_hash = huellaEs(p.title, p.description)
      nuevo.en_auto = true
    }
    listos++
    if (!Object.keys(nuevo).length) {
      sinCambio++
      continue
    }
    cambiados++
    handles.push(p.handle)
    log(`  + ${p.handle} · ${Object.keys(nuevo).filter((k) => !["en_hash", "en_auto"].includes(k)).join(", ")} · "${String(nuevo.en_title || meta.en_title || p.title).slice(0, 70)}"`)
    if (aplicar) {
      await knex("product")
        .where({ id: p.id })
        .update({ metadata: knex.raw("coalesce(metadata, '{}'::jsonb) || ?::jsonb", [JSON.stringify(nuevo)]), updated_at: knex.fn.now() })
    }
  }

  log(`Productos que coinciden: ${listos} · con algo nuevo: ${cambiados} · ya estaban: ${sinCambio}`)
  if (saltados.length) {
    log(`Saltados (${saltados.length}):`)
    for (const s of saltados) log(`  - ${s}`)
  }
  if (!aplicar) {
    log("Nada cambió. Si la lista está bien, corre lo mismo con APLICAR=1 adelante.")
    return
  }
  try {
    await limpiarCacheTienda(["products", "offers", ...handles.map((h) => `product-${h}`)])
    log("Caché de la tienda limpia.")
  } catch (e) {
    log(`No pude limpiar la caché de la tienda (${e?.message || e}); los cambios se verán al siguiente despliegue.`)
  }
  log(`✓ Listo: ${cambiados} productos con su texto en inglés. Revisa uno en https://hetnacnc.com/us/products/${handles[0] || ""}`)
}
