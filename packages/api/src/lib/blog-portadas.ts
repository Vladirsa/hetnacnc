// Portadas del blog con IA (25 nov 2026): ningún artículo del blog tenía imagen,
// y Google, Facebook y WhatsApp muestran la portada al compartir. A cada
// artículo publicado sin `cover_image_url` se le genera una foto realista del
// tema (sin letras) con fal.ai y se guarda en el almacenamiento público.
// La corre jobs/portadas-blog.ts; también sirve para uno solo.
import { fal } from "./fabrica/fal"
import { subir, temaDe } from "./fabrica"
import { LEARNING_MODULE } from "../modules/learning"

// FLUX schnell: barato y rápido; para una portada de blog basta.
const MODELO = process.env.BLOG_PORTADA_MODELO || "fal-ai/flux/schnell"

const ESCENAS: Record<string, string> = {
  plasma: "a CNC plasma cutting table cutting a steel sheet with bright sparks",
  router: "a CNC router milling an MDF board, wood chips, workshop",
  torno: "a CNC lathe or milling machine machining an aluminum part, metal chips, coolant",
  impresion3d: "a 3D printer printing a technical plastic part on its bed",
  laser: "a CO2 laser cutter engraving and cutting a sheet of plywood with a thin beam",
  lamina: "stacks of steel, aluminum and MDF sheets in a fabrication workshop",
  taller: "a clean modern Mexican CNC workshop with machines and finished parts",
}

export function promptPortada(titulo: string, extracto = ""): string {
  const escena = ESCENAS[temaDe(`${titulo} ${extracto}`)] || ESCENAS.taller
  return (
    `Professional editorial photograph for a blog article titled "${titulo}". ` +
    `Scene: ${escena}. Realistic, natural light, shallow depth of field, high detail. ` +
    `No text, no letters, no words, no logos, no watermark, no people's faces.`
  )
}

export async function generarPortada(scope: any, a: { id: string; slug: string; title: string; excerpt?: string | null }) {
  if (!(process.env.FAL_KEY || "").trim()) throw new Error("falta FAL_KEY")
  const out = await fal(MODELO, { prompt: promptPortada(a.title, a.excerpt || ""), image_size: "landscape_16_9", num_images: 1, enable_safety_checker: true }, 4)
  const url = out?.images?.[0]?.url
  if (!url) throw new Error("fal no regresó imagen")
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!r.ok) throw new Error(`no se pudo bajar la imagen (${r.status})`)
  const tipo = r.headers.get("content-type") || "image/jpeg"
  const ext = tipo.includes("png") ? "png" : tipo.includes("webp") ? "webp" : "jpg"
  const publica = await subir(scope, `blog-portada-${a.slug}.${ext}`, tipo, Buffer.from(await r.arrayBuffer()))
  await scope.resolve(LEARNING_MODULE).updateLearningArticles({ id: a.id, cover_image_url: publica })
  return publica
}

/** Artículos publicados (y aprobados) que todavía no tienen portada. */
export async function articulosSinPortada(scope: any, limite: number) {
  const todos = await scope.resolve(LEARNING_MODULE).listLearningArticles({}, { take: 500, order: { published_at: "DESC" } })
  return (todos as any[])
    .filter((a) => !a.cover_image_url && a.published_at && new Date(a.published_at).getTime() <= Date.now())
    .filter((a) => !a.revision) // null = no necesita revisión o ya aprobado
    .slice(0, limite)
}
