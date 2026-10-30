import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_ENVIO, asegurarTablasEnvio, evidenciaCompleta, folioEnvio, leerEvidencia, numeroFolio } from "../../../lib/envios"
import { T_GUIAS, asegurarTablaGuias, evidenciaGuiaCompleta } from "../../../lib/guias"
import {
  ESTADOS_SOBREPESO,
  T_SOBREPESO,
  asegurarTablaSobrepesos,
  cobrarSobrepeso,
  folioSobrepeso,
  nuevoSobrepesoId,
} from "../../../lib/sobrepesos"

// Sobrepesos que reportó la paquetería (Skydropx ya se los cobró a HETNA).
//   GET  /admin/hetna-sobrepesos?estado=por_cobrar
//   POST /admin/hetna-sobrepesos  { tipo: "envio"|"guia", folio, kg_cotizado, kg_reportado, monto, nota, disputar }
//     tipo "envio": folio ENV-00012 (Envíos HETNA) -> lo paga el cliente
//     tipo "guia":  número de pedido de la tienda (#123) -> lo paga el taller

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablaSobrepesos(knex)
  const estado = String((req.query as any)?.estado || "")
  let q = knex(T_SOBREPESO).orderBy("created_at", "desc").limit(200)
  if (estado in ESTADOS_SOBREPESO) q = q.where({ estado })
  const filas = await q
  const totales = await knex(T_SOBREPESO).select("estado").sum({ monto: "monto" }).count({ n: "*" }).groupBy("estado")
  return res.json({
    sobrepesos: filas.map((s: any) => ({
      id: s.id,
      folio: folioSobrepeso(s.folio),
      tipo: s.tipo,
      referencia: s.referencia,
      responsable_tipo: s.responsable_tipo,
      responsable_nombre: s.responsable_nombre,
      responsable_email: s.responsable_email,
      kg_cotizado: s.kg_cotizado != null ? Number(s.kg_cotizado) : null,
      kg_reportado: s.kg_reportado != null ? Number(s.kg_reportado) : null,
      monto: Number(s.monto),
      nota: s.nota,
      estado: s.estado,
      estado_nombre: ESTADOS_SOBREPESO[s.estado as keyof typeof ESTADOS_SOBREPESO] || s.estado,
      evidencia_completa: s.evidencia_completa,
      pago_url: s.pago_url,
      pago_id: s.pago_id,
      created_at: s.created_at,
    })),
    totales: Object.fromEntries(totales.map((t: any) => [t.estado, { n: Number(t.n), monto: Number(t.monto) }])),
  })
}

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablaSobrepesos(knex)
  const b = (req.body || {}) as Record<string, unknown>
  const monto = num(b.monto)
  if (!monto) return res.status(400).json({ message: "Escribe el monto que cobró la paquetería." })

  let datos: Record<string, unknown>
  if (b.tipo === "envio") {
    await asegurarTablasEnvio(knex)
    const n = numeroFolio(String(b.folio || ""))
    const e = n ? await knex(T_ENVIO).where({ folio: n }).first() : null
    if (!e) return res.status(404).json({ message: "No existe ese envío (ENV-…)." })
    const origen = typeof e.origen === "string" ? JSON.parse(e.origen) : e.origen
    const cliente = await knex("customer").where({ id: e.customer_id }).first("email", "first_name", "last_name")
    const paquete = typeof e.paquete === "string" ? JSON.parse(e.paquete) : e.paquete
    datos = {
      tipo: "envio",
      ref: e.id,
      referencia: folioEnvio(e.folio),
      responsable_tipo: "cliente",
      responsable_id: e.customer_id,
      responsable_email: cliente?.email || origen?.email || null,
      responsable_nombre: [cliente?.first_name, cliente?.last_name].filter(Boolean).join(" ") || origen?.nombre || null,
      kg_cotizado: num(b.kg_cotizado) ?? num(paquete?.peso_cobrado) ?? num(paquete?.peso),
      evidencia_completa: evidenciaCompleta(leerEvidencia(e.evidencia)),
    }
  } else if (b.tipo === "guia") {
    await asegurarTablaGuias(knex)
    const n = Number(String(b.folio || "").replace(/\D/g, ""))
    const pedido = n ? await knex("order").where({ display_id: n }).first("id") : null
    const g = pedido ? await knex(T_GUIAS).where({ order_id: pedido.id }).first() : null
    if (!g) return res.status(404).json({ message: "Ese pedido no tiene guía de Envíos HETNA." })
    const taller = await knex("seller").where({ id: g.seller_id }).first("email", "name")
    const cot = typeof g.cotizacion === "string" ? JSON.parse(g.cotizacion) : g.cotizacion
    datos = {
      tipo: "guia",
      ref: g.order_id,
      referencia: `Pedido #${n}`,
      responsable_tipo: "taller",
      responsable_id: g.seller_id,
      responsable_email: taller?.email || null,
      responsable_nombre: taller?.name || null,
      kg_cotizado: num(b.kg_cotizado) ?? num(cot?.paquete?.peso),
      evidencia_completa: evidenciaGuiaCompleta(g),
    }
  } else {
    return res.status(400).json({ message: "Elige si es un envío (ENV-…) o la guía de un pedido de taller." })
  }

  const id = nuevoSobrepesoId()
  const disputar = b.disputar === true
  await knex(T_SOBREPESO).insert({
    id,
    ...datos,
    kg_reportado: num(b.kg_reportado),
    monto,
    nota: String(b.nota || "").trim().slice(0, 500) || null,
    estado: disputar ? "en_disputa" : "por_cobrar",
  })
  const s = await knex(T_SOBREPESO).where({ id }).first()
  let resultado: { pago_url: string | null; correo: boolean } = { pago_url: null, correo: false }
  if (!disputar) resultado = await cobrarSobrepeso(knex, s, logger)
  logger.info(`[sobrepesos] ${folioSobrepeso(s.folio)} registrado (${s.referencia}, $${monto}, ${disputar ? "en disputa" : "por cobrar"})`)
  return res.json({ ok: true, folio: folioSobrepeso(s.folio), ...resultado, evidencia_completa: s.evidencia_completa })
}
