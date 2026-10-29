// POST /store/foro/aviso  { titulo, ruta, seccion, estado_mx? }
// Se llama al publicar una pregunta o un "Busco maquinado" en el foro: avisa
// por correo a los talleres que hacen ese trabajo (y primero a los de su
// estado), para que respondan. Responder les da visibilidad, y a la persona
// que preguntó le llega ayuda de quien sí sabe.
//
// Con sesión de cliente y con tope por persona, para que nadie use el foro
// para mandar correos a los talleres. La liga sólo puede ser del foro.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { estaDeBaja, ligaBaja } from "../../../../lib/baja"
import { STORE_URL, boton, esc, marco } from "../../../../lib/licitacion"
import { sendEmail } from "../../../../lib/resend"

// Sección del foro → servicios del perfil del taller (los mismos nombres que
// usan las solicitudes). Las secciones generales no avisan a nadie.
const SERVICIOS_POR_SECCION: Record<string, string[]> = {
  "router-cnc": ["Corte CNC", "Fresado de madera"],
  "corte-laser": ["Corte láser", "Grabado"],
  plasma: ["Corte plasma"],
  "torno-fresadora": ["Maquinado", "Fresado de metal"],
  "impresion-3d": ["Impresión 3D"],
  "diseno-cam": ["Diseño CAD/CAM"],
}
const MAX_TALLERES = 25
const POR_HORA = 3
const avisos = new Map<string, number[]>()
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const b = (req.body || {}) as Record<string, string>
  const titulo = String(b.titulo || "").trim().slice(0, 150)
  const ruta = String(b.ruta || "")
  const seccion = String(b.seccion || "")
  const estadoMx = String(b.estado_mx || "").slice(0, 60)
  const servicios = SERVICIOS_POR_SECCION[seccion]

  if (!titulo || !/^\/foro-cnc\/[a-z0-9-]+\/[a-z0-9-]+$/.test(ruta)) {
    return res.status(400).json({ message: "Aviso no válido." })
  }
  if (!servicios) return res.json({ ok: true, avisados: 0 })

  const quien = req.auth_context.actor_id
  const ahora = Date.now()
  const previos = (avisos.get(quien) || []).filter((t) => ahora - t < 3600_000)
  if (previos.length >= POR_HORA) return res.json({ ok: true, avisados: 0 })
  avisos.set(quien, [...previos, ahora])

  const talleres = (await knex("seller")
    .whereNull("deleted_at")
    .whereNotNull("email")
    .limit(500)
    .select("email", "name", "metadata")) as { email: string; name: string; metadata: any }[]
  const hacenEsto = talleres
    .filter((t) => {
      const suyos: string[] = t.metadata?.perfil?.servicios || []
      return suyos.some((s) => servicios.includes(s))
    })
    .sort((x, y) => Number(y.metadata?.perfil?.estado === estadoMx) - Number(x.metadata?.perfil?.estado === estadoMx))
    .slice(0, MAX_TALLERES)

  res.json({ ok: true, avisados: hacenEsto.length })

  const liga = `${STORE_URL}/mx${ruta}`
  let enviados = 0
  for (const t of hacenEsto) {
    if (await estaDeBaja(knex, t.email)) continue
    const r = await sendEmail({
      to: t.email,
      subject: `Pregunta en el Foro CNC que tu taller puede responder`,
      html: marco(
        "Alguien necesita a alguien que sepa",
        `<p style="margin:0 0 12px;color:#40403A">Hola ${esc(t.name)}, en el Foro CNC de HETNA preguntaron algo de tu especialidad${
          estadoMx && t.metadata?.perfil?.estado === estadoMx ? ` <strong>en ${esc(estadoMx)}</strong>` : ""
        }:</p>` +
          `<p style="margin:0 0 12px;font-size:16px;color:#142033"><strong>${esc(titulo)}</strong></p>` +
          `<p style="margin:0 0 12px;color:#40403A">Responder suma puntos a tu perfil, te pone en "Los que más ayudan" y la persona ve tu taller.</p>` +
          boton("Ver y responder", liga)
      ),
      bajaUrl: ligaBaja(t.email),
    })
    if (r.sent) enviados += 1
    await pausa(600)
  }
  logger.info(`[foro] aviso de "${titulo.slice(0, 60)}" a ${enviados} talleres`)
}
