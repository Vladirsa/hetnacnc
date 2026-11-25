// GET /admin/hetna-clientes?estado=sin_confirmar|confirmados|todos&q=texto
// Cuentas de cliente con su estado de confirmación de correo (pantalla
// "Cuentas de clientes" del admin). Las sin confirmar dicen cuándo se borran
// solas (jobs/limpiar-cuentas-sin-confirmar.ts).
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { DIAS_PARA_CONFIRMAR } from "../../../jobs/limpiar-cuentas-sin-confirmar"
import { requiereVerificacion } from "../../../lib/verificar-correo"

const DIA = 24 * 60 * 60 * 1000
const meta = (m: unknown) => (typeof m === "string" ? JSON.parse(m) : m || {}) as Record<string, unknown>

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const estado = String(req.query.estado || "sin_confirmar")
  const q = String(req.query.q || "").trim().toLowerCase().slice(0, 80)

  const base = knex("customer as c").where("c.has_account", true).whereNull("c.deleted_at")
  if (q) {
    base.where((w: any) =>
      w.whereRaw("lower(c.email) like ?", [`%${q}%`])
        .orWhereRaw("lower(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')) like ?", [`%${q}%`])
    )
  }
  const filas = await base
    .select(
      "c.id", "c.email", "c.first_name", "c.last_name", "c.phone", "c.created_at", "c.has_account", "c.metadata",
      knex.raw(`(select count(*)::int from "order" o where o.customer_id = c.id and o.deleted_at is null) as pedidos`)
    )
    .orderBy("c.created_at", "desc")
    .limit(2000)

  const todas = filas.map((f: any) => {
    const m = meta(f.metadata)
    const falta = requiereVerificacion({ ...f, metadata: m })
    const pedidos = Number(f.pedidos) || 0
    return {
      id: f.id,
      email: f.email,
      nombre: [f.first_name, f.last_name].filter(Boolean).join(" ").trim(),
      telefono: f.phone || "",
      creado: f.created_at,
      pedidos,
      confirmado: !falta,
      // Cuentas de antes de pedir confirmación: no tienen fecha, pero cuentan como confirmadas
      confirmado_en: (m.correo_verificado_en as string) || null,
      se_borra: falta && !pedidos ? new Date(new Date(f.created_at).getTime() + DIAS_PARA_CONFIRMAR * DIA).toISOString() : null,
    }
  })
  const cuentas = {
    sin_confirmar: todas.filter((c: any) => !c.confirmado).length,
    confirmados: todas.filter((c: any) => c.confirmado).length,
    todos: todas.length,
  }
  const lista = estado === "confirmados" ? todas.filter((c: any) => c.confirmado)
    : estado === "todos" ? todas
    : todas.filter((c: any) => !c.confirmado)
  res.json({ cuentas, dias_para_confirmar: DIAS_PARA_CONFIRMAR, clientes: lista.slice(0, 300) })
}
