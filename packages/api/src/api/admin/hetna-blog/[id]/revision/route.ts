// POST /admin/hetna-blog/:id/revision  { accion: "aprobar" | "rechazar", motivo? }
// Revisión de los artículos que mandan los instructores desde su panel.
//   aprobar  -> se publica; cuenta para bajar la comisión de sus cursos
//   rechazar -> no se publica; el taller ve el motivo, corrige y lo reenvía
// Se le avisa al taller por correo (si falla, no se deshace nada).
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { servicioTalleres } from "../../../../../lib/alta-taller"
import { servicioBlog } from "../../../../../lib/blog"
import { recalcularComisionAutor, type ResumenAutor } from "../../../../../lib/comision-autores"
import { VENDOR_URL, boton, esc, marco } from "../../../../../lib/licitacion"
import { sendEmail } from "../../../../../lib/resend"

const SITIO = process.env.STORE_URL || "https://hetnacnc.com"

async function avisar(scope: any, sellerId: string, titulo: string, aprobado: boolean, motivo: string, slug: string, c: ResumenAutor | null) {
  const t = await servicioTalleres(scope).retrieveSeller(sellerId).catch(() => null)
  if (!t?.email) return
  const comision =
    aprobado && c?.actual != null && c.base != null && c.actual < c.base
      ? `<p style="margin:0 0 12px;color:#40403A">Con tus artículos aprobados, la comisión de tus cursos baja de ${c.base}% a <strong>${c.actual}%</strong> por cada venta nueva.</p>`
      : ""
  const r = await sendEmail({
    to: t.email,
    subject: aprobado ? "Tu artículo ya está publicado en el blog de HETNA" : "Tu artículo necesita cambios",
    html: marco(
      aprobado ? "Artículo publicado" : "Tu artículo necesita cambios",
      `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">Hola, equipo de <strong>${esc(t.name || "tu taller")}</strong>. ` +
        (aprobado
          ? `Revisamos <strong>${esc(titulo)}</strong> y ya está publicado en el blog.</p>${comision}` +
            boton("Ver mi artículo", `${SITIO}/mx/foro-cnc/blog/${encodeURIComponent(slug)}`)
          : `Revisamos <strong>${esc(titulo)}</strong> y antes de publicarlo hay que corregir esto:</p>` +
            `<p style="margin:0 0 12px;color:#40403A;background:#F3F1EA;padding:10px 12px;border-radius:8px">${esc(motivo)}</p>` +
            boton("Corregir mi artículo", `${VENDOR_URL}/blog`))
    ),
  })
  if (!r.sent) scope.resolve("logger").warn(`[blog-revision] correo a ${t.email} no enviado: ${r.reason}`)
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const blog = servicioBlog(req.scope)
  const id = String(req.params.id)
  const [a] = (await blog.listLearningArticles({ id }, { take: 1 })) as any[]
  if (!a) return res.status(404).json({ message: "Artículo no encontrado." })
  if (!a.seller_id) return res.status(400).json({ message: "Este artículo no es de un instructor." })
  const b = (req.body || {}) as { accion?: string; motivo?: string }
  const motivo = typeof b.motivo === "string" ? b.motivo.trim().slice(0, 1000) : ""
  if (b.accion === "aprobar") {
    await blog.updateLearningArticles({
      id,
      revision: null,
      motivo_revision: null,
      published_at: a.published_at || new Date(),
      aprobado_at: a.aprobado_at || new Date(),
    } as any)
  } else if (b.accion === "rechazar") {
    if (motivo.length < 5) return res.status(400).json({ message: "Escribe qué tiene que corregir (mínimo 5 letras)." })
    await blog.updateLearningArticles({ id, revision: "rechazado", motivo_revision: motivo, published_at: null } as any)
  } else {
    return res.status(400).json({ message: "Acción no válida." })
  }
  let comision: ResumenAutor | null = null
  try {
    comision = await recalcularComisionAutor(req.scope, a.seller_id)
  } catch (e) {
    req.scope.resolve("logger").error(`[blog-revision] comisión ${a.seller_id}: ${(e as Error).message}`)
  }
  await avisar(req.scope, a.seller_id, a.title, b.accion === "aprobar", motivo, a.slug, comision).catch(() => undefined)
  res.json({ ok: true, comision })
}
