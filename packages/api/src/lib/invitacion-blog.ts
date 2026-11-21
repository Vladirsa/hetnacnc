// Invitación a los instructores para escribir en el blog (y pagar menos
// comisión por sus cursos, lib/comision-autores.ts). La manda n8n con
// POST /hooks/academia/invitar-blog:
//   modo "ver"     lista a quién se le mandaría (no manda nada)
//   modo "prueba"  manda el correo SÓLO a `correo` (el dueño) y regresa el texto del WhatsApp
//   modo "enviar"  manda a cada instructor UNA sola vez (queda anotado en seller.metadata)
// Instructor = taller activo con al menos un curso publicado. El WhatsApp sólo
// llega a números verificados que no escribieron BAJA (lib/whatsapp.ts).
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { diasVigencia, escalones } from "./comision-autores"
import { VENDOR_URL, boton, esc, marco } from "./licitacion"
import { sendEmail } from "./resend"
import { avisarWhatsapp } from "./whatsapp"

export const MAX_POR_CORRIDA = 40

export type Instructor = { id: string; nombre: string; email: string | null; cursos: number; invitado: string | null }

/** Talleres activos con cursos publicados, y si ya se les invitó. */
export async function instructores(c: MedusaContainer): Promise<Instructor[]> {
  const knex = c.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const filas = await knex("course as c")
    .join("seller as s", "s.id", "c.seller_id")
    .whereNull("c.deleted_at")
    .whereNull("s.deleted_at")
    .where("c.status", "published")
    .whereNotIn("s.status", ["suspended", "terminated"])
    .groupBy("s.id", "s.name", "s.email", "s.metadata")
    .select("s.id", "s.name", "s.email", "s.metadata", knex.raw("count(c.id)::int as cursos"))
  return filas.map((f: any) => ({
    id: f.id,
    nombre: f.name || "tu taller",
    email: f.email || null,
    cursos: Number(f.cursos) || 0,
    invitado: (f.metadata && f.metadata.invitacion_blog_at) || null,
  }))
}

function tabla() {
  const filas = escalones()
    .map((e) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${e.articulos} ${e.articulos === 1 ? "artículo" : "artículos o más"}</td><td style="padding:6px 10px;border-bottom:1px solid #eee"><strong>${e.pct}%</strong></td></tr>`)
    .join("")
  return `<table style="border-collapse:collapse;margin:0 0 14px;font-size:14px;color:#40403A"><tr><td style="padding:6px 10px;border-bottom:1px solid #eee">Sin artículos</td><td style="padding:6px 10px;border-bottom:1px solid #eee">5%</td></tr>${filas}</table>`
}

const p = (t: string) => `<p style="margin:0 0 12px;color:#40403A;line-height:1.55">${t}</p>`

export function correoInvitacion(nombre: string) {
  const dias = diasVigencia()
  const mejor = escalones().slice(-1)[0]
  return {
    asunto: "Paga menos comisión por tus cursos: escribe en el blog de HETNA",
    html: marco(
      "Escribe en el blog y paga menos comisión",
      p(`Hola, equipo de <strong>${esc(nombre)}</strong>. Desde hoy puedes <strong>bajar la comisión de tus cursos</strong> escribiendo en el blog de HETNA.`) +
        p("Escribe sobre lo que sabes: una técnica, un truco de tu máquina, un caso de tu taller o cómo elegir una fresa o un material. Lo revisamos y lo publicamos con el nombre de tu taller.") +
        p(`Mientras tengas artículos publicados (cuenta cada uno durante ${dias} días), tus cursos pagan menos comisión por venta:`) +
        tabla() +
        p("Además tu artículo sale en Google y en la Academia con tu nombre: te trae alumnos y clientes nuevos. Es gratis y lo escribes desde tu panel.") +
        boton("Escribir mi primer artículo", `${VENDOR_URL}/blog`) +
        `<p style="margin:14px 0 0;color:#6B6A63;font-size:13px;line-height:1.5">Requisitos: unas 250 palabras o más, tuyo (no copiado) y útil para quien lo lea, no un anuncio. Te avisamos por correo cuando lo publiquemos. El descuento aplica a las ventas nuevas de tus cursos${mejor ? ` (la comisión baja hasta ${mejor.pct}%)` : ""}; tus libros y demás productos siguen igual.</p>`
    ),
  }
}

export function whatsappInvitacion() {
  const e = escalones()
  const [uno, dos] = [e[0], e[1]]
  return {
    titulo: "Paga menos comisión por tus cursos",
    cuerpo:
      `Escribe un artículo en el blog de HETNA y, al publicarlo, la comisión de tus cursos baja de 5% a ${uno?.pct ?? 4.5}%` +
      (dos ? `. Con ${dos.articulos} artículos o más, baja a ${dos.pct}%.` : ".") +
      " Además sale en Google con el nombre de tu taller y te trae clientes. Se escribe desde tu panel › Blog.",
    url: `${VENDOR_URL}/blog`,
  }
}

const correoValido = (v: unknown) => typeof v === "string" && /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(v.trim())

export async function invitarBlog(c: MedusaContainer, modo: string, correo?: string) {
  const logger = c.resolve("logger")
  const lista = await instructores(c)
  const pendientes = lista.filter((x) => !x.invitado)
  const wa = whatsappInvitacion()

  if (modo === "ver") {
    return { ok: true, total: lista.length, pendientes: pendientes.map(({ nombre, email, cursos }) => ({ nombre, email, cursos })), ya_invitados: lista.length - pendientes.length }
  }
  if (modo === "prueba") {
    if (!correoValido(correo)) return { ok: false, error: "Falta un correo válido para la prueba." }
    const m = correoInvitacion("Taller de prueba")
    const r = await sendEmail({ to: correo!.trim(), subject: `[PRUEBA] ${m.asunto}`, html: m.html })
    const textoWa = `*${wa.titulo}*\n${wa.cuerpo}\n\n${wa.url}\n\n_Escribe BAJA para no recibir avisos._`
    return { ok: r.sent, correo_enviado: r.sent, motivo: r.sent ? undefined : r.reason, whatsapp: textoWa, se_mandaria_a: pendientes.length }
  }
  if (modo === "enviar") {
    const knex = c.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
    const lote = pendientes.slice(0, MAX_POR_CORRIDA)
    const enviados: { nombre: string; correo: boolean; whatsapp: boolean }[] = []
    for (const t of lote) {
      // Se anota ANTES de mandar: si algo falla a la mitad, nunca se manda dos veces.
      const marcado = await knex.raw(
        `update seller set metadata = coalesce(metadata, '{}'::jsonb) || ?::jsonb where id = ? and coalesce(metadata->>'invitacion_blog_at','') = '' returning id`,
        [JSON.stringify({ invitacion_blog_at: new Date().toISOString() }), t.id]
      )
      if (!marcado?.rows?.length) continue
      let okCorreo = false
      if (t.email) {
        const m = correoInvitacion(t.nombre)
        const r = await sendEmail({ to: t.email, subject: m.asunto, html: m.html }).catch(() => ({ sent: false }) as any)
        okCorreo = !!r.sent
        if (!r.sent) logger.warn(`[invitacion-blog] correo a ${t.id} no enviado: ${r.reason || "error"}`)
      }
      const okWa = (await avisarWhatsapp(knex, { sellerIds: [t.id] }, wa, logger)) > 0
      enviados.push({ nombre: t.nombre, correo: okCorreo, whatsapp: okWa })
    }
    return { ok: true, enviados, faltan: Math.max(0, pendientes.length - lote.length) }
  }
  return { ok: false, error: "Modo no válido (ver, prueba o enviar)." }
}
