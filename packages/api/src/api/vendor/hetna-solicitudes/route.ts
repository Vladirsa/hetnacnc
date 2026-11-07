import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  MOTIVOS_RESPUESTA,
  T_PROPUESTA,
  T_RESPUESTA,
  T_SOLICITUD,
  asegurarTablaRespuestas,
  asegurarTablas,
  folioTexto,
  ocultarContacto,
} from "../../../lib/licitacion"
import { servicioTalleres } from "../../../lib/alta-taller"
import { cupoLicitacion } from "../../../lib/licitacion-plan"
import { NOMBRE_ETAPA, asegurarSeguimiento, etapaDe } from "../../../lib/seguimiento"
import { PCT_POR_PLAN, asegurarCobro, cuentaTaller, planComision } from "../../../lib/licitacion-cobro"
import { asegurarExtra, preguntasDe, rangoGanador } from "../../../lib/licitacion-extra"

// Panel del taller: solicitudes que puede cotizar (abiertas + las dirigidas a él)
// y las que ya cotizó. Nunca incluye datos de contacto del cliente.
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })

  // Filtros del panel: por servicio y por estado de entrega. Sólo acotan lo
  // que está por cotizar; lo que el taller ya cotizó sale siempre.
  const servicio = String(req.query.servicio || "").trim().slice(0, 80)
  const estadoMx = String(req.query.estado_mx || "").trim().slice(0, 60)

  // "Ocultas" = las que este taller marcó como que no puede cotizar.
  const verOcultas = req.query.ocultas === "1"

  await asegurarTablas(knex)
  await asegurarTablaRespuestas(knex)
  await asegurarSeguimiento(knex)
  await asegurarCobro(knex)
  await asegurarExtra(knex)
  const filas = (await knex(`${T_SOLICITUD} as s`)
    .leftJoin(`${T_PROPUESTA} as p`, function (this: any) {
      this.on("p.solicitud_id", "=", "s.id").andOn("p.seller_id", "=", knex.raw("?", [sellerId]))
    })
    .leftJoin(`${T_RESPUESTA} as r`, function (this: any) {
      this.on("r.solicitud_id", "=", "s.id").andOn("r.seller_id", "=", knex.raw("?", [sellerId]))
    })
    .where((q: any) =>
      q
        .where((a: any) => a.where("s.modo", "abierta").orWhere("s.taller_id", sellerId))
        // Por cotizar = abierta y sin pasar su fecha de cierre (ver
        // recibePropuestas). Lo ya cotizado se ve siempre, aunque haya cerrado.
        .andWhere((a: any) =>
          a
            .where((x: any) =>
              x
                .where("s.estado", "abierta")
                .andWhere((c: any) => c.whereNull("s.cierra_en").orWhere("s.cierra_en", ">", knex.fn.now()))
                .modify((c: any) => {
                  // "Necesito más información" no la oculta: sigue pendiente.
                  if (!verOcultas) c.where((r: any) => r.whereNull("r.id").orWhere("r.motivo", "mas_info"))
                  if (servicio) c.whereRaw("s.trabajo->>'servicio' = ?", [servicio])
                  if (estadoMx) c.whereRaw("s.trabajo->>'estado_mx' = ?", [estadoMx])
                })
            )
            .orWhereNotNull("p.id")
        )
    )
    .orderBy("s.created_at", "desc")
    .limit(100)
    .select(
      "s.id", "s.folio", "s.modo", "s.taller_id", "s.estado", "s.trabajo", "s.cierra_en", "s.created_at",
      "s.etapa", "s.pago_estado", "s.paqueteria", "s.guia",
      "s.propuesta_elegida", "s.cobro", "s.comision_pct", "s.pagado",
      "p.id as p_id", "p.precio", "p.dias", "p.vigencia_dias", "p.incluye_envio", "p.condiciones", "p.estado as p_estado", "p.anticipo_pct",
      "r.motivo as r_motivo", "r.nota as r_nota"
    )) as any[]

  const conteos = (await knex(T_PROPUESTA)
    .whereIn("solicitud_id", filas.map((f) => f.id))
    .groupBy("solicitud_id")
    .select("solicitud_id")
    .count("* as n")) as { solicitud_id: string; n: string }[]
  const nPorSol = Object.fromEntries(conteos.map((c) => [c.solicitud_id, Number(c.n)]))

  // Propuesta ganadora de las que este taller perdió: sólo rango y días.
  const perdidas = filas.filter((f) => f.p_estado === "descartada" && f.propuesta_elegida)
  const ganadoras = perdidas.length
    ? ((await knex(T_PROPUESTA).whereIn("id", perdidas.map((f) => f.propuesta_elegida)).select("id", "precio", "dias")) as any[])
    : []
  const ganadoraPorId = Object.fromEntries(ganadoras.map((g) => [g.id, g]))

  // Preguntas: las ya contestadas (todas) y las mías sin contestar.
  const preguntasPorSol: Record<string, any[]> = {}
  await Promise.all(
    filas.map(async (f) => {
      const ps = await preguntasDe(knex, f.id, { sellerId }).catch(() => [])
      preguntasPorSol[f.id] = ps.filter((p: any) => p.respuesta || p.mia)
    })
  )

  const solicitudes = filas.map((f) => ({
    id: f.id,
    folio: folioTexto(f.folio),
    para_mi: f.taller_id === sellerId,
    estado: f.estado,
    // El seguimiento sólo le importa al taller que ganó; a los demás les
    // basta saber si sigue abierta.
    etapa: f.p_estado === "elegida" ? etapaDe(f) : null,
    etapa_nombre: f.p_estado === "elegida" ? NOMBRE_ETAPA[etapaDe(f)] : null,
    pagada: f.estado === "pagada" || f.pago_estado === "pagado",
    envio: f.p_estado === "elegida" ? { paqueteria: f.paqueteria || "", guia: f.guia || "" } : null,
    cierra_en: f.cierra_en,
    creada: f.created_at,
    // De los archivos sólo nombre y tamaño: la liga se pide aparte, firmada.
    trabajo: {
      ...f.trabajo,
      descripcion: ocultarContacto(f.trabajo?.descripcion || ""),
      archivos: (f.trabajo?.archivos || []).map((a: any) => ({ nombre: a.nombre, tamano: a.tamano })),
    },
    mi_respuesta: f.r_motivo
      ? { motivo: f.r_motivo, texto: MOTIVOS_RESPUESTA[f.r_motivo] || f.r_motivo, nota: f.r_nota || "" }
      : null,
    propuestas_recibidas: nPorSol[f.id] || 0,
    preguntas: preguntasPorSol[f.id] || [],
    // Si perdió: rango del precio elegido y sus días (sin decir quién ganó)
    eleccion:
      f.p_estado === "descartada" && ganadoraPorId[f.propuesta_elegida]
        ? { ...rangoGanador(Number(ganadoraPorId[f.propuesta_elegida].precio)), dias: ganadoraPorId[f.propuesta_elegida].dias }
        : null,
    // Si ganó: cómo le pagan y cuánto lleva pagado el cliente
    cobro:
      f.p_estado === "elegida"
        ? { modo: f.cobro || null, comision_pct: f.comision_pct != null ? Number(f.comision_pct) : null, pagado: Number(f.pagado || 0) }
        : null,
    mi_propuesta: f.p_id
      ? {
          id: f.p_id,
          precio: Number(f.precio),
          dias: f.dias,
          vigencia_dias: f.vigencia_dias,
          incluye_envio: f.incluye_envio === "si",
          condiciones: f.condiciones || "",
          anticipo_pct: f.anticipo_pct ? Number(f.anticipo_pct) : 100,
          estado: f.p_estado,
        }
      : null,
  }))

  // Cupo de propuestas del mes según el plan; null = no se pudo saber (no se limita).
  const seller = await servicioTalleres(req.scope).retrieveSeller(sellerId).catch(() => null)
  const cupo = seller ? await cupoLicitacion(knex, sellerId, seller).catch(() => null) : null

  // Cómo cobraría si gana: cuenta conectada en la app y comisión de su plan
  const cuenta = seller ? await cuentaTaller((seller as any).email).catch(() => null) : null
  const plan = seller ? await planComision(seller as any).catch(() => "gratis") : "gratis"
  const cobro_taller = {
    mercadopago: Boolean(cuenta?.mp),
    paypal: Boolean(cuenta?.paypal),
    comision_pct: PCT_POR_PLAN[plan] ?? 0,
  }

  return res.json({ solicitudes, cupo, cobro_taller })
}
