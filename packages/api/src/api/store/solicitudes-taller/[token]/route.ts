import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_PROPUESTA, T_SOLICITUD, asegurarTablas, folioTexto, ocultarContacto, pesoPlan } from "../../../../lib/licitacion"

// Vista privada del cliente: su solicitud y las propuestas recibidas.
// Solo con el token secreto que le llegó por correo. Sin datos de contacto de nadie.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const token = String(req.params.token || "")
  if (token.length < 32) return res.status(404).json({ message: "Solicitud no encontrada." })

  await asegurarTablas(knex)
  const s = await knex(T_SOLICITUD).where({ token }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })

  const props = (await knex(`${T_PROPUESTA} as p`)
    .join("seller as v", "v.id", "p.seller_id")
    .where("p.solicitud_id", s.id)
    .select(
      "p.id", "p.precio", "p.dias", "p.vigencia_dias", "p.incluye_envio", "p.condiciones", "p.estado", "p.created_at",
      "v.name as taller", "v.handle", "v.metadata"
    )) as any[]

  const propuestas = props
    .map((p) => {
      const perfil = p.metadata?.perfil || {}
      return {
        id: p.id,
        precio: Number(p.precio),
        dias: p.dias,
        vigencia_dias: p.vigencia_dias,
        incluye_envio: p.incluye_envio === "si",
        condiciones: p.condiciones ? ocultarContacto(p.condiciones) : "",
        estado: p.estado,
        fecha: p.created_at,
        taller: { nombre: p.taller, handle: p.handle, estado: perfil.estado || "", calificacion: perfil.calificacion ?? null },
        destacado: pesoPlan(p.metadata) > 0,
        _peso: pesoPlan(p.metadata),
      }
    })
    // Talleres con membresía primero; luego el más barato.
    .sort((a, b) => b._peso - a._peso || a.precio - b.precio)
    .map(({ _peso, ...p }) => p)

  return res.json({
    folio: folioTexto(s.folio),
    modo: s.modo,
    estado: s.estado,
    creada: s.created_at,
    cierra_en: s.cierra_en,
    trabajo: s.trabajo,
    propuesta_elegida: s.propuesta_elegida,
    pago_url: s.estado === "elegida" && s.pago_estado !== "pagado" ? s.pago_url || null : null,
    pago_estado: s.pago_estado || null,
    propuestas,
  })
}
