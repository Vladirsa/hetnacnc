// POST /store/solicitudes-taller/:token/analisis
// Licitaciones 3.0 (Fase 2): resumen de las propuestas escrito por IA para el
// cliente (lib/licitacion-ia.ts). Se guarda en hetna_solicitud.analisis con la
// "huella" de las propuestas: mientras no cambien, se reusa y no se vuelve a
// pagar la IA. La IA no elige ganador.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_PROPUESTA, T_SOLICITUD, asegurarTablas, ocultarContacto } from "../../../../../lib/licitacion"
import { iaDisponible, resumirPropuestas } from "../../../../../lib/licitacion-ia"
import { esMiembroEmpresarial } from "../../../../../lib/confianza"
import { type PropuestaComparable, asegurarPropuestaFormal, huellaPropuestas } from "../../../../../lib/licitacion-propuesta"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger") as any
  await asegurarTablas(knex)
  await asegurarPropuestaFormal(knex)
  const s = await knex(T_SOLICITUD).where({ token: String(req.params.token || "") }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  if (!iaDisponible()) return res.json({ disponible: false, resumen: null })
  // Fase 3: el resumen con IA es de la Membresía Empresarial
  if (!(await esMiembroEmpresarial(knex, { customerId: s.cliente_id, email: s.contacto?.email }))) {
    return res.json({ disponible: true, resumen: null, empresarial: true, motivo: "El resumen con IA es parte de la Membresía Empresarial (gratis por ahora). Escríbenos y te la activamos." })
  }

  const filas = (await knex(`${T_PROPUESTA} as p`)
    .join("seller as v", "v.id", "p.seller_id")
    .where("p.solicitud_id", s.id)
    .orderBy("p.created_at", "asc")
    .select("p.*", "v.name as taller", "v.metadata")) as any[]
  if (filas.length < 2) return res.json({ disponible: true, resumen: null, motivo: "Se necesitan al menos dos propuestas para comparar." })

  const lista: PropuestaComparable[] = filas.map((p) => ({
    id: p.id,
    taller: p.taller,
    precio: Number(p.precio),
    moneda: p.moneda || "MXN",
    dias: p.dias,
    incluye_envio: p.incluye_envio === "si",
    anticipo_pct: p.anticipo_pct ? Number(p.anticipo_pct) : 100,
    materiales: p.materiales,
    operaciones: p.operaciones,
    fecha_entrega: p.fecha_entrega ? new Date(p.fecha_entrega).toISOString().slice(0, 10) : null,
    condiciones_pago: p.condiciones_pago,
    garantia: p.garantia,
    observaciones: p.observaciones,
    condiciones: p.condiciones ? ocultarContacto(p.condiciones) : null,
    calificacion: p.metadata?.perfil?.calificacion ?? null,
    verificado: p.metadata?.verificado === true,
    adjuntos: Array.isArray(p.adjuntos) ? p.adjuntos.length : 0,
  }))
  const huella = huellaPropuestas(lista)
  if (s.analisis?.huella === huella && s.analisis?.resumen) return res.json({ disponible: true, resumen: s.analisis.resumen, guardado: true })

  const resumen = await resumirPropuestas(s.trabajo || {}, lista, logger)
  if (resumen) {
    await knex(T_SOLICITUD)
      .where({ id: s.id })
      .update({ analisis: JSON.stringify({ huella, resumen, creado: new Date().toISOString() }) })
      .catch(() => undefined)
  }
  res.json({ disponible: true, resumen })
}
