import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { preguntasDe } from "../../../../lib/licitacion-extra"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_PROPUESTA, T_SOLICITUD, asegurarTablas, numeroDeFolio, trabajoPublico } from "../../../../lib/licitacion"
import { asegurarPrivacidad, trabajoPublicoPrivado } from "../../../../lib/licitacion-privacidad"
import { asegurarPropuestaFormal } from "../../../../lib/licitacion-propuesta"

// Un trabajo del tablero público, por folio (HET-00012). Se sigue enseñando
// después de cerrar -- con su estado -- para que una liga compartida en redes
// no termine en un 404, pero nunca con datos del cliente.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const numero = numeroDeFolio(String(req.params.folio || ""))
  if (!numero) return res.status(404).json({ message: "Trabajo no encontrado." })

  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablas(knex)
  await asegurarPrivacidad(knex)
  await asegurarPropuestaFormal(knex)

  const s = await knex(T_SOLICITUD)
    .where({ folio: numero, modo: "abierta" })
    // Licitaciones 3.0: las privadas no salen en el tablero público
    .whereNot({ modalidad: "privada" })
    // En revisión todavía no es pública: HETNA no la ha aprobado.
    .whereNot({ estado: "revision" })
    .first("id", "folio", "estado", "trabajo", "cierra_en", "created_at", "modalidad", "privacidad", "contacto", "tipo")
  if (!s) return res.status(404).json({ message: "Trabajo no encontrado." })

  const [{ n }] = (await knex(T_PROPUESTA).where({ solicitud_id: s.id }).count("* as n")) as { n: string }[]
  // Preguntas ya contestadas por el cliente: las ve cualquier taller interesado.
  const preguntas = (await preguntasDe(knex, s.id, { soloRespondidas: true }).catch(() => [])).map((p: any) => ({
    pregunta: p.pregunta,
    respuesta: p.respuesta,
    fecha: p.respondida_en,
  }))
  res.json({ trabajo: { ...trabajoPublico({ ...s, propuestas: Number(n) || 0 }), ...trabajoPublicoPrivado(s), preguntas } })
}
